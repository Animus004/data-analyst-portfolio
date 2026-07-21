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
var ExcelParser = {
  name: "ExcelParser",
  extensions: ["xlsx", "xls"],
  async parse(fileName, content) {
    const proj = createEmptyProject(fileName, "ExcelParser");
    proj.tags = ["Excel", "Spreadsheets"];
    proj.categories = ["Financial Modeling", "Business Analytics"];
    proj.role = "Financial Analyst";
    try {
      const excelBuffer = Buffer.from(content, "base64");
      const workbook = XLSX.read(excelBuffer, { type: "buffer" });
      let projectsRaw = [];
      let metricsRaw = [];
      workbook.SheetNames.forEach((sheetName) => {
        const nameLower = sheetName.toLowerCase().replace(/\s+/g, "");
        const sheet = workbook.Sheets[sheetName];
        if (nameLower === "projects" || nameLower === "casestudies") {
          projectsRaw = XLSX.utils.sheet_to_json(sheet);
        } else if (nameLower === "metrics" || nameLower === "kpis") {
          metricsRaw = XLSX.utils.sheet_to_json(sheet);
        }
      });
      if (projectsRaw.length > 0) {
        const firstProj = projectsRaw[0];
        proj.title = firstProj.title || proj.title;
        proj.subtitle = firstProj.subtitle || proj.subtitle;
        proj.objective = firstProj.objective || firstProj.businessProblem || proj.objective;
        proj.businessProblem = firstProj.businessProblem || proj.businessProblem;
        proj.methodology = firstProj.methodology || proj.methodology;
        proj.datasetDesc = firstProj.datasetDesc || proj.datasetDesc;
        proj.dataCleaning = firstProj.dataCleaning || proj.dataCleaning;
        proj.findings = firstProj.findings || proj.findings;
        proj.recommendations = firstProj.recommendations || proj.recommendations;
        proj.challengesText = firstProj.challengesText || proj.challengesText;
        proj.lessonsLearned = firstProj.lessonsLearned || proj.lessonsLearned;
      }
      metricsRaw.forEach((m, mIdx) => {
        proj.metrics.push({
          id: `xls-metric-${mIdx}-${Date.now()}`,
          label: String(m.label || m.name || m.title || "KPI Metric").trim(),
          value: String(m.value || m.amount || "N/A").trim(),
          description: String(m.description || m.details || "").trim(),
          iconName: m.iconName || m.icon || "Activity",
          sourceFile: fileName,
          sourceLocation: `Sheet: Metrics, Row ${mIdx + 2}`
        });
      });
    } catch (err) {
      console.error("ExcelParser Error:", err);
    }
    return proj;
  }
};
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
var MarkdownParser = {
  name: "MarkdownParser",
  extensions: ["md", "txt"],
  async parse(fileName, content, type) {
    const proj = createEmptyProject(fileName, "MarkdownParser");
    proj.tags = ["Markdown", "Documentation"];
    proj.categories = ["Technical Writing", "Reporting"];
    const text = type === "text" ? content : Buffer.from(content, "base64").toString("utf-8");
    proj.summary = `Technical documentation compiled from Markdown files: ${fileName}.`;
    const sections = text.split(/\n#+\s+/);
    sections.forEach((sec) => {
      const lines = sec.split("\n");
      const title = lines[0].trim().toLowerCase();
      const body = lines.slice(1).join("\n").trim();
      if (title.includes("objective") || title.includes("goal")) {
        proj.objective = body;
      } else if (title.includes("problem") || title.includes("challenge")) {
        proj.businessProblem = body;
      } else if (title.includes("methodology") || title.includes("architecture")) {
        proj.methodology = body;
      } else if (title.includes("finding") || title.includes("insight")) {
        proj.findings = body;
      } else if (title.includes("recommendation")) {
        proj.recommendations = body;
      } else if (title.includes("clean") || title.includes("etl")) {
        proj.dataCleaning = body;
      }
    });
    proj.storyBlocks.push({
      id: `md-sb-${Date.now()}`,
      type: "markdown",
      title: `Document Section: ${fileName}`,
      bodyContent: text,
      sourceFile: fileName
    });
    return proj;
  }
};
var WordParser = {
  name: "WordParser",
  extensions: ["docx"],
  async parse(fileName, content) {
    const proj = createEmptyProject(fileName, "WordParser");
    proj.tags = ["Word", "Technical Report"];
    proj.categories = ["Business Analysis", "Documentation"];
    try {
      const buffer = Buffer.from(content, "base64");
      const extractionResult = await mammoth.extractRawText({ buffer });
      const text = extractionResult.value;
      proj.objective = `Extracted narrative from Business Analysis Report: ${fileName}`;
      proj.findings = text.slice(0, 2e3);
      proj.storyBlocks.push({
        id: `word-sb-${Date.now()}`,
        type: "markdown",
        title: `Document extraction: ${fileName}`,
        bodyContent: text,
        sourceFile: fileName
      });
    } catch (err) {
      console.error("WordParser Error:", err);
    }
    return proj;
  }
};
var CSVParser = {
  name: "CSVParser",
  extensions: ["csv"],
  async parse(fileName, content, type) {
    const proj = createEmptyProject(fileName, "CSVParser");
    proj.tags = ["CSV", "Flat File"];
    proj.categories = ["Data Prep", "Tabular Analysis"];
    try {
      const text = type === "text" ? content : Buffer.from(content, "base64").toString("utf-8");
      const lines = text.split("\n").filter((l) => l.trim() !== "");
      if (lines.length > 0) {
        const headers = lines[0].split(",").map((h) => h.trim());
        proj.datasetDesc = `Flat-file dataset contains ${lines.length - 1} records across headers: ${headers.join(", ")}.`;
        proj.metrics.push({
          id: `csv-metric-rows-${Date.now()}`,
          label: "Row Count",
          value: String(lines.length - 1),
          description: `Total analytical dimensions in CSV file ${fileName}`,
          iconName: "Database",
          sourceFile: fileName,
          sourceLocation: `Entire CSV file`
        });
      }
    } catch (err) {
      console.error("CSVParser Error:", err);
    }
    return proj;
  }
};
var PDFParser = {
  name: "PDFParser",
  extensions: ["pdf"],
  async parse(fileName) {
    const proj = createEmptyProject(fileName, "PDFParser");
    proj.tags = ["PDF", "Acrobat Document"];
    proj.categories = ["Data Extract", "Reporting"];
    proj.objective = `Grounded extraction from PDF document: ${fileName}`;
    return proj;
  }
};
var ImageParser = {
  name: "ImageParser",
  extensions: ["png", "jpg", "jpeg"],
  async parse(fileName) {
    const proj = createEmptyProject(fileName, "ImageParser");
    proj.tags = ["Visual Assets", "Images"];
    proj.categories = ["Telemetry Visualization"];
    proj.objective = `Visual asset evidence payload: ${fileName}`;
    return proj;
  }
};
var PARSER_REGISTRY = {
  xlsx: ExcelParser,
  xls: ExcelParser,
  sql: SQLParser,
  py: PythonParser,
  ipynb: NotebookParser,
  pbix: PowerBIParser,
  dax: PowerBIParser,
  md: MarkdownParser,
  txt: MarkdownParser,
  docx: WordParser,
  csv: CSVParser,
  pdf: PDFParser,
  png: ImageParser,
  jpg: ImageParser,
  jpeg: ImageParser
};
async function unpackZipFile(base64Content) {
  const extractedFiles = [];
  const MAX_EXTRACTED_FILES = 100;
  const MAX_TOTAL_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;
  let totalUncompressedBytes = 0;
  try {
    const zipBuffer = Buffer.from(base64Content, "base64");
    const zip = new JSZip();
    const contents = await zip.loadAsync(zipBuffer);
    const entries = Object.entries(contents.files);
    if (entries.length > MAX_EXTRACTED_FILES) {
      console.warn(`ZIP extraction warning: Archive contains ${entries.length} files, exceeding max quota (${MAX_EXTRACTED_FILES}).`);
    }
    for (const [rawFilename, fileObj] of entries) {
      if (extractedFiles.length >= MAX_EXTRACTED_FILES) {
        console.warn(`ZIP quota cap reached (${MAX_EXTRACTED_FILES} files). Remaining entries ignored.`);
        break;
      }
      const sanitizedFilename = rawFilename.replace(/\\/g, "/").split("/").filter((part) => part !== ".." && part !== ".").join("/");
      if (!sanitizedFilename || fileObj.dir) {
        continue;
      }
      const ext = sanitizedFilename.split(".").pop()?.toLowerCase() || "";
      if (ext === "zip") {
        console.warn(`Nested ZIP file '${sanitizedFilename}' skipped to prevent infinite decompression recursion.`);
        continue;
      }
      const isBinary = ["xlsx", "xls", "pbix", "twbx", "png", "jpg", "jpeg", "pdf", "docx"].includes(ext);
      if (isBinary) {
        const contentBase64 = await fileObj.async("base64");
        const fileSize = Buffer.byteLength(contentBase64, "base64");
        totalUncompressedBytes += fileSize;
        if (totalUncompressedBytes > MAX_TOTAL_UNCOMPRESSED_BYTES) {
          console.warn("Decompression bomb protection triggered: Exceeded 100MB uncompressed limit.");
          break;
        }
        extractedFiles.push({
          name: sanitizedFilename,
          content: contentBase64,
          type: "binary"
        });
      } else {
        const textContent = await fileObj.async("string");
        totalUncompressedBytes += Buffer.byteLength(textContent, "utf-8");
        if (totalUncompressedBytes > MAX_TOTAL_UNCOMPRESSED_BYTES) {
          console.warn("Decompression bomb protection triggered: Exceeded 100MB uncompressed limit.");
          break;
        }
        extractedFiles.push({
          name: sanitizedFilename,
          content: textContent,
          type: "text"
        });
      }
    }
  } catch (err) {
    console.error("ZIP Unpack Security Violation or Failure:", err.message);
  }
  return extractedFiles;
}

// src/api/_lib/utils/security.ts
import crypto from "crypto";
function validateFileSignature(fileName, base64OrBuffer) {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const buf = typeof base64OrBuffer === "string" ? Buffer.from(base64OrBuffer, "base64") : base64OrBuffer;
  if (buf.length === 0) {
    return { isValid: false, error: `File '${fileName}' is empty (0 bytes).` };
  }
  const textExtensions = ["sql", "py", "ipynb", "md", "txt", "csv", "dax", "json"];
  if (textExtensions.includes(ext)) {
    if (buf.length >= 2 && buf[0] === 77 && buf[1] === 90) {
      return { isValid: false, error: `File '${fileName}' contains an executable binary header (MZ) disguised as text.` };
    }
    if (buf.length >= 4 && buf[0] === 127 && buf[1] === 69 && buf[2] === 76 && buf[3] === 70) {
      return { isValid: false, error: `File '${fileName}' contains an ELF binary header disguised as text.` };
    }
    return { isValid: true, detectedType: "Text/Script Source" };
  }
  if (["zip", "xlsx", "docx", "pbix"].includes(ext)) {
    if (buf.length >= 4 && buf[0] === 80 && buf[1] === 75) {
      return { isValid: true, detectedType: "ZIP Archive / OpenXML Document" };
    }
    return { isValid: false, error: `File '${fileName}' claims to be .${ext} but lacks valid PKZIP magic header.` };
  }
  if (ext === "pdf") {
    if (buf.length >= 4 && buf[0] === 37 && buf[1] === 80 && buf[2] === 68 && buf[3] === 70) {
      return { isValid: true, detectedType: "PDF Document" };
    }
    return { isValid: false, error: `File '${fileName}' claims to be a PDF but lacks %PDF magic header.` };
  }
  if (ext === "png") {
    if (buf.length >= 8 && buf[0] === 137 && buf[1] === 80 && buf[2] === 78 && buf[3] === 71) {
      return { isValid: true, detectedType: "PNG Image" };
    }
    return { isValid: false, error: `File '${fileName}' claims to be a PNG but lacks valid PNG magic header.` };
  }
  if (["jpg", "jpeg"].includes(ext)) {
    if (buf.length >= 3 && buf[0] === 255 && buf[1] === 216 && buf[2] === 255) {
      return { isValid: true, detectedType: "JPEG Image" };
    }
    return { isValid: false, error: `File '${fileName}' claims to be a JPEG but lacks valid JPEG magic header.` };
  }
  if (ext === "xls") {
    if (buf.length >= 8 && buf[0] === 208 && buf[1] === 207 && buf[2] === 17 && buf[3] === 224) {
      return { isValid: true, detectedType: "OLE Composite Excel Document" };
    }
    return { isValid: true, detectedType: "Spreadsheet Document" };
  }
  return { isValid: true, detectedType: "Generic Data File" };
}
function computeSha256(content) {
  const buf = typeof content === "string" ? Buffer.from(content, "base64") : content;
  return crypto.createHash("sha256").update(buf).digest("hex");
}
function validateFileBuffer(buffer, fileName) {
  return validateFileSignature(fileName, buffer);
}
function isAllowedFileType(fileName) {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const allowed = ["zip", "pbit", "pbix", "xlsx", "xls", "docx", "pdf", "py", "ipynb", "sql", "dax", "csv", "json", "md", "txt", "png", "jpg", "jpeg"];
  return allowed.includes(ext);
}
async function executeWithTimeout(taskName, fn, timeoutMs = 15e3) {
  let timeoutHandle;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`Execution threshold exceeded (${timeoutMs}ms) for '${taskName}'. Terminated for safety.`));
    }, timeoutMs);
  });
  try {
    const result = await Promise.race([fn(), timeoutPromise]);
    clearTimeout(timeoutHandle);
    return result;
  } catch (err) {
    clearTimeout(timeoutHandle);
    throw err;
  }
}
function categorizeStorageError(error) {
  if (!error) {
    return { category: "unknown", message: "Unknown error" };
  }
  const rawMessage = typeof error === "string" ? error : error.message || JSON.stringify(error);
  const msg = rawMessage.toLowerCase();
  const statusCode = String(error.statusCode || error.status || error.code || "").toLowerCase();
  if (msg.includes("bucket not found") || msg.includes("bucket does not exist") || statusCode === "404" && msg.includes("bucket")) {
    return { category: "bucket_not_found", message: rawMessage };
  }
  if (msg.includes("row-level security") || msg.includes("permission denied") || msg.includes("access denied") || msg.includes("unauthorized") || statusCode === "401" || statusCode === "403" || statusCode === "42501") {
    return { category: "permission_denied", message: rawMessage };
  }
  if (msg.includes("invalid path") || msg.includes("invalid key") || msg.includes("key name invalid") || msg.includes("path") && msg.includes("invalid")) {
    return { category: "invalid_path", message: rawMessage };
  }
  if (msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("econnrefused") || msg.includes("network request failed")) {
    return { category: "network_error", message: rawMessage };
  }
  if (msg.includes("object not found") || msg.includes("not_found") || statusCode === "404" && (msg.includes("object") || msg.includes("file") || msg.includes("resource"))) {
    return { category: "object_not_found", message: rawMessage };
  }
  return { category: "unknown", message: rawMessage };
}

