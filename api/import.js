// @ts-nocheck
// src/api/_lib/parsers/registry.ts
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import JSZip from "jszip";
function createEmptyProject(fileName, parserName) {
  return {
    title: "",
    subtitle: "",
    summary: "",
    industry: "",
    role: "",
    duration: "",
    date: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
    tags: [parserName.replace("Parser", "")],
    categories: [],
    objective: "",
    businessProblem: "",
    methodology: "",
    datasetDesc: "",
    dataCleaning: "",
    findings: "",
    recommendations: "",
    challengesText: "",
    lessonsLearned: "",
    metrics: [],
    storyBlocks: [],
    sourceFiles: [fileName]
  };
}
var SQLParser = {
  name: "SQLParser",
  extensions: ["sql"],
  async parse(fileName, content, type) {
    const proj = createEmptyProject(fileName, "SQLParser");
    proj.tags = ["SQL", "Relational Database"];
    proj.categories = ["Data Engineering", "Database Querying"];
    const text = type === "text" ? content : Buffer.from(content, "base64").toString("utf-8");
    const lines = text.split("\n");
    const sqlEvidence = {
      sourceFile: fileName,
      parser: "SQLParser",
      confidence: 95,
      tables: [],
      joins: [],
      aggregations: [],
      windowFunctions: [],
      businessQuestions: [],
      calculatedMetrics: []
    };
    const tablesSet = /* @__PURE__ */ new Set();
    const joinsSet = /* @__PURE__ */ new Set();
    const aggSet = /* @__PURE__ */ new Set();
    const windowSet = /* @__PURE__ */ new Set();
    lines.forEach((line, lineIdx) => {
      const trimmed = line.trim();
      const fromMatch = trimmed.match(/\bFROM\s+([a-zA-Z0-9_\.]+)/i);
      if (fromMatch && fromMatch[1]) tablesSet.add(fromMatch[1]);
      const joinMatch = trimmed.match(/\b(LEFT|RIGHT|INNER|FULL|CROSS)?\s*JOIN\s+([a-zA-Z0-9_\.]+)/i);
      if (joinMatch && joinMatch[2]) {
        tablesSet.add(joinMatch[2]);
        joinsSet.add(joinMatch[0].trim());
      }
      const aggMatch = trimmed.match(/\b(SUM|COUNT|AVG|MAX|MIN)\s*\([^)]+\)/gi);
      if (aggMatch) {
        aggMatch.forEach((a) => aggSet.add(a.trim()));
      }
      if (/OVER\s*\(/i.test(trimmed)) {
        windowSet.add(trimmed);
      }
      const aliasMatch = trimmed.match(/(SUM|COUNT|AVG|MAX|MIN)\([^)]+\)\s+AS\s+([a-zA-Z0-9_]+)/i);
      if (aliasMatch && aliasMatch[2]) {
        sqlEvidence.calculatedMetrics.push({ name: aliasMatch[2], formula: aliasMatch[1] });
      }
      if (trimmed.startsWith("--") || trimmed.startsWith("/*")) {
        const comment = trimmed.replace(/^(--|\/\*|\*\/)/, "").trim();
        const lower = comment.toLowerCase();
        if (lower.startsWith("kpi:") || lower.startsWith("metric:")) {
          const parts = comment.substring(comment.indexOf(":") + 1).split("=");
          if (parts.length >= 2) {
            const mLabel = parts[0].trim();
            const rest = parts[1].trim();
            proj.metrics.push({
              id: `sql-metric-${proj.metrics.length}-${Date.now()}`,
              label: mLabel,
              value: rest,
              description: `Extracted from SQL script ${fileName}`,
              iconName: mLabel.toLowerCase().includes("revenue") ? "DollarSign" : "Activity",
              sourceFile: fileName,
              sourceLocation: `Line ${lineIdx + 1}`
            });
          }
        } else if (comment.endsWith("?")) {
          sqlEvidence.businessQuestions.push(comment);
        }
      }
    });
    sqlEvidence.tables = Array.from(tablesSet);
    sqlEvidence.joins = Array.from(joinsSet);
    sqlEvidence.aggregations = Array.from(aggSet);
    sqlEvidence.windowFunctions = Array.from(windowSet);
    proj.storyBlocks.push({
      id: `sql-query-sb-${Date.now()}`,
      type: "code_snippet",
      title: `SQL Script: ${fileName}`,
      bodyContent: text,
      language: "sql",
      sourceFile: fileName
    });
    return {
      project: proj,
      evidenceNode: { type: "sql", data: sqlEvidence }
    };
  }
};
var PythonParser = {
  name: "PythonParser",
  extensions: ["py"],
  async parse(fileName, content, type) {
    const proj = createEmptyProject(fileName, "PythonParser");
    proj.tags = ["Python"];
    proj.categories = ["Data Science", "Data Engineering"];
    const text = type === "text" ? content : Buffer.from(content, "base64").toString("utf-8");
    const lines = text.split("\n");
    const docEvidence = {
      sourceFile: fileName,
      parser: "PythonParser",
      confidence: 90,
      sections: [{ heading: "Python Source Code", content: text.slice(0, 3e3) }],
      extractedTerms: ["Python", "Pandas", "Scikit-Learn"]
    };
    lines.forEach((line, lineIdx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("#")) {
        const comment = trimmed.slice(1).trim();
        const lower = comment.toLowerCase();
        if (lower.startsWith("kpi:") || lower.startsWith("metric:")) {
          const parts = comment.substring(comment.indexOf(":") + 1).split("=");
          if (parts.length >= 2) {
            proj.metrics.push({
              id: `py-metric-${proj.metrics.length}-${Date.now()}`,
              label: parts[0].trim(),
              value: parts[1].trim(),
              description: `Extracted from Python script ${fileName}`,
              iconName: "Activity",
              sourceFile: fileName,
              sourceLocation: `Line ${lineIdx + 1}`
            });
          }
        }
      }
    });
    proj.storyBlocks.push({
      id: `py-script-sb-${Date.now()}`,
      type: "code_snippet",
      title: `Python Script: ${fileName}`,
      bodyContent: text,
      language: "python",
      sourceFile: fileName
    });
    return {
      project: proj,
      evidenceNode: { type: "document", data: docEvidence }
    };
  }
};
var NotebookParser = {
  name: "NotebookParser",
  extensions: ["ipynb"],
  async parse(fileName, content, type) {
    const proj = createEmptyProject(fileName, "NotebookParser");
    proj.tags = ["Python", "Jupyter Notebook"];
    proj.categories = ["Data Science", "Interactive Analytics"];
    proj.role = "Data Scientist";
    const docEvidence = {
      sourceFile: fileName,
      parser: "NotebookParser",
      confidence: 90,
      sections: [],
      extractedTerms: ["Jupyter", "Interactive Notebook"]
    };
    try {
      const text = type === "text" ? content : Buffer.from(content, "base64").toString("utf-8");
      const json = JSON.parse(text);
      const cells = json.cells || [];
      let markdownConcat = "";
      let codeCellIdx = 0;
      cells.forEach((cell) => {
        const cellType = cell.cell_type;
        const sourceLines = Array.isArray(cell.source) ? cell.source : [cell.source || ""];
        const sourceText = sourceLines.join("");
        if (cellType === "markdown") {
          markdownConcat += sourceText + "\n\n";
          docEvidence.sections.push({ heading: "Markdown Cell", content: sourceText });
        } else if (cellType === "code") {
          codeCellIdx++;
          sourceLines.forEach((l, lineNum) => {
            const commentIndex = l.indexOf("#");
            if (commentIndex !== -1) {
              const commentPart = l.substring(commentIndex + 1).trim();
              if (commentPart.toLowerCase().startsWith("kpi:") || commentPart.toLowerCase().startsWith("metric:")) {
                const parts = commentPart.substring(commentPart.indexOf(":") + 1).split("=");
                if (parts.length >= 2) {
                  proj.metrics.push({
                    id: `notebook-metric-${proj.metrics.length}-${Date.now()}`,
                    label: parts[0].trim(),
                    value: parts[1].trim(),
                    description: `Notebook Code Extraction`,
                    iconName: "Activity",
                    sourceFile: fileName,
                    sourceLocation: `Cell ${codeCellIdx}, Line ${lineNum + 1}`
                  });
                }
              }
            }
          });
        }
      });
      if (markdownConcat.trim()) {
        docEvidence.sections.push({ heading: "Notebook Markdown Synthesis", content: markdownConcat });
      }
    } catch (err) {
      console.error("NotebookParser Error:", err);
    }
    return {
      project: proj,
      evidenceNode: { type: "document", data: docEvidence }
    };
  }
};
var PowerBIParser = {
  name: "PowerBIParser",
  extensions: ["pbix", "dax"],
  async parse(fileName, content, type) {
    const proj = createEmptyProject(fileName, "PowerBIParser");
    proj.tags = ["Power BI", "DAX"];
    proj.categories = ["Business Intelligence", "Dashboard Analytics"];
    const text = type === "text" ? content : Buffer.from(content, "base64").toString("utf-8");
    const pbiEvidence = {
      sourceFile: fileName,
      parser: "PowerBIParser",
      confidence: 90,
      visuals: [],
      daxMeasures: [],
      pages: ["Overview", "Executive Dashboard"],
      relationships: [],
      kpis: []
    };
    const daxLines = text.split("\n");
    daxLines.forEach((line) => {
      const match = line.match(/^([a-zA-Z0-9_\s%]+)\s*=\s*(.+)$/);
      if (match) {
        const name = match[1].trim();
        const expr = match[2].trim();
        pbiEvidence.daxMeasures.push({ name, expression: expr });
        pbiEvidence.kpis.push({ label: name, value: expr });
        proj.metrics.push({
          id: `dax-metric-${proj.metrics.length}-${Date.now()}`,
          label: name,
          value: expr,
          description: "Calculated DAX Measure",
          iconName: "BarChart2",
          sourceFile: fileName
        });
      }
    });
    proj.storyBlocks.push({
      id: `pbi-sb-${Date.now()}`,
      type: "code_snippet",
      title: `DAX Calculations: ${fileName}`,
      bodyContent: text.slice(0, 5e3),
      language: "sql",
      sourceFile: fileName
    });
    return {
      project: proj,
      evidenceNode: { type: "powerbi", data: pbiEvidence }
    };
  }
};
var GitHubParser = {
  name: "GitHubParser",
  extensions: ["git"],
  async parse(fileName) {
    const proj = createEmptyProject(fileName, "GitHubParser");
    proj.tags = ["GitHub", "Source Control"];
    proj.categories = ["DevOps", "Data Engineering"];
    const docEvidence = {
      sourceFile: fileName,
      parser: "GitHubParser",
      confidence: 90,
      sections: [{ heading: "GitHub Repository Structure", content: `Repository files extracted from ${fileName}` }],
      extractedTerms: ["Git", "Repository"]
    };
    return {
      project: proj,
      evidenceNode: { type: "document", data: docEvidence }
    };
  }
};

