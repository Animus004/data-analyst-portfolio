/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getSupabaseClient } from "./storageService";

export interface UploadedPackageFileMeta {
  name: string;
  storagePath: string;
  size: number;
  type: string;
  detectedType?: string;
  publicUrl?: string;
  fallbackContent?: string;
}

export interface PackageUploadFile {
  fileObject: File;
  name: string;
  size: number;
  type: string;
  detectedType?: string;
}

export interface PackageUploadProgress {
  fileName: string;
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
  status: "idle" | "pending" | "uploading" | "completed" | "error";
  errorMsg?: string;
}

export type UploadProgressMap = Record<string, PackageUploadProgress>;

const STORAGE_BUCKET = "portfolio-uploads";
const MAX_INLINE_FALLBACK_SIZE = 4.5 * 1024 * 1024; // 4.5 MB threshold for inline Base64 payload

export type StorageErrorCategory = 
  | "bucket_not_found"
  | "permission_denied"
  | "invalid_path"
  | "network_error"
  | "object_not_found"
  | "unknown";

/**
 * Categorizes Supabase storage errors to accurately distinguish root causes.
 */
export function categorizeStorageError(error: any): { category: StorageErrorCategory; message: string } {
  if (!error) {
    return { category: "unknown", message: "Unknown error" };
  }

  const rawMessage = typeof error === "string" ? error : error.message || JSON.stringify(error);
  const msg = rawMessage.toLowerCase();
  const statusCode = String(error.statusCode || error.status || error.code || "").toLowerCase();

  if (
    msg.includes("bucket not found") ||
    msg.includes("bucket does not exist") ||
    (statusCode === "404" && msg.includes("bucket"))
  ) {
    return { category: "bucket_not_found", message: rawMessage };
  }

  if (
    msg.includes("row-level security") ||
    msg.includes("permission denied") ||
    msg.includes("access denied") ||
    msg.includes("unauthorized") ||
    statusCode === "401" ||
    statusCode === "403" ||
    statusCode === "42501"
  ) {
    return { category: "permission_denied", message: rawMessage };
  }

  if (
    msg.includes("invalid path") ||
    msg.includes("invalid key") ||
    msg.includes("key name invalid") ||
    (msg.includes("path") && msg.includes("invalid"))
  ) {
    return { category: "invalid_path", message: rawMessage };
  }

  if (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("econnrefused") ||
    msg.includes("network request failed")
  ) {
    return { category: "network_error", message: rawMessage };
  }

  if (
    msg.includes("object not found") ||
    msg.includes("not_found") ||
    (statusCode === "404" && (msg.includes("object") || msg.includes("file") || msg.includes("resource")))
  ) {
    return { category: "object_not_found", message: rawMessage };
  }

  return { category: "unknown", message: rawMessage };
}

/**
 * Verifies if the dedicated Supabase Storage bucket is operational and accessible.
 */
export async function verifyUploadBucket(): Promise<{ exists: boolean; message?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { exists: false, message: "Supabase client is not initialized. Check environment credentials." };
  }

  try {
    const { error } = await client.storage
      .from(STORAGE_BUCKET)
      .list("", { limit: 1 });

    if (error) {
      const { category, message } = categorizeStorageError(error);
      console.warn(`[packageUploadService] Storage bucket '${STORAGE_BUCKET}' validation notice [${category}]: ${message}`);

      if (category === "bucket_not_found") {
        return {
          exists: false,
          message: `Storage bucket '${STORAGE_BUCKET}' was not found. Please create it in your Supabase Dashboard under Storage -> New Bucket (Public, 50MB limit) or run the provided SQL setup script.`
        };
      }

      if (category === "permission_denied") {
        console.info(`[packageUploadService] Root listing restricted by RLS for '${STORAGE_BUCKET}'. Direct file operations will be attempted.`);
        return { exists: true };
      }

      return {
        exists: false,
        message: `Storage validation warning (${category}): ${message}`
      };
    }

    return { exists: true };
  } catch (err: any) {
    console.error(`[packageUploadService] Exception checking storage bucket '${STORAGE_BUCKET}':`, err);
    return { exists: false, message: err.message || "Unexpected exception during storage bucket check." };
  }
}

/**
 * Converts any browser File object to Base64 in chunked memory blocks.
 */
async function readArrayBufferAsBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000; // 32KB chunks to prevent stack overflow
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize) as any);
  }
  return btoa(binary);
}

/**
 * Attempts storage upload with exponential retries (1s, 2s, 4s).
 */