// src/api/_lib/compiler/index.ts
import crypto2 from "crypto";
function normalizeLabel(label) {
  return label.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}
function validateAndDetectConflicts(projects) {
  const conflicts = [];
  if (projects.length <= 1) return conflicts;
  const fieldsToCompare = ["title", "subtitle", "role", "duration", "industry", "date"];
  fieldsToCompare.forEach((field) => {
    const valuesMap = /* @__PURE__ */ new Map();
    projects.forEach((p) => {
      const val = p[field] || "";
      if (val && val !== "Not Found" && val !== "Requires User Review") {
        const norm = val.toLowerCase().trim();
        if (!valuesMap.has(norm)) {
          valuesMap.set(norm, []);
        }
        valuesMap.get(norm).push({
          value: val,
          sourceFile: p.sourceFiles.join(", ")
        });
      }
    });
    if (valuesMap.size > 1) {
      const valuesList = [];
      valuesMap.forEach((group) => {
        valuesList.push(group[0]);
      });
      conflicts.push({
        field: field.charAt(0).toUpperCase() + field.slice(1),
        values: valuesList
      });
    }
  });
  const metricGroups = /* @__PURE__ */ new Map();
  projects.forEach((p) => {
    p.metrics.forEach((m) => {
      const normLabel = normalizeLabel(m.label);
      if (normLabel) {
        if (!metricGroups.has(normLabel)) {
          metricGroups.set(normLabel, []);
        }
        metricGroups.get(normLabel).push({
          label: m.label,
          value: m.value,
          sourceFile: m.sourceFile,
          location: m.sourceLocation
        });
      }
    });
  });
  metricGroups.forEach((group, normLabel) => {
    if (group.length > 1) {
      const valuesMap = /* @__PURE__ */ new Map();
      group.forEach((item) => {
        const normVal = item.value.toLowerCase().trim();
        if (!valuesMap.has(normVal)) {
          valuesMap.set(normVal, []);
        }
        valuesMap.get(normVal).push(item);
      });
      if (valuesMap.size > 1) {
        const valuesList = [];
        valuesMap.forEach((vGroup) => {
          const rep = vGroup[0];
          valuesList.push({
            value: rep.value,
            sourceFile: rep.sourceFile,
            location: rep.location
          });
        });
        conflicts.push({
          field: `KPI: ${group[0].label}`,
          values: valuesList
        });
      }
    }
  });
  return conflicts;
}
function mergeExtractedProjects(projects) {
  if (projects.length === 0) {
    return {
      title: "Consolidated Project Report",
      subtitle: "Multi-file structured analysis",
      summary: "",
      industry: "Uncategorized",
      role: "Analyst",
      duration: "Ongoing",
      date: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      tags: [],
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
      sourceFiles: []
    };
  }
  const base = projects[0];
  const merged = {
    ...base,
    tags: Array.from(new Set(projects.flatMap((p) => p.tags))),
    categories: Array.from(new Set(projects.flatMap((p) => p.categories))),
    metrics: projects.flatMap((p) => p.metrics),
    storyBlocks: projects.flatMap((p) => p.storyBlocks),
    sourceFiles: Array.from(new Set(projects.flatMap((p) => p.sourceFiles)))
  };
  projects.slice(1).forEach((p) => {
    if (p.objective && p.objective !== base.objective) merged.objective += "\n" + p.objective;
    if (p.businessProblem && p.businessProblem !== base.businessProblem) merged.businessProblem += "\n" + p.businessProblem;
    if (p.methodology && p.methodology !== base.methodology) merged.methodology += "\n" + p.methodology;
    if (p.datasetDesc && p.datasetDesc !== base.datasetDesc) merged.datasetDesc += "\n" + p.datasetDesc;
    if (p.dataCleaning && p.dataCleaning !== base.dataCleaning) merged.dataCleaning += "\n" + p.dataCleaning;
    if (p.findings && p.findings !== base.findings) merged.findings += "\n" + p.findings;
    if (p.recommendations && p.recommendations !== base.recommendations) merged.recommendations += "\n" + p.recommendations;
    if (p.challengesText && p.challengesText !== base.challengesText) merged.challengesText += "\n" + p.challengesText;
    if (p.lessonsLearned && p.lessonsLearned !== base.lessonsLearned) merged.lessonsLearned += "\n" + p.lessonsLearned;
  });
  return merged;
}
async function compileProjectPackage(rawFiles) {
  let projectType = "Mixed Analytics";
  const MAX_RAW_FILES = 50;
  if (rawFiles.length > MAX_RAW_FILES) {
    throw new Error(`Package exceeds maximum file limit (${MAX_RAW_FILES} files). Please reduce file count.`);
  }
  const allFiles = [];
  const fileCoverage = [];
  for (const file of rawFiles) {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const fileHash = computeSha256(file.content);
    const sigCheck = validateFileSignature(file.name, file.content);
    if (!sigCheck.isValid) {
      fileCoverage.push({
        fileName: file.name,
        status: "Failed",
        reason: sigCheck.error || "Magic byte file signature mismatch.",
        size: file.size,
        sha256: fileHash
      });
      continue;
    }
    if (ext === "zip") {
      projectType = "ZIP Package";
      const unpacked = await unpackZipFile(file.content);
      unpacked.forEach((u) => {
        const uHash = computeSha256(u.content);
        allFiles.push({
          name: u.name,
          content: u.content,
          type: u.type,
          size: Buffer.byteLength(u.content, u.type === "binary" ? "base64" : "utf-8"),
          sha256: uHash
        });
      });
      fileCoverage.push({
        fileName: file.name,
        status: "Used",
        reason: `Unpacked ZIP package archive containing ${unpacked.length} analytics files. Signature verified.`,
        size: file.size,
        sha256: fileHash
      });
    } else {
      const isText = ["py", "sql", "dax", "md", "txt", "csv", "json"].includes(ext);
      allFiles.push({
        name: file.name,
        content: file.content,
        type: isText ? "text" : "binary",
        size: file.size,
        sha256: fileHash
      });
    }
  }
  const parsedProjects = [];
  for (const file of allFiles) {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const parser = PARSER_REGISTRY[ext];
    if (parser) {
      try {
        const parsed = await executeWithTimeout(
          `Parser[${parser.name}] for '${file.name}'`,
          () => parser.parse(file.name, file.content, file.type),
          15e3
        );
        parsedProjects.push(parsed);
        fileCoverage.push({
          fileName: file.name,
          status: "Used",
          reason: `Parsed via specialized Vercel-native ${parser.name}. SHA-256 verified.`,
          size: file.size,
          sha256: file.sha256
        });
      } catch (err) {
        console.error(`Sandboxed parser failure for '${file.name}':`, err.message);
        fileCoverage.push({
          fileName: file.name,
          status: "Failed",
          reason: `Isolated parser error: ${err.message || "Unknown execution error"}`,
          size: file.size,
          sha256: file.sha256
        });
      }
    } else {
      fileCoverage.push({
        fileName: file.name,
        status: "Ignored",
        reason: `Format extension (.${ext}) skipped automatically by parser router registry.`,
        size: file.size,
        sha256: file.sha256
      });
    }
  }
  if (parsedProjects.length === 1 && projectType !== "ZIP Package") {
    const ext = rawFiles[0].name.split(".").pop()?.toLowerCase() || "";
    if (ext === "xlsx" || ext === "xls") projectType = "Excel Analytics";
    else if (ext === "sql") projectType = "SQL Analytics";
    else if (ext === "py") projectType = "Python";
    else if (ext === "ipynb") projectType = "Python";
    else if (ext === "pbix" || ext === "dax") projectType = "Power BI";
  }
  const rawProject = mergeExtractedProjects(parsedProjects);
  const conflicts = validateAndDetectConflicts(parsedProjects);
  const packageEvidenceHash = crypto2.createHash("sha256").update(allFiles.map((f) => f.sha256).sort().join(":")).digest("hex");
  return {
    projectType,
    rawProject: {
      ...rawProject,
      sourceFiles: Array.from(new Set(allFiles.map((f) => f.name)))
    },
    conflicts,
    fileCoverage,
    auditMetadata: {
      importTimestamp: (/* @__PURE__ */ new Date()).toISOString(),
      parserVersions: "PortfolioOS Parser Engine v2.0 (Sandboxed)",
      evidenceHash: packageEvidenceHash,
      projectVersion: "v1",
      totalFilesProcessed: allFiles.length
    }
  };
}
async function compileSourceCodeToProject(fileName, sourceCode) {
  return compileProjectPackage([{
    name: fileName,
    size: Buffer.byteLength(sourceCode),
    type: "text",
    content: sourceCode
  }]);
}

