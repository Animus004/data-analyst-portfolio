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
async function parseUploadedPackage(fileName, buffer) {
  return compileProjectPackage([{
    name: fileName,
    size: buffer.length,
    type: "binary",
    content: buffer.toString("base64")
  }]);
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
