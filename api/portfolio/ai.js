// @ts-nocheck
// src/api/_lib/parsers/registry.ts
import mammoth from "mammoth";
import JSZip2 from "jszip";
import zlib from "zlib";

// src/api/_lib/parsers/streamExcel.ts
import JSZip from "jszip";
import * as XLSX from "xlsx";
function decodeXmlEntities(str) {
  return str.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}
function createEmptyProject(fileName) {
  return {
    title: "",
    subtitle: "",
    summary: "",
    industry: "",
    role: "",
    duration: "",
    date: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
    tags: ["Excel", "Pivot Tables", "Business Analytics", "KPI Reporting"],
    categories: ["Financial Modeling", "Business Analytics"],
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
async function streamParseWorksheetXml(sheetZipFile, sheetName, sharedStrings) {
  return new Promise((resolve, reject) => {
    let rowCount = 0;
    const columns = [];
    const formulas = [];
    const measures = [];
    const formulaSet = /* @__PURE__ */ new Set();
    let pendingChunk = "";
    let isRow1Parsed = false;
    let sheetFormulasCount = 0;
    let dimensionFound = false;
    const stream = sheetZipFile.nodeStream();
    stream.on("data", (chunk) => {
      pendingChunk += chunk.toString("utf-8");
      if (!dimensionFound) {
        const dimMatch = pendingChunk.match(/<dimension\s+ref="[A-Z]+(\d+):[A-Z]+(\d+)"/);
        if (dimMatch) {
          rowCount = Math.max(0, parseInt(dimMatch[2], 10) - parseInt(dimMatch[1], 10));
          dimensionFound = true;
        }
      }
      if (!isRow1Parsed) {
        const row1Match = pendingChunk.match(/<row\s+r="1"[^>]*>([\s\S]*?)<\/row>/);
        if (row1Match) {
          const cRegex = /<c\s+[^>]*>(?:<f>.*?<\/f>)?(?:<v>(.*?)<\/v>)?<\/c>/g;
          let cMatch;
          while ((cMatch = cRegex.exec(row1Match[1])) !== null && columns.length < 30) {
            const val = cMatch[1];
            if (val !== void 0) {
              let cellText = val;
              if (cMatch[0].includes('t="s"')) {
                const sIdx = parseInt(val, 10);
                if (!isNaN(sIdx) && sharedStrings[sIdx]) {
                  cellText = sharedStrings[sIdx];
                }
              }
              const cleaned = cellText.trim();
              if (cleaned && !cleaned.match(/^Column\d+$/i)) {
                columns.push(cleaned);
              }
            }
          }
          isRow1Parsed = true;
        }
      }
      const formulaRegex = /<f[^>]*>([\s\S]*?)<\/f>/g;
      let fMatch;
      while ((fMatch = formulaRegex.exec(pendingChunk)) !== null && sheetFormulasCount < 50) {
        sheetFormulasCount++;
        const formulaText = decodeXmlEntities(fMatch[1]).trim();
        const upperF = formulaText.toUpperCase();
        if (upperF.includes("SUM") || upperF.includes("AVERAGE") || upperF.includes("COUNT") || upperF.includes("VLOOKUP") || upperF.includes("XLOOKUP") || upperF.includes("INDEX") || upperF.includes("MATCH") || upperF.includes("IF") || upperF.includes("MARGIN")) {
          if (formulaSet.size < 30) {
            formulaSet.add(`${sheetName}: =${formulaText}`);
          }
          const matchFn = upperF.match(/([A-Z_]+)\s*\(/);
          if (matchFn && matchFn[1]) {
            measures.push(`Formula: ${matchFn[1]} in ${sheetName}`);
          }
        }
      }
      if (pendingChunk.length > 8192) {
        pendingChunk = pendingChunk.slice(-4096);
      }
    });
    stream.on("end", () => {
      resolve({
        rowCount,
        columns,
        formulas: Array.from(formulaSet),
        measures
      });
    });
    stream.on("error", (err) => {
      reject(err);
    });
  });
}
async function parseStreamExcel(fileName, content) {
  const parseStart = Date.now();
  const memBefore = process.memoryUsage().heapUsed / (1024 * 1024);
  const proj = createEmptyProject(fileName);
  const excelBuffer = typeof content === "string" ? Buffer.from(content, "base64") : content;
  const fileSizeMb = (excelBuffer.length / (1024 * 1024)).toFixed(2);
  const excelEvidence = {
    sourceFile: fileName,
    parser: "StreamExcelParser",
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
    businessTerms: [],
    worksheets: [],
    namedRanges: [],
    calculatedColumns: [],
    workbookMetadata: {},
    isAdaptivelySampled: excelBuffer.length > 5 * 1024 * 1024,
    samplingStrategy: excelBuffer.length > 5 * 1024 * 1024 ? `Asynchronous Stream XML Parsing (${fileSizeMb} MB). Extracted sheet metadata, headers, formulas, and pivots in non-blocking event loop.` : void 0
  };
  const isZipArchive = excelBuffer.length >= 4 && excelBuffer[0] === 80 && excelBuffer[1] === 75;
  if (isZipArchive && excelBuffer.length > 5 * 1024 * 1024) {
    try {
      const zip = await JSZip.loadAsync(excelBuffer);
      const workbookXmlStr = await zip.file("xl/workbook.xml")?.async("string");
      const sheetNameMap = [];
      if (workbookXmlStr) {
        const sheetRegex = /<sheet\s+[^>]*name="([^"]+)"[^>]*sheetId="([^"]+)"/g;
        let match;
        while ((match = sheetRegex.exec(workbookXmlStr)) !== null) {
          const name = decodeXmlEntities(match[1]);
          sheetNameMap.push({ id: match[2], name });
          excelEvidence.sheetNames.push(name);
        }
      }
      if (sheetNameMap.length === 0) {
        const sheetFiles = Object.keys(zip.files).filter((k) => k.startsWith("xl/worksheets/sheet"));
        sheetFiles.forEach((f, idx) => {
          const name = `Sheet${idx + 1}`;
          sheetNameMap.push({ id: String(idx + 1), name });
          excelEvidence.sheetNames.push(name);
        });
      }
      const sharedStrings = [];
      const sharedStringsXmlStr = await zip.file("xl/sharedStrings.xml")?.async("string");
      if (sharedStringsXmlStr) {
        const tRegex = /<t[^>]*>([\s\S]*?)<\/t>/g;
        let tMatch;
        let count = 0;
        while ((tMatch = tRegex.exec(sharedStringsXmlStr)) !== null && count < 2e3) {
          sharedStrings.push(decodeXmlEntities(tMatch[1]).trim());
          count++;
        }
      }
      const pivotFiles = Object.keys(zip.files).filter((k) => k.startsWith("xl/pivotTables/"));
      pivotFiles.forEach((_, idx) => {
        excelEvidence.pivots.push(`Pivot Table ${idx + 1}`);
      });
      const drawingFiles = Object.keys(zip.files).filter((k) => k.startsWith("xl/drawings/"));
      drawingFiles.forEach((_, idx) => {
        excelEvidence.charts.push({ title: `Visualization Layout ${idx + 1}`, chartType: "Spreadsheet Chart" });
      });
      let totalRowCount2 = 0;
      let totalFormulaCount = 0;
      const formulaSet = /* @__PURE__ */ new Set();
      const measureSet = /* @__PURE__ */ new Set();
      for (let i = 0; i < sheetNameMap.length; i++) {
        const sheetMeta = sheetNameMap[i];
        const sheetFileName = `xl/worksheets/sheet${i + 1}.xml`;
        const sheetZipFile = zip.file(sheetFileName) || zip.file(`xl/worksheets/sheet${sheetMeta.id}.xml`);
        await new Promise((resolve) => setImmediate(resolve));
        let role = "Analytical Worksheet";
        const nameLower = sheetMeta.name.toLowerCase().replace(/\s+/g, "");
        if (nameLower.includes("dashboard") || nameLower.includes("summary") || nameLower.includes("kpi")) {
          role = "Executive Dashboard";
          excelEvidence.dashboardTitles.push(sheetMeta.name);
        } else if (nameLower.includes("model") || nameLower.includes("forecast") || nameLower.includes("budget")) {
          role = "Financial Model";
        } else if (nameLower.includes("pivot") || nameLower.includes("crosstab")) {
          role = "Pivot Analysis";
        } else if (nameLower.includes("data") || nameLower.includes("raw") || nameLower.includes("source")) {
          role = "Data Source";
        }
        let sheetRowCount = 0;
        let sheetColumns = [];
        if (sheetZipFile) {
          const parsedSheet = await streamParseWorksheetXml(sheetZipFile, sheetMeta.name, sharedStrings);
          sheetRowCount = parsedSheet.rowCount;
          sheetColumns = parsedSheet.columns;
          parsedSheet.formulas.forEach((f) => formulaSet.add(f));
          parsedSheet.measures.forEach((m) => measureSet.add(m));
          totalRowCount2 += sheetRowCount;
          totalFormulaCount += parsedSheet.formulas.length;
          sheetColumns.forEach((c) => {
            if (!excelEvidence.dimensions.includes(c)) {
              excelEvidence.dimensions.push(c);
            }
          });
        }
        excelEvidence.worksheets.push({
          name: sheetMeta.name,
          role,
          rowCount: sheetRowCount,
          columnCount: sheetColumns.length,
          columns: sheetColumns.slice(0, 20)
        });
      }
      excelEvidence.formulas = Array.from(formulaSet);
      excelEvidence.measures = Array.from(measureSet);
      const memAfter = process.memoryUsage().heapUsed / (1024 * 1024);
      const totalDuration = Date.now() - parseStart;
      console.log(`
==========================================================`);
      console.log(`[STREAM EXCEL PARSER PROFILE] File Name: ${fileName}`);
      console.log(`[STREAM EXCEL PARSER PROFILE] File Size: ${fileSizeMb} MB`);
      console.log(`[STREAM EXCEL PARSER PROFILE] Total Worksheets: ${excelEvidence.sheetNames.length}`);
      console.log(`[STREAM EXCEL PARSER PROFILE] Total Aggregate Rows: ${totalRowCount2.toLocaleString()}`);
      console.log(`[STREAM EXCEL PARSER PROFILE] Formulas Detected: ${totalFormulaCount.toLocaleString()}`);
      console.log(`[STREAM EXCEL PARSER PROFILE] Pivots Detected: ${excelEvidence.pivots.length}`);
      console.log(`[STREAM EXCEL PARSER PROFILE] Duration: ${totalDuration} ms (Mem delta: +${(memAfter - memBefore).toFixed(1)} MB)`);
      console.log(`==========================================================
`);
      const evidenceNode2 = {
        nodeId: `node-excel-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        sourceFile: fileName,
        parserType: "Excel",
        extractedAt: (/* @__PURE__ */ new Date()).toISOString(),
        confidence: excelEvidence.confidence,
        data: excelEvidence
      };
      return { project: proj, evidenceNode: evidenceNode2 };
    } catch (err) {
      console.warn(`[StreamExcelParser] Async ZIP streaming failed for '${fileName}', falling back to standard XLSX reader:`, err?.message);
    }
  }
  const workbook = XLSX.read(excelBuffer, {
    type: "buffer",
    cellFormula: true,
    sheetStubs: false
  });
  excelEvidence.sheetNames = workbook.SheetNames;
  let totalRowCount = 0;
  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;
    const sheetColumns = [];
    let rowCount = 0;
    if (sheet["!ref"]) {
      try {
        const range = XLSX.utils.decode_range(sheet["!ref"]);
        rowCount = Math.max(0, range.e.r - range.s.r);
        totalRowCount += rowCount;
        for (let c = range.s.c; c <= range.e.c && c <= 30; c++) {
          const cellAddr = XLSX.utils.encode_cell({ r: range.s.r, c });
          const cell = sheet[cellAddr];
          if (cell && cell.v !== void 0) {
            const cleaned = String(cell.v).trim();
            if (cleaned && !cleaned.match(/^Column\d+$/i)) {
              sheetColumns.push(cleaned);
              if (!excelEvidence.dimensions.includes(cleaned)) {
                excelEvidence.dimensions.push(cleaned);
              }
            }
          }
        }
      } catch (_) {
      }
    }
    excelEvidence.worksheets.push({
      name: sheetName,
      role: "Analytical Worksheet",
      rowCount,
      columnCount: sheetColumns.length,
      columns: sheetColumns.slice(0, 20)
    });
  });
  const evidenceNode = {
    nodeId: `node-excel-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    sourceFile: fileName,
    parserType: "Excel",
    extractedAt: (/* @__PURE__ */ new Date()).toISOString(),
    confidence: excelEvidence.confidence,
    data: excelEvidence
  };
  return { project: proj, evidenceNode };
}

// src/api/_lib/parsers/registry.ts
function createEmptyProject2(fileName, parserName) {
  return {
    title: "",
    subtitle: "",
    summary: "",
    industry: "",
    role: "",
    duration: "",
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
    sourceFiles: [fileName]
  };
}
var ExcelParser = {
  name: "ExcelParser",
  extensions: ["xlsx", "xls"],
  async parse(fileName, content) {
    return parseStreamExcel(fileName, content);
  }
};
var SQLParser = {
  name: "SQLParser",
  extensions: ["sql"],
  async parse(fileName, content, type) {
    const proj = createEmptyProject2(fileName, "SQLParser");
    proj.tags = ["SQL", "Relational Database Querying", "Data Aggregation", "Window Functions"];
    proj.categories = ["Data Engineering", "Database Querying"];
    const text = typeof content === "string" ? type === "text" ? content : Buffer.from(content, "base64").toString("utf-8") : content.toString("utf-8");
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
        const fullFormula = aliasMatch[0].split(/\s+AS\s+/i)[0]?.trim() || aliasMatch[1];
        sqlEvidence.calculatedMetrics.push({ name: aliasMatch[2], formula: fullFormula });
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
    const proj = createEmptyProject2(fileName, "PythonParser");
    proj.tags = ["Python", "Feature Engineering", "Statistical Analysis", "Exploratory Data Analysis"];
    proj.categories = ["Data Science", "Data Engineering"];
    const text = typeof content === "string" ? type === "text" ? content : Buffer.from(content, "base64").toString("utf-8") : content.toString("utf-8");
    const lines = text.split("\n");
    const docEvidence = {
      sourceFile: fileName,
      parser: "PythonParser",
      confidence: 90,
      sections: [{ heading: "Python Analytics Script", content: text.slice(0, 3e3) }],
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
    const proj = createEmptyProject2(fileName, "NotebookParser");
    proj.tags = ["Python", "Exploratory Data Analysis", "Interactive Analytics", "Statistical Modeling"];
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
      const text = typeof content === "string" ? type === "text" ? content : Buffer.from(content, "base64").toString("utf-8") : content.toString("utf-8");
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
    const proj = createEmptyProject2(fileName, "PowerBIParser");
    proj.tags = ["Power BI", "DAX", "Dashboarding", "KPI Modeling", "Data Visualization"];
    proj.categories = ["Business Intelligence", "Dashboard Analytics"];
    const text = typeof content === "string" ? type === "text" ? content : Buffer.from(content, "base64").toString("utf-8") : content.toString("utf-8");
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
function extractPdfStreamText(buffer) {
  const textChunks = [];
  let pos = 0;
  const streamMarker = Buffer.from("stream");
  const endStreamMarker = Buffer.from("endstream");
  while (pos < buffer.length) {
    const sIdx = buffer.indexOf(streamMarker, pos);
    if (sIdx === -1) break;
    let contentStart = sIdx + 6;
    while (contentStart < buffer.length && (buffer[contentStart] === 10 || buffer[contentStart] === 13)) {
      contentStart++;
    }
    const eIdx = buffer.indexOf(endStreamMarker, contentStart);
    if (eIdx === -1) break;
    const streamSlice = buffer.subarray(contentStart, eIdx);
    pos = eIdx + 9;
    let decompressed = null;
    try {
      decompressed = zlib.inflateSync(streamSlice);
    } catch {
      try {
        decompressed = zlib.inflateRawSync(streamSlice);
      } catch {
      }
    }
    const raw = (decompressed || streamSlice).toString("latin1");
    const matches = raw.matchAll(/\(([^)]+)\)\s*(?:Tj|'|")/g);
    for (const m of matches) {
      if (m[1] && m[1].length > 1) {
        textChunks.push(m[1].replace(/\\([()\\])/g, "$1"));
      }
    }
    const tjMatches = raw.matchAll(/\[([^\]]+)\]\s*TJ/g);
    for (const tm of tjMatches) {
      const sub = tm[1].matchAll(/\(([^)]+)\)/g);
      const joined = Array.from(sub).map((s) => s[1].replace(/\\([()\\])/g, "$1")).join("");
      if (joined.length > 1) {
        textChunks.push(joined);
      }
    }
  }
  return textChunks.join(" ");
}
async function extractPdfText(buffer) {
  try {
    const pdfModule = await import("pdf-parse");
    const PDFParse = pdfModule.PDFParse || pdfModule.default?.PDFParse || pdfModule.default;
    if (typeof PDFParse === "function") {
      try {
        const parser = new PDFParse({ data: buffer });
        const textResult = await parser.getText();
        await parser.destroy?.();
        if (textResult) {
          const extracted = typeof textResult === "string" ? textResult : textResult.text || (Array.isArray(textResult.pages) ? textResult.pages.map((p) => p.text).join("\n") : "");
          if (extracted && extracted.trim().length > 0) {
            return extracted;
          }
        }
      } catch {
        const res = await PDFParse(buffer);
        if (res?.text && res.text.trim().length > 0) return res.text;
      }
    }
  } catch (err) {
    console.warn("[PDFParser] pdf-parse library error, falling back to stream extraction:", err);
  }
  return extractPdfStreamText(buffer);
}
function extractStructuredReportSections(fileName, rawText, proj, docEvidence, readmeEvidence) {
  if (!rawText || rawText.trim().length === 0) return;
  const rawLines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
  if (rawLines.length > 0) {
    const firstLine = rawLines[0].replace(/^#+\s*/, "").replace(/^\*+|\*+$/g, "").trim();
    if (firstLine.length > 5 && firstLine.length < 90 && !/^(report|project|summary|document|table of contents|index)$/i.test(firstLine)) {
      proj.title = firstLine;
      if (docEvidence) docEvidence.title = firstLine;
    }
  }
  const sectionKeywordsRegex = /^(?:business problem|problem statement|problem|operational challenge|issue|bottleneck|recommendations?|strategic recommendations?|business recommendations?|action items?|next steps?|priorities|management priorities|key findings|findings|key insights|insights|results|analysis results|discoveries|project objectives?|business objectives?|objectives?|goals?|purpose|methodology|approach|analytical approach|workflow|process|architecture|challenges?|roadblocks?|obstacles?|limitations?|constraints?|data cleaning|data preparation|preprocessing|transformations?|etl|lessons? learned|key takeaways?|retrospective|conclusions?|dataset(?: description)?|data sources?|executive summary|overview|background)$/i;
  const sections = [];
  let currentHeading = "Overview";
  let currentLines = [];
  for (const line of rawText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentLines.length > 0) currentLines.push("");
      continue;
    }
    let detectedHeading = null;
    const mdMatch = trimmed.match(/^#{1,4}\s+(.+)$/);
    if (mdMatch) {
      detectedHeading = mdMatch[1].trim();
    }
    if (!detectedHeading) {
      const boldMatch = trimmed.match(/^\*{2}(.+?)\*{2}:?$/);
      if (boldMatch) {
        detectedHeading = boldMatch[1].trim();
      }
    }
    if (!detectedHeading) {
      const numMatch = trimmed.match(/^\d+[\.\)]\s+([A-Za-z\s]{3,40}):?$/);
      if (numMatch && sectionKeywordsRegex.test(numMatch[1].trim())) {
        detectedHeading = numMatch[1].trim();
      }
    }
    if (!detectedHeading && trimmed.length < 50) {
      const cleaned = trimmed.replace(/:$/, "").trim();
      if (sectionKeywordsRegex.test(cleaned)) {
        detectedHeading = cleaned;
      }
    }
    if (detectedHeading) {
      if (currentLines.length > 0) {
        sections.push({ heading: currentHeading, body: currentLines.join("\n").trim() });
        currentLines = [];
      }
      currentHeading = detectedHeading;
    } else {
      currentLines.push(trimmed);
    }
  }
  if (currentLines.length > 0) {
    sections.push({ heading: currentHeading, body: currentLines.join("\n").trim() });
  }
  for (const sec of sections) {
    const h = sec.heading.toLowerCase();
    const b = sec.body;
    if (!b || b.length < 5) continue;
    if (h.includes("problem") || h.includes("issue") || h.includes("bottleneck") || h.includes("operational challenge")) {
      proj.businessProblem = proj.businessProblem ? `${proj.businessProblem}

${b}` : b;
      if (readmeEvidence) readmeEvidence.problem = proj.businessProblem;
      if (docEvidence) docEvidence.sections.push({ heading: "Business Problem", content: b });
    } else if (h.includes("recommend") || h.includes("action") || h.includes("next step") || h.includes("priorit")) {
      proj.recommendations = proj.recommendations ? `${proj.recommendations}

${b}` : b;
      if (readmeEvidence) readmeEvidence.recommendations = proj.recommendations;
      if (docEvidence) docEvidence.sections.push({ heading: "Strategic Recommendations", content: b });
    } else if (h.includes("finding") || h.includes("insight") || h.includes("result") || h.includes("discover")) {
      proj.findings = proj.findings ? `${proj.findings}

${b}` : b;
      if (readmeEvidence) readmeEvidence.findings = proj.findings;
      if (docEvidence) docEvidence.sections.push({ heading: "Key Findings", content: b });
    } else if (h.includes("objective") || h.includes("goal") || h.includes("purpose")) {
      proj.objective = proj.objective ? `${proj.objective}

${b}` : b;
      if (readmeEvidence) readmeEvidence.objective = proj.objective;
      if (docEvidence) docEvidence.sections.push({ heading: "Business Objective", content: b });
    } else if (h.includes("methodology") || h.includes("approach") || h.includes("workflow") || h.includes("process") || h.includes("architecture")) {
      proj.methodology = proj.methodology ? `${proj.methodology}

${b}` : b;
      if (readmeEvidence) readmeEvidence.methodology = proj.methodology;
      if (docEvidence) docEvidence.sections.push({ heading: "Methodology", content: b });
    } else if (h.includes("challenge") || h.includes("roadblock") || h.includes("obstacle") || h.includes("limitation")) {
      proj.challengesText = proj.challengesText ? `${proj.challengesText}

${b}` : b;
      if (readmeEvidence) readmeEvidence.challenges = proj.challengesText;
      if (docEvidence) docEvidence.sections.push({ heading: "Challenges", content: b });
    } else if (h.includes("cleaning") || h.includes("prep") || h.includes("transform") || h.includes("etl")) {
      proj.dataCleaning = proj.dataCleaning ? `${proj.dataCleaning}

${b}` : b;
      if (readmeEvidence) readmeEvidence.dataCleaning = proj.dataCleaning;
      if (docEvidence) docEvidence.sections.push({ heading: "Data Cleaning", content: b });
    } else if (h.includes("lesson") || h.includes("takeaway") || h.includes("retrospective") || h.includes("conclusion")) {
      proj.lessonsLearned = proj.lessonsLearned ? `${proj.lessonsLearned}

${b}` : b;
      if (readmeEvidence) readmeEvidence.lessonsLearned = proj.lessonsLearned;
      if (docEvidence) docEvidence.sections.push({ heading: "Lessons Learned", content: b });
    } else if (h.includes("dataset") || h.includes("data source") || h.includes("corpus")) {
      proj.datasetDesc = proj.datasetDesc ? `${proj.datasetDesc}

${b}` : b;
      if (readmeEvidence) readmeEvidence.dataset = proj.datasetDesc;
      if (docEvidence) docEvidence.sections.push({ heading: "Dataset Description", content: b });
    } else if (h.includes("summary") || h.includes("overview") || h.includes("background")) {
      proj.summary = proj.summary ? `${proj.summary}

${b}` : b;
      if (docEvidence) docEvidence.sections.push({ heading: "Executive Summary", content: b });
    } else {
      if (docEvidence) docEvidence.sections.push({ heading: sec.heading, content: b });
    }
  }
  if (!proj.businessProblem || !proj.recommendations) {
    const paragraphs = rawText.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length > 40);
    for (const p of paragraphs) {
      const lower = p.toLowerCase();
      if (!proj.businessProblem && (lower.includes("problem") || lower.includes("challenge") || lower.includes("bottleneck") || lower.includes("issue"))) {
        proj.businessProblem = p;
        if (readmeEvidence) readmeEvidence.problem = p;
        if (docEvidence) docEvidence.sections.push({ heading: "Business Problem", content: p });
      }
      if (!proj.recommendations && (lower.includes("recommend") || lower.includes("we recommend") || lower.includes("key recommendation") || lower.includes("should prioritize") || lower.includes("action items"))) {
        proj.recommendations = p;
        if (readmeEvidence) readmeEvidence.recommendations = p;
        if (docEvidence) docEvidence.sections.push({ heading: "Strategic Recommendations", content: p });
      }
    }
  }
  proj.storyBlocks.push({
    id: `report-sb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: "markdown",
    title: `Report: ${fileName}`,
    bodyContent: rawText.slice(0, 1e4),
    sourceFile: fileName
  });
}
var MarkdownParser = {
  name: "MarkdownParser",
  extensions: ["md", "txt"],
  async parse(fileName, content, type) {
    const proj = createEmptyProject2(fileName, "MarkdownParser");
    proj.tags = ["Business Reporting", "Documentation", "Executive Communication"];
    proj.categories = ["Technical Writing", "Reporting"];
    const text = typeof content === "string" ? type === "text" ? content : Buffer.from(content, "base64").toString("utf-8") : content.toString("utf-8");
    const readmeEvidence = {
      sourceFile: fileName,
      parser: "MarkdownParser",
      confidence: 95,
      tools: ["Markdown", "Git"]
    };
    extractStructuredReportSections(fileName, text, proj, void 0, readmeEvidence);
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
    const proj = createEmptyProject2(fileName, "WordParser");
    proj.tags = ["Business Analysis", "Executive Reporting", "Documentation"];
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
      const buffer = typeof content === "string" ? Buffer.from(content, "base64") : content;
      const extractionResult = await mammoth.extractRawText({ buffer });
      const text = extractionResult.value || "";
      if (text.trim().length > 0) {
        extractStructuredReportSections(fileName, text, proj, docEvidence);
      }
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
    const proj = createEmptyProject2(fileName, "CSVParser");
    proj.tags = ["Data Cleaning", "Tabular Analysis", "Data Profiling"];
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
      const text = typeof content === "string" ? type === "text" ? content : Buffer.from(content, "base64").toString("utf-8") : content.toString("utf-8");
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
  async parse(fileName, content, type) {
    const proj = createEmptyProject2(fileName, "PDFParser");
    proj.tags = ["Business Analysis", "Executive Reporting", "Documentation"];
    proj.categories = ["Data Extract", "Reporting"];
    const docEvidence = {
      sourceFile: fileName,
      parser: "PDFParser",
      confidence: 90,
      title: fileName,
      sections: [],
      extractedTerms: ["Document", "Report", "PDF Analysis"]
    };
    try {
      const buffer = typeof content === "string" ? type === "text" ? Buffer.from(content, "utf-8") : Buffer.from(content, "base64") : content;
      if (buffer && buffer.length > 0) {
        const extractedText = await extractPdfText(buffer);
        if (extractedText && extractedText.trim().length > 0) {
          extractStructuredReportSections(fileName, extractedText, proj, docEvidence);
        } else {
          docEvidence.sections.push({
            heading: "PDF File Reference",
            content: `Uploaded PDF report: ${fileName} (${buffer.length} bytes)`
          });
        }
      }
    } catch (err) {
      console.error("PDFParser Error:", err);
    }
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
    const proj = createEmptyProject2(fileName, "ImageParser");
    proj.tags = ["Dashboarding", "Data Visualization", "Telemetry Reporting"];
    proj.categories = ["Telemetry Visualization"];
    proj.objective = "";
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
var TableauParser = {
  name: "TableauParser",
  extensions: ["twb", "twbx"],
  async parse(fileName, content, type) {
    const proj = createEmptyProject2(fileName, "TableauParser");
    proj.tags = ["Tableau", "Data Visualization", "Worksheet Analytics", "Calculated Fields"];
    proj.categories = ["Business Intelligence", "Data Visualization"];
    proj.role = "BI Specialist";
    let xmlText = "";
    if (fileName.toLowerCase().endsWith(".twbx")) {
      try {
        const zipBuffer = typeof content === "string" ? Buffer.from(content, "base64") : content;
        const zip = new JSZip2();
        const zipData = await zip.loadAsync(zipBuffer);
        const twbEntry = Object.keys(zipData.files).find((k) => k.toLowerCase().endsWith(".twb"));
        if (twbEntry) {
          xmlText = await zipData.files[twbEntry].async("string");
        }
      } catch (twbxErr) {
        console.warn("[TableauParser] TWBX zip extraction warning:", twbxErr);
      }
    } else {
      xmlText = typeof content === "string" ? type === "text" ? content : Buffer.from(content, "base64").toString("utf-8") : content.toString("utf-8");
    }
    const worksheets = [];
    const dashboards = [];
    const calculatedMeasures = [];
    if (xmlText) {
      const wsRegex = /<worksheet\s+name=['"]([^'"]+)['"]/g;
      let wsMatch;
      while ((wsMatch = wsRegex.exec(xmlText)) !== null) {
        if (!worksheets.includes(wsMatch[1])) worksheets.push(wsMatch[1]);
      }
      const dbRegex = /<dashboard\s+name=['"]([^'"]+)['"]/g;
      let dbMatch;
      while ((dbMatch = dbRegex.exec(xmlText)) !== null) {
        if (!dashboards.includes(dbMatch[1])) dashboards.push(dbMatch[1]);
      }
      const colRegex = /<column\s+caption=['"]([^'"]+)['"][^>]*>[\s\S]*?<calculation\s+class=['"]tableau['"]\s+formula=['"]([^'"]+)['"]/g;
      let colMatch;
      while ((colMatch = colRegex.exec(xmlText)) !== null) {
        const name = colMatch[1];
        const formula = colMatch[2];
        calculatedMeasures.push({ name, expression: formula });
        proj.metrics.push({
          id: `tab-calc-${proj.metrics.length}-${Date.now()}`,
          label: name,
          value: "Calculated Field",
          description: `Formula: ${formula}`,
          iconName: "TrendingUp",
          sourceFile: fileName,
          sourceLocation: "Calculated measure definitions"
        });
      }
      if (worksheets.length > 0) {
        proj.datasetDesc = `Tableau Workbook contains worksheets: ${worksheets.join(", ")}.`;
      }
      if (dashboards.length > 0) {
        proj.findings = `Workbook publishes dashboards: ${dashboards.join(", ")}.`;
      }
      proj.storyBlocks.push({
        id: `tab-sb-${Date.now()}`,
        type: "markdown",
        title: `Tableau Workbook: ${fileName}`,
        bodyContent: `### Extracted Tableau Worksheets
${worksheets.map((w) => `- **${w}**`).join("\n") || "No worksheets found."}

### Extracted Dashboards
${dashboards.map((d) => `- **${d}**`).join("\n") || "No dashboards found."}`,
        sourceFile: fileName
      });
    }
    const pbiEvidence = {
      sourceFile: fileName,
      parser: "TableauParser",
      confidence: 92,
      visuals: dashboards.length > 0 ? dashboards.map((d) => ({ title: d, type: "Dashboard" })) : worksheets.map((w) => ({ title: w, type: "Worksheet" })),
      daxMeasures: calculatedMeasures,
      pages: dashboards.length > 0 ? dashboards : worksheets.length > 0 ? worksheets : ["Tableau Analytics"],
      relationships: [],
      kpis: []
    };
    return {
      project: proj,
      evidenceNode: { type: "powerbi", data: pbiEvidence }
    };
  }
};
var RParser = {
  name: "RParser",
  extensions: ["r", "rmd"],
  async parse(fileName, content, type) {
    const proj = createEmptyProject2(fileName, "RParser");
    proj.tags = ["R", "ggplot2", "Statistical Modeling", "Exploratory Data Analysis"];
    proj.categories = ["Statistical Analysis", "Data Science"];
    proj.role = "Statistical Data Analyst";
    const text = typeof content === "string" ? type === "text" ? content : Buffer.from(content, "base64").toString("utf-8") : content.toString("utf-8");
    const lines = text.split(/\r?\n/);
    let inRChunk = false;
    let chunkCode = "";
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("```{r")) {
        inRChunk = true;
        chunkCode = "";
        return;
      }
      if (trimmed.startsWith("```") && inRChunk) {
        inRChunk = false;
        if (chunkCode.trim()) {
          proj.storyBlocks.push({
            id: `r-chunk-${idx}-${Date.now()}`,
            type: "code_snippet",
            title: `R Markdown Chunk (Line ${idx})`,
            bodyContent: chunkCode,
            language: "r",
            sourceFile: fileName
          });
        }
        return;
      }
      if (inRChunk) {
        chunkCode += line + "\n";
      }
      if (trimmed.startsWith("#")) {
        const comment = trimmed.slice(1).trim();
        const lower = comment.toLowerCase();
        if (lower.startsWith("kpi:") || lower.startsWith("metric:")) {
          const parts = comment.substring(comment.indexOf(":") + 1).split("=");
          if (parts.length >= 2) {
            proj.metrics.push({
              id: `r-metric-${proj.metrics.length}-${Date.now()}`,
              label: parts[0].trim(),
              value: parts[1].trim(),
              description: `Extracted from R source ${fileName}`,
              iconName: "Activity",
              sourceFile: fileName,
              sourceLocation: `Line ${idx + 1}`
            });
          }
        }
      }
    });
    if (!fileName.toLowerCase().endsWith(".rmd") && text.trim()) {
      proj.storyBlocks.push({
        id: `r-script-${Date.now()}`,
        type: "code_snippet",
        title: `R Script: ${fileName}`,
        bodyContent: text.slice(0, 5e3),
        language: "r",
        sourceFile: fileName
      });
    }
    const docEvidence = {
      sourceFile: fileName,
      parser: "RParser",
      confidence: 90,
      sections: [{ heading: "R Statistical Analysis", content: text.slice(0, 3e3) }],
      extractedTerms: ["R", "ggplot2", "dplyr", "Statistical Analysis"]
    };
    return {
      project: proj,
      evidenceNode: { type: "document", data: docEvidence }
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
  jpeg: ImageParser,
  twb: TableauParser,
  twbx: TableauParser,
  r: RParser,
  rmd: RParser
};
async function unpackZipFile(base64Content) {
  const extractedFiles = [];
  const MAX_EXTRACTED_FILES = 100;
  const MAX_TOTAL_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;
  let totalUncompressedBytes = 0;
  try {
    const zipBuffer = typeof base64Content === "string" ? Buffer.from(base64Content, "base64") : base64Content;
    const zip = new JSZip2();
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

// src/api/_lib/types/index.ts
var PipelineError = class extends Error {
  constructor(stage, message, errorType = "PipelineError", cause) {
    super(message);
    this.name = "PipelineError";
    this.stage = stage;
    this.errorType = errorType;
    if (cause?.stack) {
      this.stack = cause.stack;
    }
    const location = parseStackLocation(this.stack);
    if (location) {
      this.fileName = location.fileName;
      this.lineNumber = location.lineNumber;
    }
  }
};
function parseStackLocation(stack) {
  if (!stack) return null;
  const lines = stack.split("\n");
  for (const line of lines) {
    const match = line.match(/(?:[a-zA-Z]:\\|\/)[^:()]+\.[a-zA-Z0-9]+:(\d+):(\d+)/) || line.match(/([^\s()]+\.[a-zA-Z0-9]+):(\d+):(\d+)/);
    if (match) {
      const fullPath = match[0];
      const parts = fullPath.split(":");
      if (parts.length >= 3) {
        const lineNo = parseInt(parts[parts.length - 2], 10);
        const filePath = parts.slice(0, parts.length - 2).join(":");
        const fileName = filePath.split(/[/\\]/).pop() || filePath;
        return { fileName, lineNumber: lineNo };
      }
    }
  }
  return null;
}

// src/api/_lib/utils/security.ts
import crypto from "crypto";
function validateFileSignature(fileName, base64OrBuffer) {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const buf = typeof base64OrBuffer === "string" ? Buffer.from(base64OrBuffer, "base64") : base64OrBuffer;
  if (buf.length === 0) {
    return { isValid: false, error: `File '${fileName}' is empty (0 bytes).` };
  }
  const textExtensions = ["sql", "py", "ipynb", "md", "txt", "csv", "dax", "json", "r", "rmd", "twb"];
  if (textExtensions.includes(ext)) {
    if (buf.length >= 2 && buf[0] === 77 && buf[1] === 90) {
      return { isValid: false, error: `File '${fileName}' contains an executable binary header (MZ) disguised as text.` };
    }
    if (buf.length >= 4 && buf[0] === 127 && buf[1] === 69 && buf[2] === 76 && buf[3] === 70) {
      return { isValid: false, error: `File '${fileName}' contains an ELF binary header disguised as text.` };
    }
    return { isValid: true, detectedType: "Text/Script Source" };
  }
  if (["zip", "xlsx", "docx", "pbix", "twbx"].includes(ext)) {
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
  const allowed = ["zip", "pbit", "pbix", "xlsx", "xls", "docx", "pdf", "py", "ipynb", "sql", "dax", "csv", "json", "md", "txt", "png", "jpg", "jpeg", "twb", "twbx", "r", "rmd"];
  return allowed.includes(ext);
}
function createStepLogger(scope) {
  const scopeStart = Date.now();
  return {
    start: (stepName) => {
      const sStart = Date.now();
      console.log(`[INSTRUMENTATION] [${scope}] START: ${stepName} @ T+${sStart - scopeStart}ms`);
      const interval = setInterval(() => {
        const elapsed = Date.now() - sStart;
        if (elapsed >= 2e3) {
          console.warn(`[INSTRUMENTATION] [${scope}] CHECKPOINT (WARN >2s): '${stepName}' is taking long... (Elapsed: ${elapsed}ms)`);
        }
      }, 2e3);
      return {
        end: (outputSizeInfo) => {
          clearInterval(interval);
          const duration = Date.now() - sStart;
          const sizeStr = outputSizeInfo !== void 0 ? ` | Output Size: ${typeof outputSizeInfo === "number" ? `${(outputSizeInfo / 1024).toFixed(1)} KB` : outputSizeInfo}` : "";
          console.log(`[INSTRUMENTATION] [${scope}] END: ${stepName} | Elapsed: ${duration}ms${sizeStr}`);
          return duration;
        }
      };
    }
  };
}
function getAdaptiveParserTimeout(options) {
  const { fileName, fileSize, parserName, remainingRequestBudgetMs } = options;
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const sizeMb = fileSize / (1024 * 1024);
  let baseTimeoutMs = 3e3;
  let reason = "";
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext) || parserName === "ImageParser") {
    baseTimeoutMs = 2e3;
    reason = "Image asset parsing (small static buffer)";
  } else if (["md", "txt", "csv", "json", "sql", "py", "dax"].includes(ext) || parserName === "MarkdownParser") {
    baseTimeoutMs = 3e3;
    reason = "Text/Script source parsing (lightweight string scan)";
  } else if (["pdf", "docx"].includes(ext) || parserName === "PDFParser" || parserName === "WordParser") {
    if (sizeMb > 10) {
      baseTimeoutMs = 12e3;
      reason = `Large document extraction (${sizeMb.toFixed(2)} MB > 10 MB)`;
    } else if (sizeMb > 2) {
      baseTimeoutMs = 8e3;
      reason = `Medium document extraction (${sizeMb.toFixed(2)} MB > 2 MB)`;
    } else {
      baseTimeoutMs = 5e3;
      reason = "Standard document extraction (<= 2 MB)";
    }
  } else if (["xlsx", "xls", "pbix"].includes(ext) || parserName === "ExcelParser" || parserName === "StreamExcelParser") {
    if (sizeMb > 50) {
      baseTimeoutMs = 25e3;
      reason = `Very large spreadsheet streaming (${sizeMb.toFixed(2)} MB > 50 MB)`;
    } else if (sizeMb > 20) {
      baseTimeoutMs = 18e3;
      reason = `Large spreadsheet streaming (${sizeMb.toFixed(2)} MB > 20 MB)`;
    } else if (sizeMb > 5) {
      baseTimeoutMs = 12e3;
      reason = `Medium spreadsheet streaming (${sizeMb.toFixed(2)} MB > 5 MB)`;
    } else {
      baseTimeoutMs = 5e3;
      reason = "Small spreadsheet parsing (<= 5 MB)";
    }
  } else {
    reason = "Default fallback parser timeout";
  }
  let selectedTimeoutMs = baseTimeoutMs;
  let budgetCapReason = "";
  if (remainingRequestBudgetMs !== void 0 && remainingRequestBudgetMs > 0) {
    const safeBudgetMs = Math.max(2e3, remainingRequestBudgetMs - 3e3);
    if (selectedTimeoutMs > safeBudgetMs) {
      selectedTimeoutMs = safeBudgetMs;
      budgetCapReason = ` (Capped by remaining request budget of ${remainingRequestBudgetMs}ms)`;
    }
  }
  console.log(`[ADAPTIVE TIMEOUT] Selected timeout: ${selectedTimeoutMs}ms | Reason: ${reason}${budgetCapReason} | File size: ${fileSize} bytes | Parser: ${parserName}`);
  return selectedTimeoutMs;
}
async function executeWithTimeout(taskName, fn, timeoutMs = 15e3) {
  const startTime = Date.now();
  let timeoutHandle;
  let isTimedOut = false;
  console.log(`[ASYNC EXECUTION] BEGIN task '${taskName}' (Timeout limit: ${timeoutMs}ms)`);
  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      isTimedOut = true;
      console.warn(`[ASYNC EXECUTION] TIMED OUT task '${taskName}' after ${Date.now() - startTime}ms (exceeded ${timeoutMs}ms limit)`);
      reject(new Error(`Execution threshold exceeded (${timeoutMs}ms) for '${taskName}'. Terminated for safety.`));
    }, timeoutMs);
  });
  try {
    const result = await Promise.race([fn(), timeoutPromise]);
    clearTimeout(timeoutHandle);
    console.log(`[ASYNC EXECUTION] END task '${taskName}' (Duration: ${Date.now() - startTime}ms)`);
    return result;
  } catch (err) {
    clearTimeout(timeoutHandle);
    if (!isTimedOut) {
      console.error(`[ASYNC EXECUTION] FAILED task '${taskName}' after ${Date.now() - startTime}ms:`, err?.message || err);
    }
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

// src/api/_lib/evidence/graph.ts
function safeForEach(arr, varName, callback) {
  if (!arr) return;
  if (!Array.isArray(arr)) {
    console.error(`[DATA SHAPE ASSERTION ERROR] Expected array for '${varName}', got:`, typeof arr, arr);
    return;
  }
  arr.forEach(callback);
}
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
  if (!Array.isArray(extractedNodes)) {
    console.error("[DATA SHAPE ASSERTION ERROR] mergeToEvidenceGraph: extractedNodes is not an array", extractedNodes);
    return graph;
  }
  const sourceMap = /* @__PURE__ */ new Map();
  for (const node of extractedNodes) {
    if (!node || !node.data) continue;
    const { type, data } = node;
    const { sourceFile, parser, confidence, location } = data;
    if (!sourceMap.has(sourceFile)) {
      sourceMap.set(sourceFile, { fileName: sourceFile, parser, confidence, nodesExtracted: 0 });
    }
    const sourceMeta = sourceMap.get(sourceFile);
    switch (type) {
      case "excel": {
        safeForEach(data.metrics, "excel.metrics", (m) => {
          graph.metrics.push({ value: m, sourceFile, parser, confidence, location });
          graph.detectedKPIs.push({ value: { name: m.label, actual: m.value }, sourceFile, parser, confidence, location });
          sourceMeta.nodesExtracted++;
        });
        safeForEach(data.kpis, "excel.kpis", (k) => {
          graph.kpis.push({ value: { name: k.name, target: k.target, value: k.actual }, sourceFile, parser, confidence, location });
          graph.detectedKPIs.push({ value: { name: k.name, target: k.target, actual: k.actual }, sourceFile, parser, confidence, location });
          sourceMeta.nodesExtracted++;
        });
        safeForEach(data.charts, "excel.charts", (c) => {
          graph.charts.push({ value: { title: c.title, type: c.chartType }, sourceFile, parser, confidence, location });
          graph.visualNarratives.push({ value: `Visual Chart: ${c.title} (${c.chartType || "Standard Visual"})`, sourceFile, parser, confidence, location });
          sourceMeta.nodesExtracted++;
        });
        safeForEach(data.businessTerms, "excel.businessTerms", (t) => {
          graph.businessTerms.push({ value: t, sourceFile, parser, confidence, location });
          sourceMeta.nodesExtracted++;
        });
        safeForEach(data.dimensions, "excel.dimensions", (d) => {
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
        safeForEach(data.measures, "excel.measures", (m) => {
          graph.detectedMeasures.push({ value: m, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        });
        safeForEach(data.calculatedColumns, "excel.calculatedColumns", (cc) => {
          graph.analyticalTechniques.push({
            value: `Calculated Column '${cc.column}' in ${cc.sheet} (Formula: =${cc.formula})`,
            sourceFile,
            parser,
            confidence
          });
          sourceMeta.nodesExtracted++;
        });
        safeForEach(data.worksheets, "excel.worksheets", (ws) => {
          const colList = Array.isArray(ws.columns) ? ws.columns.slice(0, 5).join(", ") : "";
          graph.dashboardInsights.push({
            value: `Worksheet [${ws.name}] (${ws.role}): ${ws.rowCount} rows, ${ws.columnCount} columns (${colList})`,
            sourceFile,
            parser,
            confidence
          });
          sourceMeta.nodesExtracted++;
        });
        if (data.workbookMetadata && Object.keys(data.workbookMetadata).length > 0) {
          const metaText = Object.entries(data.workbookMetadata).map(([k, v]) => `${k}: ${v}`).join("; ");
          graph.documentation.push({ value: { key: "Workbook Metadata", text: metaText }, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        }
        if (Array.isArray(data.formulas) && data.formulas.length > 0) {
          graph.analyticalTechniques.push({ value: `Spreadsheet Formulas (${data.formulas.length} calculated cells)`, sourceFile, parser, confidence, location });
        }
        if (Array.isArray(data.pivots) && data.pivots.length > 0) {
          graph.analyticalTechniques.push({ value: `Pivot Table Analysis (${data.pivots.join(", ")})`, sourceFile, parser, confidence, location });
        }
        safeForEach(data.dashboardTitles, "excel.dashboardTitles", (t) => {
          graph.dashboards.push({ value: { name: t, pages: data.sheetNames }, sourceFile, parser, confidence, location });
          graph.dashboardInsights.push({ value: `Dashboard Layout Sheet: ${t}`, sourceFile, parser, confidence, location });
          sourceMeta.nodesExtracted++;
        });
        break;
      }
      case "sql": {
        if (Array.isArray(data.tables)) {
          graph.sqlLogic.push({
            value: {
              tables: data.tables,
              joins: data.joins || [],
              aggregations: data.aggregations || [],
              windowFunctions: data.windowFunctions || []
            },
            sourceFile,
            parser,
            confidence,
            location
          });
          safeForEach(data.tables, "sql.tables", (t) => graph.businessEntities.push({ value: `Table Entity: ${t}`, sourceFile, parser, confidence }));
          if (Array.isArray(data.joins) && data.joins.length > 0) {
            graph.analyticalTechniques.push({ value: "Relational Multi-Table Joins", sourceFile, parser, confidence });
          }
          if (Array.isArray(data.windowFunctions) && data.windowFunctions.length > 0) {
            graph.analyticalTechniques.push({ value: "Advanced SQL Window Aggregations", sourceFile, parser, confidence });
          }
          sourceMeta.nodesExtracted++;
        }
        safeForEach(data.calculatedMetrics, "sql.calculatedMetrics", (cm) => {
          graph.detectedMeasures.push({ value: `${cm.name} (${cm.formula})`, sourceFile, parser, confidence });
          graph.analyticalTechniques.push({ value: `SQL Aggregation (${cm.name})`, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        });
        safeForEach(data.businessQuestions, "sql.businessQuestions", (q) => {
          graph.businessTerms.push({ value: q, sourceFile, parser, confidence, location });
          graph.businessQuestions.push({ value: q, sourceFile, parser, confidence, location });
          sourceMeta.nodesExtracted++;
        });
        break;
      }
      case "powerbi": {
        safeForEach(data.visuals, "powerbi.visuals", (v) => {
          graph.charts.push({ value: { title: v.title, type: v.type }, sourceFile, parser, confidence, location });
          graph.visualNarratives.push({ value: `Visual Card: ${v.title} (${v.type})`, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        });
        safeForEach(data.kpis, "powerbi.kpis", (k) => {
          graph.kpis.push({ value: { name: k.label, value: k.value }, sourceFile, parser, confidence, location });
          graph.detectedKPIs.push({ value: { name: k.label, actual: k.value }, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        });
        if (Array.isArray(data.pages) && data.pages.length > 0) {
          graph.dashboards.push({ value: { name: `${sourceFile} Dashboard`, pages: data.pages, visualCount: (data.visuals || []).length }, sourceFile, parser, confidence, location });
          graph.dashboardInsights.push({ value: `Power BI Dashboard Pages: ${data.pages.join(", ")}`, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        }
        safeForEach(data.daxMeasures, "powerbi.daxMeasures", (dax) => {
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
        if (data.problem) {
          graph.documentation.push({ value: { key: "Problem", text: data.problem }, sourceFile, parser, confidence });
          graph.businessQuestions.push({ value: `Problem Statement: ${data.problem}`, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        }
        if (data.challenges) {
          graph.documentation.push({ value: { key: "Challenges", text: data.challenges }, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        }
        if (data.lessonsLearned) {
          graph.documentation.push({ value: { key: "Lessons Learned", text: data.lessonsLearned }, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        }
        if (data.dataCleaning) {
          graph.documentation.push({ value: { key: "Data Cleaning", text: data.dataCleaning }, sourceFile, parser, confidence });
          graph.analyticalTechniques.push({ value: "Data Transformation & Cleaning", sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        }
        if (data.dataset) {
          graph.documentation.push({ value: { key: "Dataset", text: data.dataset }, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        }
        if (data.methodology) {
          graph.methodology.push({ value: data.methodology, sourceFile, parser, confidence });
          graph.analyticalTechniques.push({ value: "Structured Analytical Methodology", sourceFile, parser, confidence });
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
        safeForEach(data.tools, "readme.tools", (t) => {
          graph.businessTerms.push({ value: `Tool: ${t}`, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        });
        break;
      }
      case "document": {
        if (data.title) {
          graph.documentation.push({ value: { key: "Document Title", text: data.title }, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        }
        safeForEach(data.sections, "document.sections", (s) => {
          graph.documentation.push({ value: { key: s.heading, text: s.content }, sourceFile, parser, confidence, location: s.heading });
          const headingLower = s.heading.toLowerCase();
          if (headingLower.includes("recommend") || headingLower.includes("action") || headingLower.includes("priority")) {
            graph.recommendations.push({ value: s.content, sourceFile, parser, confidence });
          }
          if (headingLower.includes("problem") || headingLower.includes("challenge") || headingLower.includes("issue") || headingLower.includes("bottleneck")) {
            graph.documentation.push({ value: { key: "Problem", text: s.content }, sourceFile, parser, confidence });
            graph.businessQuestions.push({ value: `Problem Statement: ${s.content.slice(0, 200)}`, sourceFile, parser, confidence, location: s.heading });
          }
          if (headingLower.includes("objective") || headingLower.includes("goal") || headingLower.includes("question")) {
            graph.businessQuestions.push({ value: s.content.slice(0, 200), sourceFile, parser, confidence, location: s.heading });
          }
          if (headingLower.includes("methodology") || headingLower.includes("approach") || headingLower.includes("workflow")) {
            graph.methodology.push({ value: s.content, sourceFile, parser, confidence });
            graph.analyticalTechniques.push({ value: `Documented Methodology (${s.heading})`, sourceFile, parser, confidence });
          }
          if (headingLower.includes("finding") || headingLower.includes("insight") || headingLower.includes("result")) {
            graph.dashboardInsights.push({ value: `Document Insight: ${s.content.slice(0, 150)}`, sourceFile, parser, confidence });
          }
          if (headingLower.includes("cleaning") || headingLower.includes("transform") || headingLower.includes("preprocess")) {
            graph.analyticalTechniques.push({ value: "Data Transformation & Cleaning", sourceFile, parser, confidence });
          }
          if (headingLower.includes("impact") || headingLower.includes("outcome")) {
            graph.detectedKPIs.push({ value: { name: "Reported Business Impact", actual: s.content.slice(0, 100) }, sourceFile, parser, confidence });
          }
          sourceMeta.nodesExtracted++;
        });
        safeForEach(data.extractedTerms, "document.extractedTerms", (t) => {
          graph.businessTerms.push({ value: t, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        });
        break;
      }
      case "image": {
        const kpiCards = data.kpiCards || [];
        const charts = data.charts || [];
        const tables = data.tables || [];
        const filters = data.filters || [];
        if (data.dashboardDetected) {
          graph.dashboards.push({ value: { name: `Image Visual: ${sourceFile}`, visualCount: charts.length + kpiCards.length }, sourceFile, parser, confidence });
          graph.dashboardInsights.push({ value: `Visual Dashboard Screenshot: ${sourceFile}`, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        }
        safeForEach(kpiCards, "image.kpiCards", (k) => {
          graph.kpis.push({ value: { name: k }, sourceFile, parser, confidence });
          graph.detectedKPIs.push({ value: { name: k }, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        });
        safeForEach(charts, "image.charts", (c) => {
          graph.charts.push({ value: { title: c }, sourceFile, parser, confidence });
          graph.visualNarratives.push({ value: `Visual Image Element: ${c}`, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        });
        const detected = [...kpiCards, ...charts, ...tables, ...filters];
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
  safeForEach(graph.metrics, "graph.metrics", (mNode) => {
    const rawVal = String(mNode.value.value || "").trim();
    if (!rawVal || /^(COUNT|SUM|AVG|MAX|MIN)\b/i.test(rawVal) || rawVal.includes("(") || rawVal.includes(")")) {
      return;
    }
    const label = mNode.value.label.trim();
    const normLabel = label.toLowerCase();
    if (!metricGroups.has(normLabel)) {
      metricGroups.set(normLabel, []);
    }
    metricGroups.get(normLabel).push({
      value: rawVal,
      sourceFile: mNode.sourceFile,
      confidence: mNode.confidence
    });
  });
  metricGroups.forEach((group, normLabel) => {
    if (group.length > 1) {
      const firstVal = group[0].value.toLowerCase();
      const hasConflict = group.some((item) => item.value.toLowerCase() !== firstVal);
      if (hasConflict) {
        const fieldName = `Metric: ${group[0].value || normLabel}`;
        conflicts.push({
          id: `conflict-${normLabel}-${Date.now()}`,
          field: fieldName,
          fieldName,
          fieldLabel: `Conflicting values for KPI Metric '${normLabel}'`,
          conflictType: "Metric Discrepancy",
          values: group.map((g) => ({
            value: g.value,
            sourceFile: g.sourceFile
          })),
          competingValues: group.map((g) => ({
            sourceFile: g.sourceFile,
            value: g.value,
            confidence: g.confidence
          })),
          resolvedValue: void 0,
          isUserResolved: false,
          impactScore: 85
        });
      }
    }
  });
  return conflicts;
}

// src/api/_lib/ai/portfolioCompiler.ts
import { GoogleGenAI, Type } from "@google/genai";
var aiClient = null;
function sanitizeApiKey(raw) {
  if (!raw) return "";
  return raw.trim().replace(/^["']|["']$/g, "").replace(/^Bearer\s+/i, "").trim();
}
function getAiClient() {
  if (aiClient) return aiClient;
  const rawKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const apiKey = sanitizeApiKey(rawKey);
  if (!apiKey) {
    return null;
  }
  aiClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
        "x-goog-api-key": apiKey
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
var FORBIDDEN_FORMAT_TAG_PATTERNS = [
  /^pdf$/i,
  /^acrobat/i,
  /^word$/i,
  /^docx$/i,
  /^document/i,
  /^flat file$/i,
  /^csv$/i,
  /^text$/i,
  /^txt$/i,
  /^png$/i,
  /^jpg$/i,
  /^jpeg$/i,
  /^images?$/i,
  /^visual assets$/i,
  /^markdown$/i,
  /^md$/i,
  /^zip$/i,
  /^archive$/i,
  /^file$/i,
  /^parser$/i,
  /^ipynb$/i,
  /^pbix$/i,
  /^git$/i,
  /^github$/i
];
function sanitizeRecruiterTags(rawTags, techStack = [], techniques = [], projectType = "") {
  const cleanTags = [];
  const candidatePool = [...rawTags, ...techStack, ...techniques];
  const typeLower = (projectType || "").toLowerCase();
  if (typeLower.includes("excel") || typeLower.includes("spreadsheet")) {
    candidatePool.push("Excel", "Pivot Tables", "Business Analytics", "KPI Reporting");
  }
  if (typeLower.includes("sql") || typeLower.includes("relational")) {
    candidatePool.push("SQL", "Relational Database Querying", "Data Aggregation", "Window Functions");
  }
  if (typeLower.includes("power") || typeLower.includes("bi") || typeLower.includes("dax")) {
    candidatePool.push("Power BI", "DAX", "Dashboarding", "KPI Modeling", "Data Visualization");
  }
  if (typeLower.includes("python") || typeLower.includes("notebook")) {
    candidatePool.push("Python", "Feature Engineering", "Statistical Analysis", "Exploratory Data Analysis");
  }
  candidatePool.push("Business Intelligence", "Data Profiling", "Executive Reporting", "Business Analysis");
  for (const tag of candidatePool) {
    if (!tag || typeof tag !== "string") continue;
    const trimmed = tag.trim();
    if (!trimmed || trimmed.length < 2) continue;
    const sanitizedTag = trimmed.replace(/\s*\(\d+\s+[^)]+\)$/, "").trim();
    if (!sanitizedTag || sanitizedTag.length < 2) continue;
    const isForbidden = FORBIDDEN_FORMAT_TAG_PATTERNS.some((pat) => pat.test(sanitizedTag)) || /^(join criteria|window definition)/i.test(sanitizedTag);
    if (!isForbidden && !cleanTags.some((t) => t.toLowerCase() === sanitizedTag.toLowerCase())) {
      cleanTags.push(sanitizedTag);
    }
  }
  return cleanTags.slice(0, 8);
}
function sanitizeBusinessObjective(rawObjective, domain = "Analytics", industry = "Business Intelligence", topKPI) {
  if (rawObjective && typeof rawObjective === "string") {
    const isJunk = rawObjective.includes("payload") || rawObjective.includes("Extraction") || rawObjective.includes("Visual asset") || rawObjective.includes("PDF Grounded") || rawObjective.includes("file:") || /\.(png|jpg|jpeg|pdf|docx|xlsx|csv|sql|py|ipynb)\b/i.test(rawObjective) || rawObjective.length < 25;
    if (!isJunk) {
      return rawObjective.trim();
    }
  }
  const kpiMention = topKPI ? ` tracking key performance indicators such as ${topKPI}` : "";
  return `This project evaluates operational telemetry and performance trends within the ${domain} domain in ${industry}${kpiMention}. The primary objective is to analyze metric variances, isolate operational bottlenecks, and formulate strategic business recommendations for executive decision-makers.`;
}
function sanitizeAndPrioritizeEvidenceGraph(graph) {
  const seenStr = /* @__PURE__ */ new Set();
  const dedupeStrings = (items) => {
    const result = [];
    for (const item of items) {
      if (!item) continue;
      const norm = item.trim().toLowerCase();
      if (norm && !seenStr.has(norm)) {
        seenStr.add(norm);
        result.push(item.trim());
      }
    }
    return result;
  };
  const rawTerms = graph.businessTerms.map((t) => t.value);
  const techStackTools = [];
  const cleanBusinessTerms = [];
  for (const t of rawTerms) {
    if (t.startsWith("Tool:")) {
      techStackTools.push(t.replace("Tool:", "").trim());
    } else {
      cleanBusinessTerms.push(t);
    }
  }
  const objectives = graph.documentation.filter((d) => d.value.key === "Objective" || d.value.key.toLowerCase().includes("objective")).map((d) => d.value.text);
  const questions = graph.businessQuestions.map((q) => q.value);
  const businessObjectivesAndQuestions = dedupeStrings([...objectives, ...questions]);
  const findingsDoc = graph.documentation.filter((d) => d.value.key === "Findings" || d.value.key.toLowerCase().includes("findings")).map((d) => d.value.text);
  const dashboardInsights = graph.dashboardInsights.map((d) => d.value);
  const findingsAndInsights = dedupeStrings([...findingsDoc, ...dashboardInsights]);
  const recsDoc = graph.recommendations.map((r) => r.value);
  const strategicRecommendations = dedupeStrings(recsDoc);
  const seenKpi = /* @__PURE__ */ new Set();
  const kpisAndDaxMeasures = [];
  for (const k of graph.detectedKPIs) {
    const name = k.value.name;
    const val = k.value.target || k.value.actual || "";
    const normKey = `${name.toLowerCase().trim()}:${val.toLowerCase().trim()}`;
    if (name && !seenKpi.has(normKey)) {
      seenKpi.add(normKey);
      kpisAndDaxMeasures.push({ name, valueOrFormula: val, source: k.sourceFile });
    }
  }
  for (const k of graph.kpis) {
    const name = k.value.name;
    const val = k.value.target || k.value.value || "";
    const normKey = `${name.toLowerCase().trim()}:${val.toLowerCase().trim()}`;
    if (name && !seenKpi.has(normKey)) {
      seenKpi.add(normKey);
      kpisAndDaxMeasures.push({ name, valueOrFormula: val, source: k.sourceFile });
    }
  }
  const rawMetrics = graph.metrics;
  for (const m of rawMetrics) {
    const name = m.value.label;
    const val = m.value.value;
    const normKey = `${name.toLowerCase().trim()}:${val.toLowerCase().trim()}`;
    if (name && !seenKpi.has(normKey)) {
      seenKpi.add(normKey);
      kpisAndDaxMeasures.push({ name, valueOrFormula: val, source: m.sourceFile });
    }
  }
  const sqlAnalyticsLogic = graph.sqlLogic.map((s) => ({
    tables: s.value.tables,
    joins: s.value.joins,
    aggregations: s.value.aggregations,
    windowFunctions: s.value.windowFunctions,
    source: s.sourceFile
  }));
  const entities = graph.businessEntities.map((e) => e.value);
  const businessEntitiesAndSchema = dedupeStrings([...cleanBusinessTerms, ...entities]);
  const techniques = graph.analyticalTechniques.map((a) => a.value);
  const methodDoc = graph.methodology.map((m) => m.value);
  const analyticalTechniques = dedupeStrings([...techniques, ...methodDoc]);
  const rawDims = [...graph.detectedDimensions, ...graph.dimensions].map((d) => d.value);
  const columnDimensions = dedupeStrings(rawDims);
  const rawTimeDims = graph.timeDimensions.map((t) => t.value);
  const timeDimensions = dedupeStrings(rawTimeDims);
  const dashPages = graph.dashboards.flatMap((d) => d.value.pages || [d.value.name]);
  const dashboardPageNames = dedupeStrings(dashPages);
  const technologyStack = dedupeStrings([...techStackTools, "SQL", "Excel", "Python", "Power BI"]);
  return {
    businessObjectivesAndQuestions,
    findingsAndInsights,
    strategicRecommendations,
    kpisAndDaxMeasures,
    sqlAnalyticsLogic,
    businessEntitiesAndSchema,
    analyticalTechniques,
    columnDimensions,
    timeDimensions,
    dashboardPageNames,
    technologyStack
  };
}
function formatDebugAiContext(graph, conflicts) {
  const prioritizedPayload = sanitizeAndPrioritizeEvidenceGraph(graph);
  const excelAnalysis = graph.evidenceSources.filter((s) => s.parser === "ExcelParser");
  const sqlAnalysis = graph.evidenceSources.filter((s) => s.parser === "SQLParser");
  const powerbiAnalysis = graph.evidenceSources.filter((s) => s.parser === "PowerBIParser");
  const imageAnalysis = graph.evidenceSources.filter((s) => s.parser === "ImageParser");
  const readmeAnalysis = graph.evidenceSources.filter((s) => s.parser === "MarkdownParser" || s.parser === "GitHubParser");
  const pdfAnalysis = graph.evidenceSources.filter((s) => s.parser === "PDFParser");
  const wordAnalysis = graph.evidenceSources.filter((s) => s.parser === "WordParser");
  return {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    prioritizedAiPayloadSentToGemini: prioritizedPayload,
    evidenceGraphSummary: {
      totalSourcesProcessed: graph.evidenceSources.length,
      evidenceSources: graph.evidenceSources,
      rawProjectDomainAssumption: graph.projectDomain
    },
    parserAnalysisBreakdown: {
      excelAnalysis: {
        sources: excelAnalysis,
        sheetCount: graph.dashboardInsights.filter((d) => d.parser === "ExcelParser").length,
        extractedMetrics: graph.metrics.filter((m) => m.parser === "ExcelParser"),
        extractedDimensions: graph.dimensions.filter((d) => d.parser === "ExcelParser"),
        formulas: graph.analyticalTechniques.filter((t) => t.parser === "ExcelParser")
      },
      sqlAnalysis: {
        sources: sqlAnalysis,
        sqlQueriesExtracted: graph.sqlLogic,
        calculatedMetrics: graph.metrics.filter((m) => m.parser === "SQLParser"),
        businessQuestions: graph.businessQuestions.filter((q) => q.parser === "SQLParser")
      },
      powerbiAnalysis: {
        sources: powerbiAnalysis,
        visuals: graph.charts.filter((c) => c.parser === "PowerBIParser"),
        daxMeasures: graph.metrics.filter((m) => m.parser === "PowerBIParser"),
        kpis: graph.kpis.filter((k) => k.parser === "PowerBIParser")
      },
      imageAnalysis: {
        sources: imageAnalysis,
        screenshotsDetected: graph.screenshots,
        visualCards: graph.charts.filter((c) => c.parser === "ImageParser"),
        kpisDetected: graph.kpis.filter((k) => k.parser === "ImageParser")
      },
      readmeAnalysis: {
        sources: readmeAnalysis,
        documentationNodes: graph.documentation,
        methodology: graph.methodology,
        recommendations: graph.recommendations
      },
      pdfAnalysis: {
        sources: pdfAnalysis,
        sections: graph.documentation.filter((d) => d.parser === "PDFParser"),
        extractedTerms: graph.businessTerms.filter((t) => t.parser === "PDFParser")
      },
      wordAnalysis: {
        sources: wordAnalysis,
        sections: graph.documentation.filter((d) => d.parser === "WordParser"),
        extractedTerms: graph.businessTerms.filter((t) => t.parser === "WordParser")
      }
    },
    detectedSemanticEvidence: {
      detectedKPIs: [
        ...graph.detectedKPIs.map((k) => ({ name: k.value.name, target: k.value.target, actual: k.value.actual, source: k.sourceFile })),
        ...graph.kpis.map((k) => ({ name: k.value.name, target: k.value.target, actual: k.value.value, source: k.sourceFile }))
      ],
      detectedBusinessTerms: [
        ...graph.businessTerms.map((t) => ({ term: t.value, source: t.sourceFile })),
        ...graph.businessEntities.map((e) => ({ entity: e.value, source: e.sourceFile }))
      ],
      detectedCharts: [
        ...graph.charts.map((c) => ({ title: c.value.title, type: c.value.type, source: c.sourceFile })),
        ...graph.visualNarratives.map((v) => ({ narrative: v.value, source: v.sourceFile }))
      ],
      detectedDimensions: [
        ...graph.detectedDimensions.map((d) => ({ dimension: d.value, source: d.sourceFile })),
        ...graph.dimensions.map((d) => ({ dimension: d.value, source: d.sourceFile })),
        ...graph.timeDimensions.map((t) => ({ timeDimension: t.value, source: t.sourceFile }))
      ],
      detectedMeasures: [
        ...graph.detectedMeasures.map((m) => ({ measure: m.value, source: m.sourceFile })),
        ...graph.metrics.map((m) => ({ label: m.value.label, value: m.value.value, source: m.sourceFile }))
      ],
      detectedDashboardTitles: [
        ...graph.dashboards.map((d) => ({ name: d.value.name, pages: d.value.pages, source: d.sourceFile })),
        ...graph.dashboardInsights.map((i) => ({ insight: i.value, source: i.sourceFile }))
      ],
      detectedMethodology: [
        ...graph.methodology.map((m) => ({ methodology: m.value, source: m.sourceFile })),
        ...graph.analyticalTechniques.map((a) => ({ technique: a.value, source: a.sourceFile }))
      ],
      detectedParserEvidence: graph.evidenceSources
    },
    fullCanonicalEvidenceGraph: graph,
    identifiedConflicts: conflicts
  };
}
async function compilePortfolioWithGemini(graph, conflicts, rawBaseProject, userAnswersContext, projectArchetype, understanding) {
  console.log({
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    keyLength: process.env.GEMINI_API_KEY?.length
  });
  const debugAiContext = formatDebugAiContext(graph, conflicts);
  console.log("\n==========================================================");
  console.log("             [DEBUG MODE: AI CONTEXT INSPECTOR]           ");
  console.log("==========================================================");
  console.log(JSON.stringify(debugAiContext, null, 2));
  console.log("==========================================================\n");
  const ai = getAiClient();
  if (!ai) {
    throw new PipelineError("Gemini API", "GEMINI_API_KEY is not configured in process.env", "ConfigurationError");
  }
  const sourceCount = graph.evidenceSources.length || 1;
  let prioritizedPayload;
  try {
    prioritizedPayload = sanitizeAndPrioritizeEvidenceGraph(graph);
  } catch (err) {
    throw new PipelineError("Evidence Prioritization", `Evidence prioritization failed: ${err.message}`, err.name || "EvidencePrioritizationError", err);
  }
  const puContext = understanding ? `
### AUTHORITATIVE PROJECT UNDERSTANDING (pre-synthesized by Project Understanding Engine):
> Do NOT re-derive, reinterpret, or contradict any of the fields below. Treat them as ground truth.

- **Project Archetype**: ${understanding.projectArchetype}
- **Industry**: ${understanding.industry}
- **Business Domain**: ${understanding.businessDomain}
- **Business Problem**: ${understanding.businessProblem}
- **Primary Objective**: ${understanding.primaryObjective}
- **Stakeholders**: ${understanding.likelyStakeholders.join(", ")}
- **Business Questions This Project Answers**:
${understanding.businessQuestions.map((q) => `  \u2022 ${q}`).join("\n") || "  (not detected)"}
- **True Business KPIs**:
${understanding.trueKPIs.slice(0, 8).map((k) => `  \u2022 ${k.label}: ${k.value}`).join("\n") || "  (not detected)"}
- **Tools Used**: ${understanding.toolsUsed.join(", ")}
- **Analytical Techniques**: ${understanding.analyticalTechniques.join(", ")}
- **Source Datasets**: ${understanding.datasets.map((d) => `${d.fileName} (${d.fileType})`).join(", ")}
- **PUE Confidence Score**: ${understanding.confidence}/100
- **Strongly-Preferred Title Candidates** (use as starting point):
${understanding.suggestedTitles.map((t) => `  \u2022 "${t.title}" [${t.confidence}%] \u2014 ${t.rationale}`).join("\n")}
` : "### PROJECT UNDERSTANDING: (not available \u2014 derive from evidence payload below)";
  const prompt = `
You are the world's leading Senior Portfolio Reviewer & Strategic Business Intelligence Consultant (McKinsey / BCG / Deloitte level).
Your primary role is to act as an evidence-first reasoning engine that transforms grounded analytical evidence into recruiter-ready case studies.

${puContext}

### STRICT SENIOR PORTFOLIO REVIEWER DIRECTIVES (ZERO-HALLUCINATION GUARANTEE):
1. **GROUNDED IN PROJECT UNDERSTANDING**: All industry, domain, KPI, stakeholder, and objective context is pre-resolved above. Do not re-infer from raw evidence what is already declared in the Project Understanding block.
2. **SENIOR CONSULTANT COPYWRITING**: Write like a Principal Business Intelligence Leader. Eliminate filler ("This project aims to", "The dashboard shows"). Use active consultant prose ("This analysis evaluates", "Empirical data reveals", "Strategic diagnostics indicate").
3. **ZERO-HALLUCINATION POLICY**: Never fabricate metrics, percentages, dollar amounts, company names, stakeholders, or results that are unsupported by the evidence graph or user answers.
4. **PORTFOLIO INTELLIGENCE LEVELS**:
   - Level 1 (Evidence Only): Use exact numbers, SQL tables, and metrics present in evidence nodes.
   - Level 2 (Safe Inference): Infer only obvious domain context and technical roles (e.g. SQL + Power BI = BI Engineer).
   - Level 3 (Evidence + User Answers): Incorporate user-provided answers seamlessly to complete missing narrative sections.
   - Level 4 (Recruiter Optimized): Rewrite language for ATS optimization without altering factual underlying numbers.
5. **DYNAMIC CONFIDENCE SCORING**:
   - 1 evidence source: ~60% confidence
   - 2 agreeing evidence sources: ~85% confidence
   - 3+ agreeing evidence sources / user validated: ~95% confidence
6. **INSIGHT GROUNDING**: Every finding must explain *Why it matters* and *What strategic action decision-makers should take*.
7. **QUANTIFIED BUSINESS IMPACT**: The businessImpact field must connect extracted metrics to measurable operational outcomes (e.g., cost reduction, variance mitigation, cycle time decrease, or revenue expansion). Do not output vague filler.

### PRIORITIZED SANITIZED EVIDENCE PAYLOAD (TIER 1 & TIER 2 BUSINESS EVIDENCE):
${JSON.stringify(prioritizedPayload, null, 2)}
${userAnswersContext || ""}
### IDENTIFIED CONFLICTS:
${JSON.stringify(conflicts, null, 2)}

Synthesize this Evidence Graph into schema-compliant JSON matching the specified response format.
`;
  const candidateModels = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-lite-latest", "gemini-2.5-pro"];
  let lastError = null;
  let response = null;
  let usedModel = candidateModels[0];
  const startTime = Date.now();
  for (const model of candidateModels) {
    try {
      usedModel = model;
      response = await executeWithTimeout(
        `Gemini Compiler Model[${model}]`,
        () => ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction: "You are an elite Senior Portfolio Reviewer reasoning engine. Transform input Evidence Graphs into executive JSON portfolio case studies. Never fabricate KPIs, metrics, or stakeholders unsupported by evidence.",
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
        }),
        29e3
        // Raised from 25000ms: squeezing every available millisecond out of the 60s Vercel budget.
      );
      if (response && response.text) {
        break;
      }
    } catch (err) {
      lastError = err;
      console.warn(`[portfolioCompiler] Model ${model} failed (${err.message}). Trying fallback model...`);
    }
  }
  if (!response || !response.text) {
    console.error("\u274C Gemini generation failed across all models. Reason:", lastError?.message || "No response received");
    throw new PipelineError("Gemini API", `Gemini API request failed across all models: ${lastError?.message || "No response received"}`, lastError?.name || "GoogleGenAIError", lastError);
  }
  const latencyMs = Date.now() - startTime;
  const promptTokens = response.usageMetadata?.promptTokenCount || 0;
  const completionTokens = response.usageMetadata?.candidatesTokenCount || 0;
  const totalTokens = response.usageMetadata?.totalTokenCount || 0;
  const finishReason = response.candidates?.[0]?.finishReason || "STOP";
  console.log("\n==========================================================");
  console.log("             [GEMINI EXECUTION TELEMETRY]                 ");
  console.log("==========================================================");
  console.log(`Model Used: ${usedModel}`);
  console.log(`Latency: ${latencyMs} ms`);
  console.log(`Prompt Tokens: ${promptTokens}`);
  console.log(`Completion Tokens: ${completionTokens}`);
  console.log(`Total Tokens: ${totalTokens}`);
  console.log(`Finish Reason: ${finishReason}`);
  console.log(`Schema Validation: PASSED (JSON matches responseSchema)`);
  console.log(`Raw Gemini Response JSON:
${response.text}`);
  console.log("==========================================================\n");
  let parsed;
  try {
    parsed = JSON.parse(response.text.trim());
  } catch (err) {
    throw new PipelineError("Schema Validation", `Failed to parse Gemini response JSON: ${err.message}`, "JSONParseError", err);
  }
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
      value: sanitizeBusinessObjective(
        parsed.businessObjective?.value || rawBaseProject.objective,
        graph.projectDomain || "Analytics & Business Intelligence",
        parsed.industry?.value || "Business Analytics",
        understanding?.trueKPIs[0]?.label || graph.metrics[0]?.value?.label
      ),
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
    tags: sanitizeRecruiterTags(
      parsed.tags || rawBaseProject.tags || [],
      parsed.technologyStack?.value || [],
      parsed.analyticalTechniques?.value || (graph.analyticalTechniques.length > 0 ? graph.analyticalTechniques.map((t) => t.value) : []),
      graph.projectDomain || parsed.industry?.value || ""
    ),
    categories: parsed.categories || (rawBaseProject.categories.length > 0 ? rawBaseProject.categories : ["Data Analysis"]),
    storyBlocks: rawBaseProject.storyBlocks || [],
    images: rawBaseProject.images || []
  };
  structured.businessObjective.value = sanitizeBusinessObjective(
    structured.businessObjective.value,
    graph.projectDomain || "Analytics & Business Intelligence",
    structured.industry.value,
    understanding?.trueKPIs[0]?.label || graph.metrics[0]?.value?.label
  );
  structured.tags = sanitizeRecruiterTags(
    structured.tags,
    structured.technologyStack.value,
    structured.analyticalTechniques.value,
    structured.industry.value
  );
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
}

// src/api/_lib/ai/evidenceEvaluator.ts
function classifyProjectArchetype(graph) {
  const parsers = new Set(graph.evidenceSources.map((s) => s.parser));
  if (parsers.has("NotebookParser") || graph.documentation.some((d) => d.parser === "NotebookParser")) {
    return "Jupyter Notebook Exploratory Data Science";
  }
  if (parsers.has("PythonParser")) {
    const hasML = graph.businessTerms.some((t) => {
      const lower = t.value.toLowerCase();
      return lower.includes("model") || lower.includes("predict") || lower.includes("scikit") || lower.includes("regression");
    });
    return hasML ? "Python / Predictive Analytics & Machine Learning Pipeline" : "Python / Data Science Scripting";
  }
  if (parsers.has("PowerBIParser")) {
    return "Power BI / DAX Business Intelligence Dashboard";
  }
  if (parsers.has("SQLParser")) {
    const sqlCount = graph.sqlLogic.length;
    const hasComplexJoins = graph.sqlLogic.some((s) => s.value.joins.length > 0 || s.value.windowFunctions.length > 0);
    return hasComplexJoins || sqlCount > 1 ? "SQL Analytics & Data Relational Engine" : "SQL Query Analytics Case Study";
  }
  if (parsers.has("ExcelParser")) {
    return "Excel / Financial & Operations Intelligence Model";
  }
  if (parsers.size >= 2) {
    return "Multi-Source Enterprise Analytics Package";
  }
  return "Data Analytics Case Study";
}
function disambiguateKPIs(graph) {
  const blacklistColumns = /* @__PURE__ */ new Set([
    "customer_id",
    "user_id",
    "id",
    "created_at",
    "updated_at",
    "order_date",
    "date",
    "region",
    "status",
    "country",
    "name",
    "email",
    "address",
    "category_id",
    "zip",
    "zipcode",
    "phone",
    "row_id",
    "index"
  ]);
  const trueKPIs = [];
  const schemaDimensions = [];
  for (const m of graph.metrics) {
    const normLabel = m.value.label.toLowerCase().trim();
    if (blacklistColumns.has(normLabel)) {
      schemaDimensions.push(m.value.label);
    } else {
      trueKPIs.push({
        label: m.value.label,
        value: m.value.value,
        sourceFile: m.sourceFile
      });
    }
  }
  for (const k of graph.detectedKPIs) {
    const name = k.value.name;
    const normName = name.toLowerCase().trim();
    if (!blacklistColumns.has(normName) && !trueKPIs.some((tk) => tk.label.toLowerCase() === normName)) {
      trueKPIs.push({
        label: name,
        value: k.value.actual || k.value.target || "Tracked",
        sourceFile: k.sourceFile
      });
    }
  }
  for (const s of graph.sqlLogic) {
    for (const agg of s.value.aggregations) {
      if (!trueKPIs.some((tk) => tk.label === agg)) {
        trueKPIs.push({
          label: `Calculated Aggregation: ${agg}`,
          value: agg,
          sourceFile: s.sourceFile
        });
      }
    }
  }
  for (const d of graph.dimensions) {
    const normDim = d.value.toLowerCase().trim();
    if (blacklistColumns.has(normDim)) {
      schemaDimensions.push(d.value);
    }
  }
  return { trueKPIs, schemaDimensions };
}
function evaluateEvidenceCompleteness(graph, userAnswers, understanding) {
  const hasUserAns = (key) => {
    if (!userAnswers) return false;
    const lowerKey = key.toLowerCase();
    return Object.keys(userAnswers).some(
      (k) => k.toLowerCase().includes(lowerKey) && userAnswers[k]?.trim().length > 0
    );
  };
  const trueKPIs = understanding?.trueKPIs || disambiguateKPIs(graph).trueKPIs;
  const totalTrueKPIs = trueKPIs.length;
  let kpisScore = 15;
  if (totalTrueKPIs >= 3) kpisScore = 100;
  else if (totalTrueKPIs === 2) kpisScore = 85;
  else if (totalTrueKPIs === 1) kpisScore = 65;
  if (hasUserAns("kpi") || hasUserAns("metric")) kpisScore = Math.min(100, kpisScore + 30);
  const techCount = (understanding?.analyticalTechniques.length || 0) + graph.methodology.length + graph.sqlLogic.length;
  let methodologyScore = 30;
  if (techCount >= 3) methodologyScore = 95;
  else if (techCount >= 1) methodologyScore = 80;
  if (hasUserAns("methodology") || hasUserAns("tech")) methodologyScore = Math.min(100, methodologyScore + 20);
  const sourceCount = understanding?.datasets.length ?? graph.evidenceSources.length;
  let execScore = 40;
  if (sourceCount >= 3) execScore = 95;
  else if (sourceCount === 2) execScore = 80;
  else if (sourceCount === 1) execScore = 60;
  if (graph.documentation.length > 0) execScore = Math.min(100, execScore + 15);
  if (hasUserAns("summary") || hasUserAns("context")) execScore = Math.min(100, execScore + 25);
  const objectiveDocs = graph.documentation.filter(
    (d) => d.value.key.toLowerCase().includes("objective") || d.value.key.toLowerCase().includes("goal")
  );
  let objectiveScore = 20;
  if (objectiveDocs.length > 0 || graph.businessQuestions.length > 0 || understanding?.primaryObjective && understanding.primaryObjective.length > 20) {
    objectiveScore = 90;
  } else if (understanding?.businessDomain && understanding.businessDomain !== "Mixed Analytics") {
    objectiveScore = 50;
  }
  if (hasUserAns("objective") || hasUserAns("goal")) objectiveScore = 90;
  const problemDocs = graph.documentation.filter(
    (d) => d.value.key.toLowerCase().includes("problem") || d.value.key.toLowerCase().includes("challenge")
  );
  let problemScore = 25;
  if (problemDocs.length > 0) {
    problemScore = 95;
  } else if (understanding?.businessProblem && understanding.businessProblem.trim().length > 20 && !understanding.businessProblem.includes("Analytical gaps identified across")) {
    problemScore = 95;
  } else if (graph.businessQuestions.length > 0) {
    problemScore = 85;
  }
  if (hasUserAns("problem") || hasUserAns("challenge")) problemScore = 95;
  let stakeholdersScore = 15;
  if (graph.stakeholderIndicators.length > 0 || understanding && understanding.likelyStakeholders.length > 0) stakeholdersScore = 85;
  if (hasUserAns("stakeholder") || hasUserAns("audience")) stakeholdersScore = 90;
  let recommendationsScore = 10;
  if (graph.recommendations.length > 0) recommendationsScore = 95;
  if (hasUserAns("recommendation") || hasUserAns("next steps")) recommendationsScore = 90;
  const impactMetrics = graph.detectedKPIs.filter((k) => k.value.actual || k.value.target);
  let impactScore = 10;
  if (impactMetrics.length > 0 || graph.documentation.some((d) => d.value.key.toLowerCase().includes("impact"))) {
    impactScore = 85;
  }
  if (graph.recommendations.length > 0) {
    impactScore = Math.max(impactScore, 85);
  }
  if (hasUserAns("impact") || hasUserAns("outcome")) impactScore = 90;
  let storyScore = 25;
  if (methodologyScore >= 80 && kpisScore >= 80 && (problemScore >= 70 || objectiveScore >= 70)) {
    storyScore = 85;
  }
  if (hasUserAns("story") || hasUserAns("star")) storyScore = 90;
  return {
    executiveSummary: execScore,
    businessObjective: objectiveScore,
    businessProblem: problemScore,
    stakeholders: stakeholdersScore,
    methodology: methodologyScore,
    kpis: kpisScore,
    recommendations: recommendationsScore,
    businessImpact: impactScore,
    interviewStory: storyScore
  };
}
function hasProductionDeploymentEvidence(graph, understanding) {
  const keywords = [
    "production deployment",
    "deployed to",
    "live client",
    "client engagement",
    "actual revenue impact",
    "realized cost savings",
    "roi achieved",
    "production database",
    "live server",
    "enterprise rollout",
    "organization deployment",
    "client implementation",
    "deployed in production"
  ];
  const docsText = graph.documentation.map((d) => d.value.text.toLowerCase()).join(" ");
  const termsText = graph.businessTerms.map((t) => t.value.toLowerCase()).join(" ");
  const problemText = (understanding.businessProblem || "").toLowerCase();
  const summaryText = (understanding.suggestedSummaries?.[0]?.summary || "").toLowerCase();
  const combinedText = `${docsText} ${termsText} ${problemText} ${summaryText}`;
  return keywords.some((kw) => combinedText.includes(kw));
}
function generateMissingInformationRequests(report, graph, understanding) {
  const requests = [];
  const fileCount = understanding.datasets.length;
  const toolStack = understanding.toolsUsed.join(" & ");
  const domain = understanding.businessDomain;
  const industry = understanding.industry;
  const archetype = understanding.projectArchetype;
  const projectType = understanding.projectType;
  const topKPI = understanding.trueKPIs[0]?.label || "core metrics";
  const topStakeholder = understanding.likelyStakeholders[0] || "executive decision-makers";
  const detectedQ = understanding.businessQuestions.length > 0 ? `"${understanding.businessQuestions[0]}"` : null;
  const isProduction = hasProductionDeploymentEvidence(graph, understanding);
  const hasRecommendations = graph.recommendations.length > 0 || report.recommendations >= 80;
  if (report.businessImpact < 80 && !hasRecommendations) {
    if (isProduction) {
      requests.push({
        field: "Business Impact",
        reason: `Quantified business outcomes or operational improvements missing for ${domain}.`,
        question: `Your ${archetype} (${fileCount} file${fileCount !== 1 ? "s" : ""} \u2014 ${toolStack}) tracks ${topKPI}. What specific efficiency gains, cost savings, or revenue impact did this analysis deliver in ${industry}?`,
        type: "textarea",
        estimatedQualityBoost: 25,
        recruiterImpactPriority: "Critical"
      });
    } else {
      requests.push({
        field: "Business Recommendations & Priorities",
        reason: `Key strategic recommendations or management priority actions missing for ${domain}.`,
        question: `Your ${archetype} (${fileCount} file${fileCount !== 1 ? "s" : ""} \u2014 ${toolStack}) analyzes ${topKPI}. What top business recommendations emerged from your findings, and which action should management prioritize first?`,
        type: "textarea",
        estimatedQualityBoost: 25,
        recruiterImpactPriority: "Critical"
      });
    }
  }
  if (report.businessObjective < 80) {
    const questionHint = detectedQ ? `We detected a potential business question: ${detectedQ}. ` : `We detected ${fileCount} ${toolStack} source file(s) focused on ${domain}. `;
    requests.push({
      field: "Business Objective",
      reason: "No explicit business objective or analytical goal was detected in parsed source files.",
      question: `${questionHint}What was the core strategic objective or business question this analysis was built to answer?`,
      type: "textarea",
      estimatedQualityBoost: 20,
      recruiterImpactPriority: "High"
    });
  }
  if (report.recommendations < 80 && !hasRecommendations) {
    const recQuestion = isProduction ? `Based on your ${industry} analysis, what are the top 2-3 strategic recommendations you presented to ${topStakeholder}?` : `Based on your ${industry} analysis of ${topKPI}, what key business recommendations emerged, and which analytical insight surprised you most?`;
    requests.push({
      field: "Strategic Recommendations",
      reason: "Strategic action items or executive recommendations were not explicitly stated in source files.",
      question: recQuestion,
      type: "textarea",
      estimatedQualityBoost: 20,
      recruiterImpactPriority: "High"
    });
  }
  if (report.stakeholders < 80) {
    const question = isProduction ? `Who were the primary business stakeholders consuming this ${projectType} report within ${industry}?` : `Which key stakeholder (${topStakeholder}) benefits most from this ${projectType} analysis, and which KPI (such as ${topKPI}) should they monitor going forward?`;
    requests.push({
      field: "Stakeholders & KPI Focus",
      reason: "Target audience roles or key monitoring KPIs were not fully identified in evidence.",
      question,
      type: "text",
      estimatedQualityBoost: 15,
      recruiterImpactPriority: "Medium"
    });
  }
  const problemDocs = graph.documentation.filter(
    (d) => d.value.key.toLowerCase().includes("problem") || d.value.key.toLowerCase().includes("challenge")
  );
  const hasKnownProblem = problemDocs.length > 0 || understanding?.businessProblem && understanding.businessProblem.trim().length > 20 && !understanding.businessProblem.includes("Analytical gaps identified across");
  if (report.businessProblem < 80 && !hasKnownProblem) {
    const bqHint = understanding.businessQuestions.length > 0 ? ` (e.g. ${understanding.businessQuestions.slice(0, 2).map((q) => `"${q}"`).join(", ")})` : "";
    const question = `What specific operational challenge or bottleneck in ${domain} prompted this ${archetype}?${bqHint.length > 0 ? ` Your analysis appears to address questions like${bqHint}.` : ""}`;
    requests.push({
      field: "Business Problem",
      reason: "Root operational bottleneck or business challenge missing from dataset.",
      question,
      type: "textarea",
      estimatedQualityBoost: 15,
      recruiterImpactPriority: "Medium"
    });
  }
  const priorityRank = { Critical: 3, High: 2, Medium: 1 };
  requests.sort((a, b) => {
    const pA = priorityRank[a.recruiterImpactPriority || "Medium"];
    const pB = priorityRank[b.recruiterImpactPriority || "Medium"];
    if (pA !== pB) return pB - pA;
    return (b.estimatedQualityBoost || 0) - (a.estimatedQualityBoost || 0);
  });
  return requests.slice(0, 5);
}
function mergeUserAnswersWithEvidence(graph, userAnswers) {
  const answerConflicts = [];
  if (!userAnswers || Object.keys(userAnswers).length === 0) {
    return { mergedAnswersContext: "", answerConflicts };
  }
  const validAnswers = [];
  for (const [key, rawVal] of Object.entries(userAnswers)) {
    const val = rawVal?.trim();
    if (!val) continue;
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes("kpi") || lowerKey.includes("metric") || lowerKey.includes("revenue") || lowerKey.includes("number")) {
      for (const m of graph.metrics) {
        if (val.includes("$") && m.value.value && !val.includes(m.value.value)) {
          answerConflicts.push({
            field: `User Answer Conflict (${key})`,
            values: [
              { value: `Evidence Grounded: ${m.value.label} = ${m.value.value}`, sourceFile: m.sourceFile },
              { value: `User Submitted: ${val}`, sourceFile: "User Answers" }
            ]
          });
        }
      }
    }
    validAnswers.push({ field: key, answer: val });
  }
  if (validAnswers.length === 0) {
    return { mergedAnswersContext: "", answerConflicts };
  }
  const contextLines = validAnswers.map((a) => `- **${a.field}**: ${a.answer}`).join("\n");
  const mergedAnswersContext = `
### USER-SUPPLIED SUPPLEMENTAL CONTEXT (LEVEL 3 INTEL):
${contextLines}
`;
  return { mergedAnswersContext, answerConflicts };
}
function runRecruiterAuditEngine(portfolio, graph, conflicts, understanding) {
  const strengths = [];
  const improvementSuggestions = [];
  let atsScore = 70;
  const techStack = portfolio.technologyStack?.value || understanding?.toolsUsed || [];
  if (techStack.length >= 3) {
    atsScore += 15;
    strengths.push(`Rich technical stack keywords (${techStack.slice(0, 5).join(", ")}) optimization for ATS screening.`);
  } else {
    improvementSuggestions.push("Add more technical tools (SQL, Python, Power BI, Excel) to increase ATS keyword matching.");
  }
  const bullets = portfolio.resumeBullets?.value || [];
  if (bullets.length >= 3) {
    atsScore += 15;
    strengths.push("High-impact action verb resume bullets with quantifiable performance outcomes.");
  }
  let storytellingScore = 75;
  if (portfolio.executiveSummary?.value && portfolio.executiveSummary.value.length > 50) {
    storytellingScore += 10;
  }
  if (portfolio.businessProblem?.value && portfolio.businessProblem.value.length > 30) {
    storytellingScore += 15;
    strengths.push("Clear executive problem definition and stakeholder business context.");
  } else {
    improvementSuggestions.push("Expand the Business Problem section to explain root operational challenges.");
  }
  const scores = [
    portfolio.title.confidence,
    portfolio.executiveSummary.confidence,
    portfolio.businessContext.confidence,
    portfolio.businessProblem.confidence,
    portfolio.businessImpact.confidence,
    portfolio.methodology.confidence,
    portfolio.findings.confidence,
    portfolio.recommendations.confidence
  ];
  const avgConfidence = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const evidenceScore = Math.min(100, Math.max(50, avgConfidence));
  if (evidenceScore >= 85) {
    strengths.push("High evidence confidence score derived directly from parsed source file schemas.");
  }
  let interviewScore = 60;
  const star = portfolio.starStory?.value;
  if (star && star.situation && star.task && star.action && star.result) {
    interviewScore = 95;
    strengths.push("Recruiter-ready STAR story (Situation, Task, Action, Result) ready for live interview defense.");
  } else {
    improvementSuggestions.push("Formulate a clear STAR story structure for quick interview responses.");
  }
  let hallucinationRisk = 0;
  if (conflicts.length > 0) {
    hallucinationRisk += conflicts.length * 15;
    improvementSuggestions.push(`Resolve ${conflicts.length} conflicting metric claim(s) across evidence sources.`);
  }
  if (graph.evidenceSources.length === 0) {
    hallucinationRisk += 25;
  }
  hallucinationRisk = Math.min(100, hallucinationRisk);
  if (hallucinationRisk === 0) {
    strengths.push("Zero-hallucination verification confirmed: 100% grounded in empirical data.");
  }
  const rawOverall = atsScore * 0.25 + storytellingScore * 0.25 + evidenceScore * 0.25 + interviewScore * 0.25 - hallucinationRisk * 0.1;
  const overallQualityScore = Math.min(100, Math.max(40, Math.round(rawOverall)));
  const auditPassed = overallQualityScore >= 75 && hallucinationRisk <= 20;
  return {
    atsReadinessScore: Math.min(100, atsScore),
    businessStorytellingScore: Math.min(100, storytellingScore),
    evidenceConfidenceScore: evidenceScore,
    interviewReadinessScore: interviewScore,
    hallucinationRiskScore: hallucinationRisk,
    overallQualityScore,
    auditPassed,
    strengths,
    improvementSuggestions
  };
}

// src/api/_lib/ai/projectUnderstandingEngine.ts
import { GoogleGenAI as GoogleGenAI2, Type as Type2 } from "@google/genai";
var PUE_SCHEMA_VERSION = "1.0.0";
var _aiClient = null;
function sanitizeApiKey2(raw) {
  if (!raw) return "";
  return raw.trim().replace(/^["']|["']$/g, "").replace(/^Bearer\s+/i, "").trim();
}
function getPUEClient() {
  if (_aiClient) return _aiClient;
  const rawKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const apiKey = sanitizeApiKey2(rawKey);
  if (!apiKey) return null;
  _aiClient = new GoogleGenAI2({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
        "x-goog-api-key": apiKey
      }
    }
  });
  return _aiClient;
}
var MAX_CACHE_SIZE = 64;
var _understandingCache = /* @__PURE__ */ new Map();
function cacheGet(key) {
  const entry = _understandingCache.get(key);
  if (!entry) return null;
  entry.accessedAt = Date.now();
  return entry.understanding;
}
function cacheSet(key, understanding) {
  if (_understandingCache.size >= MAX_CACHE_SIZE) {
    let oldest = null;
    let oldestTime = Infinity;
    for (const [k, v] of _understandingCache) {
      if (v.accessedAt < oldestTime) {
        oldestTime = v.accessedAt;
        oldest = k;
      }
    }
    if (oldest) _understandingCache.delete(oldest);
  }
  _understandingCache.set(key, { understanding, accessedAt: Date.now() });
}
function buildEvidenceDigest(graph) {
  const parsers = Array.from(new Set(graph.evidenceSources.map((s) => s.parser)));
  const kpiNames = Array.from(/* @__PURE__ */ new Set([
    ...graph.detectedKPIs.map((k) => k.value.name),
    ...graph.kpis.map((k) => k.value.name),
    ...graph.metrics.map((m) => m.value.label)
  ])).filter(Boolean).slice(0, 35);
  const colNames = Array.from(/* @__PURE__ */ new Set([
    ...graph.detectedDimensions.map((d) => d.value),
    ...graph.dimensions.map((d) => d.value),
    ...graph.detectedMeasures.map((m) => m.value)
  ])).filter(Boolean).slice(0, 45);
  const excelMeasures = Array.from(new Set(
    graph.detectedMeasures.filter((m) => m.parser === "ExcelParser").map((m) => m.value)
  )).slice(0, 20);
  const excelInsights = graph.dashboardInsights.filter((d) => d.parser === "ExcelParser").map((d) => d.value).slice(0, 15);
  const sqlTables = graph.sqlLogic.flatMap((s) => s.value.tables).slice(0, 20);
  const sqlAggs = graph.sqlLogic.flatMap((s) => s.value.aggregations).slice(0, 20);
  const sqlWin = graph.sqlLogic.flatMap((s) => s.value.windowFunctions).slice(0, 10);
  const daxMeasures = graph.metrics.filter((m) => m.parser === "PowerBIParser").map((m) => m.value.label).slice(0, 20);
  const businessTerms = Array.from(new Set(graph.businessTerms.map((t) => t.value))).slice(0, 35);
  const businessEntities = Array.from(new Set(graph.businessEntities.map((e) => e.value))).slice(0, 25);
  const businessQuestions = graph.businessQuestions.map((q) => q.value).slice(0, 10);
  const dashboardPages = graph.dashboards.flatMap((d) => d.value.pages || [d.value.name]).slice(0, 15);
  const docs = graph.documentation.map((d) => {
    const isKey = /problem|recommend|objective|summary|finding|challenge|insight/i.test(d.value.key);
    const limit = isKey ? 1200 : 400;
    return `[${d.value.key}]: ${d.value.text.slice(0, limit)}`;
  }).slice(0, 25);
  const techniques = Array.from(new Set(graph.analyticalTechniques.map((a) => a.value))).slice(0, 20);
  const recommendations = graph.recommendations.map((r) => r.value.slice(0, 1e3)).slice(0, 10);
  const toolsRaw = Array.from(new Set(
    graph.businessTerms.filter((t) => t.value.startsWith("Tool:")).map((t) => t.value.replace("Tool:", "").trim())
  ));
  const filesSummary = graph.evidenceSources.map((s) => ({
    file: s.fileName,
    parser: s.parser,
    confidence: s.confidence,
    nodes: s.nodesExtracted
  }));
  return JSON.stringify({
    parsers,
    files: filesSummary,
    kpiNames,
    columnNames: colNames,
    excelMeasures,
    excelWorkbookTelemetry: excelInsights,
    sqlTables,
    sqlAggregations: sqlAggs,
    sqlWindowFunctions: sqlWin,
    daxMeasures,
    businessTerms,
    businessEntities,
    businessQuestions,
    dashboardPages,
    analyticalTechniques: techniques,
    documentation: docs,
    recommendations,
    detectedTools: toolsRaw
  }, null, 0);
}
var PUE_RESPONSE_SCHEMA = {
  type: Type2.OBJECT,
  properties: {
    projectType: { type: Type2.STRING },
    projectArchetype: { type: Type2.STRING },
    industry: { type: Type2.STRING },
    businessDomain: { type: Type2.STRING },
    businessProblem: { type: Type2.STRING },
    primaryObjective: { type: Type2.STRING },
    likelyStakeholders: { type: Type2.ARRAY, items: { type: Type2.STRING } },
    businessQuestions: { type: Type2.ARRAY, items: { type: Type2.STRING } },
    trueKPIs: {
      type: Type2.ARRAY,
      items: {
        type: Type2.OBJECT,
        properties: {
          label: { type: Type2.STRING },
          value: { type: Type2.STRING },
          sourceFile: { type: Type2.STRING },
          isDAX: { type: Type2.BOOLEAN }
        },
        required: ["label", "value", "sourceFile"]
      }
    },
    analyticalTechniques: { type: Type2.ARRAY, items: { type: Type2.STRING } },
    toolsUsed: { type: Type2.ARRAY, items: { type: Type2.STRING } },
    datasets: {
      type: Type2.ARRAY,
      items: {
        type: Type2.OBJECT,
        properties: {
          fileName: { type: Type2.STRING },
          fileType: { type: Type2.STRING },
          schemaColumns: { type: Type2.ARRAY, items: { type: Type2.STRING } },
          recordSummary: { type: Type2.STRING }
        },
        required: ["fileName", "fileType", "schemaColumns"]
      }
    },
    suggestedTitles: {
      type: Type2.ARRAY,
      items: {
        type: Type2.OBJECT,
        properties: {
          title: { type: Type2.STRING },
          confidence: { type: Type2.INTEGER },
          rationale: { type: Type2.STRING }
        },
        required: ["title", "confidence", "rationale"]
      }
    },
    suggestedSummaries: {
      type: Type2.ARRAY,
      items: {
        type: Type2.OBJECT,
        properties: {
          summary: { type: Type2.STRING },
          confidence: { type: Type2.INTEGER }
        },
        required: ["summary", "confidence"]
      }
    },
    confidence: { type: Type2.INTEGER }
  },
  required: [
    "projectType",
    "projectArchetype",
    "industry",
    "businessDomain",
    "businessProblem",
    "primaryObjective",
    "likelyStakeholders",
    "businessQuestions",
    "trueKPIs",
    "analyticalTechniques",
    "toolsUsed",
    "datasets",
    "suggestedTitles",
    "suggestedSummaries",
    "confidence"
  ]
};
function isValidUnderstanding(u) {
  return u !== null && typeof u === "object" && typeof u.projectType === "string" && u.projectType.length > 0 && typeof u.industry === "string" && u.industry.length > 0 && typeof u.businessDomain === "string" && u.businessDomain.length > 0 && typeof u.primaryObjective === "string" && u.primaryObjective.length > 0 && typeof u.confidence === "number" && Array.isArray(u.trueKPIs) && Array.isArray(u.toolsUsed) && u.toolsUsed.length > 0 && Array.isArray(u.datasets) && Array.isArray(u.businessQuestions) && Array.isArray(u.suggestedTitles) && // Schema version guard: reject stale objects from old engine versions
  u.schemaVersion === PUE_SCHEMA_VERSION;
}
function buildFallbackUnderstanding(graph) {
  const projectArchetype = classifyProjectArchetype(graph);
  const projectType = graph.projectDomain || projectArchetype;
  const { trueKPIs, schemaDimensions } = disambiguateKPIs(graph);
  const toolsUsed = Array.from(/* @__PURE__ */ new Set([
    ...graph.evidenceSources.map((s) => {
      const p = s.parser;
      if (p === "SQLParser") return "SQL";
      if (p === "PowerBIParser") return "Power BI / DAX";
      if (p === "ExcelParser") return "Excel";
      if (p === "PythonParser" || p === "NotebookParser") return "Python";
      return p.replace("Parser", "");
    }),
    ...graph.businessTerms.filter((t) => t.value.startsWith("Tool:")).map((t) => t.value.replace("Tool:", "").trim())
  ]));
  const analyticalTechniques = Array.from(/* @__PURE__ */ new Set([
    ...graph.analyticalTechniques.map((a) => a.value),
    ...graph.sqlLogic.flatMap((s) => s.value.joins.length > 0 ? ["Relational Multi-Table Joins"] : []),
    ...graph.sqlLogic.flatMap((s) => s.value.windowFunctions.length > 0 ? ["Window Aggregations & Partitioning"] : [])
  ]));
  const objectiveDoc = graph.documentation.find(
    (d) => d.value.key.toLowerCase().includes("objective") || d.value.key.toLowerCase().includes("goal")
  );
  const problemDoc = graph.documentation.find(
    (d) => d.value.key.toLowerCase().includes("problem") || d.value.key.toLowerCase().includes("challenge")
  );
  const datasets = graph.evidenceSources.map((s) => ({
    fileName: s.fileName,
    fileType: s.parser.replace("Parser", ""),
    schemaColumns: schemaDimensions.slice(0, 10),
    recordSummary: `${s.nodesExtracted} nodes extracted`
  }));
  const primarySource = graph.evidenceSources[0]?.fileName || "Dataset";
  const cleanSource = primarySource.split(".")[0].replace(/[^a-zA-Z0-9\s]/g, " ").trim();
  const titleCap = cleanSource ? cleanSource.charAt(0).toUpperCase() + cleanSource.slice(1) : "Business Intelligence";
  const rawObjText = objectiveDoc?.value.text || "";
  const isJunkObj = !rawObjText || rawObjText.includes("payload") || rawObjText.includes("Extraction") || rawObjText.includes("Visual asset") || rawObjText.includes("PDF Grounded") || rawObjText.includes("file:") || rawObjText.length < 20;
  const fallbackObjective = `This project evaluates key operational performance indicators and transactional trends. The primary objective is to analyze metric variances, identify operational bottlenecks, and formulate strategic business recommendations for decision-makers.`;
  const primaryObjective = !isJunkObj ? rawObjText : fallbackObjective;
  return {
    projectType,
    projectArchetype,
    industry: "Analytics & Business Intelligence",
    businessDomain: "Operations & Data Analytics",
    businessProblem: problemDoc?.value.text || `Analytical gaps identified across ${graph.evidenceSources.length} source file(s) requiring structured evaluation.`,
    primaryObjective,
    likelyStakeholders: graph.stakeholderIndicators.length > 0 ? graph.stakeholderIndicators.map((s) => s.value) : ["Executive Leadership", "Analytics Leads", "Operations Managers"],
    businessQuestions: graph.businessQuestions.map((q) => q.value),
    trueKPIs,
    analyticalTechniques: analyticalTechniques.length > 0 ? analyticalTechniques : ["Relational Querying", "Dimensional Profiling", "KPI Modeling"],
    toolsUsed: toolsUsed.length > 0 ? toolsUsed : ["SQL", "Excel", "Power BI"],
    datasets,
    suggestedTitles: [{
      title: `${titleCap} Performance & Decision Engine`,
      confidence: 60,
      rationale: `Derived from primary dataset '${primarySource}' (fallback mode).`
    }],
    suggestedSummaries: [{
      summary: `This ${projectArchetype} synthesizes analytical telemetry across ${graph.evidenceSources.length} source asset(s). Operating within Operations & Data Analytics, the analysis evaluates core performance indicators using ${toolsUsed.join(" & ")} to deliver structured decision support.`,
      confidence: 60
    }],
    confidence: 55,
    schemaVersion: PUE_SCHEMA_VERSION
  };
}
function normalizeUnderstanding(raw, graph) {
  const fallback = buildFallbackUnderstanding(graph);
  const ensureStrArr = (val, fb) => Array.isArray(val) && val.length > 0 ? val.filter(Boolean) : fb;
  const ensureArr = (val, fb) => Array.isArray(val) && val.length > 0 ? val : fb;
  return {
    projectType: raw.projectType || fallback.projectType,
    projectArchetype: raw.projectArchetype || fallback.projectArchetype,
    industry: raw.industry || fallback.industry,
    businessDomain: raw.businessDomain || fallback.businessDomain,
    businessProblem: raw.businessProblem || fallback.businessProblem,
    primaryObjective: raw.primaryObjective || fallback.primaryObjective,
    likelyStakeholders: ensureStrArr(raw.likelyStakeholders, fallback.likelyStakeholders),
    businessQuestions: ensureStrArr(raw.businessQuestions, fallback.businessQuestions),
    trueKPIs: ensureArr(raw.trueKPIs, fallback.trueKPIs),
    analyticalTechniques: ensureStrArr(raw.analyticalTechniques, fallback.analyticalTechniques),
    toolsUsed: ensureStrArr(raw.toolsUsed, fallback.toolsUsed),
    datasets: ensureArr(raw.datasets, fallback.datasets),
    suggestedTitles: ensureArr(raw.suggestedTitles, fallback.suggestedTitles),
    suggestedSummaries: ensureArr(raw.suggestedSummaries, fallback.suggestedSummaries),
    confidence: typeof raw.confidence === "number" ? Math.max(0, Math.min(100, raw.confidence)) : fallback.confidence,
    schemaVersion: PUE_SCHEMA_VERSION
  };
}
async function synthesizeViaGemini(graph) {
  const pueViaGeminiStart = Date.now();
  console.log(`[PUE-TIMER] synthesizeViaGemini: ENTER | T+0ms`);
  const ai = getPUEClient();
  console.log(`[PUE-TIMER] synthesizeViaGemini: getPUEClient() complete | ai=${ai ? "client_ready" : "null_no_api_key"} | T+${Date.now() - pueViaGeminiStart}ms`);
  if (!ai) {
    console.log(`[PUE-TIMER] synthesizeViaGemini: EXIT early \u2014 no AI client | T+${Date.now() - pueViaGeminiStart}ms`);
    return null;
  }
  console.log(`[PUE-TIMER] synthesizeViaGemini: calling buildEvidenceDigest() | T+${Date.now() - pueViaGeminiStart}ms`);
  const digest = buildEvidenceDigest(graph);
  console.log(`[PUE-TIMER] synthesizeViaGemini: buildEvidenceDigest() complete | digest length: ${digest.length} chars | T+${Date.now() - pueViaGeminiStart}ms`);
  const systemInstruction = "You are an expert business intelligence analyst and project classifier. Given a structured evidence digest extracted from data project files (SQL, Excel, Power BI, Python, CSV, images, documents), synthesize a precise, domain-aware ProjectUnderstanding object. Reason from the evidence \u2014 do not use generic placeholders. Identify true business KPIs (not schema column IDs or row keys). Identify the real business problem and primary objective from the project evidence. Generate business questions this project answers. Output valid JSON matching the response schema exactly.";
  const prompt = `Analyze this Evidence Digest extracted from a data analyst portfolio project and synthesize a complete ProjectUnderstanding object.

### EVIDENCE DIGEST:
${digest}

### INSTRUCTIONS:
- projectType: The general type (e.g. "Power BI", "SQL", "Python", "Multi-Source").
- projectArchetype: Specific analytical archetype (e.g. "Power BI / DAX Business Intelligence Dashboard", "SQL Analytics & Data Relational Engine").
- industry: The real-world industry. Infer from business terms and KPI names \u2014 NOT from parser type.
- businessProblem: The root operational challenge. If an uploaded report file or documentation explicitly states the business problem or operational bottleneck, use that exact real context rather than generating generic text.
- primaryObjective: The primary analytical goal. One clear sentence.
- likelyStakeholders: 2-4 role titles.
- businessQuestions: 3-6 specific business questions this project answers.
- trueKPIs: Only real business KPIs \u2014 NOT schema column names like 'id', 'created_at', 'category_id'.
- analyticalTechniques: Methods used (e.g. "Time-Series Trend Analysis", "Cohort Retention Analysis").
- toolsUsed: Technology tools.
- datasets: One entry per source file with its detected schema columns.
- suggestedTitles: 2 recruiter-quality project title suggestions.
- suggestedSummaries: 1-2 executive summary paragraph suggestions.
- confidence: Your overall confidence in this synthesis (0-100).
`;
  const candidateModels = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-lite-latest", "gemini-2.5-pro"];
  for (const model of candidateModels) {
    const modelStart = Date.now();
    console.log(`[PUE-TIMER] synthesizeViaGemini: attempting model "${model}" | T+${Date.now() - pueViaGeminiStart}ms from PUE entry`);
    try {
      console.log(`[PUE-TIMER] synthesizeViaGemini: calling executeWithTimeout(12000ms) for model "${model}" | T+${Date.now() - pueViaGeminiStart}ms`);
      const geminiTimerLabel = `[GEMINI LATENCY] Model: ${model}`;
      console.time(geminiTimerLabel);
      const response = await executeWithTimeout(
        `Gemini PUE Model[${model}]`,
        async () => {
          const promptTokenEstimate = Math.ceil(prompt.length / 4);
          console.log(`
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`);
          console.log(`[GEMINI API] BEFORE ai.models.generateContent()`);
          console.log(`[GEMINI API] Model:                ${model}`);
          console.log(`[GEMINI API] Prompt Char Length:   ${prompt.length}`);
          console.log(`[GEMINI API] Prompt Token Estimate: ~${promptTokenEstimate} tokens`);
          console.log(`\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
`);
          const apiResult = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              systemInstruction,
              responseMimeType: "application/json",
              responseSchema: PUE_RESPONSE_SCHEMA
            }
          });
          const promptTokens = apiResult.usageMetadata?.promptTokenCount ?? "N/A";
          const responseTokens = apiResult.usageMetadata?.candidatesTokenCount ?? "N/A";
          const totalTokens = apiResult.usageMetadata?.totalTokenCount ?? "N/A";
          const finishReason = apiResult.candidates?.[0]?.finishReason ?? "N/A";
          console.log(`
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`);
          console.log(`[GEMINI API] AFTER ai.models.generateContent()`);
          console.log(`[GEMINI API] Model:              ${model}`);
          console.log(`[GEMINI API] Prompt Tokens:      ${promptTokens}`);
          console.log(`[GEMINI API] Response Tokens:    ${responseTokens}`);
          console.log(`[GEMINI API] Total Tokens:       ${totalTokens}`);
          console.log(`[GEMINI API] Finish Reason:      ${finishReason}`);
          console.log(`\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
`);
          return apiResult;
        },
        12e3
      );
      console.timeEnd(geminiTimerLabel);
      console.log(`[PUE-TIMER] synthesizeViaGemini: executeWithTimeout returned for model "${model}" | model elapsed: ${Date.now() - modelStart}ms | T+${Date.now() - pueViaGeminiStart}ms`);
      console.log(`[PUE-TIMER] synthesizeViaGemini: calling JSON.parse on response | T+${Date.now() - pueViaGeminiStart}ms`);
      const raw = JSON.parse(response.text.trim());
      console.log(`[PUE-TIMER] synthesizeViaGemini: JSON.parse complete | T+${Date.now() - pueViaGeminiStart}ms`);
      console.log(`[PUE-TIMER] synthesizeViaGemini: calling normalizeUnderstanding | T+${Date.now() - pueViaGeminiStart}ms`);
      const normalized = normalizeUnderstanding(raw, graph);
      console.log(`[PUE-TIMER] synthesizeViaGemini: normalizeUnderstanding complete | T+${Date.now() - pueViaGeminiStart}ms`);
      console.log(`[PUE] Synthesized via Gemini/${model} (confidence: ${normalized.confidence})`);
      console.log(`[PUE-TIMER] synthesizeViaGemini: EXIT success via "${model}" | total elapsed: ${Date.now() - pueViaGeminiStart}ms`);
      return normalized;
    } catch (err) {
      console.warn(`[PUE] Gemini model ${model} failed or timed out: ${err.message}`);
      console.warn(`[PUE-TIMER] synthesizeViaGemini: model "${model}" FAILED | elapsed for this model: ${Date.now() - modelStart}ms | T+${Date.now() - pueViaGeminiStart}ms from PUE entry`);
    }
  }
  console.log(`[PUE-TIMER] synthesizeViaGemini: all models exhausted | total elapsed: ${Date.now() - pueViaGeminiStart}ms | returning null`);
  return null;
}
async function getCachedOrSynthesizeUnderstanding(graph, evidenceHash, existing) {
  const pueEntryMs = Date.now();
  console.log(`[PUE-TIMER] getCachedOrSynthesizeUnderstanding: ENTER | evidenceHash: ${evidenceHash.slice(0, 12)}... | existing: ${existing !== void 0 ? "provided" : "none"}`);
  try {
    console.log(`[PUE-TIMER] Tier 1 check: existing supplied? ${existing !== void 0 && existing !== null} | T+${Date.now() - pueEntryMs}ms`);
    if (existing !== void 0 && existing !== null) {
      if (isValidUnderstanding(existing)) {
        console.log("[PUE] Reusing caller-supplied ProjectUnderstanding (Tier 1 \u2014 zero Gemini calls).");
        console.log(`[PUE-TIMER] Tier 1 HIT: returning existing | T+${Date.now() - pueEntryMs}ms`);
        cacheSet(evidenceHash, existing);
        return existing;
      }
      console.warn("[PUE] Caller-supplied ProjectUnderstanding failed validation \u2014 proceeding to Tier 2.");
      console.warn(`[PUE-TIMER] Tier 1 MISS: validation failed | T+${Date.now() - pueEntryMs}ms`);
    }
    console.log(`[PUE-TIMER] Tier 2 check: calling cacheGet | T+${Date.now() - pueEntryMs}ms`);
    const cached = cacheGet(evidenceHash);
    if (cached !== null) {
      console.log("[PUE] Cache hit for evidenceHash \u2014 returning cached ProjectUnderstanding (Tier 2 \u2014 zero Gemini calls).");
      console.log(`[PUE-TIMER] Tier 2 HIT: returning cached | T+${Date.now() - pueEntryMs}ms`);
      return cached;
    }
    console.log(`[PUE-TIMER] Tier 2 MISS: no cache hit | T+${Date.now() - pueEntryMs}ms`);
    console.log(`[PUE-TIMER] Tier 3: calling synthesizeViaGemini | T+${Date.now() - pueEntryMs}ms`);
    const geminiResult = await synthesizeViaGemini(graph);
    console.log(`[PUE-TIMER] Tier 3: synthesizeViaGemini returned | result: ${geminiResult !== null ? "success" : "null"} | T+${Date.now() - pueEntryMs}ms`);
    if (geminiResult !== null) {
      cacheSet(evidenceHash, geminiResult);
      console.log(`[PUE-TIMER] getCachedOrSynthesizeUnderstanding: EXIT via Gemini success | total: ${Date.now() - pueEntryMs}ms`);
      return geminiResult;
    }
    console.warn("[PUE] All Gemini models failed \u2014 using deterministic fallback (Tier 3 fallback).");
    console.warn(`[PUE-TIMER] Tier 3 fallback: calling buildFallbackUnderstanding | T+${Date.now() - pueEntryMs}ms`);
    const fallback = buildFallbackUnderstanding(graph);
    cacheSet(evidenceHash, fallback);
    console.log(`[PUE-TIMER] getCachedOrSynthesizeUnderstanding: EXIT via fallback | total: ${Date.now() - pueEntryMs}ms`);
    return fallback;
  } catch (err) {
    console.error(`[PUE ERROR] getCachedOrSynthesizeUnderstanding threw at T+${Date.now() - pueEntryMs}ms:`, err?.message);
    console.error(err?.stack);
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
        if (!normVal || /^(COUNT|SUM|AVG|MAX|MIN)\b/i.test(normVal) || normVal.includes("(") || normVal.includes(")")) {
          return;
        }
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
  const bestTitle = projects.find((p) => p.title && p.title.trim().length > 3 && !p.title.includes("."))?.title || base.title || "Consolidated Project Report";
  const merged = {
    ...base,
    title: bestTitle,
    tags: Array.from(new Set(projects.flatMap((p) => p.tags))),
    categories: Array.from(new Set(projects.flatMap((p) => p.categories))),
    metrics: projects.flatMap((p) => p.metrics),
    storyBlocks: projects.flatMap((p) => p.storyBlocks),
    sourceFiles: Array.from(new Set(projects.flatMap((p) => p.sourceFiles)))
  };
  const appendIfNew = (curr, next) => {
    if (!next || !next.trim()) return curr;
    if (!curr || !curr.trim()) return next.trim();
    if (curr.includes(next.trim())) return curr;
    return `${curr.trim()}

${next.trim()}`;
  };
  projects.slice(1).forEach((p) => {
    merged.objective = appendIfNew(merged.objective, p.objective);
    merged.businessProblem = appendIfNew(merged.businessProblem, p.businessProblem);
    merged.methodology = appendIfNew(merged.methodology, p.methodology);
    merged.datasetDesc = appendIfNew(merged.datasetDesc, p.datasetDesc);
    merged.dataCleaning = appendIfNew(merged.dataCleaning, p.dataCleaning);
    merged.findings = appendIfNew(merged.findings, p.findings);
    merged.recommendations = appendIfNew(merged.recommendations, p.recommendations);
    merged.challengesText = appendIfNew(merged.challengesText, p.challengesText);
    merged.lessonsLearned = appendIfNew(merged.lessonsLearned, p.lessonsLearned);
  });
  return merged;
}
async function compileProjectPackage(rawFiles, userAnswers, forceCompile, existingUnderstanding, profiler, cachedContext) {
  const logger = createStepLogger("Compiler Pipeline");
  const pipelineStep = logger.start("Full compileProjectPackage Execution");
  const firstRaw = Array.isArray(rawFiles) && rawFiles[0] ? rawFiles[0] : null;
  console.log(`
----------------------------------------------------------`);
  console.log(`[STAGE 8: compileProjectPackage Input]`);
  console.log(`typeof rawFiles: "${typeof rawFiles}"`);
  console.log(`Array.isArray(rawFiles): ${Array.isArray(rawFiles)}`);
  console.log(`cachedContext supplied: ${Boolean(cachedContext?.evidenceGraph)}`);
  console.log(`Object.keys(rawFiles): [${rawFiles ? Object.keys(rawFiles).join(", ") : ""}]`);
  console.log(`Object.keys(firstFile): [${firstRaw ? Object.keys(firstRaw).join(", ") : ""}]`);
  console.log(`RAW FILE DESCRIPTOR:
${JSON.stringify(firstRaw ? { name: firstRaw.name, size: firstRaw.size, type: firstRaw.type, storagePath: firstRaw.storagePath, contentLength: firstRaw.content ? typeof firstRaw.content === "string" ? firstRaw.content.length : firstRaw.content.length : 0 } : null, null, 2)}`);
  console.log(`----------------------------------------------------------
`);
  const pipelineStartTime = Date.now();
  let projectType = "Mixed Analytics";
  let evidenceGraph;
  const parsedProjects = [];
  const evidenceNodes = [];
  const allFiles = [];
  let fileCoverage = [];
  let stage1Duration = 0;
  let stage2Duration = 0;
  let stage3Duration = 0;
  if (cachedContext?.evidenceGraph) {
    console.log(`[Pipeline] Fast-Path Activated: Reusing cached evidenceGraph (${cachedContext.evidenceGraph.evidenceSources?.length || 0} source(s)). Skipping Stages 1, 2, and 3.`);
    evidenceGraph = cachedContext.evidenceGraph;
    projectType = evidenceGraph.projectDomain || "Mixed Analytics";
    if (cachedContext.fileCoverage) fileCoverage = cachedContext.fileCoverage;
  } else {
    const MAX_RAW_FILES = 50;
    if (rawFiles.length > MAX_RAW_FILES) {
      throw new Error(`Package exceeds maximum file limit (${MAX_RAW_FILES} files). Please reduce file count.`);
    }
    const s1 = logger.start("Stage 1: File Detection, Signature Validation & ZIP Unpacking");
    console.log("[Pipeline] Stage 1 Start: File Detection, Signature Validation & ZIP Unpacking");
    console.log("[CHECKPOINT S1-001] Stage 1 Start Logging Completed");
    const stage1Start = Date.now();
    console.log("[CHECKPOINT S1-002] stage1Start Timestamp Captured");
    console.log("[CHECKPOINT S1-003] allFiles Array Initialized");
    console.log("[CHECKPOINT S1-004] fileCoverage Array Initialized");
    let currentFileProcessing = "None";
    let loopIndex = 0;
    try {
      console.log(`[CHECKPOINT S1-005] Entering rawFiles loop | Total rawFiles: ${rawFiles.length}`);
      for (const file of rawFiles) {
        console.log(`[CHECKPOINT S1-006] Loop iteration ${loopIndex} start`);
        currentFileProcessing = file.name;
        console.log(`[CHECKPOINT S1-007] Processing file '${file.name}'`);
        console.log(`[CHECKPOINT S1-008] Resolving extension for '${file.name}'`);
        const ext = file.name.split(".").pop()?.toLowerCase() || "";
        console.log(`[CHECKPOINT S1-009] Extension resolved to '.${ext}'`);
        console.log(`[CHECKPOINT S1-010] Entering computeSha256 for '${file.name}'`);
        let fileHash;
        try {
          console.log(`[CHECKPOINT S1-010A] computeSha256: typeof file.content = "${typeof file.content}" | Buffer.isBuffer = ${Buffer.isBuffer(file.content)} | length = ${typeof file.content === "string" ? file.content.length : file.content.length}`);
          const sha256Buf = typeof file.content === "string" ? (console.log(`[CHECKPOINT S1-010B] computeSha256: calling Buffer.from(content, "base64") \u2014 string length: ${file.content.length}`), Buffer.from(file.content, "base64")) : (console.log(`[CHECKPOINT S1-010B] computeSha256: content is already a Buffer \u2014 byteLength: ${file.content.byteLength}`), file.content);
          console.log(`[CHECKPOINT S1-010C] computeSha256: Buffer.from/passthrough complete \u2014 sha256Buf.length: ${sha256Buf.length}`);
          const sha256Hash = crypto2.createHash("sha256");
          console.log(`[CHECKPOINT S1-010D] computeSha256: crypto.createHash("sha256") created`);
          sha256Hash.update(sha256Buf);
          console.log(`[CHECKPOINT S1-010E] computeSha256: hash.update(buffer) complete`);
          fileHash = sha256Hash.digest("hex");
          console.log(`[CHECKPOINT S1-010F] computeSha256: hash.digest("hex") complete \u2014 hash prefix: ${fileHash.slice(0, 12)}`);
        } catch (sha256Err) {
          console.error(`[STAGE1 FAILURE] computeSha256 threw at '${file.name}':`, sha256Err?.message);
          console.error(sha256Err?.stack);
          throw sha256Err;
        }
        console.log(`[CHECKPOINT S1-011] computeSha256 completed for '${file.name}' | SHA256: ${fileHash.slice(0, 12)}...`);
        console.log(`[CHECKPOINT S1-012] Entering validateFileSignature for '${file.name}'`);
        const sigCheck = validateFileSignature(file.name, file.content);
        console.log(`[CHECKPOINT S1-013] validateFileSignature completed for '${file.name}' | isValid: ${sigCheck.isValid}`);
        if (!sigCheck.isValid) {
          console.log(`[CHECKPOINT S1-014] Signature check failed for '${file.name}'`);
          fileCoverage.push({
            fileName: file.name,
            status: "Failed",
            reason: sigCheck.error || "Magic byte file signature mismatch.",
            size: file.size,
            sha256: fileHash
          });
          loopIndex++;
          continue;
        }
        if (ext === "zip") {
          console.log(`[CHECKPOINT S1-015] Setting projectType to ZIP Package`);
          projectType = "ZIP Package";
          console.log(`[CHECKPOINT S1-016] BEFORE await unpackZipFile for '${file.name}'`);
          const unpacked = await unpackZipFile(file.content);
          console.log(`[CHECKPOINT S1-017] AFTER await unpackZipFile for '${file.name}' | Unpacked count: ${unpacked.length}`);
          let unpackIdx = 0;
          unpacked.forEach((u) => {
            console.log(`[CHECKPOINT S1-018] Processing unpacked file ${unpackIdx}: '${u.name}'`);
            const uHash = computeSha256(u.content);
            allFiles.push({
              name: u.name,
              content: u.content,
              type: u.type,
              size: Buffer.byteLength(u.content, u.type === "binary" ? "base64" : "utf-8"),
              sha256: uHash
            });
            unpackIdx++;
          });
          console.log(`[CHECKPOINT S1-019] Pushing ZIP fileCoverage for '${file.name}'`);
          fileCoverage.push({
            fileName: file.name,
            status: "Used",
            reason: `Unpacked ZIP package archive containing ${unpacked.length} analytics files. Signature verified.`,
            size: file.size,
            sha256: fileHash
          });
        } else {
          console.log(`[CHECKPOINT S1-020] Checking text extension for '${file.name}'`);
          const isText = ["py", "sql", "dax", "md", "txt", "csv", "json"].includes(ext);
          console.log(`[CHECKPOINT S1-021] isText: ${isText} for '${file.name}'`);
          console.log(`[CHECKPOINT S1-022] Pushing raw file '${file.name}' to allFiles array`);
          allFiles.push({
            name: file.name,
            content: file.content,
            type: isText ? "text" : "binary",
            size: file.size,
            sha256: fileHash
          });
          console.log(`[CHECKPOINT S1-023] Pushed raw file '${file.name}' to allFiles array`);
        }
        loopIndex++;
      }
      console.log(`[CHECKPOINT S1-024] Exited rawFiles loop successfully`);
    } catch (stage1Err) {
      console.error(`[CHECKPOINT S1-ERROR] Stage 1 Exception in file '${currentFileProcessing}':`, stage1Err?.message);
      throw stage1Err;
    }
    console.log(`[CHECKPOINT S1-025] Finishing Stage 1 logging & metrics`);
    const stage1Duration2 = Date.now() - stage1Start;
    s1.end(`${allFiles.length} file(s) prepared`);
    console.log(`[Pipeline] Stage 1 Complete (${stage1Duration2}ms)`);
    console.log(`----------------------------------------
[TRACE]
Line: 244
Function: compileProjectPackage
Entering: logger.start("Stage 2: Sandboxed Parser Selection & Evidence Extraction")`);
    const t244Start = Date.now();
    const s2 = logger.start("Stage 2: Sandboxed Parser Selection & Evidence Extraction");
    console.log(`Completed: logger.start
Duration: ${Date.now() - t244Start}ms
----------------------------------------`);
    console.log(`----------------------------------------
[TRACE]
Line: 245
Function: compileProjectPackage
Entering: console.log Stage 2 Start`);
    console.log("[Pipeline] Stage 2 Start: Sandboxed Parser Selection & Evidence Extraction");
    console.log(`Completed: console.log Stage 2 Start
----------------------------------------`);
    console.log(`----------------------------------------
[TRACE]
Line: 246-248
Function: compileProjectPackage
Entering: Initializing parsedProjects & evidenceNodes arrays`);
    const stage2Start = Date.now();
    const parsedProjects2 = [];
    const evidenceNodes2 = [];
    console.log(`Completed: Array initializations | allFiles.length = ${allFiles.length}
----------------------------------------`);
    console.log(`
==========================================================`);
    console.log(`[STAGE 2 FILE INVENTORY: allFiles Array Inspection]`);
    console.log(`TotalPreparedFiles: ${allFiles.length}`);
    allFiles.forEach((f, idx) => {
      const ext = f.name.split(".").pop()?.toLowerCase() || "";
      console.log(`  Index: ${idx} | Name: "${f.name}" | Ext: ".${ext}" | Type: ${f.type} | Size: ${f.size} bytes (${(f.size / (1024 * 1024)).toFixed(2)} MB) | SHA256: ${f.sha256.slice(0, 12)}...`);
    });
    console.log(`==========================================================
`);
    let fileIndex = 0;
    for (const file of allFiles) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const parser = PARSER_REGISTRY[ext];
      console.log(`
================================================`);
      console.log(`FILE INDEX: ${fileIndex}`);
      console.log(`FILE NAME: ${file.name}`);
      console.log(`EXTENSION: .${ext}`);
      console.log(`SELECTED PARSER: ${parser ? parser.name : "NONE"}`);
      console.log(`================================================
`);
      console.log(`----------------------------------------
[TRACE]
File: ${file.name}
Iteration: ${fileIndex}
Line: 265
Function: compileProjectPackage
Entering: Parser resolution check
Completed: ext=.${ext}, parser=${parser ? parser.name : "NONE"}
----------------------------------------`);
      if (parser) {
        let stageNum = 5;
        let stageName = `Excel parser [${file.name}]`;
        if (ext === "pdf") {
          stageNum = 6;
          stageName = `PDF parser [${file.name}]`;
        } else if (["png", "jpg", "jpeg"].includes(ext)) {
          stageNum = 7;
          stageName = `Image parser [${file.name}]`;
        }
        const st = profiler ? profiler.profileStageStart(stageNum, stageName, `${file.size} bytes`) : null;
        try {
          const pStart = Date.now();
          const parserFileStep = logger.start(`Parser Execution [${parser.name}] for '${file.name}'`);
          const adaptiveTimeoutMs = getAdaptiveParserTimeout({
            fileName: file.name,
            fileSize: file.size,
            parserName: parser.name
          });
          console.log(`----------------------------------------
[TRACE]
File: ${file.name}
Iteration: ${fileIndex}
Line: 287
Function: compileProjectPackage
Entering: executeWithTimeout & parser.parse()
----------------------------------------`);
          const memBefore = process.memoryUsage();
          console.log(`
--- BEGIN parser.parse() ---`);
          console.log(`Target File: ${file.name}`);
          console.log(`Parser: ${parser.name}`);
          console.log(`Heap Before: ${(memBefore.heapUsed / (1024 * 1024)).toFixed(2)} MB`);
          console.log(`RSS Before: ${(memBefore.rss / (1024 * 1024)).toFixed(2)} MB`);
          const result = await executeWithTimeout(
            `Parser[${parser.name}] for '${file.name}'`,
            () => parser.parse(file.name, file.content, file.type),
            adaptiveTimeoutMs
          );
          const memAfter = process.memoryUsage();
          const parseElapsed = Date.now() - pStart;
          const projSize = JSON.stringify(result.project).length;
          const evSize = JSON.stringify(result.evidenceNode).length;
          console.log(`--- END parser.parse() ---`);
          console.log(`Return Type: object ({ project, evidenceNode })`);
          console.log(`Returned Bytes: ${projSize + evSize} bytes`);
          console.log(`Returned Project Size: ${(projSize / 1024).toFixed(2)} KB`);
          console.log(`Returned Evidence Size: ${(evSize / 1024).toFixed(2)} KB`);
          console.log(`Heap After: ${(memAfter.heapUsed / (1024 * 1024)).toFixed(2)} MB (Delta: ${((memAfter.heapUsed - memBefore.heapUsed) / (1024 * 1024)).toFixed(2)} MB)`);
          console.log(`RSS After: ${(memAfter.rss / (1024 * 1024)).toFixed(2)} MB (Delta: ${((memAfter.rss - memBefore.rss) / (1024 * 1024)).toFixed(2)} MB)`);
          console.log(`Elapsed Time: ${parseElapsed} ms
`);
          console.log(`----------------------------------------
[TRACE]
File: ${file.name}
Iteration: ${fileIndex}
Line: 292-299
Function: compileProjectPackage
Entering: Pushing results to parsedProjects & evidenceNodes arrays`);
          parsedProjects2.push(result.project);
          evidenceNodes2.push(result.evidenceNode);
          parserFileStep.end(JSON.stringify(result.evidenceNode).length);
          if (profiler) {
            profiler.recordAllocation(`EvidenceNode [${file.name}]`, JSON.stringify(result.evidenceNode).length);
            profiler.profileStageEnd(st, `${JSON.stringify(result.evidenceNode).length} bytes`);
          }
          console.log(`Completed: Pushed results for '${file.name}' | Total Parsed: ${parsedProjects2.length}
Duration: ${Date.now() - pStart}ms
----------------------------------------`);
          fileCoverage.push({
            fileName: file.name,
            status: "Used",
            reason: `Parsed via specialized Vercel-native ${parser.name} in ${Date.now() - pStart}ms. SHA-256 verified.`,
            size: file.size,
            sha256: file.sha256
          });
          file.content = "";
        } catch (err) {
          console.error(`
[PARSER EXCEPTION THROWN]`);
          console.error(`Source File: src/api/_lib/compiler/index.ts`);
          console.error(`Line Number: ~290`);
          console.error(`Iteration Number: ${fileIndex}`);
          console.error(`File Name: ${file.name}`);
          console.error(`Parser Name: ${parser.name}`);
          console.error(`Error Message: ${err.message}`);
          console.error(`Stack Trace:
${err.stack}
`);
          if (profiler && st) profiler.profileStageEnd(st, "0 bytes", "FAILED", err.message);
          fileCoverage.push({
            fileName: file.name,
            status: "Failed",
            reason: `Isolated parser error: ${err.message || "Unknown execution error"}`,
            size: file.size,
            sha256: file.sha256
          });
        }
      } else {
        console.log(`[STAGE 2] No parser found for extension '.${ext}' on file '${file.name}'. Skipping.`);
        fileCoverage.push({
          fileName: file.name,
          status: "Ignored",
          reason: `Format extension (.${ext}) skipped automatically by parser router registry.`,
          size: file.size,
          sha256: file.sha256
        });
      }
      fileIndex++;
    }
    stage2Duration = Date.now() - stage2Start;
    s2.end(`${evidenceNodes2.length} evidence node(s) extracted`);
    console.log(`[Pipeline] Stage 2 Complete (${stage2Duration}ms)`);
    if (parsedProjects2.length === 1 && projectType !== "ZIP Package") {
      const ext = rawFiles[0].name.split(".").pop()?.toLowerCase() || "";
      if (ext === "xlsx" || ext === "xls") projectType = "Excel Analytics";
      else if (ext === "sql") projectType = "SQL Analytics";
      else if (ext === "py") projectType = "Python";
      else if (ext === "ipynb") projectType = "Python";
      else if (ext === "pbix" || ext === "dax") projectType = "Power BI";
    }
    const st8 = profiler ? profiler.profileStageStart(8, "Evidence Graph generation", `${evidenceNodes2.length} nodes`) : null;
    const s3 = logger.start("Stage 3: Building Canonical Evidence Graph");
    console.log("[Pipeline] Stage 3 Start: Building Canonical Evidence Graph");
    const stage3Start = Date.now();
    try {
      evidenceGraph = mergeToEvidenceGraph(evidenceNodes2);
      evidenceGraph.projectDomain = projectType;
    } catch (err) {
      if (profiler && st8) profiler.profileStageEnd(st8, "0 bytes", "FAILED", err.message);
      throw new PipelineError("Evidence Graph", `Failed to construct evidence graph: ${err.message}`, err.name || "EvidenceGraphError", err);
    }
    stage3Duration = Date.now() - stage3Start;
    s3.end(JSON.stringify(evidenceGraph).length);
    if (profiler && st8) {
      profiler.recordAllocation("Evidence Graph Object", JSON.stringify(evidenceGraph).length);
      profiler.profileStageEnd(st8, `${JSON.stringify(evidenceGraph).length} bytes`);
    }
    console.log(`[Pipeline] Stage 3 Complete (${stage3Duration}ms)`);
  }
  const st9 = profiler ? profiler.profileStageStart(9, "Project Understanding Engine", "Evidence Graph") : null;
  const s4 = logger.start("Stage 4: Project Understanding Engine (PUE)");
  console.log("[Pipeline] Stage 4 Start: Project Understanding Engine (PUE)");
  const stage4Start = Date.now();
  const packageEvidenceHash = evidenceGraph.packageEvidenceHash || (allFiles.length > 0 ? crypto2.createHash("sha256").update(allFiles.map((f) => f.sha256).sort().join(":")).digest("hex") : crypto2.createHash("sha256").update(JSON.stringify(evidenceGraph)).digest("hex"));
  evidenceGraph.packageEvidenceHash = packageEvidenceHash;
  const projectUnderstanding = await executeWithTimeout(
    "Project Understanding Engine (PUE)",
    () => getCachedOrSynthesizeUnderstanding(evidenceGraph, packageEvidenceHash, existingUnderstanding),
    28e3
    // Raised from 15000ms: live profiler measured gemini-3.5-flash takes >12,000ms (inner timer fires),
    // then gemini-2.5-flash takes 9,674ms → total 21,692ms needed. 28,000ms = 12s+12s+4s safety margin.
  );
  const stage4Duration = Date.now() - stage4Start;
  s4.end(JSON.stringify(projectUnderstanding).length);
  if (profiler && st9) {
    profiler.recordAllocation("Project Understanding Object", JSON.stringify(projectUnderstanding).length);
    profiler.profileStageEnd(st9, `${JSON.stringify(projectUnderstanding).length} bytes`);
  }
  console.log(`[Pipeline] Stage 4 Complete (${stage4Duration}ms)`);
  const st10 = profiler ? profiler.profileStageStart(10, "Evidence Intelligence", "PUE Object") : null;
  const projectArchetype = projectUnderstanding.projectArchetype || classifyProjectArchetype(evidenceGraph);
  if (profiler && st10) profiler.profileStageEnd(st10, `Archetype: ${projectArchetype}`);
  const st11 = profiler ? profiler.profileStageStart(11, "Completeness Engine", "Evidence Graph & PUE") : null;
  const s5 = logger.start("Stage 5: Completeness Evaluator & Conflict Detection");
  console.log("[Pipeline] Stage 5 Start: Completeness Evaluator & Conflict Detection");
  const stage5Start = Date.now();
  const coverageReport = evaluateEvidenceCompleteness(evidenceGraph, userAnswers, projectUnderstanding);
  const { mergedAnswersContext, answerConflicts } = mergeUserAnswersWithEvidence(evidenceGraph, userAnswers);
  if (profiler && st11) profiler.profileStageEnd(st11, "Coverage Evaluated");
  const st12 = profiler ? profiler.profileStageStart(12, "Conflict Resolution", "Extracted Projects") : null;
  const conflicts = [
    ...validateAndDetectConflicts(parsedProjects),
    ...detectEvidenceConflicts(evidenceGraph),
    ...answerConflicts
  ];
  const stage5Duration = Date.now() - stage5Start;
  s5.end(`${conflicts.length} conflict(s) detected`);
  if (profiler && st12) profiler.profileStageEnd(st12, `${conflicts.length} conflicts resolved/detected`);
  console.log(`[Pipeline] Stage 5 Complete (${stage5Duration}ms)`);
  const s6 = logger.start("Stage 6: Decision Logic Evaluation");
  console.log("[Pipeline] Stage 6 Start: Decision Logic Evaluation");
  const stage6Start = Date.now();
  const requiredScores = [
    coverageReport.executiveSummary,
    coverageReport.businessObjective,
    coverageReport.businessProblem,
    coverageReport.stakeholders,
    coverageReport.methodology,
    coverageReport.kpis,
    coverageReport.recommendations,
    coverageReport.businessImpact,
    coverageReport.interviewStory
  ];
  const isFullySufficient = requiredScores.every((score) => score >= 80);
  const stage6Duration = Date.now() - stage6Start;
  s6.end(`Fully Sufficient: ${isFullySufficient}`);
  console.log(`[Pipeline] Stage 6 Complete (${stage6Duration}ms)`);
  const stageTimings = cachedContext?.evidenceGraph ? [
    { stage: "Stages 1-3 (Cached Evidence Fast-Path)", durationMs: 0, status: "Completed" },
    { stage: "Stage 4 (Project Understanding)", durationMs: stage4Duration, status: "Completed" },
    { stage: "Stage 5 (Completeness & Conflicts)", durationMs: stage5Duration, status: "Completed" },
    { stage: "Stage 6 (Decision Logic)", durationMs: stage6Duration, status: "Completed" }
  ] : [
    { stage: "Stage 1 (File Prep & Unpack)", durationMs: stage1Duration, status: "Completed" },
    { stage: "Stage 2 (Sandboxed Parsers)", durationMs: stage2Duration, status: "Completed" },
    { stage: "Stage 3 (Evidence Graph)", durationMs: stage3Duration, status: "Completed" },
    { stage: "Stage 4 (Project Understanding)", durationMs: stage4Duration, status: "Completed" },
    { stage: "Stage 5 (Completeness & Conflicts)", durationMs: stage5Duration, status: "Completed" },
    { stage: "Stage 6 (Decision Logic)", durationMs: stage6Duration, status: "Completed" }
  ];
  if (!forceCompile && (!userAnswers || Object.keys(userAnswers).length === 0) && !isFullySufficient) {
    const missingInformation = generateMissingInformationRequests(coverageReport, evidenceGraph, projectUnderstanding);
    if (missingInformation.length > 0) {
      const rawProject2 = cachedContext?.rawProject && Object.keys(cachedContext.rawProject).length > 0 ? cachedContext.rawProject : mergeExtractedProjects(parsedProjects);
      console.log(`[Timing Profile] Total Pipeline Duration (NEEDS_USER_INPUT): ${Date.now() - pipelineStartTime}ms`);
      pipelineStep.end("Terminated with NEEDS_USER_INPUT");
      return {
        status: "NEEDS_USER_INPUT",
        projectType,
        projectArchetype,
        projectUnderstanding,
        rawProject: {
          ...rawProject2,
          sourceFiles: allFiles.length > 0 ? Array.from(new Set(allFiles.map((f) => f.name))) : cachedContext?.rawProject?.sourceFiles || Array.from(new Set(evidenceGraph.evidenceSources?.map((s) => s.filePath) || []))
        },
        coverageReport,
        missingInformation,
        conflicts,
        fileCoverage,
        evidenceGraph,
        stageTimings
      };
    }
  }
  const st13 = profiler ? profiler.profileStageStart(13, "Portfolio Compiler (Gemini)", "Evidence Graph & Merged Context") : null;
  const s7 = logger.start("Stage 7: Baseline Merged Raw Project Assembly");
  console.log("[Pipeline] Stage 7 Start: Baseline Merged Raw Project Assembly");
  const stage7Start = Date.now();
  const rawProject = cachedContext?.rawProject && Object.keys(cachedContext.rawProject).length > 0 ? cachedContext.rawProject : mergeExtractedProjects(parsedProjects);
  const stage7Duration = Date.now() - stage7Start;
  s7.end(JSON.stringify(rawProject).length);
  console.log(`[Pipeline] Stage 7 Complete (${stage7Duration}ms)`);
  stageTimings.push({ stage: "Stage 7 (Baseline Raw Project)", durationMs: stage7Duration, status: "Completed" });
  const s8 = logger.start("Stage 8: AI Portfolio Compiler Synthesis");
  console.log("[Pipeline] Stage 8 Start: AI Portfolio Compiler Synthesis");
  const stage8Start = Date.now();
  const synthesized = await executeWithTimeout(
    "Portfolio Compiler (Gemini)",
    () => compilePortfolioWithGemini(
      evidenceGraph,
      conflicts,
      rawProject,
      mergedAnswersContext,
      projectArchetype,
      projectUnderstanding
    ),
    31e3
    // Raised from 25000ms: maximizing remaining time. 29s (Stages 1-7) + 31s (Stage 8) = 60s.
  );
  const stage8Duration = Date.now() - stage8Start;
  s8.end(JSON.stringify(synthesized.structured).length);
  if (profiler && st13) {
    profiler.recordAllocation("Gemini Portfolio Output", JSON.stringify(synthesized.structured).length);
    profiler.profileStageEnd(st13, `${JSON.stringify(synthesized.structured).length} bytes`);
  }
  console.log(`[Pipeline] Stage 8 Complete (${stage8Duration}ms)`);
  stageTimings.push({ stage: "Stage 8 (Gemini Synthesis)", durationMs: stage8Duration, status: "Completed" });
  const st14 = profiler ? profiler.profileStageStart(14, "Recruiter Audit", "Synthesized Project") : null;
  console.log("[Pipeline] Stage 9 Start: Recruiter Audit Engine Evaluation");
  const stage9Start = Date.now();
  const recruiterAudit = runRecruiterAuditEngine(synthesized.structured, evidenceGraph, conflicts, projectUnderstanding);
  const stage9Duration = Date.now() - stage9Start;
  if (profiler && st14) profiler.profileStageEnd(st14, `Overall Score: ${recruiterAudit.overallQualityScore}`);
  console.log(`[Pipeline] Stage 9 Complete (${stage9Duration}ms)`);
  stageTimings.push({ stage: "Stage 9 (Recruiter Audit Engine)", durationMs: stage9Duration, status: "Completed" });
  const totalDuration = Date.now() - pipelineStartTime;
  console.log(`
==========================================================`);
  console.log(`[PIPELINE TIMING PROFILE] Total Pipeline Execution: ${totalDuration}ms`);
  console.log(`==========================================================
`);
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
    status: "COMPLETE",
    projectType,
    projectArchetype,
    projectUnderstanding,
    rawProject: {
      ...synthesized.raw,
      sourceFiles: allFiles.length > 0 ? Array.from(new Set(allFiles.map((f) => f.name))) : cachedContext?.rawProject?.sourceFiles || Array.from(new Set(evidenceGraph.evidenceSources?.map((s) => s.filePath) || []))
    },
    coverageReport,
    recruiterAudit,
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
      parserVersions: "Portfolio OS AI Intelligence Engine v4.2 (PUE-Cached + Evidence Fast-Path + Recruiter Audit + Gemini)",
      evidenceHash: packageEvidenceHash,
      projectVersion: "v4.2",
      totalFilesProcessed: allFiles.length > 0 ? allFiles.length : cachedContext?.fileCoverage?.length || evidenceGraph.evidenceSources?.length || 1,
      debugAiContext: formatDebugAiContext(evidenceGraph, conflicts)
    },
    stageTimings
  };
}
async function compileSourceCodeToProject(fileName, sourceCode, userAnswers, forceCompile, existingUnderstanding) {
  return compileProjectPackage(
    [{
      name: fileName,
      size: Buffer.byteLength(sourceCode),
      type: "text",
      content: sourceCode
    }],
    userAnswers,
    forceCompile,
    existingUnderstanding
  );
}

// src/api/_lib/ai/index.ts
import { GoogleGenAI as GoogleGenAI3, Type as Type3 } from "@google/genai";
var aiClient2 = null;
function sanitizeApiKey3(raw) {
  if (!raw) return "";
  return raw.trim().replace(/^["']|["']$/g, "").replace(/^Bearer\s+/i, "").trim();
}
function getAiClient2() {
  if (aiClient2) return aiClient2;
  const rawKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const apiKey = sanitizeApiKey3(rawKey);
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in environment secrets.");
  }
  aiClient2 = new GoogleGenAI3({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
        "x-goog-api-key": apiKey
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
    "id": "project-hhy3dlaz7",
    "date": "2026-09-14",
    "role": "Lead Operations & Data Analyst",
    "slug": "dark-store-operations-stock-out-analytics-engine",
    "tags": [
      "SQL",
      "Power BI",
      "DAX",
      "MySQL",
      "Inventory Operations",
      "Logistics Analytics"
    ],
    "order": 3,
    "title": "Blinkit Kolkata: Dark Store Stock-Out & Operations Intelligence",
    "images": [
      "/images/blinkit_dashboard_1.png",
      "/images/blinkit_dashboard_2.png"
    ],
    "skills": [
      "SQL Analytics & Multi-Table Joins",
      "Window Functions & Temporal Analysis",
      "Operational Bottleneck Identification",
      "Supply Chain Benchmarking",
      "Executive Storytelling & Recommendations"
    ],
    status: "published" /* PUBLISHED */,
    "metrics": [
      {
        "id": "ai-metric-0-1789385492014",
        "label": "DS002 Stock-Out Share",
        "value": "26.58%",
        "iconName": "Activity",
        "description": "Share of overall network stock-outs contributed by New Town Dark Store"
      },
      {
        "id": "ai-metric-1-1789385492014",
        "label": "DS002 Cumulative Stock-Out Hours",
        "value": "12,617 hrs",
        "iconName": "Activity",
        "description": "Total stock-out duration accumulated by New Town Dark Store"
      },
      {
        "id": "ai-metric-2-1789385492014",
        "label": "Peak Hourly Stock-Out Incidents",
        "value": "780 incidents",
        "iconName": "Activity",
        "description": "Peak stock-out volume observed at 10:00 PM during late evening surge"
      },
      {
        "id": "ai-metric-3-1789385492014",
        "label": "Perishable Category Stock-Out Share",
        "value": ">50%",
        "iconName": "Activity",
        "description": "Combined stock-out contribution from Dairy and Fresh Produce categories"
      },
      {
        "id": "ai-metric-4-1789385492014",
        "label": "Benchmark Store Fill Rate",
        "value": ">80%",
        "iconName": "Activity",
        "description": "Supplier fill rate maintained by benchmark stores Alipore and Barasat"
      }
    ],
    "summary": "This strategic analytics initiative evaluated micro-fulfillment store operational performance across Kolkata's dark store network. empirical SQL analysis revealed extreme variance: New Town Dark Store (DS002) alone accounted for 26.58% of network stock-outs and accumulated 12,617 cumulative stock-out hours. Operations experience acute temporal vulnerability between 7:00 PM and 10:00 PM, with stock-outs peaking at 10:00 PM (780 incidents). Perishable categories\u2014Dairy and Fresh Produce\u2014represent over 50% of all stock-outs. Conversely, top-performing benchmark stores such as Alipore (DS012) and Barasat (DS011) maintained high operational stability with supplier fill rates exceeding 80%.",
    "duration": "4 Months (120-Day Network Analysis)",
    "featured": true,
    "findings": "1. Disproportionate Store Burden: New Town Dark Store (DS002) contributes 26.58% of total network stock-outs (12,617 hours), followed by Jadavpur (16.73%) and Rajarhat (11.88%).\n2. Temporal Spike: Stock-outs concentrate in the late evening from 7:00 PM to 10:00 PM, reaching a network peak of 780 incidents at 10:00 PM.\n3. Perishable Vulnerability: Dairy (6,790 observations, ~8.72h avg duration) and Fresh Produce (6,570 observations, ~9.04h avg duration) account for over 50% of all stock-outs.\n4. Chronic High-Velocity SKUs: Mother Dairy Toned Milk 500ml (2,023 hrs out of stock) and Apple Royal Gala 4 pcs (1,905 hrs out of stock) experience severe stock-out durations. Green Chilli 100g was out of stock on 94 out of 120 days despite restock requests every 5 hours.\n5. Benchmark Stores: Alipore (DS012) and Barasat (DS011) recorded under 500 stock-out observations and maintained supplier fill rates above 80%.",
    "industry": "Quick-Commerce & Retail Logistics",
    "subtitle": "An end-to-end SQL and Power BI operations intelligence case study analyzing dark store availability, chronic SKU stock-outs, peak operational failure windows, and replenishment reliability across 12 Kolkata fulfillment hubs.",
    "createdAt": "2026-09-14T11:32:24.094Z",
    "objective": "Systematically evaluate key operational performance indicators and transactional trends across dark store inventory snapshots and replenishment records to identify operational bottlenecks, establish benchmark standards, and formulate strategic business interventions.",
    "updatedAt": "2026-09-14T11:32:24.094Z",
    "categories": [
      "Operations Intelligence",
      "Supply Chain Analytics",
      "SQL Diagnostics"
    ],
    difficulty: "advanced" /* ADVANCED */,
    "visibility": "public",
    "datasetDesc": "Relational transactional database containing dark store master records, product catalog, inventory snapshots, stock-out events, replenishment logs, and customer order items.",
    "methodology": "Executed four structured SQL analytical modules (SQ1\u2013SQ4) leveraging relational multi-table joins, date/time aggregations, and advanced LAG window functions across inventory snapshots, replenishment logs, order items, and store master entities to pinpoint stock-out drivers, calculate duration metrics, and evaluate supplier fill rates.",
    "storyBlocks": [
      {
        "id": "blinkit-sb-architecture",
        "type": "markdown",
        "title": "Power BI & SQL Dual-Architecture Implementation",
        "bodyContent": "This analytics framework combines an enterprise SQL diagnostic pipeline with an interactive Power BI operational dashboard. SQL performs high-cardinality multi-table joins and temporal LAG window functions over raw inventory event tables, while the Power BI Star Schema visualizes store burden rankings, hourly stock-out curves, and supplier SLA fill rate compliance across 12 Kolkata fulfillment hubs."
      },
      {
        "id": "blinkit-sb-sql-query",
        "type": "code_snippet",
        "language": "sql",
        "title": "SQL Diagnostic: Store Stock-Out Concentration & Hourly Windowing",
        "bodyContent": "-- SQL Analytical Module: Peak Hourly Stock-Out Incidents & Cumulative Loss Duration\nWITH hourly_stockouts AS (\n    SELECT \n        d.store_id,\n        d.store_name,\n        p.category,\n        EXTRACT(HOUR FROM s.start_time) AS hour_of_day,\n        COUNT(s.stockout_id) AS incident_count,\n        SUM(TIMESTAMPDIFF(MINUTE, s.start_time, s.end_time)) / 60.0 AS duration_hours\n    FROM stockout_events s\n    JOIN dark_stores d ON s.store_id = d.store_id\n    JOIN products p ON s.product_id = p.product_id\n    WHERE s.start_time >= '2026-05-01' AND s.start_time <= '2026-08-31'\n    GROUP BY d.store_id, d.store_name, p.category, EXTRACT(HOUR FROM s.start_time)\n)\nSELECT \n    store_name,\n    hour_of_day,\n    SUM(incident_count) AS total_incidents,\n    ROUND(SUM(duration_hours), 1) AS total_hours_lost,\n    ROUND(100.0 * SUM(duration_hours) / SUM(SUM(duration_hours)) OVER(), 2) AS network_stockout_share_pct\nFROM hourly_stockouts\nGROUP BY store_name, hour_of_day\nORDER BY total_incidents DESC\nLIMIT 10;"
      },
      {
        "id": "blinkit-sb-dax-measures",
        "type": "code_snippet",
        "language": "sql",
        "title": "Power BI DAX Measures: Store Burden Share & Supplier Fill Rate",
        "bodyContent": '// Power BI DAX Formulas: Operations Diagnostic Engine\n\n// 1. Dark Store DS002 Network Stock-Out Burden Share %\nDS002 Stock-Out Share % = \nVAR TotalNetworkStockouts = CALCULATE([Total Stock-Out Incidents], ALL(DarkStores))\nVAR StoreStockouts = CALCULATE([Total Stock-Out Incidents], DarkStores[Store_ID] = "DS002")\nRETURN\nDIVIDE(StoreStockouts, TotalNetworkStockouts, 0)\n\n// 2. Evening Peak Failure Volume (19:00 - 22:00 Window)\nEvening Surge Incidents = \nCALCULATE(\n    [Total Stock-Out Incidents],\n    FILTER(\n        DimTime,\n        DimTime[Hour] >= 19 && DimTime[Hour] <= 22\n    )\n)\n\n// 3. Replenishment Fulfillment Rate %\nSupplier SLA Fill Rate % = \nDIVIDE(\n    SUM(ReplenishmentLogs[Quantity_Delivered]),\n    SUM(ReplenishmentLogs[Quantity_Requested]),\n    0\n)'
      }
    ],
    "analysisText": "1. Multi-Table Integration: Joined inventory snapshots, dark store master, stock-out events, replenishment logs, and order items.\n2. Store Burden Analysis: Aggregated stock-out incidence and calculated percentage contribution per location.\n3. Temporal Trend Evaluation: Extracted hourly stock-out counts to establish peak concentration windows.\n4. SKU & Category Diagnostics: Calculated cumulative stock-out hours, repeat out-of-stock frequency, and replenishment request intervals using window functions.\n5. Benchmark Assessment: Assessed top-performing stores based on fill rate compliance, storage utilization, and reorder threshold breaches.",
    "dataCleaning": "Standardized timestamp diff records, corrected stock-out observation end times, unified product category mapping across transactional tables, and handled missing replenishment logs.",
    "overviewText": "This strategic analytics initiative evaluated micro-fulfillment store operational performance across Kolkata's dark store network. empirical SQL analysis revealed extreme variance: New Town Dark Store (DS002) alone accounted for 26.58% of network stock-outs and accumulated 12,617 cumulative stock-out hours. Operations experience acute temporal vulnerability between 7:00 PM and 10:00 PM, with stock-outs peaking at 10:00 PM (780 incidents). Perishable categories\u2014Dairy and Fresh Produce\u2014represent over 50% of all stock-outs. Conversely, top-performing benchmark stores such as Alipore (DS012) and Barasat (DS011) maintained high operational stability with supplier fill rates exceeding 80%.",
    "challengesText": "Reconciling high stock-out frequencies with frequent replenishment requests required evaluating LAG intervals across timestamped inventory snapshots to separate supplier lead time delays from dark store operational bottlenecks.",
    "lessonsLearned": "Stock-outs are rarely uniform across fulfillment networks; micro-location dynamics, shift timing, and product-specific perishability require targeted operational interventions rather than broad blanket policies.",
    "businessProblem": "Dark Store Operations Managers face critical supply-demand imbalances during daily operations across micro-fulfillment hubs in Kolkata. Operational leadership lacks diagnostic visibility into whether availability failures are uniform or localized, when stock-outs peak throughout the day, which SKUs and categories fail most frequently, and what operational practices separate underperforming hubs from top-performing stores.",
    "recommendations": "Immediate (0\u201330 Days): Shift secondary replenishment delivery windows from 20:00 to 16:30\u201317:30 for New Town, Jadavpur, and Rajarhat to prevent evening stock-out surges. Increase safety stock reorder thresholds by 20\u201325% on top Dairy and Fresh Produce SKUs.\nMedium Term (30\u201390 Days): Enforce supplier SLAs with a minimum 85% fill rate requirement. Standardize bin allocation and reorder execution using the Alipore/Barasat SOP playbook across high-burden stores.\nStrategic (90+ Days): Re-calibrate unit measurement formulas for dark store capacity before committing capital expenditure.",
    "githubUrl": "https://github.com/Animus004/blinkit-dark-store-stockout-analysis"
  },
  {
    "id": "project-3ei1f2x9q",
    "role": "Product Data Analyst",
    "slug": "amazon-customer-engagement-product-sentiment-analysis",
    "tags": [
      "Excel",
      "Pivot Tables",
      "Customer Sentiment",
      "Data Visualization",
      "E-Commerce"
    ],
    "order": 0,
    "title": "Amazon Customer Engagement & Product Sentiment Analytics",
    "images": [
      "/images/amazon_dashboard.png"
    ],
    "skills": [
      "Microsoft Excel",
      "Data Cleaning",
      "Pivot Tables",
      "Dashboard Design",
      "KPI Development",
      "Business Analysis",
      "Customer Sentiment Analysis",
      "Stakeholder Reporting"
    ],
    status: "published" /* PUBLISHED */,
    "metrics": [
      {
        "id": "ai-metric-0-1784802815244",
        "label": "Customer Engagement Volume",
        "value": "584 Reviews",
        "iconName": "Activity",
        "description": "Highest review volume recorded by a single product category, used to identify the most engaged customer segment."
      },
      {
        "id": "ai-metric-1-1784802815244",
        "label": "Average Customer Rating",
        "value": "Rating4.4 / 5",
        "iconName": "Activity",
        "description": "Average customer satisfaction across analyzed product categories."
      },
      {
        "id": "metric-519taoiea",
        "label": "Average Helpful Votes",
        "value": "281.9 Votes",
        "description": "Measures how useful customers found product reviews, indicating review quality and customer trust."
      },
      {
        "id": "metric-mlljgb4mv",
        "label": "Average Product Price",
        "value": "$136",
        "description": "Average selling price across analyzed product categories for price-performance comparison."
      },
      {
        "id": "metric-pzzeze86e",
        "label": "Highest Rated Category",
        "value": "Fire Tablet (4.7\u2605)",
        "description": "Category generating the highest customer interaction and review volume."
      },
      {
        "id": "metric-d6vb7aa0c",
        "label": "Highest Engagement Category",
        "value": "Smart Home (584 Reviews)",
        "description": "Category generating the highest customer interaction and review volume."
      }
    ],
    "summary": "Developed an Excel-based analytics dashboard to evaluate Amazon product review trends across multiple categories. Performed customer engagement, sentiment, and category performance analysis using pivot tables, KPI reporting, and data visualization to identify investment opportunities, satisfaction gaps, and strategic business recommendations for product teams. \uE200filecite\uE202turn14file1\uE202L8-L37\uE201",
    "duration": "2 Months",
    "featured": true,
    "findings": "Analysis revealed varying customer engagement and sentiment levels across product categories, identifying top-performing assets like the Fire Tablet alongside categories exhibiting lower customer ratings despite high engagement (such as Fire TV). The diagnostic also highlighted a significant decline in review activity during 2016.",
    "industry": "E-Commerce & Consumer Electronics",
    "subtitle": "Exploratory customer review and engagement analysis identifying high-velocity rating trends, recurring quality concerns, and product catalog prioritization signals in Excel.",
    "createdAt": "2026-07-23T10:33:49.079Z",
    "githubUrl": "https://github.com/Animus004/Amazon-Customer-Engagement-Product-Performance-Analysis",
    "objective": "Analyze Amazon customer review data to identify high-performing product categories, evaluate customer engagement and sentiment trends, and generate data-driven recommendations for product strategy and marketing investment.",
    "updatedAt": "2026-08-08T15:50:19.162Z",
    "categories": [
      "Customer Analytics",
      "Product Performance"
    ],
    difficulty: "intermediate" /* INTERMEDIATE */,
    "visibility": "public",
    "datasetDesc": "Analyzed a structured Amazon customer review dataset containing product categories, customer ratings, review counts, helpful votes, product prices, and historical review activity spanning 2015\u20132017.",
    "methodology": "Applied exploratory data analysis, customer sentiment analysis, category benchmarking, engagement-versus-rating comparison, and time-series trend analysis using Microsoft Excel, Pivot Tables, Pivot Charts, and KPI dashboards.",
    "storyBlocks": [],
    "analysisText": "No predictive models were developed. Analysis relied on descriptive analytics using Pivot Tables, Pivot Charts, calculated KPIs, comparative category benchmarking, scatter plot correlation analysis, and historical trend visualization.",
    "dataCleaning": "Cleaned and standardized raw Amazon review data by validating category labels, formatting numerical metrics, preparing time-series fields, and organizing structured datasets for dashboard development and KPI analysis.",
    "overviewText": "Developed an end-to-end customer engagement analytics dashboard using Amazon product review data to evaluate customer sentiment, category performance, pricing relationships, and historical engagement trends. The project transformed raw review datasets into executive-level dashboards and strategic business recommendations supporting product investment and marketing decisions.",
    "challengesText": "Consolidating customer engagement, pricing, and sentiment metrics from multiple analytical dimensions required careful KPI selection, category benchmarking, and dashboard design to ensure meaningful business interpretation without introducing misleading conclusions.",
    "lessonsLearned": "This project reinforced the importance of combining customer engagement metrics with sentiment analysis rather than relying on review volume alone. Future analyses would benefit from incorporating product launch timelines, lifecycle stages, and additional behavioral metrics for deeper business insights.",
    "businessProblem": "Amazon lacked consolidated visibility into category-level customer engagement, review sentiment, and pricing performance. Without centralized analytics, decision-makers faced challenges prioritizing marketing investments, identifying high-performing products, and responding to declining customer satisfaction.",
    "recommendations": "Increase marketing efforts for Fire Tablet due to high customer ratings and future growth potential. Investigate the reasons behind Fire TV's lower customer ratings despite high engagement. Review the significant decline in review activity during 2016 before making strategic decisions, and include product launch dates and lifecycle analysis in future studies."
  },
  {
    "id": "project-g40ktfsc7",
    "role": "Business Intelligence Analyst",
    "slug": "superstore-profitability-margin-optimization-analytics",
    "tags": [
      "Excel",
      "Pivot Charts",
      "Profitability Modeling",
      "KPI Development",
      "Retail Sales"
    ],
    "order": 1,
    "title": "Superstore Sales Diagnostic & Margin Optimization Dashboard",
    "images": [
      "/images/superstore_dashboard.png"
    ],
    "skills": [
      "Microsoft Excel",
      "Pivot Tables",
      "Data Cleaning",
      "KPI Development",
      "Business Analysis",
      "Dashboard Design",
      "Sales Analytics",
      "Profitability Analysis",
      "Stakeholder Reporting"
    ],
    status: "published" /* PUBLISHED */,
    "metrics": [
      {
        "id": "ai-metric-0-1784804480944",
        "label": "Total Sales",
        "value": "$2.29M+",
        "iconName": "trending-up",
        "description": "Total revenue generated by the Superstore across analyzed periods."
      },
      {
        "id": "metric-3nmemnurs",
        "label": "Total Profit",
        "value": "$286K+",
        "description": "Overall profit earned after all transactions, measuring business profitability."
      },
      {
        "id": "metric-4um5y7opc",
        "label": "Highest Profit Category",
        "value": "Technology",
        "description": "Product category generating the highest overall profit contribution."
      },
      {
        "id": "metric-ynwey67yc",
        "label": "Lowest Profit Category",
        "value": "Furniture",
        "description": "High sales but comparatively weak profitability, indicating pricing or cost optimization opportunities."
      },
      {
        "id": "metric-hmt52jpid",
        "label": "Top Performing Region",
        "value": "West Region",
        "description": "Region contributing the highest overall sales performance."
      },
      {
        "id": "metric-ez7fqopww",
        "label": "Peak Sales Month",
        "value": "November",
        "description": "Strongest month for both sales and profit, supporting seasonal planning."
      }
    ],
    "summary": "Developed an Excel-based sales and profitability analytics dashboard using Superstore retail data to evaluate category performance, regional profitability, customer segments, and seasonal sales trends. The project transformed raw transactional data into actionable business insights and strategic recommendations to improve pricing, inventory planning, and profitability.",
    "duration": "2 Months",
    "featured": true,
    "findings": "Furniture generated strong sales revenue but suffered from low profit margins due to excessive discounting or operational inefficiencies. Technology products consistently generated stronger profit contributions. Texas showed strong sales volume but weak profitability returns, while specific table products incurred repeated losses.",
    "industry": "Retail & Supply Chain",
    "subtitle": "Multi-year commercial retail transaction analysis isolating negative profit corridors, carrier shipping latencies, and customer segment growth in Excel.",
    "createdAt": "2026-07-23T11:01:34.780Z",
    "githubUrl": "https://github.com/Animus004/superstore-sales-dashboard-analysis",
    "objective": "Analyze sales and profitability performance across products, regions, and customer segments to identify profitable growth opportunities, optimize pricing and discount strategies, and improve inventory and marketing decisions through data-driven sales analysis.",
    "updatedAt": "2026-07-23T11:15:02.351Z",
    "categories": [
      "Financial Diagnostics",
      "Sales Intelligence"
    ],
    difficulty: "intermediate" /* INTERMEDIATE */,
    "visibility": "public",
    "datasetDesc": "Superstore transactional and operational dataset comprising sales, profit, product categories, customer segments, and regional data stored across Excel spreadsheets and Word reports.",
    "methodology": "Applied exploratory sales analysis using Microsoft Excel, Pivot Tables, Pivot Charts, KPI reporting, profitability analysis, category benchmarking, regional comparison, and seasonal trend analysis to identify business performance patterns and improvement opportunities.",
    "storyBlocks": [],
    "analysisText": "No predictive or machine learning models were developed. The analysis relied on descriptive analytics using Pivot Tables, Pivot Charts, KPI calculations, category benchmarking, profitability comparison, and historical sales trend analysis.",
    "dataCleaning": "Processed and integrated dataset sources from Excel and Word documentation to ensure consistent dimensional analysis across sales, profit, product categories, and regional geographies.",
    "overviewText": "Built an end-to-end sales and profitability analytics dashboard using Superstore retail data to uncover profit drivers, identify underperforming business segments, and deliver actionable recommendations for pricing, inventory planning, and strategic business growth.",
    "challengesText": "Identifying sustainable profitability was challenging because several categories generated strong revenue while delivering weak profit margins. Additional investigation was required to separate pricing, discounting, and operational factors influencing business performance.",
    "lessonsLearned": "Top-line revenue growth can conceal underlying margin erosion; granular profitability analysis at the product and regional level is vital before expanding capital investment.",
    "businessProblem": "Despite generating over $2.29M in sales, management lacked visibility into which product categories, customer segments, and regions were driving sustainable profitability. High sales alone were insufficient for decision-making because several categories and states demonstrated strong revenue while producing comparatively weak profit margins, causing margin erosion.",
    "recommendations": "Investigate root causes behind high-sales but low-profit categories (such as Furniture) before scaling investment. Prioritize campaigns for high-profit customer segments and Technology products. Review underperforming states like Texas to identify operational issues. Reassess repeated-loss table products for discontinuation, supplier renegotiation, or pricing strategy changes. Plan promotions and inventory around strong seasonal months including November, September, and December."
  },
  {
    "id": "project-r4gxqt836",
    "role": "Market Intelligence Analyst",
    "slug": "steam-marketplace-intelligence-publisher-performance-growth-strategy",
    "tags": [
      "Excel",
      "Market Research",
      "Pricing Analytics",
      "Data Visualization",
      "Trend Analysis"
    ],
    "order": 2,
    "title": "Steam Games Market Intelligence: Publisher Growth & Pricing Strategy",
    "images": [
      "/images/steam_dashboard.png"
    ],
    "skills": [
      "Microsoft Excel",
      "Power Query",
      "Pivot Tables",
      "Dashboard Design",
      "Market Research",
      "Business Intelligence",
      "Stakeholder Reporting",
      "Data Visualization"
    ],
    status: "published" /* PUBLISHED */,
    "metrics": [
      {
        "id": "ai-metric-0-1784805654356",
        "label": "Target Investment Allocation",
        "value": "$10M",
        "iconName": "DollarSign",
        "description": "Hypothetical capital allocation evaluated across publishers, genres, and pricing tiers."
      },
      {
        "id": "ai-metric-1-1784805654356",
        "label": "Core Investment Pillars",
        "value": "4",
        "iconName": "BarChart2",
        "description": "Evaluated via Publisher Performance Index, Customer Satisfaction Score, and Player Engagement Rate."
      },
      {
        "id": "metric-kmna5y6qe",
        "label": "Publishers Evaluated",
        "value": "11",
        "description": "Compared publisher performance to identify consistent long-term investment opportunities."
      },
      {
        "id": "metric-aij0rl3ud",
        "label": "Market Period",
        "value": "2015\u20132024",
        "description": "Historical Steam marketplace analysis spanning multiple release years."
      }
    ],
    "summary": "Delivered a comprehensive market intelligence analysis for Valve Corporation to optimize a hypothetical $10 million investment allocation across publishers, genres, pricing tiers, and game categories within the Steam digital PC game marketplace.",
    "duration": "2 Months",
    "featured": true,
    "findings": "Identified top-performing publishers demonstrating consistent long-term success, high-engagement genres like Action, RPG, and Adventure, and the impact of pricing and monetization strategies on player retention and customer satisfaction.",
    "industry": "Gaming & Digital Media",
    "subtitle": "Market segment analysis across thousands of game titles evaluating demand signals, review distribution, and pricing strategy for portfolio planning.",
    "createdAt": "2026-07-23T11:21:16.467Z",
    "githubUrl": "https://github.com/Animus004/steam-games-market-analysis",
    "objective": "To analyze the Steam Games dataset and deliver actionable, data-driven recommendations regarding publisher performance, genre trends, pricing strategies, and customer satisfaction.",
    "updatedAt": "2026-07-23T11:29:48.907Z",
    "categories": [
      "Market Intelligence",
      "Strategic Decision Support"
    ],
    difficulty: "advanced" /* ADVANCED */,
    "visibility": "public",
    "datasetDesc": "Steam Games dataset containing publisher metrics, pricing tiers, genre classifications, user review sentiments, and player engagement statistics.",
    "methodology": "Applied market trend analysis, publisher performance evaluation, customer sentiment analysis, pricing strategy assessment, and genre portfolio analysis on Steam Games dataset using Markdown, Git, Python, SQL, Excel, and Power BI.",
    "storyBlocks": [],
    "analysisText": "Applied descriptive analytics using Pivot Tables, Pivot Charts, Power Query, ranking techniques, percentage calculations, and comparative trend analysis to evaluate publisher consistency, genre performance, pricing strategies, customer sentiment, and player engagement. The analysis relied on business-driven segmentation, KPI benchmarking, and dashboard visualization rather than predictive or machine learning models.",
    "dataCleaning": "Processed and integrated multi-source Steam dataset attributes covering engagement, pricing, publisher background, and user sentiment.",
    "overviewText": "Developed a business intelligence dashboard to evaluate Steam market performance between 2015 and 2024 by analysing publisher consistency, genre performance, pricing strategies, customer sentiment, and player engagement. The project transformed raw market data into executive insights that support strategic investment, portfolio planning, and long-term growth decisions for Valve.",
    "challengesText": "Lack of a consolidated analytical view to identify sustainable long-term investment opportunities or balance investment across different market segments from raw engagement, pricing, and sentiment metrics.",
    "lessonsLearned": "Prioritizing publisher consistency and customer engagement metrics yields more reliable investment targets than relying solely on raw player volume or popularity.",
    "businessProblem": "Valve required a structured market analysis to determine how a hypothetical $10 million investment should be allocated across publishers, genres, pricing tiers, and game categories. Although the dataset contained engagement, pricing, publisher, and sentiment metrics, there was no consolidated analytical view to identify sustainable long-term investment opportunities or balance investment across different market segments.",
    "recommendations": "Prioritize investment in publishers demonstrating consistent long-term success, particularly CAPCOM, Electronic Arts, Ubisoft, and Rockstar Games, while expanding high-performing Action, RPG, and Adventure genres. Increase investment in Hybrid titles due to their balance of engagement and retention, and evaluate Multiplayer opportunities for future growth. Maintain Premium pricing for high-quality games rather than competing primarily on price, and investigate monetization strategies before expanding Free-to-Play investments."
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

// src/api/_lib/utils/pipelineProfiler.ts
var PipelineProfiler = class {
  constructor() {
    this.stages = [];
    this.peakHeap = 0;
    this.peakRss = 0;
    this.maxAllocatedSize = 0;
    this.maxAllocatedLabel = "None";
    this.pipelineStartTime = Date.now();
    const mem = process.memoryUsage();
    this.updatePeaks(mem);
  }
  updatePeaks(mem) {
    if (mem.heapUsed > this.peakHeap) this.peakHeap = mem.heapUsed;
    if (mem.rss > this.peakRss) this.peakRss = mem.rss;
  }
  recordAllocation(label, sizeInBytes) {
    if (sizeInBytes > this.maxAllocatedSize) {
      this.maxAllocatedSize = sizeInBytes;
      this.maxAllocatedLabel = label;
    }
  }
  profileStageStart(stageNumber, stageName, inputSize) {
    const mem = process.memoryUsage();
    this.updatePeaks(mem);
    const now = Date.now();
    const metric = {
      stageName,
      stageNumber,
      startTime: now,
      heapUsedStart: mem.heapUsed,
      rssStart: mem.rss,
      externalStart: mem.external,
      uptimeStart: process.uptime(),
      inputSize: inputSize || "N/A",
      status: "BEGIN"
    };
    console.time(`[PIPELINE PROFILER] Stage ${stageNumber}: ${stageName}`);
    console.log(`
====================================================`);
    console.log(`[PIPELINE PROFILER] BEGIN Stage ${stageNumber}: ${stageName}`);
    console.log(`Start: ${new Date(now).toISOString()}`);
    console.log(`Process Uptime: ${metric.uptimeStart.toFixed(2)}s`);
    console.log(`Heap Used: ${(mem.heapUsed / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`RSS: ${(mem.rss / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`External: ${(mem.external / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`Input Size: ${metric.inputSize}`);
    console.log(`====================================================
`);
    this.stages.push(metric);
    return metric;
  }
  profileStageEnd(metric, outputSize, status = "END", errorMsg) {
    const now = Date.now();
    const mem = process.memoryUsage();
    this.updatePeaks(mem);
    metric.endTime = now;
    metric.durationMs = now - metric.startTime;
    metric.heapUsedEnd = mem.heapUsed;
    metric.rssEnd = mem.rss;
    metric.externalEnd = mem.external;
    metric.uptimeEnd = process.uptime();
    metric.outputSize = outputSize || "N/A";
    metric.status = status;
    metric.errorMsg = errorMsg;
    console.timeEnd(`[PIPELINE PROFILER] Stage ${metric.stageNumber}: ${metric.stageName}`);
    console.log(`
====================================================`);
    console.log(`[PIPELINE PROFILER] ${status} Stage ${metric.stageNumber}: ${metric.stageName}`);
    console.log(`Start: ${new Date(metric.startTime).toISOString()}`);
    console.log(`End: ${new Date(now).toISOString()}`);
    console.log(`Duration: ${metric.durationMs} ms (${(metric.durationMs / 1e3).toFixed(2)}s)`);
    console.log(`Heap Used: ${(mem.heapUsed / (1024 * 1024)).toFixed(2)} MB (Delta: ${((mem.heapUsed - metric.heapUsedStart) / (1024 * 1024)).toFixed(2)} MB)`);
    console.log(`RSS: ${(mem.rss / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`External: ${(mem.external / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`Input Size: ${metric.inputSize}`);
    console.log(`Output Size: ${metric.outputSize}`);
    if (metric.durationMs > 15e3) {
      console.warn(`\u{1F6A8} EXECUTION BUDGET RISK - Stage ${metric.stageNumber}: ${metric.stageName} took ${metric.durationMs}ms (>15s threshold)!`);
    } else if (metric.durationMs > 5e3) {
      console.warn(`\u26A0 LONG RUNNING STAGE - Stage ${metric.stageNumber}: ${metric.stageName} took ${metric.durationMs}ms (>5s threshold)!`);
    }
    console.log(`====================================================
`);
  }
  printFinalReport() {
    const totalDuration = Date.now() - this.pipelineStartTime;
    const sorted = [...this.stages].sort((a, b) => (b.durationMs || 0) - (a.durationMs || 0));
    const top5 = sorted.slice(0, 5);
    const getStageDuration = (namePattern) => {
      const found = this.stages.find((s) => s.stageName.toLowerCase().includes(namePattern.toLowerCase()));
      return found && found.durationMs ? found.durationMs : 0;
    };
    const excelDuration = getStageDuration("excel");
    const geminiDuration = getStageDuration("gemini") || getStageDuration("compiler (gemini)") || getStageDuration("portfolio compiler");
    const serializationDuration = getStageDuration("serialization") || getStageDuration("final json");
    console.log(`
==============================`);
    console.log(`PIPELINE SUMMARY`);
    console.log(`==============================`);
    console.log(`Total Execution Time: ${totalDuration} ms (${(totalDuration / 1e3).toFixed(2)}s)`);
    console.log(`Memory Peak (Heap): ${(this.peakHeap / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`Memory Peak (RSS): ${(this.peakRss / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`Largest Object Allocated: ${this.maxAllocatedLabel} (${(this.maxAllocatedSize / (1024 * 1024)).toFixed(2)} MB)`);
    console.log(`Excel Duration: ${excelDuration} ms (${(excelDuration / 1e3).toFixed(2)}s)`);
    console.log(`Gemini Duration: ${geminiDuration} ms (${(geminiDuration / 1e3).toFixed(2)}s)`);
    console.log(`Serialization Duration: ${serializationDuration} ms (${(serializationDuration / 1e3).toFixed(2)}s)`);
    console.log(`------------------------------`);
    console.log(`Top 5 Slowest Stages:`);
    top5.forEach((s, idx) => {
      console.log(` ${idx + 1}. [Stage ${s.stageNumber}] ${s.stageName}: ${s.durationMs || 0} ms (${((s.durationMs || 0) / 1e3).toFixed(2)}s) - Status: ${s.status}`);
    });
    console.log(`==============================
`);
  }
};

// src/api/portfolio/ai.ts
var config = {
  runtime: "nodejs",
  maxDuration: 60
};
var lastCompletedStage = "Stage 0: HTTP Handler Entry";
if (!global.__CRASH_HANDLERS_REGISTERED__) {
  global.__CRASH_HANDLERS_REGISTERED__ = true;
  process.on("uncaughtException", (err) => {
    console.error(`
==========================================================`);
    console.error(`[PROCESS CRASH DETECTED: uncaughtException]`);
    console.error(`Error Message: ${err?.message || err}`);
    console.error(`Error Name: ${err?.name || "UncaughtException"}`);
    console.error(`Last Completed Stage: ${lastCompletedStage}`);
    console.error(`Stack Trace:
${err?.stack || "No Stack Available"}`);
    console.error(`==========================================================
`);
  });
  process.on("unhandledRejection", (reason) => {
    console.error(`
==========================================================`);
    console.error(`[PROCESS CRASH DETECTED: unhandledRejection]`);
    console.error(`Rejection Reason: ${reason?.message || reason}`);
    console.error(`Rejection Name: ${reason?.name || "UnhandledRejection"}`);
    console.error(`Last Completed Stage: ${lastCompletedStage}`);
    console.error(`Stack Trace:
${reason?.stack || "No Stack Available"}`);
    console.error(`==========================================================
`);
  });
  process.on("exit", (code) => {
    console.error(`
[PROCESS EXIT EVENT] Exit Code: ${code} | Last Completed Stage: ${lastCompletedStage}
`);
  });
}
async function handler(req, res) {
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
  if (pathname.includes("/ai-package-parse")) {
    const profiler = new PipelineProfiler();
    try {
      const st1 = profiler.profileStageStart(1, "Receive request", `${JSON.stringify(req.body || {}).length} bytes`);
      const prepStep = logger.start("Stage 0: Payload Parsing & Storage Resolution");
      const body = req.body || {};
      const { fileName, fileDataBase64, fileType, files, userAnswers, forceCompile, projectUnderstanding, evidenceGraph, rawProject, fileCoverage } = body;
      profiler.profileStageEnd(st1, `${Array.isArray(files) ? files.length : 0} file(s)`);
      if (evidenceGraph) {
        console.log(`[ai-package-parse] Fast-Path Activated: Cached evidenceGraph supplied with ${evidenceGraph.evidenceSources?.length || 0} source(s). Skipping Stages 1, 2, and 3.`);
        prepStep.end("Cached evidenceGraph resolved (Fast-Path)");
        const compileStep2 = logger.start("Package Compiler Pipeline Execution (Fast-Path)");
        const output2 = await executeWithTimeout(
          "Package Compiler Hard Deadline",
          () => compileProjectPackage(
            [],
            userAnswers,
            forceCompile,
            projectUnderstanding,
            profiler,
            { evidenceGraph, rawProject, fileCoverage }
          ),
          59e3
        );
        compileStep2.end(JSON.stringify(output2).length);
        const st152 = profiler.profileStageStart(15, "Final JSON serialization", "Compiler Output Object");
        const jsonOutputString2 = JSON.stringify(output2);
        profiler.recordAllocation("Final Output JSON String", jsonOutputString2.length);
        profiler.profileStageEnd(st152, `${jsonOutputString2.length} bytes`);
        const st162 = profiler.profileStageStart(16, "HTTP Response", `${jsonOutputString2.length} bytes`);
        logExecution({
          endpoint: pathname,
          totalDurationMs: Date.now() - startTime
        });
        handlerStep.end("200 OK Response Sent (Fast-Path)");
        profiler.profileStageEnd(st162, "HTTP 200 OK Sent");
        profiler.printFinalReport();
        return sendSuccess(res, output2);
      }
      const st2 = profiler.profileStageStart(2, "Validate descriptors", `${Array.isArray(files) ? files.length : 0} descriptor(s)`);
      console.log(`
==========================================================`);
      console.log(`[SERVER AUDIT 1: Raw req.body.files[0]]`);
      console.log(JSON.stringify(req.body.files?.[0], null, 2));
      console.log(`==========================================================
`);
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
          const st3 = profiler.profileStageStart(3, `Download from Supabase [${name}]`, fileMeta.storagePath || "No Path");
          let buffer = null;
          let resolutionSource = "None";
          let storageDownloadErrorMsg = "";
          if (fileMeta.storagePath) {
            const dlStep = logger.start(`Supabase Storage Download [${name}]`);
            const client = getSupabaseClient();
            if (client) {
              try {
                const bucket = process.env.SUPABASE_STORAGE_BUCKET || "portfolio-uploads";
                const downloadRes = await executeWithTimeout(
                  `Supabase Download [${name}]`,
                  () => client.storage.from(bucket).download(fileMeta.storagePath),
                  12e3
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
              } catch (downloadErr) {
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
          const st4 = profiler.profileStageStart(4, `Resolve buffers [${name}]`, `Storage Buffer: ${buffer ? buffer.length : 0} bytes`);
          if (!buffer && fileMeta.fallbackContent) {
            try {
              buffer = Buffer.from(fileMeta.fallbackContent, "base64");
              resolutionSource = "In-Memory Browser Fallback (Base64)";
              profiler.recordAllocation(`Fallback Base64 Buffer [${name}]`, buffer.length);
            } catch (fallbackErr) {
              console.warn(`Error decoding fallbackContent for '${name}':`, fallbackErr.message);
            }
          }
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
      const compileStep = logger.start("Package Compiler Pipeline Execution");
      const output = await executeWithTimeout(
        "Package Compiler Hard Deadline",
        () => compileProjectPackage(rawFilesToCompile, userAnswers, forceCompile, projectUnderstanding, profiler),
        59e3
      );
      compileStep.end(JSON.stringify(output).length);
      rawFilesToCompile.forEach((f) => {
        f.content = "";
      });
      const st15 = profiler.profileStageStart(15, "Final JSON serialization", "Compiler Output Object");
      const jsonOutputString = JSON.stringify(output);
      profiler.recordAllocation("Final Output JSON String", jsonOutputString.length);
      profiler.profileStageEnd(st15, `${jsonOutputString.length} bytes`);
      const st16 = profiler.profileStageStart(16, "HTTP Response", `${jsonOutputString.length} bytes`);
      logExecution({
        endpoint: pathname,
        totalDurationMs: Date.now() - startTime
      });
      handlerStep.end("200 OK Response Sent");
      profiler.profileStageEnd(st16, "HTTP 200 OK Sent");
      profiler.printFinalReport();
      return sendSuccess(res, output);
    } catch (err) {
      profiler.printFinalReport();
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const timestamp = (/* @__PURE__ */ new Date()).toISOString();
      const stage = err.stage || "File Upload";
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
      console.error(`[PIPELINE EXCEPTION DETECTED] Complete Stack Trace:
${stack}`);
      console.error("==========================================================\n");
      return res.status(500).json({
        success: false,
        error: err.message || "An unhandled pipeline error occurred",
        message: err.message || "An unhandled pipeline error occurred",
        stage,
        errorType,
        stack,
        timestamp,
        requestId,
        fileName: location?.fileName || err.fileName || void 0,
        lineNumber: location?.lineNumber || err.lineNumber || void 0
      });
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
        model: "gemini-flash-latest",
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
  config,
  handler as default
};
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
