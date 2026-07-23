/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { parseUploadedPackage, compileSourceCodeToProject, compileProjectPackage } from "../_lib/compiler/index";
import { getAiClient } from "../_lib/ai/index";
import { getSupabaseClient } from "../_lib/storage/index";
import { validateFileBuffer, isAllowedFileType, categorizeStorageError, enforceOwnerPermission, executeWithTimeout, createStepLogger } from "../_lib/utils/security";
import { sendError, sendSuccess, logExecution } from "../_lib/utils/index";
import { PipelineStage, parseStackLocation } from "../_lib/types/index";
import { PipelineProfiler } from "../_lib/utils/pipelineProfiler";

export const config = {
  runtime: "nodejs",
  maxDuration: 60
};

let lastCompletedStage = "Stage 0: HTTP Handler Entry";

if (!(global as any).__CRASH_HANDLERS_REGISTERED__) {
  (global as any).__CRASH_HANDLERS_REGISTERED__ = true;

  process.on("uncaughtException", (err: any) => {
    console.error(`\n==========================================================`);
    console.error(`[PROCESS CRASH DETECTED: uncaughtException]`);
    console.error(`Error Message: ${err?.message || err}`);
    console.error(`Error Name: ${err?.name || "UncaughtException"}`);
    console.error(`Last Completed Stage: ${lastCompletedStage}`);
    console.error(`Stack Trace:\n${err?.stack || "No Stack Available"}`);
    console.error(`==========================================================\n`);
  });

  process.on("unhandledRejection", (reason: any) => {
    console.error(`\n==========================================================`);
    console.error(`[PROCESS CRASH DETECTED: unhandledRejection]`);
    console.error(`Rejection Reason: ${reason?.message || reason}`);
    console.error(`Rejection Name: ${reason?.name || "UnhandledRejection"}`);
    console.error(`Last Completed Stage: ${lastCompletedStage}`);
    console.error(`Stack Trace:\n${reason?.stack || "No Stack Available"}`);
    console.error(`==========================================================\n`);
  });

  process.on("exit", (code: number) => {
    console.error(`\n[PROCESS EXIT EVENT] Exit Code: ${code} | Last Completed Stage: ${lastCompletedStage}\n`);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Always guarantee JSON response Content-Type
  res.setHeader("Content-Type", "application/json");

  if (!enforceOwnerPermission(req, res)) return;

  const logger = createStepLogger("API Endpoint /ai-package-parse");
  const handlerStep = logger.start("HTTP Handler /api/portfolio/ai");

  const startTime = Date.now();
  const rawUrl = req.url || "";
  const parsedUrl = new URL(rawUrl, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;

  if (req.method !== "POST") {
    return sendError(res, 405, "Method Not Allowed. Only POST is supported.");
  }

  // Action: AI Package Parse (PBIT, ZIP, DAX, etc.)
  if (pathname.includes("/ai-package-parse")) {
    const profiler = new PipelineProfiler();
    try {
      // Stage 1: Receive request
      const st1 = profiler.profileStageStart(1, "Receive request", `${JSON.stringify(req.body || {}).length} bytes`);

      const prepStep = logger.start("Stage 0: Payload Parsing & Storage Resolution");
      const body = req.body || {};
      const { fileName, fileDataBase64, fileType, files, userAnswers, forceCompile, projectUnderstanding } = body;

      profiler.profileStageEnd(st1, `${Array.isArray(files) ? files.length : 0} file(s)`);

      // Stage 2: Validate descriptors
      const st2 = profiler.profileStageStart(2, "Validate descriptors", `${Array.isArray(files) ? files.length : 0} descriptor(s)`);

      // SERVER AUDIT 1: Raw req.body.files[0] immediately after parsing
      console.log(`\n==========================================================`);
      console.log(`[SERVER AUDIT 1: Raw req.body.files[0]]`);
      console.log(JSON.stringify(req.body.files?.[0], null, 2));
      console.log(`==========================================================\n`);

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

          // Stage 3: Download from Supabase
          const st3 = profiler.profileStageStart(3, `Download from Supabase [${name}]`, fileMeta.storagePath || "No Path");

          let buffer: Buffer | null = null;
          let resolutionSource = "None";
          let storageDownloadErrorMsg = "";

          // 1. Use storagePath first: Download from Supabase Storage if available with 12s timeout
          if (fileMeta.storagePath) {
            const dlStep = logger.start(`Supabase Storage Download [${name}]`);
            const client = getSupabaseClient();
            if (client) {
              try {
                const bucket = process.env.SUPABASE_STORAGE_BUCKET || "portfolio-uploads";
                const downloadRes = await executeWithTimeout(
                  `Supabase Download [${name}]`,
                  () => client.storage.from(bucket).download(fileMeta.storagePath!),
                  12000
                );

                if (!downloadRes.error && downloadRes.data) {
                  const arrayBuffer = await downloadRes.data.arrayBuffer();
                  buffer = Buffer.from(arrayBuffer);
                  resolutionSource = "Supabase Storage Download";
                  dlStep.end(buffer.length);
                  profiler.recordAllocation(`Supabase Storage Buffer [${name}]`, buffer.length);
                  profiler.profileStageEnd(st3, `${buffer.length} bytes`);
                } else if (downloadRes.error) {
                  dlStep.end("Failed");
                  const { category, message } = categorizeStorageError(downloadRes.error);
                  storageDownloadErrorMsg = `Category ${category}: ${message}`;
                  console.warn(`[ai-package-parse] Storage download failed for path '${fileMeta.storagePath}' [Category: ${category}]: ${message}`);
                  profiler.profileStageEnd(st3, "0 bytes", "FAILED", storageDownloadErrorMsg);
                }
              } catch (downloadErr: any) {
                dlStep.end("Timeout/Error");
                storageDownloadErrorMsg = downloadErr.message || "Timeout downloading from Supabase Storage";
                console.warn(`[ai-package-parse] Exception or timeout downloading storage path '${fileMeta.storagePath}':`, downloadErr.message);
                profiler.profileStageEnd(st3, "0 bytes", "TIMED OUT", storageDownloadErrorMsg);
              }
            } else {
              storageDownloadErrorMsg = "Supabase client unconfigured on server environment.";
              profiler.profileStageEnd(st3, "0 bytes", "FAILED", storageDownloadErrorMsg);
            }
          } else {
            profiler.profileStageEnd(st3, "No Storage Path", "END");
          }

          // Stage 4: Resolve buffers
          const st4 = profiler.profileStageStart(4, `Resolve buffers [${name}]`, `Storage Buffer: ${buffer ? buffer.length : 0} bytes`);

          // 2. Fall back seamlessly to fallbackContent if storage download is unavailable
          if (!buffer && fileMeta.fallbackContent) {
            try {
              buffer = Buffer.from(fileMeta.fallbackContent, "base64");
              resolutionSource = "In-Memory Browser Fallback (Base64)";
              profiler.recordAllocation(`Fallback Base64 Buffer [${name}]`, buffer.length);
            } catch (fallbackErr: any) {
              console.warn(`Error decoding fallbackContent for '${name}':`, fallbackErr.message);
            }
          }

          // 3. Return HTTP 400 only when both storagePath download and fallbackContent fail to yield content
          if (!buffer) {
            profiler.profileStageEnd(st4, "0 bytes", "FAILED", storageDownloadErrorMsg);
            const hasPath = Boolean(fileMeta.storagePath);
            const hasFallback = Boolean(fileMeta.fallbackContent);
            if (!hasPath && !hasFallback) {
              return sendError(res, 400, `Both storagePath and fallbackContent are absent on file descriptor for '${name}'.`);
            } else {
              return sendError(res, 400, `Failed to retrieve content for '${name}' (storagePath: '${fileMeta.storagePath || "NONE"}'). Storage download error: ${storageDownloadErrorMsg || "Download failed"} and no inline fallbackContent was available.`);
            }
          }

          const validation = validateFileBuffer(buffer, name);
          if (!validation.isValid) {
            profiler.profileStageEnd(st4, "0 bytes", "FAILED", validation.error);
            return sendError(res, 400, validation.error || `Corrupted file buffer for '${name}'.`);
          }

          profiler.profileStageEnd(st4, `Resolved Buffer: ${buffer.length} bytes`);

          rawFilesToCompile.push({
            name,
            size: fileMeta.size || buffer.length,
            type: fileMeta.type || "binary",
            content: buffer,
            storagePath: fileMeta.storagePath
          });
        }
        profiler.profileStageEnd(st2, `${rawFilesToCompile.length} file descriptor(s) validated`);
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
          content: buffer
        });
      } else {
        return sendError(
          res,
          400,
          "Invalid request payload. Must provide either legacy format ({ fileName, fileDataBase64 }) or new format ({ packageId, files })."
        );
      }
      prepStep.end(`${rawFilesToCompile.length} file(s) resolved`);

      // Execute package compiler with a 56-second hard deadline.
      // Budget: stages 1-7 take ~29s measured + Stage 8 primary Gemini call (25s inner) = 54s hard path.
      // 56s gives 2s margin within Vercel's 60s maxDuration. The Stage 8 review pass (20s inner) is
      // soft-optional — its catch block returns the already-generated structured output on timeout.
      const compileStep = logger.start("Package Compiler Pipeline Execution");
      const output = await executeWithTimeout(
        "Package Compiler Hard Deadline",
        () => compileProjectPackage(rawFilesToCompile, userAnswers, forceCompile, projectUnderstanding, profiler),
        56000
      );
      compileStep.end(JSON.stringify(output).length);

      // Release duplicate Base64 payload strings from memory after compiler pipeline completion
      rawFilesToCompile.forEach(f => { f.content = ""; });

      // Stage 15: Final JSON serialization
      const st15 = profiler.profileStageStart(15, "Final JSON serialization", "Compiler Output Object");
      const jsonOutputString = JSON.stringify(output);
      profiler.recordAllocation("Final Output JSON String", jsonOutputString.length);
      profiler.profileStageEnd(st15, `${jsonOutputString.length} bytes`);

      // Stage 16: HTTP Response
      const st16 = profiler.profileStageStart(16, "HTTP Response", `${jsonOutputString.length} bytes`);

      logExecution({
        endpoint: pathname,
        totalDurationMs: Date.now() - startTime
      });

      handlerStep.end("200 OK Response Sent");
      profiler.profileStageEnd(st16, "HTTP 200 OK Sent");

      profiler.printFinalReport();
      return sendSuccess(res, output);
    } catch (err: any) {
      profiler.printFinalReport();
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const timestamp = new Date().toISOString();
      const stage: PipelineStage = err.stage || "File Upload";
      const errorType = err.errorType || err.name || "Error";
      const stack = err.stack || String(err);
      const location = parseStackLocation(stack);

      console.error("\n==========================================================");
      console.error(`[PIPELINE EXCEPTION DETECTED] Stage: ${stage}`);
      console.error(`[PIPELINE EXCEPTION DETECTED] Error Type: ${errorType}`);
      console.error(`[PIPELINE EXCEPTION DETECTED] Request ID: ${requestId}`);
      console.error(`[PIPELINE EXCEPTION DETECTED] Timestamp: ${timestamp}`);
      console.error(`[PIPELINE EXCEPTION DETECTED] Message: ${err.message}`);
      if (location) {
        console.error(`[PIPELINE EXCEPTION DETECTED] File Name: ${location.fileName}`);
        console.error(`[PIPELINE EXCEPTION DETECTED] Line Number: ${location.lineNumber}`);
      }
      console.error(`[PIPELINE EXCEPTION DETECTED] Complete Stack Trace:\n${stack}`);
      console.error("==========================================================\n");

      return res.status(500).json({
        success: false,
        stage,
        errorType,
        message: err.message || "An unhandled pipeline error occurred",
        stack,
        timestamp,
        requestId,
        fileName: location?.fileName || err.fileName || undefined,
        lineNumber: location?.lineNumber || err.lineNumber || undefined
      });
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
