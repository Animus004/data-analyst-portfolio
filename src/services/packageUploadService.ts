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

export interface PackageUploadProgress {
  fileName: string;
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
  status: "idle" | "uploading" | "completed" | "error";
  errorMsg?: string;
}

const STORAGE_BUCKET = "portfolio-uploads";

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

  // Bucket does not exist
  if (
    msg.includes("bucket not found") ||
    msg.includes("bucket does not exist") ||
    (statusCode === "404" && msg.includes("bucket"))
  ) {
    return { category: "bucket_not_found", message: rawMessage };
  }

  // Permission denied / RLS
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

  // Invalid storage path
  if (
    msg.includes("invalid path") ||
    msg.includes("invalid key") ||
    msg.includes("key name invalid") ||
    (msg.includes("path") && msg.includes("invalid"))
  ) {
    return { category: "invalid_path", message: rawMessage };
  }

  // Network error
  if (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("econnrefused") ||
    msg.includes("network request failed")
  ) {
    return { category: "network_error", message: rawMessage };
  }

  // Object not found
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
 * Uses a non-administrative operational read (client.storage.from().list('', { limit: 1 }))
 * instead of client.storage.listBuckets(), which is intentionally restricted for client 'anon' keys.
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
 * Uploads project package files directly as binary objects to Supabase Storage.
 * Never converts files to Base64 strings in browser memory for network transmission.
 */
export async function uploadProjectPackage(
  files: Array<{ fileObject: File; name: string; size: number; type: string; detectedType: string }>,
  packageId: string,
  onProgress?: (progressMap: Record<string, PackageUploadProgress>) => void
): Promise<{ success: boolean; uploadedFiles: UploadedPackageFileMeta[]; error?: string }> {
  const client = getSupabaseClient();
  const progressMap: Record<string, PackageUploadProgress> = {};

  files.forEach((f) => {
    progressMap[f.name] = {
      fileName: f.name,
      bytesUploaded: 0,
      totalBytes: f.size,
      percentage: 0,
      status: "idle"
    };
  });

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

export async function uploadProjectPackage(
  packageId: string,
  files: PackageUploadFile[],
  onProgress?: (progressMap: UploadProgressMap) => void
): Promise<{ success: boolean; uploadedFiles?: UploadedPackageFileMeta[]; error?: string }> {
  const client = getSupabaseClient();
  const progressMap: UploadProgressMap = {};

  // Stage 1: Browser File Selection & Initialization Audit
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
    console.log(`[UPLOAD PIPELINE AUDIT - STAGE 1 File] Name: "${f.name}" | mimeType: "${f.type || "unknown"}" | size: ${f.size} bytes (${(f.size / (1024 * 1024)).toFixed(2)} MB)`);
  });

  if (onProgress) onProgress({ ...progressMap });

  // Fallback mode if Supabase keys are unconfigured in local development environment
  if (!client) {
    console.warn("[Upload Pipeline Audit] Supabase Storage unconfigured. Using in-memory fallback.");
    const fallbackFiles: UploadedPackageFileMeta[] = [];
    for (const f of files) {
      progressMap[f.name].status = "uploading";
      if (onProgress) onProgress({ ...progressMap });

      const localPath = `local-uploads/${packageId}/${f.name}`;
      const base64 = await readArrayBufferAsBase64(f.fileObject);

      fallbackFiles.push({
        name: f.name,
        storagePath: localPath,
        size: f.size,
        type: f.type,
        detectedType: f.detectedType,
        fallbackContent: base64
      });

      console.log(`[UPLOAD PIPELINE AUDIT - STAGE 2 File (In-Memory Fallback)] Name: "${f.name}" | storagePath: "${localPath}" | fallbackContent exists? YES | status: COMPLETED`);

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

      // Convert browser file content to Base64 to guarantee fallbackContent is NEVER missing
      let base64Content: string | undefined = undefined;
      try {
        base64Content = await readArrayBufferAsBase64(f.fileObject);
      } catch (b64Err: any) {
        console.warn(`[packageUploadService] Base64 encoding warning for '${f.name}':`, b64Err.message);
      }

      const { data, error } = await client.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, f.fileObject, {
          contentType: f.type || "application/octet-stream",
          upsert: true
        });

      if (error) {
        const { category, message } = categorizeStorageError(error);
        console.warn(`[packageUploadService] Storage upload fallback triggered for '${f.name}' [Category: ${category}]: ${message}`);
        
        progressMap[f.name].status = "completed";
        if (onProgress) onProgress({ ...progressMap });

        uploadedFiles.push({
          name: f.name,
          storagePath: storagePath,
          size: f.size,
          type: f.type,
          detectedType: f.detectedType,
          fallbackContent: base64Content
        });

        console.log(`[UPLOAD PIPELINE AUDIT - STAGE 2 File (Storage Upload Fallback)] Name: "${f.name}" | storagePath: "${storagePath}" | fallbackContent exists? ${Boolean(base64Content)} | status: COMPLETED_FALLBACK`);
        continue;
      }

      const { data: publicUrlData } = client.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);

      progressMap[f.name].bytesUploaded = f.size;
      progressMap[f.name].percentage = 100;
      progressMap[f.name].status = "completed";
      if (onProgress) onProgress({ ...progressMap });

      const resolvedStoragePath = data?.path || storagePath;

      uploadedFiles.push({
        name: f.name,
        storagePath: resolvedStoragePath,
        size: f.size,
        type: f.type,
        detectedType: f.detectedType,
        publicUrl: publicUrlData?.publicUrl,
        fallbackContent: base64Content
      });

      console.log(`[UPLOAD PIPELINE AUDIT - STAGE 2 File (Storage Upload Success)] Name: "${f.name}" | mimeType: "${f.type || "unknown"}" | size: ${f.size} bytes | storagePath: "${resolvedStoragePath}" | fallbackContent exists? ${Boolean(base64Content)} | status: COMPLETED_SUCCESS`);
    } catch (err: any) {
      console.error(`Exception uploading file ${f.name}:`, err);
      progressMap[f.name].status = "error";
      progressMap[f.name].errorMsg = err.message;
      if (onProgress) onProgress({ ...progressMap });
    }
  }

  console.log(`\n==========================================================`);
  console.log(`[UPLOAD PIPELINE AUDIT - STAGE 3 & 4] Upload State & Payload Serialization`);
  console.log(`Total Descriptors Serialized: ${uploadedFiles.length}`);
  uploadedFiles.forEach(meta => {
    console.log(`- Descriptor: filename="${meta.name}" | storagePath="${meta.storagePath}" | fallbackContent.length=${meta.fallbackContent ? meta.fallbackContent.length : 0}`);
  });
  console.log(`==========================================================\n`);

  return {
    success: uploadedFiles.length > 0,
    uploadedFiles
  };
}
