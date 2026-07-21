/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { parseUploadedPackage, compileSourceCodeToProject } from "../_lib/compiler/index";
import { getAiClient } from "../_lib/ai/index";
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
      const { fileName, fileDataBase64, fileType } = req.body || {};
      if (!fileName || !fileDataBase64) {
        return sendError(res, 400, "fileName and fileDataBase64 payload required.");
      }

      if (!isAllowedFileType(fileName)) {
        return sendError(res, 400, "Unsupported file format uploaded.");
      }

      const buffer = Buffer.from(fileDataBase64, "base64");
      const validation = validateFileBuffer(buffer, fileName);
      if (!validation.isValid) {
        return sendError(res, 400, validation.error || "Corrupted file buffer.");
      }

      const output = await parseUploadedPackage(fileName, buffer);

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
