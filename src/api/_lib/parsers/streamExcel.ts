/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import JSZip from "jszip";
import * as XLSX from "xlsx";
import {
  ExtractedProject,
  ParserEvidenceNode,
  ExcelEvidence
} from "../types/index";

export interface ParserResult {
  project: ExtractedProject;
  evidenceNode: ParserEvidenceNode;
}

/**
 * Fast Regex / String utility to decode XML entity references
 */
function decodeXmlEntities(str: string): string {
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Creates an empty project blueprint for Excel files
 */
function createEmptyProject(fileName: string): ExtractedProject {
  return {
    title: "",
    subtitle: "",
    summary: "",
    industry: "",
    role: "",
    duration: "",
    date: new Date().toISOString().split("T")[0],
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

/**
 * Asynchronous, non-blocking StreamExcelParser for Portfolio OS.
 * Unpacks .xlsx archives via stream-based XML extraction to prevent single-threaded event loop lockup.
 */
export async function parseStreamExcel(fileName: string, content: string): Promise<ParserResult> {
  const parseStart = Date.now();
  const memBefore = process.memoryUsage().heapUsed / (1024 * 1024);

  const proj = createEmptyProject(fileName);
  const excelBuffer = Buffer.from(content, "base64");
  const fileSizeMb = (excelBuffer.length / (1024 * 1024)).toFixed(2);

  const excelEvidence: ExcelEvidence = {
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
    samplingStrategy: excelBuffer.length > 5 * 1024 * 1024 
      ? `Asynchronous Stream XML Parsing (${fileSizeMb} MB). Extracted sheet metadata, headers, formulas, and pivots in non-blocking event loop.`
      : undefined
  };

  // Check if buffer is a valid PKZIP archive (.xlsx)
  const isZipArchive = excelBuffer.length >= 4 && excelBuffer[0] === 0x50 && excelBuffer[1] === 0x4b;

  if (isZipArchive && excelBuffer.length > 5 * 1024 * 1024) {
    // Large .xlsx workbook (> 5 MB): Asynchronous SAX/XML Stream Reader
    try {
      const zip = await JSZip.loadAsync(excelBuffer);

      // 1. Parse xl/workbook.xml for sheet names & rel IDs
      const workbookXmlStr = await zip.file("xl/workbook.xml")?.async("string");
      const sheetNameMap: Array<{ id: string; name: string }> = [];

      if (workbookXmlStr) {
        const sheetRegex = /<sheet\s+[^>]*name="([^"]+)"[^>]*sheetId="([^"]+)"/g;
        let match: RegExpExecArray | null;
        while ((match = sheetRegex.exec(workbookXmlStr)) !== null) {
          const name = decodeXmlEntities(match[1]);
          sheetNameMap.push({ id: match[2], name });
          excelEvidence.sheetNames.push(name);
        }
      }

      // If sheetNameMap is empty, try fallback sheet pattern
      if (sheetNameMap.length === 0) {
        const sheetFiles = Object.keys(zip.files).filter(k => k.startsWith("xl/worksheets/sheet"));
        sheetFiles.forEach((f, idx) => {
          const name = `Sheet${idx + 1}`;
          sheetNameMap.push({ id: String(idx + 1), name });
          excelEvidence.sheetNames.push(name);
        });
      }

      // 2. Parse Shared Strings Table (xl/sharedStrings.xml)
      const sharedStrings: string[] = [];
      const sharedStringsXmlStr = await zip.file("xl/sharedStrings.xml")?.async("string");
      if (sharedStringsXmlStr) {
        const tRegex = /<t[^>]*>([\s\S]*?)<\/t>/g;
        let tMatch: RegExpExecArray | null;
        let count = 0;
        while ((tMatch = tRegex.exec(sharedStringsXmlStr)) !== null && count < 2000) {
          sharedStrings.push(decodeXmlEntities(tMatch[1]).trim());
          count++;
        }
      }

      // 3. Enumerate Pivot Tables & Drawings
      const pivotFiles = Object.keys(zip.files).filter(k => k.startsWith("xl/pivotTables/"));
      pivotFiles.forEach((_, idx) => {
        excelEvidence.pivots.push(`Pivot Table ${idx + 1}`);
      });

      const drawingFiles = Object.keys(zip.files).filter(k => k.startsWith("xl/drawings/"));
      drawingFiles.forEach((_, idx) => {
        excelEvidence.charts.push({ title: `Visualization Layout ${idx + 1}`, chartType: "Spreadsheet Chart" });
      });

interface StreamWorksheetResult {
  rowCount: number;
  columns: string[];
  formulas: string[];
  measures: string[];
}

/**
 * SAX-style sliding-window XML stream parser.
 * Reads uncompressed worksheet XML via nodeStream() in 64KB chunks to prevent V8 string heap inflation.
 */
async function streamParseWorksheetXml(
  sheetZipFile: JSZip.JSZipObject,
  sheetName: string,
  sharedStrings: string[]
): Promise<StreamWorksheetResult> {
  return new Promise((resolve, reject) => {
    let rowCount = 0;
    const columns: string[] = [];
    const formulas: string[] = [];
    const measures: string[] = [];
    const formulaSet = new Set<string>();

    let pendingChunk = "";
    let isRow1Parsed = false;
    let sheetFormulasCount = 0;
    let dimensionFound = false;

    const stream = sheetZipFile.nodeStream();

    stream.on("data", (chunk: Buffer) => {
      pendingChunk += chunk.toString("utf-8");

      // 1. Extract Dimension tag (<dimension ref="A1:Z1048857"/>)
      if (!dimensionFound) {
        const dimMatch = pendingChunk.match(/<dimension\s+ref="[A-Z]+(\d+):[A-Z]+(\d+)"/);
        if (dimMatch) {
          rowCount = Math.max(0, parseInt(dimMatch[2], 10) - parseInt(dimMatch[1], 10));
          dimensionFound = true;
        }
      }

      // 2. Extract Row 1 Header Cells (<row r="1">...</row>)
      if (!isRow1Parsed) {
        const row1Match = pendingChunk.match(/<row\s+r="1"[^>]*>([\s\S]*?)<\/row>/);
        if (row1Match) {
          const cRegex = /<c\s+[^>]*>(?:<f>.*?<\/f>)?(?:<v>(.*?)<\/v>)?<\/c>/g;
          let cMatch: RegExpExecArray | null;
          while ((cMatch = cRegex.exec(row1Match[1])) !== null && columns.length < 30) {
            const val = cMatch[1];
            if (val !== undefined) {
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

      // 3. Extract Formulas (<f>SUM(...)</f>) in sliding window
      const formulaRegex = /<f[^>]*>([\s\S]*?)<\/f>/g;
      let fMatch: RegExpExecArray | null;
      while ((fMatch = formulaRegex.exec(pendingChunk)) !== null && sheetFormulasCount < 50) {
        sheetFormulasCount++;
        const formulaText = decodeXmlEntities(fMatch[1]).trim();
        const upperF = formulaText.toUpperCase();

        if (
          upperF.includes("SUM") || upperF.includes("AVERAGE") || upperF.includes("COUNT") ||
          upperF.includes("VLOOKUP") || upperF.includes("XLOOKUP") || upperF.includes("INDEX") ||
          upperF.includes("MATCH") || upperF.includes("IF") || upperF.includes("MARGIN")
        ) {
          if (formulaSet.size < 30) {
            formulaSet.add(`${sheetName}: =${formulaText}`);
          }
          const matchFn = upperF.match(/([A-Z_]+)\s*\(/);
          if (matchFn && matchFn[1]) {
            measures.push(`Formula: ${matchFn[1]} in ${sheetName}`);
          }
        }
      }

      // Maintain sliding window buffer of max 4,096 chars to prevent memory accumulation
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

      // 4. Stream Each Worksheet XML via SAX Sliding Window
      let totalRowCount = 0;
      let totalFormulaCount = 0;
      const formulaSet = new Set<string>();
      const measureSet = new Set<string>();

      for (let i = 0; i < sheetNameMap.length; i++) {
        const sheetMeta = sheetNameMap[i];
        const sheetFileName = `xl/worksheets/sheet${i + 1}.xml`;
        const sheetZipFile = zip.file(sheetFileName) || zip.file(`xl/worksheets/sheet${sheetMeta.id}.xml`);

        // Yield to event loop between sheet unzips to prevent blocking
        await new Promise(resolve => setImmediate(resolve));

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
        let sheetColumns: string[] = [];

        if (sheetZipFile) {
          const parsedSheet = await streamParseWorksheetXml(sheetZipFile, sheetMeta.name, sharedStrings);
          sheetRowCount = parsedSheet.rowCount;
          sheetColumns = parsedSheet.columns;
          parsedSheet.formulas.forEach(f => formulaSet.add(f));
          parsedSheet.measures.forEach(m => measureSet.add(m));
          totalRowCount += sheetRowCount;
          totalFormulaCount += parsedSheet.formulas.length;

          sheetColumns.forEach(c => {
            if (!excelEvidence.dimensions.includes(c)) {
              excelEvidence.dimensions.push(c);
            }
          });
        }

        excelEvidence.worksheets!.push({
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

      console.log(`\n==========================================================`);
      console.log(`[STREAM EXCEL PARSER PROFILE] File Name: ${fileName}`);
      console.log(`[STREAM EXCEL PARSER PROFILE] File Size: ${fileSizeMb} MB`);
      console.log(`[STREAM EXCEL PARSER PROFILE] Total Worksheets: ${excelEvidence.sheetNames.length}`);
      console.log(`[STREAM EXCEL PARSER PROFILE] Total Aggregate Rows: ${totalRowCount.toLocaleString()}`);
      console.log(`[STREAM EXCEL PARSER PROFILE] Formulas Detected: ${totalFormulaCount.toLocaleString()}`);
      console.log(`[STREAM EXCEL PARSER PROFILE] Pivots Detected: ${excelEvidence.pivots.length}`);
      console.log(`[STREAM EXCEL PARSER PROFILE] Duration: ${totalDuration} ms (Mem delta: +${(memAfter - memBefore).toFixed(1)} MB)`);
      console.log(`==========================================================\n`);

      const evidenceNode: ParserEvidenceNode = {
        nodeId: `node-excel-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        sourceFile: fileName,
        parserType: "Excel",
        extractedAt: new Date().toISOString(),
        confidence: excelEvidence.confidence,
        data: excelEvidence
      };

      return { project: proj, evidenceNode };
    } catch (err: any) {
      console.warn(`[StreamExcelParser] Async ZIP streaming failed for '${fileName}', falling back to standard XLSX reader:`, err?.message);
    }
  }

  // Fallback for smaller workbooks (< 5 MB) or non-ZIP Excel formats (.xls)
  const workbook = XLSX.read(excelBuffer, { 
    type: "buffer", 
    cellFormula: true, 
    sheetStubs: false 
  });

  excelEvidence.sheetNames = workbook.SheetNames;
  let totalRowCount = 0;

  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;

    const sheetColumns: string[] = [];
    let rowCount = 0;

    if (sheet["!ref"]) {
      try {
        const range = XLSX.utils.decode_range(sheet["!ref"]);
        rowCount = Math.max(0, range.e.r - range.s.r);
        totalRowCount += rowCount;

        for (let c = range.s.c; c <= range.e.c && c <= 30; c++) {
          const cellAddr = XLSX.utils.encode_cell({ r: range.s.r, c });
          const cell = sheet[cellAddr];
          if (cell && cell.v !== undefined) {
            const cleaned = String(cell.v).trim();
            if (cleaned && !cleaned.match(/^Column\d+$/i)) {
              sheetColumns.push(cleaned);
              if (!excelEvidence.dimensions.includes(cleaned)) {
                excelEvidence.dimensions.push(cleaned);
              }
            }
          }
        }
      } catch (_) {}
    }

    excelEvidence.worksheets!.push({
      name: sheetName,
      role: "Analytical Worksheet",
      rowCount,
      columnCount: sheetColumns.length,
      columns: sheetColumns.slice(0, 20)
    });
  });

  const evidenceNode: ParserEvidenceNode = {
    nodeId: `node-excel-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    sourceFile: fileName,
    parserType: "Excel",
    extractedAt: new Date().toISOString(),
    confidence: excelEvidence.confidence,
    data: excelEvidence
  };

  return { project: proj, evidenceNode };
}