// src/api/_lib/ai/index.ts
import { GoogleGenAI, Type } from "@google/genai";
var aiClient = null;
function getAiClient() {
  if (aiClient) return aiClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in environment secrets.");
  }
  aiClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
  return aiClient;
}

// src/api/_lib/storage/index.ts
import { createClient } from "@supabase/supabase-js";

// src/data/seedData.ts
var seedProjects = [
  {
    id: "superstore-sales",
    title: "Superstore Sales Dashboard & Diagnostic Analysis",
    slug: "superstore-sales-dashboard-analysis",
    subtitle: "[Insert Subtitle / High-Level Objective (e.g., A diagnostic business intelligence dashboard analyzing multi-year retail transactions to identify unprofitable segments and optimize supply chains.)]",
    summary: "[Insert Brief Executive Summary (e.g., Built an interactive, responsive Power BI analytical interface modeling retail orders to identify negative profit corridors, measure distribution lag, and forecast sales trends.)]",
    industry: "[Insert Industry (e.g., E-Commerce & Retail)]",
    role: "[Insert Your Role (e.g., Lead Business Intelligence Analyst)]",
    duration: "[Insert Project Duration (e.g., 2 Months)]",
    status: "published" /* PUBLISHED */,
    difficulty: "advanced" /* ADVANCED */,
    objective: "[Insert Detailed Project Objective (e.g., To identify critical profit-bleeding product lines, optimize regional delivery durations, and build predictive sales models to guide upcoming inventory management strategies.)]",
    datasetDesc: "[Insert Dataset Description (e.g., Detailed transactional data of a multi-region retail superstore spanning thousands of records, covering order dates, shipment modes, client segments, geocoordinates, product hierarchy, and sales margins.)]",
    methodology: "1. [Insert Step 1 (e.g., Cleaned and structured transactional raw datasets using Python to resolve null values and format timestamps.)]\n2. [Insert Step 2 (e.g., Built star-schema data models in Power BI to optimize cross-report query performance.)]\n3. [Insert Step 3 (e.g., Formulated custom metrics for Year-over-Year variance, cumulative running margins, and average order latency.)]\n4. [Insert Step 4 (e.g., Designed visual matrix grids mapping regional sub-categories directly against discount thresholds.)]",
    tags: ["Power BI", "DAX", "Python", "Pandas", "Excel", "SQL"],
    categories: ["Business Intelligence", "Data Science"],
    metrics: [
      {
        id: "ss-m1",
        label: "[Insert Metric 1 Label (e.g., Identified Cash Bleeds)]",
        value: "[Insert Metric 1 Value (e.g., $32,500+)]",
        description: "[Insert Metric 1 Description (e.g., Isolated negative margin product categories such as tables and binders.)]"
      },
      {
        id: "ss-m2",
        label: "[Insert Metric 2 Label (e.g., Shipping Lag Reduction)]",
        value: "[Insert Metric 2 Value (e.g., 22%)]",
        description: "[Insert Metric 2 Description (e.g., Bypassed standard transit delays by highlighting regional carrier gaps.)]"
      },
      {
        id: "ss-m3",
        label: "[Insert Metric 3 Label (e.g., Sales Growth Trend)]",
        value: "[Insert Metric 3 Value (e.g., +12.4%)]",
        description: "[Insert Metric 3 Description (e.g., Year-over-Year revenue expansion analyzed across core consumer segments.)]"
      }
    ],
    storyBlocks: [
      {
        id: "ss-sb1",
        type: "markdown",
        title: "[Insert Markdown Block Title (e.g., The Dilemma of High Volume with Low Margin)]",
        bodyContent: "[Insert Story / Challenge / Retrospective Context. E.g., In commercial retail, high-volume sales numbers are often misleading. A cursory review of the superstore ledger showed that while overall sales were increasing, overall profit margins were shrinking. By drilling deep into sub-category structures, the diagnostics isolated a critical leak: Furniture sales had extremely high sales numbers but negative cumulative profit. This cash drain was heavily driven by high logistical shipping costs paired with excessive promotional discounts.]"
      },
      {
        id: "ss-sb2",
        type: "code_snippet",
        title: "[Insert Code Snippet Title (e.g., Calculating Sales Margin and Profitability in DAX)]",
        language: "typescript",
        bodyContent: "// DAX Measure calculating pure profit margins while protecting against zero divisions\nProfit Margin % = \nDIVIDE(\n  SUM(Superstore[Profit]), \n  SUM(Superstore[Sales]), \n  0\n)\n\n// DAX Measure to evaluate the YoY Variance\nSales YoY Variance = \nVAR CurrentSales = SUM(Superstore[Sales])\nVAR PreviousSales = CALCULATE(SUM(Superstore[Sales]), SAMEPERIODLASTYEAR('Calendar'[Date]))\nRETURN\n  DIVIDE(CurrentSales - PreviousSales, PreviousSales, 0)"
      },
      {
        id: "ss-sb3",
        type: "chart_data",
        title: "[Insert Visual Chart / Ledger Title (e.g., Profit Margins by Customer Segment (Monthly))]",
        bodyContent: '[\n  {"name": "Corporate", "Normal": 4200, "Fraud": 120},\n  {"name": "Consumer", "Normal": 5800, "Fraud": 380},\n  {"name": "Home Office", "Normal": 2400, "Fraud": 60},\n  {"name": "Discount Retail", "Normal": 1900, "Fraud": 450}\n]'
      }
    ],
    githubUrl: "https://github.com/Animus004/superstore-sales-dashboard-analysis",
    createdAt: "2026-06-10T08:00:00Z",
    updatedAt: "2026-07-15T12:00:00Z"
  },
  {
    id: "amazon-reviews",
    title: "Amazon Product Review Sentiment Dashboard",
    slug: "amazon-product-review-dashboard",
    subtitle: "[Insert Subtitle / High-Level Objective (e.g., An end-to-end NLP analytics application classifying Amazon consumer feedback, rating patterns, and review helpfulness metrics.)]",
    summary: "[Insert Brief Executive Summary (e.g., Created a Python and Power BI diagnostic dashboard parsing text-based customer reviews to extract recurring pain points, rating velocities, and sentiment indices.)]",
    industry: "[Insert Industry (e.g., Consumer Electronics & E-Commerce)]",
    role: "[Insert Your Role (e.g., Lead NLP & Analytics Engineer)]",
    duration: "[Insert Project Duration (e.g., 3 Months)]",
    status: "published" /* PUBLISHED */,
    difficulty: "advanced" /* ADVANCED */,
    objective: "[Insert Detailed Project Objective (e.g., To transform raw text product feedback into structured engineering goals, allowing manufacturing and listing optimization teams to proactively address quality issues.)]",
    datasetDesc: "[Insert Dataset Description (e.g., A robust Amazon feedback corpus spanning thousands of products, including star ratings, text comments, user locations, helpfulness counts, and verified purchaser flags.)]",
    methodology: "1. [Insert Step 1 (e.g., Cleaned customer feedback texts with tokenization, lemmatization, and customized stop-word exclusion in Python.)]\n2. [Insert Step 2 (e.g., Developed sentiment-intensity classifiers using nltk and textblob library configurations.)]\n3. [Insert Step 3 (e.g., Formulated weighted review importance ranks by compounding raw star counts with helpfulness vote ratios.)]\n4. [Insert Step 4 (e.g., Visualized real-time topic distributions and rating shifts in a beautiful, modular UI layout.)]",
    tags: ["Python", "NLTK", "Power BI", "Pandas", "NLP", "Scikit-Learn"],
    categories: ["Machine Learning", "Data Science"],
    metrics: [
      {
        id: "ar-m1",
        label: "[Insert Metric 1 Label (e.g., Feedback Categorized)]",
        value: "[Insert Metric 1 Value (e.g., 12,000+)]",
        description: "[Insert Metric 1 Description (e.g., Textual reviews normalized, tokenized, and structured automatically.)]"
      },
      {
        id: "ar-m2",
        label: "[Insert Metric 2 Label (e.g., Keyword Extraction Ratio)]",
        value: "[Insert Metric 2 Value (e.g., 94.2%)]",
        description: "[Insert Metric 2 Description (e.g., Identified primary engineering bugs directly from text logs.)]"
      },
      {
        id: "ar-m3",
        label: "[Insert Metric 3 Label (e.g., Review Integrity Verified)]",
        value: "[Insert Metric 3 Value (e.g., 99.8%)]",
        description: "[Insert Metric 3 Description (e.g., Successfully filtered out bot-generated review networks using temporal density tracking.)]"
      }
    ],
    storyBlocks: [
      {
        id: "ar-sb1",
        type: "markdown",
        title: "[Insert Markdown Block Title (e.g., Uncovering What Average Ratings Hide)]",
        bodyContent: "[Insert Story / Challenge / Retrospective Context. E.g., A standard product listing score of 4.2 stars looks decent from a high level, but it can mask devastating regional engineering bugs. By isolating and applying NLP sentiment classification to 1-and-2-star reviews specifically, this analysis mapped high-frequency word occurrences. The resulting dashboard instantly highlighted recurring issues, allowing the product team to fix the manufacturing line before the rating average collapsed.]"
      },
      {
        id: "ar-sb2",
        type: "code_snippet",
        title: "[Insert Code Snippet Title (e.g., Clean Review NLP Processing Pipeline)]",
        language: "python",
        bodyContent: "import re\nfrom nltk.corpus import stopwords\nfrom nltk.tokenize import word_tokenize\nfrom nltk.stem import WordNetLemmatizer\n\ndef clean_and_lemmatize(text):\n    # Lowercase & strip special characters\n    text_clean = re.sub(r'[^a-zA-Z\\s]', '', text.lower())\n    \n    # Tokenize words\n    tokens = word_tokenize(text_clean)\n    \n    # Filter stopwords and lemmatize\n    stop_words = set(stopwords.words('english'))\n    lemmatizer = WordNetLemmatizer()\n    \n    return [lemmatizer.lemmatize(w) for w in tokens if w not in stop_words]"
      },
      {
        id: "ar-sb3",
        type: "chart_data",
        title: "[Insert Visual Chart / Ledger Title (e.g., Sentiment Ratios across Product Collections)]",
        bodyContent: '[\n  {"name": "Electronics", "Normal": 8200, "Fraud": 1100},\n  {"name": "Home & Kitchen", "Normal": 6100, "Fraud": 950},\n  {"name": "Office Supplies", "Normal": 4500, "Fraud": 300},\n  {"name": "Automotive Parts", "Normal": 3200, "Fraud": 850}\n]'
      }
    ],
    githubUrl: "https://github.com/Animus004/amazon-product-review-dashboard",
    createdAt: "2026-05-15T09:00:00Z",
    updatedAt: "2026-07-10T15:00:00Z"
  },
  {
    id: "steam-games",
    title: "Steam Games Market Analysis & Genre Saturation Modeling",
    slug: "steam-games-market-analysis",
    subtitle: "[Insert Subtitle / High-Level Objective (e.g., A commercial market intelligence pipeline mapping pricing elasticities, concurrent active players, and genre saturation parameters on Steam.)]",
    summary: "[Insert Brief Executive Summary (e.g., Engineered a Python ETL workflow and interactive Tableau/Power BI interface studying PC game records to model successful release variables for independent game publishers.)]",
    industry: "[Insert Industry (e.g., Gaming & Digital Media)]",
    role: "[Insert Your Role (e.g., Lead Market Analyst & Data Engineer)]",
    duration: "[Insert Project Duration (e.g., 3 Months)]",
    status: "published" /* PUBLISHED */,
    difficulty: "advanced" /* ADVANCED */,
    objective: "[Insert Detailed Project Objective (e.g., To support indie gaming publishers in setting strategic launch-week price points and identify less-crowded, high-margin Steam category tags to maximize initial launch momentum.)]",
    datasetDesc: "[Insert Dataset Description (e.g., Multi-dimensional database scraped from the official Steam Web API and active player databases, tracking historical game pricing, daily peak concurrent player grids, review percentages, and genre identifiers.)]",
    methodology: "1. [Insert Step 1 (e.g., Developed robust Python query functions to safely retrieve pricing charts and player metrics.)]\n2. [Insert Step 2 (e.g., Normalized unstructured tag arrays and processed missing developer logs in Pandas.)]\n3. [Insert Step 3 (e.g., Designed linear regression and pricing elasticity charts to verify user demand sensitivities.)]\n4. [Insert Step 4 (e.g., Formulated a Genre Saturation Score comparing raw product density against review scores.)]",
    tags: ["Python", "Pandas", "Tableau", "Power BI", "SQL", "Scikit-Learn"],
    categories: ["Data Science", "Business Intelligence"],
    metrics: [
      {
        id: "sg-m1",
        label: "[Insert Metric 1 Label (e.g., Game Titles Modeled)]",
        value: "[Insert Metric 1 Value (e.g., 40,000+)]",
        description: "[Insert Metric 1 Description (e.g., Vast market registry processed, grouped, and indexed.)]"
      },
      {
        id: "sg-m2",
        label: "[Insert Metric 2 Label (e.g., Pricing Sweetspot)]",
        value: "[Insert Metric 2 Value (e.g., $14.99)]",
        description: "[Insert Metric 2 Description (e.g., Optimal price segment determined for action and RPG indie tags.)]"
      },
      {
        id: "sg-m3",
        label: "[Insert Metric 3 Label (e.g., Model Forecast Accuracy)]",
        value: "[Insert Metric 3 Value (e.g., 95.9%)]",
        description: "[Insert Metric 3 Description (e.g., High predictive accuracy on launch-week active player ranges.)]"
      }
    ],
    storyBlocks: [
      {
        id: "sg-sb1",
        type: "markdown",
        title: "[Insert Markdown Block Title (e.g., Bypassing the Saturated Indie Cemetery)]",
        bodyContent: "[Insert Story / Challenge / Retrospective Context. E.g., Every year, thousands of indie games release on Steam to virtually zero sales. This market saturation makes pricing and category tagging critical. The Steam Games Market Analysis demonstrated that multiplayer survival titles priced under $10 often suffered from lower initial user confidence ratings, whereas action roguelike games priced around $14.99 with solid cooperative features consistently had higher concurrent player metrics and favorable reviews.]"
      },
      {
        id: "sg-sb2",
        type: "code_snippet",
        title: "[Insert Code Snippet Title (e.g., Genre Saturation and Value Formula Model)]",
        language: "python",
        bodyContent: "import pandas as pd\nimport numpy as np\n\ndef calculate_genre_viability(df_games):\n    # Calculate raw volume of games per genre\n    genre_counts = df_games['genre_tag'].value_counts()\n    \n    # Calculate median positive reviews and player peak logs\n    grouped = df_games.groupby('genre_tag').agg({\n        'positive_ratio': 'median',\n        'peak_players_30d': 'median'\n    })\n    \n    # Saturation Index: High counts with low player metrics = saturated\n    grouped['viability_index'] = (grouped['peak_players_30d'] * grouped['positive_ratio']) / genre_counts\n    return grouped.sort_values(by='viability_index', ascending=False)"
      },
      {
        id: "sg-sb3",
        type: "chart_data",
        title: "[Insert Visual Chart / Ledger Title (e.g., Active Player Density vs Saturated Game Count)]",
        bodyContent: '[\n  {"name": "Co-op Roguelikes", "Normal": 7200, "Fraud": 120},\n  {"name": "Multiplayer Survival", "Normal": 9500, "Fraud": 1800},\n  {"name": "Retro Platformers", "Normal": 1200, "Fraud": 3400},\n  {"name": "Cyberpunk RPGs", "Normal": 5400, "Fraud": 600}\n]'
      }
    ],
    githubUrl: "https://github.com/Animus004/steam-games-market-analysis",
    createdAt: "2026-04-10T11:00:00Z",
    updatedAt: "2026-07-18T10:00:00Z"
  }
];

