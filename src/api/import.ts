/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  SQLParser,
  PythonParser,
  NotebookParser,
  PowerBIParser,
  GitHubParser
} from "./_lib/parsers/registry";
import { sendError, sendSuccess, logExecution } from "./_lib/utils/index";

export const config = {
  runtime: "nodejs"
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  const rawUrl = req.url || "";
  const parsedUrl = new URL(rawUrl, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;

  if (req.method !== "POST") {
    return sendError(res, 405, "Method Not Allowed. Only POST is supported.");
  }

  // Dispatcher: SQL Import
  if (pathname.includes("/sql")) {
    try {
      const { fileName = "query.sql", content } = req.body || {};
      if (!content) {
        return sendError(res, 400, "SQL content is required.");
      }

      const project = await SQLParser.parse(fileName, content, "text");
      logExecution({ endpoint: pathname, totalDurationMs: Date.now() - startTime, parserSelected: "SQLParser" });

      return sendSuccess(res, {
        parser: "SqlParser",
        project
      });
    } catch (err: any) {
      return sendError(res, 500, "Failed to import SQL dialect source.", err.message);
    }
  }

  // Dispatcher: Python Import
  if (pathname.includes("/python")) {
    try {
      const { fileName = "script.py", content } = req.body || {};
      if (!content) {
        return sendError(res, 400, "Python content is required.");
      }

      const isNotebook = fileName.endsWith(".ipynb");
      const parser = isNotebook ? NotebookParser : PythonParser;
      const project = await parser.parse(fileName, content, "text");

      logExecution({ endpoint: pathname, totalDurationMs: Date.now() - startTime, parserSelected: parser.name });

      return sendSuccess(res, {
        parser: parser.name,
        project
      });
    } catch (err: any) {
      return sendError(res, 500, "Failed to import Python analytic source.", err.message);
    }
  }

  // Dispatcher: Power BI Import
  if (pathname.includes("/powerbi")) {
    try {
      const { fileName = "model.dax", content } = req.body || {};
      if (!content) {
        return sendError(res, 400, "DAX content is required.");
      }

      const project = await PowerBIParser.parse(fileName, content, "text");
      logExecution({ endpoint: pathname, totalDurationMs: Date.now() - startTime, parserSelected: "PowerBIParser" });

      return sendSuccess(res, {
        parser: "PowerBIParser",
        project
      });
    } catch (err: any) {
      return sendError(res, 500, "Failed to import Power BI configuration.", err.message);
    }
  }

  // Dispatcher: GitHub Import
  if (pathname.includes("/github")) {
    try {
      const { repoUrl, branch = "main" } = req.body || {};
      if (!repoUrl) {
        return sendError(res, 400, "repoUrl is required.");
      }

      const cleanName = repoUrl.split("/").pop() || "repository";
      const project = await GitHubParser.parse(cleanName, repoUrl, "text");

      logExecution({ endpoint: pathname, totalDurationMs: Date.now() - startTime, parserSelected: "GitHubParser" });

      return sendSuccess(res, {
        parser: "GitHubParser",
        repoUrl,
        branch,
        project
      });
    } catch (err: any) {
      return sendError(res, 500, "Failed to import GitHub repository.", err.message);
    }
  }

  return sendError(res, 404, "Import action sub-route not found.");
}