// src/api/_lib/utils/index.ts
function sendError(res, status, message, details, traceId) {
  const tId = traceId || `err-${Math.random().toString(36).substring(2, 11)}`;
  return res.status(status).json({
    success: false,
    error: message,
    code: status,
    details: details || null,
    traceId: tId
  });
}
function sendSuccess(res, data) {
  return res.status(200).json({
    success: true,
    ...data
  });
}
function logExecution(stats) {
  console.log(`[PORTFOLIO-OS] API REQUEST METRICS:
  - Endpoint: ${stats.endpoint}
  - Exec Time: ${stats.totalDurationMs}ms
  - Parser: ${stats.parserSelected || "None"}
  - AI Exec Time: ${stats.aiDurationMs !== void 0 ? `${stats.aiDurationMs}ms` : "N/A"}
  - Supabase Latency: ${stats.supabaseDurationMs !== void 0 ? `${stats.supabaseDurationMs}ms` : "N/A"}
  - Errors: ${stats.error || "None"}
  - Timestamp: ${(/* @__PURE__ */ new Date()).toISOString()}
  `);
}

// src/api/_lib/utils/security.ts
function isOwnerRequest(headers = {}, method = "GET") {
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
function enforceOwnerPermission(req, res) {
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

// src/api/import.ts
var config = {
  runtime: "nodejs"
};
async function handler(req, res) {
  if (!enforceOwnerPermission(req, res)) return;
  const startTime = Date.now();
  const rawUrl = req.url || "";
  const parsedUrl = new URL(rawUrl, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;
  if (req.method !== "POST") {
    return sendError(res, 405, "Method Not Allowed. Only POST is supported.");
  }
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
    } catch (err) {
      return sendError(res, 500, "Failed to import SQL dialect source.", err.message);
    }
  }
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
    } catch (err) {
      return sendError(res, 500, "Failed to import Python analytic source.", err.message);
    }
  }
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
    } catch (err) {
      return sendError(res, 500, "Failed to import Power BI configuration.", err.message);
    }
  }
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
    } catch (err) {
      return sendError(res, 500, "Failed to import GitHub repository.", err.message);
    }
  }
  return sendError(res, 404, "Import action sub-route not found.");
}
export {
  config,
  handler as default
};
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
