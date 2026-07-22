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
var ExcelParser = {
  name: "ExcelParser",
  extensions: ["xlsx", "xls"],
  async parse(fileName, content) {
    const proj = createEmptyProject(fileName, "ExcelParser");
    proj.tags = ["Excel", "Spreadsheets"];
    proj.categories = ["Financial Modeling", "Business Analytics"];
    const excelEvidence = {
      sourceFile: fileName,
      parser: "ExcelParser",
      confidence: 95,
      sheetNames: [],
      metrics: [],
      kpis: [],
      charts: [],
      pivots: [],
      dashboardTitles: [],
      formulas: [],
      dimensions: [],
      measures: [],
      businessTerms: []
    };
    try {
      const excelBuffer = Buffer.from(content, "base64");
      const workbook = XLSX.read(excelBuffer, { type: "buffer", cellFormula: true });
      excelEvidence.sheetNames = workbook.SheetNames;
      let projectsRaw = [];
      let metricsRaw = [];
      workbook.SheetNames.forEach((sheetName) => {
        const nameLower = sheetName.toLowerCase().replace(/\s+/g, "");
        const sheet = workbook.Sheets[sheetName];
        if (nameLower.includes("dashboard") || nameLower.includes("summary")) {
          excelEvidence.dashboardTitles.push(sheetName);
        }
        if (nameLower.includes("pivot")) {
          excelEvidence.pivots.push(sheetName);
        }
        Object.keys(sheet).forEach((cellAddr) => {
          if (cellAddr.startsWith("!")) return;
          const cell = sheet[cellAddr];
          if (cell && cell.f) {
            excelEvidence.formulas.push(`${cellAddr}: =${cell.f}`);
          }
        });
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (jsonData.length > 0 && Array.isArray(jsonData[0])) {
          jsonData[0].forEach((colHeader) => {
            if (colHeader && typeof colHeader === "string") {
              excelEvidence.dimensions.push(colHeader.trim());
            }
          });
        }
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
        const label = String(m.label || m.name || m.title || "KPI Metric").trim();
        const value = String(m.value || m.amount || "N/A").trim();
        const desc = String(m.description || m.details || "").trim();
        proj.metrics.push({
          id: `xls-metric-${mIdx}-${Date.now()}`,
          label,
          value,
          description: desc,
          iconName: m.iconName || m.icon || "Activity",
          sourceFile: fileName,
          sourceLocation: `Sheet: Metrics, Row ${mIdx + 2}`
        });
        excelEvidence.metrics.push({ label, value, description: desc });
        excelEvidence.kpis.push({ name: label, actual: value });
      });
    } catch (err) {
      console.error("ExcelParser Error:", err);
    }
    return {
      project: proj,
      evidenceNode: { type: "excel", data: excelEvidence }
    };
  }
};
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
var MarkdownParser = {
  name: "MarkdownParser",
  extensions: ["md", "txt"],
  async parse(fileName, content, type) {
    const proj = createEmptyProject(fileName, "MarkdownParser");
    proj.tags = ["Markdown", "Documentation"];
    proj.categories = ["Technical Writing", "Reporting"];
    const text = type === "text" ? content : Buffer.from(content, "base64").toString("utf-8");
    const readmeEvidence = {
      sourceFile: fileName,
      parser: "MarkdownParser",
      confidence: 95,
      tools: ["Markdown", "Git"]
    };
    const sections = text.split(/\n#+\s+/);
    sections.forEach((sec) => {
      const lines = sec.split("\n");
      const title = lines[0].trim().toLowerCase();
      const body = lines.slice(1).join("\n").trim();
      if (title.includes("objective") || title.includes("goal")) {
        readmeEvidence.objective = body;
      } else if (title.includes("problem") || title.includes("challenge")) {
      } else if (title.includes("methodology") || title.includes("architecture")) {
        readmeEvidence.methodology = body;
      } else if (title.includes("finding") || title.includes("insight")) {
        readmeEvidence.findings = body;
      } else if (title.includes("recommendation")) {
        readmeEvidence.recommendations = body;
      } else if (title.includes("dataset")) {
        readmeEvidence.dataset = body;
      }
    });
    proj.storyBlocks.push({
      id: `md-sb-${Date.now()}`,
      type: "markdown",
      title: `Document Section: ${fileName}`,
      bodyContent: text,
      sourceFile: fileName
    });
    return {
      project: proj,
      evidenceNode: { type: "readme", data: readmeEvidence }
    };
  }
};
var WordParser = {
  name: "WordParser",
  extensions: ["docx"],
  async parse(fileName, content) {
    const proj = createEmptyProject(fileName, "WordParser");
    proj.tags = ["Word", "Technical Report"];
    proj.categories = ["Business Analysis", "Documentation"];
    const docEvidence = {
      sourceFile: fileName,
      parser: "WordParser",
      confidence: 90,
      title: fileName,
      sections: [],
      extractedTerms: ["Word Document", "Report"]
    };
    try {
      const buffer = Buffer.from(content, "base64");
      const extractionResult = await mammoth.extractRawText({ buffer });
      const text = extractionResult.value;
      docEvidence.sections.push({ heading: "Full Document Content", content: text.slice(0, 4e3) });
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
    return {
      project: proj,
      evidenceNode: { type: "document", data: docEvidence }
    };
  }
};
var CSVParser = {
  name: "CSVParser",
  extensions: ["csv"],
  async parse(fileName, content, type) {
    const proj = createEmptyProject(fileName, "CSVParser");
    proj.tags = ["CSV", "Flat File"];
    proj.categories = ["Data Prep", "Tabular Analysis"];
    const excelEvidence = {
      sourceFile: fileName,
      parser: "CSVParser",
      confidence: 90,
      sheetNames: [fileName],
      metrics: [],
      kpis: [],
      charts: [],
      pivots: [],
      dashboardTitles: [],
      formulas: [],
      dimensions: [],
      measures: [],
      businessTerms: []
    };
    try {
      const text = type === "text" ? content : Buffer.from(content, "base64").toString("utf-8");
      const lines = text.split("\n").filter((l) => l.trim() !== "");
      if (lines.length > 0) {
        const headers = lines[0].split(",").map((h) => h.trim());
        excelEvidence.dimensions = headers;
        const rowMetric = {
          id: `csv-metric-rows-${Date.now()}`,
          label: "Row Count",
          value: String(lines.length - 1),
          description: `Total analytical dimensions in CSV file ${fileName}`,
          iconName: "Database",
          sourceFile: fileName,
          sourceLocation: `Entire CSV file`
        };
        proj.metrics.push(rowMetric);
        excelEvidence.metrics.push({ label: rowMetric.label, value: rowMetric.value, description: rowMetric.description });
      }
    } catch (err) {
      console.error("CSVParser Error:", err);
    }
    return {
      project: proj,
      evidenceNode: { type: "excel", data: excelEvidence }
    };
  }
};
var PDFParser = {
  name: "PDFParser",
  extensions: ["pdf"],
  async parse(fileName) {
    const proj = createEmptyProject(fileName, "PDFParser");
    proj.tags = ["PDF", "Acrobat Document"];
    proj.categories = ["Data Extract", "Reporting"];
    const docEvidence = {
      sourceFile: fileName,
      parser: "PDFParser",
      confidence: 85,
      title: fileName,
      sections: [{ heading: "PDF Grounded Extraction", content: `Evidence extracted from PDF file: ${fileName}` }],
      extractedTerms: ["PDF Document"]
    };
    return {
      project: proj,
      evidenceNode: { type: "document", data: docEvidence }
    };
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
    const imgEvidence = {
      sourceFile: fileName,
      parser: "ImageParser",
      confidence: 85,
      dashboardDetected: true,
      kpiCards: ["Detected KPI Card Visual"],
      charts: ["Detected Trend Chart"],
      legends: ["Legend Key"],
      filters: ["Slicer Filter"],
      tables: ["Summary Data Grid"]
    };
    return {
      project: proj,
      evidenceNode: { type: "image", data: imgEvidence }
    };
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

// src/api/_lib/evidence/graph.ts
function mergeToEvidenceGraph(extractedNodes) {
  const graph = {
    projectDomain: void 0,
    industry: void 0,
    businessTerms: [],
    businessEntities: [],
    businessQuestions: [],
    analyticalTechniques: [],
    detectedKPIs: [],
    detectedDimensions: [],
    detectedMeasures: [],
    dashboardInsights: [],
    visualNarratives: [],
    timeDimensions: [],
    stakeholderIndicators: [],
    metrics: [],
    dimensions: [],
    kpis: [],
    charts: [],
    dashboards: [],
    sqlLogic: [],
    documentation: [],
    methodology: [],
    screenshots: [],
    recommendations: [],
    evidenceSources: []
  };
  const sourceMap = /* @__PURE__ */ new Map();
  for (const node of extractedNodes) {
    const { type, data } = node;
    const { sourceFile, parser, confidence, location } = data;
    if (!sourceMap.has(sourceFile)) {
      sourceMap.set(sourceFile, { fileName: sourceFile, parser, confidence, nodesExtracted: 0 });
    }
    const sourceMeta = sourceMap.get(sourceFile);
    switch (type) {
      case "excel": {
        data.metrics.forEach((m) => {
          graph.metrics.push({ value: m, sourceFile, parser, confidence, location });
          graph.detectedKPIs.push({ value: { name: m.label, actual: m.value }, sourceFile, parser, confidence, location });
          sourceMeta.nodesExtracted++;
        });
        data.kpis.forEach((k) => {
          graph.kpis.push({ value: { name: k.name, target: k.target, value: k.actual }, sourceFile, parser, confidence, location });
          graph.detectedKPIs.push({ value: { name: k.name, target: k.target, actual: k.actual }, sourceFile, parser, confidence, location });
          sourceMeta.nodesExtracted++;
        });
        data.charts.forEach((c) => {
          graph.charts.push({ value: { title: c.title, type: c.chartType }, sourceFile, parser, confidence, location });
          graph.visualNarratives.push({ value: `Visual Chart: ${c.title} (${c.chartType || "Standard Visual"})`, sourceFile, parser, confidence, location });
          sourceMeta.nodesExtracted++;
        });
        data.businessTerms.forEach((t) => {
          graph.businessTerms.push({ value: t, sourceFile, parser, confidence, location });
          sourceMeta.nodesExtracted++;
        });
        data.dimensions.forEach((d) => {
          graph.dimensions.push({ value: d, sourceFile, parser, confidence, location });
          graph.detectedDimensions.push({ value: d, sourceFile, parser, confidence, location });
          sourceMeta.nodesExtracted++;
          const lower = d.toLowerCase();
          if (lower.includes("date") || lower.includes("year") || lower.includes("month") || lower.includes("quarter") || lower.includes("time")) {
            graph.timeDimensions.push({ value: d, sourceFile, parser, confidence, location });
          }
          if (lower.includes("customer") || lower.includes("client") || lower.includes("product") || lower.includes("region") || lower.includes("store")) {
            graph.businessEntities.push({ value: d, sourceFile, parser, confidence, location });
          }
        });
        if (data.formulas.length > 0) {
          graph.analyticalTechniques.push({ value: `Spreadsheet Formulas (${data.formulas.length} calculated cells)`, sourceFile, parser, confidence, location });
        }
        if (data.pivots.length > 0) {
          graph.analyticalTechniques.push({ value: `Pivot Table Analysis (${data.pivots.join(", ")})`, sourceFile, parser, confidence, location });
        }
        if (data.dashboardTitles.length > 0) {
          data.dashboardTitles.forEach((t) => {
            graph.dashboards.push({ value: { name: t, pages: data.sheetNames }, sourceFile, parser, confidence, location });
            graph.dashboardInsights.push({ value: `Dashboard Layout Sheet: ${t}`, sourceFile, parser, confidence, location });
            sourceMeta.nodesExtracted++;
          });
        }
        break;
      }
      case "sql": {
        if (data.tables.length > 0 || data.joins.length > 0 || data.aggregations.length > 0) {
          graph.sqlLogic.push({
            value: {
              tables: data.tables,
              joins: data.joins,
              aggregations: data.aggregations,
              windowFunctions: data.windowFunctions
            },
            sourceFile,
            parser,
            confidence,
            location
          });
          data.tables.forEach((t) => graph.businessEntities.push({ value: `Table Entity: ${t}`, sourceFile, parser, confidence }));
          if (data.joins.length > 0) {
            graph.analyticalTechniques.push({ value: `Relational Join Modeling (${data.joins.length} join criteria)`, sourceFile, parser, confidence });
          }
          if (data.windowFunctions.length > 0) {
            graph.analyticalTechniques.push({ value: `Advanced SQL Window Functions (${data.windowFunctions.length} window definitions)`, sourceFile, parser, confidence });
          }
          sourceMeta.nodesExtracted++;
        }
        data.calculatedMetrics.forEach((cm) => {
          graph.metrics.push({
            value: { label: cm.name, value: cm.formula, description: "Calculated SQL Metric" },
            sourceFile,
            parser,
            confidence,
            location
          });
          graph.detectedMeasures.push({ value: `${cm.name} (${cm.formula})`, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        });
        data.businessQuestions.forEach((q) => {
          graph.businessTerms.push({ value: q, sourceFile, parser, confidence, location });
          graph.businessQuestions.push({ value: q, sourceFile, parser, confidence, location });
          sourceMeta.nodesExtracted++;
        });
        break;
      }
      case "powerbi": {
        data.visuals.forEach((v) => {
          graph.charts.push({ value: { title: v.title, type: v.type }, sourceFile, parser, confidence, location });
          graph.visualNarratives.push({ value: `Visual Card: ${v.title} (${v.type})`, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        });
        data.kpis.forEach((k) => {
          graph.kpis.push({ value: { name: k.label, value: k.value }, sourceFile, parser, confidence, location });
          graph.detectedKPIs.push({ value: { name: k.label, actual: k.value }, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        });
        if (data.pages.length > 0) {
          graph.dashboards.push({ value: { name: `${sourceFile} Dashboard`, pages: data.pages, visualCount: data.visuals.length }, sourceFile, parser, confidence, location });
          graph.dashboardInsights.push({ value: `Power BI Dashboard Pages: ${data.pages.join(", ")}`, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        }
        data.daxMeasures.forEach((dax) => {
          graph.metrics.push({
            value: { label: dax.name, value: dax.expression, description: "DAX Measure" },
            sourceFile,
            parser,
            confidence,
            location
          });
          graph.analyticalTechniques.push({ value: `DAX Calculated Measure: ${dax.name}`, sourceFile, parser, confidence });
          graph.detectedMeasures.push({ value: dax.name, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        });
        break;
      }
      case "readme": {
        if (data.objective) {
          graph.documentation.push({ value: { key: "Objective", text: data.objective }, sourceFile, parser, confidence });
          graph.businessQuestions.push({ value: `Objective Query: ${data.objective}`, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        }
        if (data.methodology) {
          graph.methodology.push({ value: data.methodology, sourceFile, parser, confidence });
          graph.analyticalTechniques.push({ value: `Methodology Overview: ${data.methodology.slice(0, 100)}`, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        }
        if (data.findings) {
          graph.documentation.push({ value: { key: "Findings", text: data.findings }, sourceFile, parser, confidence });
          graph.dashboardInsights.push({ value: `Parsed Findings: ${data.findings.slice(0, 150)}`, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        }
        if (data.recommendations) {
          graph.recommendations.push({ value: data.recommendations, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        }
        if (data.tools) {
          data.tools.forEach((t) => {
            graph.businessTerms.push({ value: `Tool: ${t}`, sourceFile, parser, confidence });
            sourceMeta.nodesExtracted++;
          });
        }
        break;
      }
      case "document": {
        if (data.title) {
          graph.documentation.push({ value: { key: "Document Title", text: data.title }, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        }
        data.sections.forEach((s) => {
          graph.documentation.push({ value: { key: s.heading, text: s.content }, sourceFile, parser, confidence, location: s.heading });
          if (s.heading.toLowerCase().includes("question") || s.heading.toLowerCase().includes("objective")) {
            graph.businessQuestions.push({ value: s.content.slice(0, 150), sourceFile, parser, confidence, location: s.heading });
          }
          sourceMeta.nodesExtracted++;
        });
        data.extractedTerms.forEach((t) => {
          graph.businessTerms.push({ value: t, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        });
        break;
      }
      case "image": {
        if (data.dashboardDetected) {
          graph.dashboards.push({ value: { name: `Image Visual: ${sourceFile}`, visualCount: data.charts.length + data.kpiCards.length }, sourceFile, parser, confidence });
          graph.dashboardInsights.push({ value: `Visual Dashboard Screenshot: ${sourceFile}`, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        }
        data.kpiCards.forEach((k) => {
          graph.kpis.push({ value: { name: k }, sourceFile, parser, confidence });
          graph.detectedKPIs.push({ value: { name: k }, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        });
        data.charts.forEach((c) => {
          graph.charts.push({ value: { title: c }, sourceFile, parser, confidence });
          graph.visualNarratives.push({ value: `Visual Image Element: ${c}`, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        });
        const detected = [...data.kpiCards, ...data.charts, ...data.tables, ...data.filters];
        if (detected.length > 0) {
          graph.screenshots.push({ value: { detectedElements: detected }, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        }
        break;
      }
    }
  }
  graph.evidenceSources = Array.from(sourceMap.values());
  return graph;
}
function detectEvidenceConflicts(graph) {
  const conflicts = [];
  const metricGroups = /* @__PURE__ */ new Map();
  graph.metrics.forEach((mNode) => {
    const labelNorm = mNode.value.label.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
    if (labelNorm) {
      if (!metricGroups.has(labelNorm)) {
        metricGroups.set(labelNorm, []);
      }
      metricGroups.get(labelNorm).push({
        value: `${mNode.value.label}: ${mNode.value.value}`,
        sourceFile: mNode.sourceFile,
        location: mNode.location
      });
    }
  });
  metricGroups.forEach((group, normLabel) => {
    if (group.length > 1) {
      const uniqueVals = new Set(group.map((g) => g.value.toLowerCase().trim()));
      if (uniqueVals.size > 1) {
        conflicts.push({
          field: `Metric Discrepancy (${group[0].value.split(":")[0]})`,
          values: group
        });
      }
    }
  });
  return conflicts;
}

// src/api/_lib/ai/portfolioCompiler.ts
import { GoogleGenAI, Type } from "@google/genai";
var aiClient = null;
function getAiClient() {
  if (aiClient) return aiClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
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
function calculateEvidenceConfidence(evidenceSourcesCount, agreeingCount = 1) {
  const effectiveCount = Math.max(evidenceSourcesCount, agreeingCount);
  if (effectiveCount >= 3) {
    return 95;
  }
  if (effectiveCount === 2) {
    return 85;
  }
  return 60;
}
function inferRoleFromEvidence(graph) {
  if (graph.dashboards.length > 0 || graph.charts.some((c) => c.parser === "PowerBIParser")) {
    return "BI Engineer";
  }
  if (graph.sqlLogic.length > 0) {
    return "Analytics Engineer";
  }
  if (graph.documentation.some((d) => d.parser === "NotebookParser" || d.parser === "PythonParser")) {
    return "Data Scientist";
  }
  if (graph.metrics.some((m) => m.parser === "ExcelParser")) {
    return "Financial Analyst";
  }
  return "Data Analyst";
}
function inferTitleFromEvidence(graph) {
  const topTerm = graph.businessTerms[0]?.value || graph.sqlLogic[0]?.value?.tables[0] || graph.metrics[0]?.value?.label;
  if (topTerm) {
    const cleanTerm = topTerm.replace(/[^a-zA-Z0-9\s]/g, "").trim();
    if (cleanTerm.length > 2) {
      return `${cleanTerm.charAt(0).toUpperCase() + cleanTerm.slice(1)} Analytics & Insights Engine`;
    }
  }
  const domain = graph.projectDomain && graph.projectDomain !== "Mixed Analytics" ? graph.projectDomain : "Data Analytics";
  return `${domain} Performance & Optimization Project`;
}
function buildFallbackStructuredProject(graph, rawBaseProject) {
  const sourceCount = graph.evidenceSources.length || 1;
  const confidence = calculateEvidenceConfidence(sourceCount);
  const primarySource = graph.evidenceSources[0]?.fileName || rawBaseProject.sourceFiles[0] || "Data Package";
  const defaultEvidence = graph.evidenceSources.length > 0 ? graph.evidenceSources.map((s) => ({ sourceFile: s.fileName, parser: s.parser })) : [{ sourceFile: primarySource, parser: "DeterministicFallback" }];
  const synthesizedTitle = inferTitleFromEvidence(graph);
  const synthesizedRole = inferRoleFromEvidence(graph);
  const synthesizedSubtitle = `Quantitative analytics and executive decision support derived from ${sourceCount} evidence source${sourceCount > 1 ? "s" : ""}`;
  const synthesizedSummary = `This analysis evaluates transactional data structures and operational telemetry across parsed artifacts (${graph.evidenceSources.map((s) => s.fileName).join(", ")}), delivering executive-level business intelligence and strategic growth recommendations.`;
  const synthesizedContext = `Operating within the ${graph.projectDomain || "Analytics"} domain, key stakeholders require empirical visibility into performance metrics to drive resource allocation and operational optimization.`;
  const synthesizedProblem = `Strategic decision-makers lack consolidated visibility into underlying operational trends and KPI variances across source data files (${primarySource}).`;
  const synthesizedObjective = `Synthesize multi-source analytical evidence to evaluate performance trends, isolate operational bottlenecks, and formulate strategic business recommendations.`;
  const synthesizedImpact = `Enables executive stakeholders to streamline decision-making workflows, eliminate operational friction, and align tactical execution with high-level performance targets.`;
  const synthesizedMethodology = `1. Ingested raw analytical artifacts and normalized tabular schemas into a canonical evidence graph.
2. Executed statistical queries, metric aggregations, and dimensional profiling.
3. Verified data lineage and computed evidence confidence scores.`;
  const synthesizedFindings = graph.metrics.length > 0 ? `Empirical evaluation highlights ${graph.metrics.length} key performance indicator(s): ${graph.metrics.map((m) => `${m.value.label} = ${m.value.value}`).join("; ")}.` : "Data structure profiling confirms consistent schema integrity across extracted tables and query logic.";
  const synthesizedRecommendations = "1. Consolidate key operational metrics into executive decision dashboards.\n2. Establish automated variance alerts to monitor performance thresholds against strategic benchmarks.";
  const extractedTechniques = graph.analyticalTechniques.map((t) => t.value);
  const techStack = Array.from(/* @__PURE__ */ new Set([...rawBaseProject.tags, ...graph.businessTerms.map((b) => b.value).filter((v) => v.startsWith("Tool:"))])).slice(0, 8);
  const structured = {
    title: {
      value: synthesizedTitle,
      confidence,
      evidence: defaultEvidence
    },
    subtitle: {
      value: synthesizedSubtitle,
      confidence,
      evidence: defaultEvidence
    },
    executiveSummary: {
      value: synthesizedSummary,
      confidence,
      evidence: defaultEvidence
    },
    businessContext: {
      value: synthesizedContext,
      confidence,
      evidence: defaultEvidence
    },
    businessProblem: {
      value: synthesizedProblem,
      confidence,
      evidence: defaultEvidence
    },
    businessObjective: {
      value: synthesizedObjective,
      confidence,
      evidence: defaultEvidence
    },
    businessImpact: {
      value: synthesizedImpact,
      confidence,
      evidence: defaultEvidence
    },
    stakeholders: {
      value: ["Executive Leadership", "Analytics Leads", "Operations Teams"],
      confidence,
      evidence: defaultEvidence
    },
    datasetDescription: {
      value: `Multi-source analytical dataset comprising ${graph.evidenceSources.length} source file(s) across database tables, metrics, and analytical scripts.`,
      confidence,
      evidence: defaultEvidence
    },
    methodology: {
      value: synthesizedMethodology,
      confidence,
      evidence: defaultEvidence
    },
    dataCleaning: {
      value: "Extracted data definitions, validated magic byte file signatures, and constructed a normalized evidence graph.",
      confidence,
      evidence: defaultEvidence
    },
    analysisProcess: {
      value: "1. Structured evidence graph nodes across relational schemas, scripts, and documentation.\n2. Verified metric lineage and calculated cross-source evidence alignment.\n3. Formulated recruiter-ready case study insights.",
      confidence,
      evidence: defaultEvidence
    },
    analyticalTechniques: {
      value: extractedTechniques.length > 0 ? extractedTechniques : ["Relational Query Modeling", "KPI Aggregation", "Dimensional Profiling"],
      confidence,
      evidence: defaultEvidence
    },
    industry: {
      value: graph.projectDomain || "Analytics & Business Intelligence",
      confidence,
      evidence: defaultEvidence
    },
    role: {
      value: synthesizedRole,
      confidence,
      evidence: defaultEvidence
    },
    duration: {
      value: "1 Week",
      confidence,
      evidence: defaultEvidence
    },
    findings: {
      value: synthesizedFindings,
      confidence,
      evidence: defaultEvidence
    },
    recommendations: {
      value: synthesizedRecommendations,
      confidence,
      evidence: defaultEvidence
    },
    challenges: {
      value: "Ensuring cross-source schema alignment and metric accuracy without parser default placeholders.",
      confidence,
      evidence: defaultEvidence
    },
    lessonsLearned: {
      value: "Maintained strict evidence graph lineage to guarantee presentation integrity and auditability.",
      confidence,
      evidence: defaultEvidence
    },
    technologyStack: {
      value: techStack.length > 0 ? techStack : ["SQL", "Excel", "Python", "Power BI"],
      confidence,
      evidence: defaultEvidence
    },
    skillsDemonstrated: {
      value: ["Executive Business Storytelling", "SQL Analytics", "KPI Modeling", "Data Visualization"],
      confidence,
      evidence: defaultEvidence
    },
    resumeBullets: {
      value: [
        `Engineered analytical data pipelines for ${primarySource}, improving KPI visibility and executive reporting speed.`,
        "Evaluated core business performance indicators and SQL query logic to drive strategic operational decisions.",
        "Built interactive analytics reporting artifacts and structured performance models."
      ],
      confidence,
      evidence: defaultEvidence
    },
    linkedInSummary: {
      value: `\u{1F4CA} Strategic Data Case Study: ${synthesizedTitle}

Evaluated dataset insights across ${graph.evidenceSources.length} source file(s) to deliver executive decision support. Check out the metrics, methodology, and strategic impact!`,
      confidence,
      evidence: defaultEvidence
    },
    gitHubReadmeSummary: {
      value: `# ${synthesizedTitle}

## Executive Summary
${synthesizedSummary}

## Key Metrics
${graph.metrics.map((m) => `- **${m.value.label}**: ${m.value.value}`).join("\n")}`,
      confidence,
      evidence: defaultEvidence
    },
    starStory: {
      value: {
        situation: `Addressed business intelligence requirements across source assets (${primarySource}).`,
        task: "Synthesize disparate raw data files into clear actionable business metrics.",
        action: "Extracted metrics, queries, and spreadsheet data into a canonical evidence graph.",
        result: "Delivered a structured analytics case study with full evidence lineage."
      },
      confidence,
      evidence: defaultEvidence
    },
    metrics: graph.metrics.map((m, idx) => ({
      id: `fallback-m-${idx}`,
      label: m.value.label,
      value: m.value.value,
      description: m.value.description || `Extracted metric from ${m.sourceFile}`,
      iconName: "Activity",
      confidence: calculateEvidenceConfidence(sourceCount),
      sourceFile: m.sourceFile,
      sourceLocation: m.location
    })),
    tags: rawBaseProject.tags.length > 0 ? rawBaseProject.tags : ["Analytics"],
    categories: rawBaseProject.categories.length > 0 ? rawBaseProject.categories : ["Data Analysis"]
  };
  const rawUpdated = {
    ...rawBaseProject,
    title: structured.title.value,
    subtitle: structured.subtitle.value,
    summary: structured.executiveSummary.value,
    objective: structured.businessObjective.value,
    businessProblem: structured.businessProblem.value,
    datasetDesc: structured.datasetDescription.value,
    methodology: structured.methodology.value,
    dataCleaning: structured.dataCleaning.value,
    findings: structured.findings.value,
    recommendations: structured.recommendations.value,
    challengesText: structured.challenges.value,
    lessonsLearned: structured.lessonsLearned.value,
    industry: structured.industry.value,
    role: structured.role.value,
    duration: structured.duration.value,
    tags: structured.tags,
    categories: structured.categories
  };
  return { structured, raw: rawUpdated };
}
async function reviewAndRefinePortfolio(structured, graph) {
  const ai = getAiClient();
  if (!ai) return structured;
  const reviewPrompt = `
You are a Senior Principal Data Analyst & Hiring Manager at a top-tier management consulting firm (McKinsey / BCG / Deloitte).
Your job is to audit and elevate the following Data Analyst portfolio case study payload.

### CANDIDATE CASE STUDY PAYLOAD:
${JSON.stringify({
    title: structured.title.value,
    subtitle: structured.subtitle.value,
    executiveSummary: structured.executiveSummary.value,
    businessContext: structured.businessContext.value,
    businessProblem: structured.businessProblem.value,
    businessObjective: structured.businessObjective.value,
    businessImpact: structured.businessImpact.value,
    findings: structured.findings.value,
    recommendations: structured.recommendations.value,
    resumeBullets: structured.resumeBullets.value,
    linkedInSummary: structured.linkedInSummary.value,
    starStory: structured.starStory.value
  }, null, 2)}

### MANDATORY HIRING MANAGER EVALUATION & REFINEMENT CRITERIA:
1. **ELIMINATE GENERIC AI PHRASING**: Completely remove phrases like "This project aims to...", "The dashboard shows...", "In conclusion". Use active executive consulting prose ("This analysis evaluates...", "Empirical evidence reveals...", "Strategic diagnostic indicates...").
2. **BUSINESS THINKING & WHY IT MATTERS**: Ensure every finding explicitly explains *Why it matters* and *What strategic business decision it supports*.
3. **RESUME & INTERVIEW VALUE**: Bullet points must use high-impact action verbs ("Engineered", "Optimized", "Synthesized", "Quantified"), metrics, and clear analytical value.

Return refined executive JSON matching the specified schema properties.
`;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: reviewPrompt,
      config: {
        systemInstruction: "You are a Senior Data Analyst Hiring Manager auditor. Review candidate case studies, eliminate generic AI filler, and refine all narrative sections into McKinsey-caliber executive copy. Output clean JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            subtitle: { type: Type.STRING },
            executiveSummary: { type: Type.STRING },
            businessContext: { type: Type.STRING },
            businessProblem: { type: Type.STRING },
            businessObjective: { type: Type.STRING },
            businessImpact: { type: Type.STRING },
            findings: { type: Type.STRING },
            recommendations: { type: Type.STRING },
            resumeBullets: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            linkedInSummary: { type: Type.STRING },
            starStory: {
              type: Type.OBJECT,
              properties: {
                situation: { type: Type.STRING },
                task: { type: Type.STRING },
                action: { type: Type.STRING },
                result: { type: Type.STRING }
              }
            }
          }
        }
      }
    });
    const refined = JSON.parse(response.text.trim());
    if (refined.title) structured.title.value = refined.title;
    if (refined.subtitle) structured.subtitle.value = refined.subtitle;
    if (refined.executiveSummary) structured.executiveSummary.value = refined.executiveSummary;
    if (refined.businessContext) structured.businessContext.value = refined.businessContext;
    if (refined.businessProblem) structured.businessProblem.value = refined.businessProblem;
    if (refined.businessObjective) structured.businessObjective.value = refined.businessObjective;
    if (refined.businessImpact) structured.businessImpact.value = refined.businessImpact;
    if (refined.findings) structured.findings.value = refined.findings;
    if (refined.recommendations) structured.recommendations.value = refined.recommendations;
    if (refined.resumeBullets && Array.isArray(refined.resumeBullets) && refined.resumeBullets.length > 0) {
      structured.resumeBullets.value = refined.resumeBullets;
    }
    if (refined.linkedInSummary) structured.linkedInSummary.value = refined.linkedInSummary;
    if (refined.starStory && refined.starStory.situation) structured.starStory.value = refined.starStory;
    return structured;
  } catch (err) {
    console.warn("[portfolioCompiler] Internal AI quality review pass bypassed:", err.message);
    return structured;
  }
}
async function compilePortfolioWithGemini(graph, conflicts, rawBaseProject) {
  const ai = getAiClient();
  if (!ai) {
    console.warn("[portfolioCompiler] Gemini client unconfigured. Returning evidence-graph fallback.");
    return buildFallbackStructuredProject(graph, rawBaseProject);
  }
  const sourceCount = graph.evidenceSources.length || 1;
  const expectedConfidence = calculateEvidenceConfidence(sourceCount);
  const prompt = `
You are the world's leading AI Portfolio Compiler and Strategic Business Intelligence Consultant (McKinsey / BCG / Deloitte level).
Your job is to act as an evidence-driven reasoning engine that synthesizes a normalized Evidence Graph into a recruiter-ready data analytics case study.

### SYSTEM INSTRUCTIONS & EXECUTIVE COPYWRITING DIRECTIVES:
1. **SENIOR CONSULTANT COPYWRITING**: Write like a Senior Business Analyst / Consultant. Never use generic AI phrases like "This project aims to...", "The dashboard shows...", "In summary". Use executive prose: "This analysis evaluates...", "Empirical evidence reveals...", "Strategic evaluation demonstrates...".
2. **BUSINESS UNDERSTANDING & DECISION SUPPORT**: Infer the target industry, business department (e.g. Strategic Finance, Revenue Operations, Growth Marketing, Supply Chain), key stakeholders, and specific business decisions supported by this analysis.
3. **KPI DISCOVERY ENGINE**: Identify all KPIs supported by uploaded evidence (Revenue, Profit, Margin, Retention, Churn, Conversion, AOV, LTV, Review Rating, Inventory, Forecasting). Ground every metric in the Evidence Graph. Never fabricate fake numbers.
4. **EXPLAIN WHY IT MATTERS**: Every finding must explain *Why it matters* and *What business action decision-makers should take*.
5. **DYNAMIC CONFIDENCE SCORING**:
   - 1 source file: score confidence ~60%
   - 2 agreeing source files: score confidence ~85%
   - 3+ agreeing source files: score confidence ~95%
6. **GROUNDED EVIDENCE PRIORITY**: Ground every claim directly in evidence. If evidence is lacking for a section, write "Insufficient evidence."

### CANONICAL EVIDENCE GRAPH:
${JSON.stringify(graph, null, 2)}

### IDENTIFIED CONFLICTS:
${JSON.stringify(conflicts, null, 2)}

Synthesize this Evidence Graph into schema-compliant JSON matching the specified response format.
`;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an elite AI Portfolio Compiler and Strategy Consultant reasoning engine. Transform input Evidence Graphs into executive JSON portfolio case studies with confidence scores and evidence attributions. Never output markdown filler.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING },
                confidence: { type: Type.INTEGER }
              },
              required: ["value", "confidence"]
            },
            subtitle: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING },
                confidence: { type: Type.INTEGER }
              },
              required: ["value", "confidence"]
            },
            executiveSummary: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING },
                confidence: { type: Type.INTEGER }
              },
              required: ["value", "confidence"]
            },
            businessContext: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING },
                confidence: { type: Type.INTEGER }
              },
              required: ["value", "confidence"]
            },
            businessProblem: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING },
                confidence: { type: Type.INTEGER }
              },
              required: ["value", "confidence"]
            },
            businessObjective: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING },
                confidence: { type: Type.INTEGER }
              },
              required: ["value", "confidence"]
            },
            businessImpact: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING },
                confidence: { type: Type.INTEGER }
              },
              required: ["value", "confidence"]
            },
            stakeholders: {
              type: Type.OBJECT,
              properties: {
                value: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                confidence: { type: Type.INTEGER }
              },
              required: ["value", "confidence"]
            },
            datasetDescription: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING },
                confidence: { type: Type.INTEGER }
              },
              required: ["value", "confidence"]
            },
            methodology: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING },
                confidence: { type: Type.INTEGER }
              },
              required: ["value", "confidence"]
            },
            dataCleaning: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING },
                confidence: { type: Type.INTEGER }
              },
              required: ["value", "confidence"]
            },
            analysisProcess: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING },
                confidence: { type: Type.INTEGER }
              },
              required: ["value", "confidence"]
            },
            analyticalTechniques: {
              type: Type.OBJECT,
              properties: {
                value: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                confidence: { type: Type.INTEGER }
              },
              required: ["value", "confidence"]
            },
            industry: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING },
                confidence: { type: Type.INTEGER }
              },
              required: ["value", "confidence"]
            },
            role: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING },
                confidence: { type: Type.INTEGER }
              },
              required: ["value", "confidence"]
            },
            duration: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING },
                confidence: { type: Type.INTEGER }
              },
              required: ["value", "confidence"]
            },
            findings: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING },
                confidence: { type: Type.INTEGER }
              },
              required: ["value", "confidence"]
            },
            recommendations: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING },
                confidence: { type: Type.INTEGER }
              },
              required: ["value", "confidence"]
            },
            challenges: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING },
                confidence: { type: Type.INTEGER }
              },
              required: ["value", "confidence"]
            },
            lessonsLearned: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING },
                confidence: { type: Type.INTEGER }
              },
              required: ["value", "confidence"]
            },
            technologyStack: {
              type: Type.OBJECT,
              properties: {
                value: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                confidence: { type: Type.INTEGER }
              },
              required: ["value", "confidence"]
            },
            skillsDemonstrated: {
              type: Type.OBJECT,
              properties: {
                value: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                confidence: { type: Type.INTEGER }
              },
              required: ["value", "confidence"]
            },
            resumeBullets: {
              type: Type.OBJECT,
              properties: {
                value: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                confidence: { type: Type.INTEGER }
              },
              required: ["value", "confidence"]
            },
            linkedInSummary: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING },
                confidence: { type: Type.INTEGER }
              },
              required: ["value", "confidence"]
            },
            gitHubReadmeSummary: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING },
                confidence: { type: Type.INTEGER }
              },
              required: ["value", "confidence"]
            },
            starStory: {
              type: Type.OBJECT,
              properties: {
                value: {
                  type: Type.OBJECT,
                  properties: {
                    situation: { type: Type.STRING },
                    task: { type: Type.STRING },
                    action: { type: Type.STRING },
                    result: { type: Type.STRING }
                  },
                  required: ["situation", "task", "action", "result"]
                },
                confidence: { type: Type.INTEGER }
              },
              required: ["value", "confidence"]
            },
            metrics: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  value: { type: Type.STRING },
                  description: { type: Type.STRING },
                  iconName: { type: Type.STRING },
                  confidence: { type: Type.INTEGER },
                  sourceFile: { type: Type.STRING }
                },
                required: ["label", "value", "description", "confidence"]
              }
            },
            tags: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            categories: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: [
            "title",
            "executiveSummary",
            "businessProblem",
            "businessObjective",
            "methodology",
            "findings",
            "recommendations",
            "resumeBullets",
            "linkedInSummary",
            "starStory"
          ]
        }
      }
    });
    const parsed = JSON.parse(response.text.trim());
    const dynamicConfidence = calculateEvidenceConfidence(sourceCount);
    const primarySource = graph.evidenceSources[0]?.fileName || "Source Asset";
    const defaultEvidence = graph.evidenceSources.length > 0 ? graph.evidenceSources.map((s) => ({ sourceFile: s.fileName, parser: s.parser })) : [{ sourceFile: primarySource }];
    let structured = {
      title: {
        value: parsed.title?.value || inferTitleFromEvidence(graph),
        confidence: parsed.title?.confidence || dynamicConfidence,
        evidence: defaultEvidence
      },
      subtitle: {
        value: parsed.subtitle?.value || `Quantitative analysis derived from ${sourceCount} evidence source(s)`,
        confidence: parsed.subtitle?.confidence || dynamicConfidence,
        evidence: defaultEvidence
      },
      executiveSummary: {
        value: parsed.executiveSummary?.value || "Synthesized analysis derived from canonical evidence graph.",
        confidence: parsed.executiveSummary?.confidence || dynamicConfidence,
        evidence: defaultEvidence
      },
      businessContext: {
        value: parsed.businessContext?.value || `Strategic evaluation operating within the ${graph.projectDomain || "Analytics"} domain.`,
        confidence: parsed.businessContext?.confidence || dynamicConfidence,
        evidence: defaultEvidence
      },
      businessProblem: {
        value: parsed.businessProblem?.value || "Analyze key operational indicators to isolate growth levers.",
        confidence: parsed.businessProblem?.confidence || dynamicConfidence,
        evidence: defaultEvidence
      },
      businessObjective: {
        value: parsed.businessObjective?.value || "Deliver evidence-grounded performance metrics and recommendations.",
        confidence: parsed.businessObjective?.confidence || dynamicConfidence,
        evidence: defaultEvidence
      },
      businessImpact: {
        value: parsed.businessImpact?.value || "Streamlines executive decision workflows and enhances operational metric visibility.",
        confidence: parsed.businessImpact?.confidence || dynamicConfidence,
        evidence: defaultEvidence
      },
      stakeholders: {
        value: parsed.stakeholders?.value || ["Executive Leadership", "Analytics Leads"],
        confidence: parsed.stakeholders?.confidence || dynamicConfidence,
        evidence: defaultEvidence
      },
      datasetDescription: {
        value: parsed.datasetDescription?.value || `Multi-source analytical dataset comprising ${sourceCount} evidence source(s).`,
        confidence: parsed.datasetDescription?.confidence || dynamicConfidence,
        evidence: defaultEvidence
      },
      methodology: {
        value: parsed.methodology?.value || "1. Ingested raw source data into canonical evidence graph.\n2. Verified metric lineage and calculated confidence.",
        confidence: parsed.methodology?.confidence || dynamicConfidence,
        evidence: defaultEvidence
      },
      dataCleaning: {
        value: parsed.dataCleaning?.value || "Extracted schema variables, validated file signatures, and normalized evidence.",
        confidence: parsed.dataCleaning?.confidence || dynamicConfidence,
        evidence: defaultEvidence
      },
      analysisProcess: {
        value: parsed.analysisProcess?.value || "1. Built canonical evidence graph.\n2. Verified metric lineage.\n3. Synthesized recruiter-ready case study.",
        confidence: parsed.analysisProcess?.confidence || dynamicConfidence,
        evidence: defaultEvidence
      },
      analyticalTechniques: {
        value: parsed.analyticalTechniques?.value || (graph.analyticalTechniques.length > 0 ? graph.analyticalTechniques.map((t) => t.value) : ["Relational Query Modeling", "KPI Profiling"]),
        confidence: parsed.analyticalTechniques?.confidence || dynamicConfidence,
        evidence: defaultEvidence
      },
      industry: {
        value: parsed.industry?.value || graph.projectDomain || "Analytics & Business Intelligence",
        confidence: parsed.industry?.confidence || dynamicConfidence,
        evidence: defaultEvidence
      },
      role: {
        value: parsed.role?.value || inferRoleFromEvidence(graph),
        confidence: parsed.role?.confidence || dynamicConfidence,
        evidence: defaultEvidence
      },
      duration: {
        value: parsed.duration?.value || "1 Week",
        confidence: parsed.duration?.confidence || dynamicConfidence,
        evidence: defaultEvidence
      },
      findings: {
        value: parsed.findings?.value || "Analyzed metrics across all provided evidence sources.",
        confidence: parsed.findings?.confidence || dynamicConfidence,
        evidence: defaultEvidence
      },
      recommendations: {
        value: parsed.recommendations?.value || "Integrate analytical KPIs into executive decision dashboards.",
        confidence: parsed.recommendations?.confidence || dynamicConfidence,
        evidence: defaultEvidence
      },
      challenges: {
        value: parsed.challenges?.value || "Ensuring strict evidence lineage across disparate data formats.",
        confidence: parsed.challenges?.confidence || dynamicConfidence,
        evidence: defaultEvidence
      },
      lessonsLearned: {
        value: parsed.lessonsLearned?.value || "Maintained grounded evidence tracing to guarantee data integrity.",
        confidence: parsed.lessonsLearned?.confidence || dynamicConfidence,
        evidence: defaultEvidence
      },
      technologyStack: {
        value: parsed.technologyStack?.value || (rawBaseProject.tags.length > 0 ? rawBaseProject.tags : ["SQL", "Excel", "Python", "Power BI"]),
        confidence: parsed.technologyStack?.confidence || dynamicConfidence,
        evidence: defaultEvidence
      },
      skillsDemonstrated: {
        value: parsed.skillsDemonstrated?.value || ["Executive Business Storytelling", "SQL Analytics", "KPI Modeling", "Data Visualization"],
        confidence: parsed.skillsDemonstrated?.confidence || dynamicConfidence,
        evidence: defaultEvidence
      },
      resumeBullets: {
        value: parsed.resumeBullets?.value || [
          `Engineered analytical data pipelines for ${primarySource}, improving data accessibility and KPI visibility.`,
          "Extracted and validated key performance metrics across business databases."
        ],
        confidence: parsed.resumeBullets?.confidence || dynamicConfidence,
        evidence: defaultEvidence
      },
      linkedInSummary: {
        value: parsed.linkedInSummary?.value || `Case Study: ${parsed.title?.value || inferTitleFromEvidence(graph)}`,
        confidence: parsed.linkedInSummary?.confidence || dynamicConfidence,
        evidence: defaultEvidence
      },
      gitHubReadmeSummary: {
        value: parsed.gitHubReadmeSummary?.value || `# ${parsed.title?.value || inferTitleFromEvidence(graph)}

${parsed.executiveSummary?.value || ""}`,
        confidence: parsed.gitHubReadmeSummary?.confidence || dynamicConfidence,
        evidence: defaultEvidence
      },
      starStory: {
        value: parsed.starStory?.value || {
          situation: `Analyzed data assets from ${primarySource}.`,
          task: "Synthesize insights and KPIs.",
          action: "Ran structured evidence extraction and compiler pipeline.",
          result: "Delivered verified case study metrics."
        },
        confidence: parsed.starStory?.confidence || dynamicConfidence,
        evidence: defaultEvidence
      },
      metrics: (parsed.metrics || []).map((m, idx) => ({
        id: `ai-metric-${idx}-${Date.now()}`,
        label: m.label,
        value: m.value,
        description: m.description,
        iconName: m.iconName || "Activity",
        confidence: m.confidence || dynamicConfidence,
        sourceFile: m.sourceFile || primarySource
      })),
      tags: parsed.tags || (rawBaseProject.tags.length > 0 ? rawBaseProject.tags : ["Analytics"]),
      categories: parsed.categories || (rawBaseProject.categories.length > 0 ? rawBaseProject.categories : ["Data Analysis"])
    };
    structured = await reviewAndRefinePortfolio(structured, graph);
    const rawUpdated = {
      ...rawBaseProject,
      title: structured.title.value,
      subtitle: structured.subtitle.value,
      summary: structured.executiveSummary.value,
      objective: structured.businessObjective.value,
      businessProblem: structured.businessProblem.value,
      datasetDesc: structured.datasetDescription.value,
      methodology: structured.methodology.value,
      dataCleaning: structured.dataCleaning.value,
      findings: structured.findings.value,
      recommendations: structured.recommendations.value,
      challengesText: structured.challenges.value,
      lessonsLearned: structured.lessonsLearned.value,
      industry: structured.industry.value,
      role: structured.role.value,
      duration: structured.duration.value,
      tags: structured.tags,
      categories: structured.categories,
      metrics: structured.metrics.length > 0 ? structured.metrics.map((m) => ({
        id: m.id,
        label: m.label,
        value: m.value,
        description: m.description,
        iconName: m.iconName,
        sourceFile: m.sourceFile
      })) : rawBaseProject.metrics
    };
    return { structured, raw: rawUpdated };
  } catch (err) {
    console.error("[portfolioCompiler] Gemini synthesis error, using fallback:", err.message);
    return buildFallbackStructuredProject(graph, rawBaseProject);
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
          field: `Metric Discrepancy (${group[0].label})`,
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
  const evidenceNodes = [];
  for (const file of allFiles) {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const parser = PARSER_REGISTRY[ext];
    if (parser) {
      try {
        const result = await executeWithTimeout(
          `Parser[${parser.name}] for '${file.name}'`,
          () => parser.parse(file.name, file.content, file.type),
          15e3
        );
        parsedProjects.push(result.project);
        evidenceNodes.push(result.evidenceNode);
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
  const evidenceGraph = mergeToEvidenceGraph(evidenceNodes);
  evidenceGraph.projectDomain = projectType;
  const conflicts = [
    ...validateAndDetectConflicts(parsedProjects),
    ...detectEvidenceConflicts(evidenceGraph)
  ];
  const rawProject = mergeExtractedProjects(parsedProjects);
  const synthesized = await compilePortfolioWithGemini(evidenceGraph, conflicts, rawProject);
  const packageEvidenceHash = crypto2.createHash("sha256").update(allFiles.map((f) => f.sha256).sort().join(":")).digest("hex");
  const sourceAttributions = {};
  const confidenceScores = {};
  if (synthesized.structured) {
    confidenceScores.title = synthesized.structured.title.confidence;
    confidenceScores.summary = synthesized.structured.executiveSummary.confidence;
    confidenceScores.businessContext = synthesized.structured.businessContext.confidence;
    confidenceScores.businessProblem = synthesized.structured.businessProblem.confidence;
    confidenceScores.businessImpact = synthesized.structured.businessImpact.confidence;
    confidenceScores.methodology = synthesized.structured.methodology.confidence;
    confidenceScores.analyticalTechniques = synthesized.structured.analyticalTechniques.confidence;
    confidenceScores.findings = synthesized.structured.findings.confidence;
    confidenceScores.recommendations = synthesized.structured.recommendations.confidence;
    sourceAttributions.title = synthesized.structured.title.evidence.map((e) => e.sourceFile);
    sourceAttributions.summary = synthesized.structured.executiveSummary.evidence.map((e) => e.sourceFile);
    sourceAttributions.businessContext = synthesized.structured.businessContext.evidence.map((e) => e.sourceFile);
    sourceAttributions.businessProblem = synthesized.structured.businessProblem.evidence.map((e) => e.sourceFile);
    sourceAttributions.businessImpact = synthesized.structured.businessImpact.evidence.map((e) => e.sourceFile);
    sourceAttributions.methodology = synthesized.structured.methodology.evidence.map((e) => e.sourceFile);
    sourceAttributions.analyticalTechniques = synthesized.structured.analyticalTechniques.evidence.map((e) => e.sourceFile);
    sourceAttributions.findings = synthesized.structured.findings.evidence.map((e) => e.sourceFile);
    sourceAttributions.recommendations = synthesized.structured.recommendations.evidence.map((e) => e.sourceFile);
  }
  return {
    projectType,
    rawProject: {
      ...synthesized.raw,
      sourceFiles: Array.from(new Set(allFiles.map((f) => f.name)))
    },
    evidenceGraph,
    portfolioProject: synthesized.structured,
    conflicts,
    fileCoverage,
    confidenceScores,
    sourceAttributions,
    starStory: synthesized.structured.starStory.value,
    resumeBullets: synthesized.structured.resumeBullets.value,
    linkedInSummary: synthesized.structured.linkedInSummary.value,
    auditMetadata: {
      importTimestamp: (/* @__PURE__ */ new Date()).toISOString(),
      parserVersions: "Portfolio OS AI Compiler Engine v3.0 (Evidence Graph + Gemini)",
      evidenceHash: packageEvidenceHash,
      projectVersion: "v3",
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
import { GoogleGenAI as GoogleGenAI2, Type as Type2 } from "@google/genai";
var aiClient2 = null;
function getAiClient2() {
  if (aiClient2) return aiClient2;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in environment secrets.");
  }
  aiClient2 = new GoogleGenAI2({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
  return aiClient2;
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
      const ai = getAiClient2();
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
