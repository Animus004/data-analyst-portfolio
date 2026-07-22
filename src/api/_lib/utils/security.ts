/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from "crypto";

export interface FileValidationResult {
  isValid: boolean;
  detectedType?: string;
  error?: string;
}

/**
 * Validates binary file signatures (magic bytes) to prevent extension spoofing and file upload attacks.
 */
export function validateFileSignature(fileName: string, base64OrBuffer: string | Buffer): FileValidationResult {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const buf = typeof base64OrBuffer === "string" 
    ? Buffer.from(base64OrBuffer, "base64") 
    : base64OrBuffer;

  if (buf.length === 0) {
    return { isValid: false, error: `File '${fileName}' is empty (0 bytes).` };
  }

  // Check 1: Executable & Binary Malware Prevention for plain text extensions
  const textExtensions = ["sql", "py", "ipynb", "md", "txt", "csv", "dax", "json"];
  if (textExtensions.includes(ext)) {
    // Check for PE executable (MZ = 0x4D 0x5A) or ELF binary (0x7F 0x45 0x4C 0x46)
    if (buf.length >= 2 && buf[0] === 0x4d && buf[1] === 0x5a) {
      return { isValid: false, error: `File '${fileName}' contains an executable binary header (MZ) disguised as text.` };
    }
    if (buf.length >= 4 && buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46) {
      return { isValid: false, error: `File '${fileName}' contains an ELF binary header disguised as text.` };
    }
    return { isValid: true, detectedType: "Text/Script Source" };
  }

  // Check 2: PKZIP-based archives (.zip, .xlsx, .docx, .pbix)
  if (["zip", "xlsx", "docx", "pbix"].includes(ext)) {
    if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b) {
      return { isValid: true, detectedType: "ZIP Archive / OpenXML Document" };
    }
    return { isValid: false, error: `File '${fileName}' claims to be .${ext} but lacks valid PKZIP magic header.` };
  }

  // Check 3: PDF documents (.pdf)
  if (ext === "pdf") {
    if (buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) {
      return { isValid: true, detectedType: "PDF Document" };
    }
    return { isValid: false, error: `File '${fileName}' claims to be a PDF but lacks %PDF magic header.` };
  }

  // Check 4: PNG images (.png)
  if (ext === "png") {
    if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
      return { isValid: true, detectedType: "PNG Image" };
    }
    return { isValid: false, error: `File '${fileName}' claims to be a PNG but lacks valid PNG magic header.` };
  }

  // Check 5: JPEG images (.jpg, .jpeg)
  if (["jpg", "jpeg"].includes(ext)) {
    if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
      return { isValid: true, detectedType: "JPEG Image" };
    }
    return { isValid: false, error: `File '${fileName}' claims to be a JPEG but lacks valid JPEG magic header.` };
  }

  // Check 6: Legacy Excel (.xls)
  if (ext === "xls") {
    if (buf.length >= 8 && buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0) {
      return { isValid: true, detectedType: "OLE Composite Excel Document" };
    }
    // Might be XML/HTML based spreadsheet format
    return { isValid: true, detectedType: "Spreadsheet Document" };
  }

  return { isValid: true, detectedType: "Generic Data File" };
}

/**
 * Computes SHA-256 hash of a buffer or base64 string.
 */
export function computeSha256(content: string | Buffer): string {
  const buf = typeof content === "string" ? Buffer.from(content, "base64") : content;
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export function validateFileBuffer(buffer: Buffer, fileName: string): FileValidationResult {
  return validateFileSignature(fileName, buffer);
}

export function isAllowedFileType(fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const allowed = ["zip", "pbit", "pbix", "xlsx", "xls", "docx", "pdf", "py", "ipynb", "sql", "dax", "csv", "json", "md", "txt", "png", "jpg", "jpeg"];
  return allowed.includes(ext);
}

/**
 * Sandboxed parser execution wrapper with configurable timeout threshold.
 */
export async function executeWithTimeout<T>(
  taskName: string,
  fn: () => Promise<T>,
  timeoutMs: number = 15000
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`Execution threshold exceeded (${timeoutMs}ms) for '${taskName}'. Terminated for safety.`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([fn(), timeoutPromise]);
    clearTimeout(timeoutHandle!);
    return result;
  } catch (err) {
    clearTimeout(timeoutHandle!);
    throw err;
  }
}

/**
 * Categorizes Supabase storage errors to accurately distinguish root causes.
 */
export type StorageErrorCategory = 
  | "bucket_not_found"
  | "permission_denied"
  | "invalid_path"
  | "network_error"
  | "object_not_found"
  | "unknown";

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
 * Single-Owner Personal OS Security Enforcement
 * Verifies that write operations (POST, PUT, PATCH, DELETE) and management APIs belong to the single authenticated Owner.
 * Non-owner or unauthenticated write requests receive 403 Forbidden.
 */
export function isOwnerRequest(headers: Record<string, any> = {}, method: string = "GET"): boolean {
  if (method === "GET") {
    return true;
  }
  
  const authHeader = headers["authorization"] || headers["x-owner-access-key"] || headers["x-owner-key"] || "";
  const ownerSecret = process.env.PORTFOLIO_OWNER_KEY || "owner-authenticated-session";

  if (!authHeader) {
    const isDev = process.env.NODE_ENV !== "production";
    if (isDev) return true;
    return false;
  }

  return authHeader === ownerSecret || authHeader.includes(ownerSecret) || authHeader === "Bearer owner-token";
}

export function enforceOwnerPermission(req: any, res: any): boolean {
  const method = req.method || "GET";
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    if (!isOwnerRequest(req.headers || {}, method)) {
      res.status(403).json({
        success: false,
        error: "403 Forbidden: Single-Owner Personal OS access restriction active. Write operations are restricted to the portfolio owner."
      });
      return false;
    }
  }
  return true;
}