async function uploadWithRetry(
  client: any,
  storagePath: string,
  fileObject: File,
  contentType: string,
  maxRetries: number = 3
): Promise<{ data: any; error: any }> {
  let lastError: any = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const { data, error } = await client.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileObject, {
        contentType,
        upsert: true
      });
    if (!error && data) {
      if (attempt > 1) {
        console.log(`[packageUploadService] Storage upload for '${fileObject.name}' succeeded on retry attempt ${attempt}/${maxRetries}.`);
      }
      return { data, error: null };
    }
    lastError = error;
    console.warn(`[packageUploadService] Storage upload attempt ${attempt}/${maxRetries} failed for '${fileObject.name}':`, error?.message);
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 500));
    }
  }
  return { data: null, error: lastError };
}

/**
 * SINGLE SHARED FILE DESCRIPTOR BUILDER
 * Constructs a unified UploadedPackageFileMeta for EVERY file type (Excel, PDF, DOCX, Markdown, PNG, JPG, ZIP, SQL, JSON, etc.)
 */
export async function buildPackageFileDescriptor(
  file: PackageUploadFile,
  packageId: string,
  storagePathOverride?: string,
  storageUploadSuccess: boolean = false
): Promise<UploadedPackageFileMeta> {
  const fileName = file.name;
  const mimeType = file.type || file.fileObject.type || "application/octet-stream";
  const size = file.size || file.fileObject.size;

  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = storagePathOverride || `uploads/default/${packageId}/${sanitizedFileName}`;

  const isSmallFile = size <= MAX_INLINE_FALLBACK_SIZE;
  let fallbackContent: string | undefined = undefined;

  // Include Base64 fallbackContent for small files (<=4.5MB) OR if storage upload failed
  if (isSmallFile || !storageUploadSuccess) {
    try {
      fallbackContent = await readArrayBufferAsBase64(file.fileObject);
    } catch (b64Err: any) {
      console.warn(`[SingleSharedBuilder] Base64 encoding warning for '${fileName}':`, b64Err.message);
    }
  }

  const descriptor: UploadedPackageFileMeta = {
    name: fileName,
    storagePath,
    size,
    type: mimeType,
    detectedType: file.detectedType || mimeType,
    fallbackContent
  };

  const hasStoragePath = Boolean(descriptor.storagePath && descriptor.storagePath.trim().length > 0);
  const hasFallback = Boolean(descriptor.fallbackContent && descriptor.fallbackContent.trim().length > 0);
  const isDescriptorValid = hasStoragePath || hasFallback;

  console.log(`[SHARED DESCRIPTOR BUILDER AUDIT]`);
  console.log(`  - filename: "${fileName}"`);
  console.log(`  - mimeType: "${mimeType}"`);
  console.log(`  - size: ${size} bytes (${(size / (1024 * 1024)).toFixed(2)} MB)`);
  console.log(`  - storagePath: "${storagePath}"`);
  console.log(`  - fallbackContent exists? ${hasFallback ? "YES" : "NO"}`);
  console.log(`  - descriptor valid? ${isDescriptorValid ? "VALID ✓" : "INVALID ❌"}`);

  return descriptor;
}

/**
 * PACKAGE-WIDE CLIENT VALIDATION ENGINE
 * Verifies all file descriptors in a package before sending HTTP request to /api/portfolio/ai-package-parse.
 */
export function validatePackageFileDescriptors(descriptors: UploadedPackageFileMeta[]): {
  isValid: boolean;
  invalidFiles: string[];
  auditLogs: string[];
} {
  const auditLogs: string[] = [];
  const invalidFiles: string[] = [];

  console.log(`\n==========================================================`);
  console.log(`[PACKAGE-WIDE CLIENT VALIDATION AUDIT]`);
  console.log(`Total Descriptors: ${descriptors.length}`);
  console.log(`==========================================================\n`);

  for (const d of descriptors) {
    const hasStoragePath = Boolean(d.storagePath && d.storagePath.trim().length > 0);
    const hasFallback = Boolean(d.fallbackContent && d.fallbackContent.trim().length > 0);
    const isValid = hasStoragePath || hasFallback;

    const logLine = `- File: "${d.name}" | mimeType: "${d.type || "unknown"}" | size: ${d.size} bytes | storagePath: "${d.storagePath || "NONE"}" | fallbackContent exists? ${hasFallback ? "YES" : "NO"} | descriptor valid? ${isValid ? "VALID ✓" : "INVALID ❌"}`;
    console.log(logLine);
    auditLogs.push(logLine);

    if (!isValid) {
      invalidFiles.push(d.name);
    }
  }

  const allValid = invalidFiles.length === 0 && descriptors.length > 0;
  console.log(`\n[PACKAGE-WIDE VALIDATION RESULT] ${allValid ? "PASSED ALL CHECKS ✓" : `FAILED ❌ (${invalidFiles.length} invalid files)`}\n`);

  return {
    isValid: allValid,
    invalidFiles,
    auditLogs
  };
}