// src/api/_lib/storage/index.ts
var supabaseClient = null;
function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && supabaseKey) {
    try {
      const sanitizedUrl = supabaseUrl.trim().replace(/\/rest\/v1\/?$/, "");
      supabaseClient = createClient(sanitizedUrl, supabaseKey);
      return supabaseClient;
    } catch (e) {
      console.error("ServerStorage: Failed to initialize Supabase:", e);
    }
  }
  return null;
}

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

// src/api/portfolio/ai.ts
async function handler(req, res) {
  const startTime = Date.now();
  const rawUrl = req.url || "";
  const parsedUrl = new URL(rawUrl, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;
  if (req.method !== "POST") {
    return sendError(res, 405, "Method Not Allowed. Only POST is supported.");
  }
  if (pathname.includes("/ai-package-parse")) {
    try {
      const body = req.body || {};
      const { fileName, fileDataBase64, fileType, files } = body;
      const rawFilesToCompile = [];
      if (Array.isArray(files) && files.length > 0) {
        for (const fileMeta of files) {
          const name = fileMeta.name || fileMeta.fileName;
          if (!name) {
            return sendError(res, 400, "File item missing name in files payload.");
          }
          if (!isAllowedFileType(name)) {
            return sendError(res, 400, `Unsupported file format '${name}' uploaded.`);
          }
          let buffer = null;
          if (fileMeta.storagePath) {
            const client = getSupabaseClient();
            if (client) {
              try {
                const bucket = process.env.SUPABASE_STORAGE_BUCKET || "portfolio-uploads";
                const { data, error } = await client.storage.from(bucket).download(fileMeta.storagePath);
                if (!error && data) {
                  const arrayBuffer = await data.arrayBuffer();
                  buffer = Buffer.from(arrayBuffer);
                } else if (error) {
                  const { category, message } = categorizeStorageError(error);
                  console.warn(`[ai-package-parse] Storage download failed for path '${fileMeta.storagePath}' [Category: ${category}]: ${message}`);
                }
              } catch (downloadErr) {
                console.warn(`[ai-package-parse] Exception downloading storage path '${fileMeta.storagePath}':`, downloadErr.message);
              }
            }
          }
          if (!buffer && fileMeta.fallbackContent) {
            try {
              buffer = Buffer.from(fileMeta.fallbackContent, "base64");
            } catch (fallbackErr) {
              console.warn(`Error decoding fallbackContent for '${name}':`, fallbackErr.message);
            }
          }
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
    } catch (err) {
      return sendError(res, 500, "Failed to compile uploaded analytic package.", err.message);
    }
  }
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
    } catch (err) {
      return sendError(res, 500, "Failed to parse source code.", err.message);
    }
  }
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
    } catch (err) {
      return sendError(res, 500, "Failed to process copilot request.", err.message);
    }
  }
  return sendError(res, 404, "Sub-route not found.");
}
export {
  handler as default
};
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
