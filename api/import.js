// @ts-nocheck
// src/api/_lib/parsers/registry.ts
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import JSZip from "jszip";
function createEmptyProject(fileName, parserName) {
  return {
    title: `Analytical Report: ${fileName}`,
    subtitle: `Synthesized analysis from ${parserName}`,
    summary: `Structured dataset analysis parsed from ${fileName} using specialized ${parserName} compiler.`,
    industry: "Analytical Technology",
    role: "Analytics Engineer",
    duration: "1 Week",
    date: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
    tags: [parserName.replace("Parser", "")],
    categories: ["Data Analytics"],
    objective: `Analyze data insights inside ${fileName}.`,
    businessProblem: `Identify strategic opportunities or patterns inside the source file ${fileName}.`,
    methodology: "1. Loaded file into the compiler pipeline.\n2. Parsed variables and analytical markers.\n3. Normalized findings.",
    datasetDesc: `Dataset from file ${fileName}.`,
    dataCleaning: "Extracted and structured content schema.",
    findings: "Analysis complete. Waiting for narrative synthesis.",
    recommendations: "1. Integrate parsed findings into central decision dashboards.",
    challengesText: "Adapting file contents to standardized portfolio schemas.",
    lessonsLearned: "Maintained complete factual lineage of evidence metrics.",
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
    proj.role = "Database Analyst";
    const text = type === "text" ? content : Buffer.from(content, "base64").toString("utf-8");
    const lines = text.split("\n");
    const tablesReferenced = /* @__PURE__ */ new Set();
    const cleanName = fileName.replace(/\.sql$/i, "").replace(/[-_]+/g, " ");
    proj.title = `SQL Analytics: ${cleanName.charAt(0).toUpperCase() + cleanName.slice(1)}`;
    lines.forEach((line, lineIdx) => {
      const trimmed = line.trim();
      const fromMatch = trimmed.match(/\bFROM\s+([a-zA-Z0-9_\.]+)/i);
      if (fromMatch && fromMatch[1]) tablesReferenced.add(fromMatch[1]);
      const joinMatch = trimmed.match(/\bJOIN\s+([a-zA-Z0-9_\.]+)/i);
      if (joinMatch && joinMatch[1]) tablesReferenced.add(joinMatch[1]);
      if (trimmed.startsWith("--")) {
        const comment = trimmed.slice(2).trim();
        const lower = comment.toLowerCase();
        if (lower.startsWith("kpi:") || lower.startsWith("metric:")) {
          const parts = comment.substring(comment.indexOf(":") + 1).split("=");
          if (parts.length >= 2) {
            const mLabel = parts[0].trim();
            const rest = parts[1].trim();
            let mVal = rest;
            let mDesc = "";
            const descIndex = rest.indexOf("(");
            if (descIndex !== -1) {
              mVal = rest.substring(0, descIndex).trim();
              mDesc = rest.substring(descIndex + 1, rest.length - 1).trim();
            }
            proj.metrics.push({
              id: `sql-metric-${proj.metrics.length}-${Date.now()}`,
              label: mLabel,
              value: mVal,
              description: mDesc || `Extracted from SQL script ${fileName}`,
              iconName: mLabel.toLowerCase().includes("revenue") ? "DollarSign" : "Activity",
              sourceFile: fileName,
              sourceLocation: `Line ${lineIdx + 1}`
            });
          }
        } else if (lower.startsWith("title:")) {
          proj.title = comment.substring(6).trim();
        } else if (lower.startsWith("subtitle:")) {
          proj.subtitle = comment.substring(9).trim();
        } else if (lower.startsWith("objective:")) {
          proj.objective = comment.substring(10).trim();
        }
      }
    });
    if (tablesReferenced.size > 0) {
      proj.datasetDesc = `Relational tables referenced: ${Array.from(tablesReferenced).join(", ")}.`;
    }
    proj.storyBlocks.push({
      id: `sql-query-sb-${Date.now()}`,
      type: "code_snippet",
      title: `SQL Script: ${fileName}`,
      bodyContent: text,
      language: "sql",
      sourceFile: fileName
    });
    return proj;
  }
};
var PythonParser = {
  name: "PythonParser",
  extensions: ["py"],
  async parse(fileName, content, type) {
    const proj = createEmptyProject(fileName, "PythonParser");
    proj.tags = ["Python"];
    proj.categories = ["Data Science", "Data Engineering"];
    proj.role = "Data Scientist";
    const text = type === "text" ? content : Buffer.from(content, "base64").toString("utf-8");
    const lines = text.split("\n");
    const cleanName = fileName.replace(/\.py$/i, "").replace(/[-_]+/g, " ");
    proj.title = `Python Analytics: ${cleanName.charAt(0).toUpperCase() + cleanName.slice(1)}`;
    lines.forEach((line, lineIdx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("#")) {
        const comment = trimmed.slice(1).trim();
        const lower = comment.toLowerCase();
        if (lower.startsWith("kpi:") || lower.startsWith("metric:")) {
          const parts = comment.substring(comment.indexOf(":") + 1).split("=");
          if (parts.length >= 2) {
            const mLabel = parts[0].trim();
            const rest = parts[1].trim();
            let mVal = rest;
            let mDesc = "";
            const descIndex = rest.indexOf("(");
            if (descIndex !== -1) {
              mVal = rest.substring(0, descIndex).trim();
              mDesc = rest.substring(descIndex + 1, rest.length - 1).trim();
            }
            proj.metrics.push({
              id: `py-metric-${proj.metrics.length}-${Date.now()}`,
              label: mLabel,
              value: mVal,
              description: mDesc || `Extracted from Python script ${fileName}`,
              iconName: mLabel.toLowerCase().includes("accuracy") ? "Percent" : "Activity",
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
    return proj;
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
    try {
      const text = type === "text" ? content : Buffer.from(content, "base64").toString("utf-8");
      const json = JSON.parse(text);
      const cells = json.cells || [];
      let markdownConcat = "";
      let codeCellIdx = 0;
      cells.forEach((cell, cellIdx) => {
        const cellType = cell.cell_type;
        const sourceLines = Array.isArray(cell.source) ? cell.source : [cell.source || ""];
        const sourceText = sourceLines.join("");
        if (cellType === "markdown") {
          markdownConcat += sourceText + "\n\n";
          const lines = sourceText.split("\n");
          lines.forEach((l) => {
            const trimmed = l.trim();
            if (trimmed.startsWith("#")) {
              const headerText = trimmed.replace(/^#+\s*/, "").toLowerCase();
              if (headerText.includes("objective") || headerText.includes("goal")) {
                proj.objective = trimmed.replace(/^#+\s*/, "");
              } else if (headerText.includes("problem") || headerText.includes("business friction")) {
                proj.businessProblem = trimmed.replace(/^#+\s*/, "");
              } else if (headerText.includes("methodology") || headerText.includes("workflow")) {
                proj.methodology = trimmed.replace(/^#+\s*/, "");
              }
            }
          });
        } else if (cellType === "code") {
          codeCellIdx++;
          sourceLines.forEach((l, lineNum) => {
            const commentIndex = l.indexOf("#");
            if (commentIndex !== -1) {
              const commentPart = l.substring(commentIndex + 1).trim();
              if (commentPart.toLowerCase().startsWith("kpi:") || commentPart.toLowerCase().startsWith("metric:")) {
                const parts = commentPart.substring(commentPart.indexOf(":") + 1).split("=");
                if (parts.length >= 2) {
                  const mLabel = parts[0].trim();
                  const rest = parts[1].trim();
                  proj.metrics.push({
                    id: `notebook-metric-${proj.metrics.length}-${Date.now()}`,
                    label: mLabel,
                    value: rest,
                    description: `Notebook Code Extraction`,
                    iconName: "Activity",
                    sourceFile: fileName,
                    sourceLocation: `Cell ${codeCellIdx}, Line ${lineNum + 1}`
                  });
                }
              }
            }
          });
          if (sourceText.trim() && proj.storyBlocks.length < 5) {
            proj.storyBlocks.push({
              id: `notebook-cell-sb-${proj.storyBlocks.length}-${Date.now()}`,
              type: "code_snippet",
              title: `Notebook Cell [${codeCellIdx}]`,
              bodyContent: sourceText,
              language: "python",
              sourceFile: fileName
            });
          }
        }
      });
      if (markdownConcat.trim()) {
        proj.findings = `Parsed findings from Notebook Markdown cells:
${markdownConcat.slice(0, 1e3)}`;
      }
    } catch (err) {
      console.error("NotebookParser Error:", err);
    }
    return proj;
  }
};
var PowerBIParser = {
  name: "PowerBIParser",
  extensions: ["pbix", "dax"],
  async parse(fileName, content, type) {
    const proj = createEmptyProject(fileName, "PowerBIParser");
    proj.tags = ["Power BI", "DAX"];
    proj.categories = ["Business Intelligence", "Dashboard Analytics"];
    proj.role = "BI Engineer";
    const text = type === "text" ? content : Buffer.from(content, "base64").toString("utf-8");
    proj.storyBlocks.push({
      id: `pbi-sb-${Date.now()}`,
      type: "code_snippet",
      title: `DAX Calculations: ${fileName}`,
      bodyContent: text.slice(0, 5e3),
      language: "sql",
      // DAX is highlighted nicely using sql/general coding
      sourceFile: fileName
    });
    return proj;
  }
};
var GitHubParser = {
  name: "GitHubParser",
  extensions: ["git"],
  async parse(fileName) {
    const proj = createEmptyProject(fileName, "GitHubParser");
    proj.tags = ["GitHub", "Source Control"];
    proj.categories = ["DevOps", "Data Engineering"];
    proj.objective = `Repository structure compiled: ${fileName}`;
    return proj;
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

// src/api/import.ts
async function handler(req, res) {
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
  handler as default
};
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