/**
 * Main Upload Function using Single Shared Builder for every file type.
 */
export async function uploadProjectPackage(
  packageId: string,
  files: PackageUploadFile[],
  onProgress?: (progressMap: UploadProgressMap) => void
): Promise<{ success: boolean; uploadedFiles?: UploadedPackageFileMeta[]; error?: string }> {
  const client = getSupabaseClient();
  const progressMap: UploadProgressMap = {};

  console.log(`\n==========================================================`);
  console.log(`[UPLOAD PIPELINE AUDIT - STAGE 1] Browser File Selection`);
  console.log(`Package ID: ${packageId}`);
  console.log(`Total Files Selected: ${files.length}`);
  console.log(`==========================================================\n`);

  files.forEach(f => {
    progressMap[f.name] = {
      fileName: f.name,
      bytesUploaded: 0,
      totalBytes: f.size,
      percentage: 0,
      status: "pending"
    };
    const isLarge = f.size > MAX_INLINE_FALLBACK_SIZE;
    console.log(`[STAGE 1 File] Name: "${f.name}" | mimeType: "${f.type || "unknown"}" | size: ${f.size} bytes (${(f.size / (1024 * 1024)).toFixed(2)} MB) | Mode: ${isLarge ? "Storage Stream (>4.5MB)" : "Dual Storage/Fallback (<=4.5MB)"}`);
  });

  if (onProgress) onProgress({ ...progressMap });

  // In-memory fallback mode if Supabase keys are unconfigured
  if (!client) {
    console.warn("[Upload Pipeline Audit] Supabase Storage unconfigured. Using in-memory fallback.");
    const fallbackFiles: UploadedPackageFileMeta[] = [];
    for (const f of files) {
      progressMap[f.name].status = "uploading";
      if (onProgress) onProgress({ ...progressMap });

      const descriptor = await buildPackageFileDescriptor(f, packageId, undefined, false);
      fallbackFiles.push(descriptor);

      progressMap[f.name].bytesUploaded = f.size;
      progressMap[f.name].percentage = 100;
      progressMap[f.name].status = "completed";
      if (onProgress) onProgress({ ...progressMap });
    }

    return {
      success: true,
      uploadedFiles: fallbackFiles
    };
  }

  const bucketCheck = await verifyUploadBucket();
  if (!bucketCheck.exists) {
    console.warn("Storage bucket check warning:", bucketCheck.message);
  }

  const uploadedFiles: UploadedPackageFileMeta[] = [];

  for (const f of files) {
    try {
      progressMap[f.name].status = "uploading";
      if (onProgress) onProgress({ ...progressMap });

      const sanitizedFileName = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `uploads/default/${packageId}/${sanitizedFileName}`;

      const { data, error } = await uploadWithRetry(
        client,
        storagePath,
        f.fileObject,
        f.type || "application/octet-stream",
        3
      );

      const resolvedStoragePath = data?.path || storagePath;
      const isStorageSuccess = Boolean(!error && data);

      if (error) {
        const { category, message } = categorizeStorageError(error);
        console.warn(`[packageUploadService] Storage upload failed for '${f.name}' after 3 retries [Category: ${category}]: ${message}`);
        
        if (f.size > MAX_INLINE_FALLBACK_SIZE) {
          throw new Error(`Failed to upload large file '${f.name}' (${(f.size / (1024 * 1024)).toFixed(2)} MB) to storage after 3 retries: ${message}`);
        }
      }

      // Build Descriptor via Single Shared Descriptor Builder for EVERY file type!
      const descriptor = await buildPackageFileDescriptor(f, packageId, resolvedStoragePath, isStorageSuccess);

      progressMap[f.name].bytesUploaded = f.size;
      progressMap[f.name].percentage = 100;
      progressMap[f.name].status = "completed";
      if (onProgress) onProgress({ ...progressMap });

      uploadedFiles.push(descriptor);
    } catch (err: any) {
      console.error(`Exception uploading file ${f.name}:`, err);
      progressMap[f.name].status = "error";
      progressMap[f.name].errorMsg = err.message;
      if (onProgress) onProgress({ ...progressMap });
    }
  }

  // Perform Package-Wide Validation on Client
  const clientValidation = validatePackageFileDescriptors(uploadedFiles);
  if (!clientValidation.isValid) {
    return {
      success: false,
      error: `Package-wide client descriptor validation failed. Invalid descriptor for file(s): ${clientValidation.invalidFiles.join(", ")}.`
    };
  }

  return {
    success: uploadedFiles.length > 0,
    uploadedFiles
  };
}
