/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { parseUploadedPackage, compileSourceCodeToProject, compileProjectPackage } from "../_lib/compiler/index";
import { getAiClient } from "../_lib/ai/index";
import { getSupabaseClient } from "../_lib/storage/index";
import { validateFileBuffer, isAllowedFileType } from "../_lib/utils/security";
import { sendError, sendSuccess, logExecution } from "../_lib/utils/index";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  const rawUrl = req.url || "";
  const parsedUrl = new URL(rawUrl, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;

  if (req.method !== "POST") {
    return sendError(res, 405, "Method Not Allowed. Only POST is supported.");
  }

  // Action: AI Package Parse (PBIT, ZIP, DAX, etc.)
  if (pathname.includes("/ai-package-parse")) {
    try {
      const body = req.body || {};
      const { fileName, fileDataBase64, fileType, files } = body;

      const rawFilesToCompile: Array<{ name: string; size: number; type: string; content: string; storagePath?: string }> = [];

      // Detect Payload Format Automatically
      if (Array.isArray(files) && files.length > 0) {
        // New Payload Format ({ packageId, files, evidenceOnlyMode })
        for (const fileMeta of files) {
          const name = fileMeta.name || fileMeta.fileName;
          if (!name) {
            return sendError(res, 400, "File item missing name in files payload.");
          }

          if (!isAllowedFileType(name)) {
            return sendError(res, 400, `Unsupported file format '${name}' uploaded.`);
          }

          let buffer: Buffer | null = null;

          // 1. Use storagePath first: Download from Supabase Storage if available
          if (fileMeta.storagePath) {
            const client = getSupabaseClient();
            if (client) {
              try {
                const bucket = process.env.SUPABASE_STORAGE_BUCKET || "portfolio-uploads";
                const { data, error } = await client.storage
                  .from(bucket)
                  .download(fileMeta.storagePath);

                if (!error && data) {
                  const arrayBuffer = await data.arrayBuffer();
                  buffer = Buffer.from(arrayBuffer);
                } else if (error) {
                  console.warn(`Supabase storage download failed for path '${fileMeta.storagePath}':`, error.message);
                }
              } catch (downloadErr: any) {
                console.warn(`Error downloading storage path '${fileMeta.storagePath}':`, downloadErr.message);
              }
            }
          }

          // 2. Fall back to fallbackContent if download is unavailable
          if (!buffer && fileMeta.fallbackContent) {
            try {
              buffer = Buffer.from(fileMeta.fallbackContent, "base64");
            } catch (fallbackErr: any) {
              console.warn(`Error decoding fallbackContent for '${name}':`, fallbackErr.message);
            }
          }

          // 3. Return HTTP 400 only when both storagePath and fallbackContent are absent or fail to yield content
          if (!buffer) {
            return sendError(res, 400, `Both storagePath and fallbackContent are absent or unavailable for file '${name}'.`);
          }

          const validation = validateFileBuffer(buffer, name);
          if (!validation.isValid) {
            return sendError(res, 400, validation.error || `Corrupted file buffer for '${name}'.`);
          }

          rawFilesToCompile.push({
            name,
            size: fileMeta.size || buffer.length,
            type: fileMeta.type || "binary",
            content: buffer.toString("base64"),
            storagePath: fileMeta.storagePath
          });
        }
      } else if (fileName && fileDataBase64) {
        // Legacy Payload Format ({ fileName, fileDataBase64 })
        if (!isAllowedFileType(fileName)) {
          return sendError(res, 400, "Unsupported file format uploaded.");
        }

        const buffer = Buffer.from(fileDataBase64, "base64");
        const validation = validateFileBuffer(buffer, fileName);
        if (!validation.isValid) {
          return sendError(res, 400, validation.error || "Corrupted file buffer.");
        }

        rawFilesToCompile.push({
          name: fileName,
          size: buffer.length,
          type: fileType || "binary",
          content: buffer.toString("base64")
        });
      } else {
        return sendError(
          res,
          400,
          "Invalid request payload. Must provide either legacy format ({ fileName, fileDataBase64 }) or new format ({ packageId, files })."
        );
      }

      const output = await compileProjectPackage(rawFilesToCompile);

      logExecution({
        endpoint: pathname,
        totalDurationMs: Date.now() - startTime
      });

      return sendSuccess(res, output);
    } catch (err: any) {
      return sendError(res, 500, "Failed to compile uploaded analytic package.", err.message);
    }
  }

  // Action: Raw Source Code Compile
  if (pathname.includes("/ai-parse")) {
    try {
      const { fileName, sourceCode, fileType } = req.body || {};
      if (!sourceCode) {
        return sendError(res, 400, "sourceCode is required.");
      }

      const output = await compileSourceCodeToProject(fileName || "script.py", sourceCode);

      logExecution({
        endpoint: pathname,
        totalDurationMs: Date.now() - startTime
      });

      return sendSuccess(res, output);
    } catch (err: any) {
      return sendError(res, 500, "Failed to parse source code.", err.message);
    }
  }

  // Action: Copilot Refinement
  if (pathname.includes("/copilot/refine")) {
    try {
      const { currentText, instruction, context = "case-study" } = req.body || {};
      if (!instruction) {
        return sendError(res, 400, "Refinement instruction is required.");
      }

      const ai = getAiClient();
      const prompt = `
You are an expert technical editor for data analytics portfolios and case studies.
Refine and enhance the following section according to the user's instructions.

### Target Section Context: ${context}
### Original Text:
${currentText || "(Empty)"}

### User Refinement Request:
${instruction}

Return only the refined text output without conversational filler.
`;

      const aiStartTime = Date.now();
      const result = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt
      });
      const aiDurationMs = Date.now() - aiStartTime;

      logExecution({
        endpoint: pathname,
        totalDurationMs: Date.now() - startTime,
        aiDurationMs
      });

      return sendSuccess(res, {
        refinedText: (result.text || "").trim()
      });
    } catch (err: any) {
      return sendError(res, 500, "Failed to process copilot request.", err.message);
    }
  }

  return sendError(res, 404, "Sub-route not found.");
}
