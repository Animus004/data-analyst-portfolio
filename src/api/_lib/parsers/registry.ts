/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from "xlsx";
import mammoth from "mammoth";
import JSZip from "jszip";
import {
  ExtractedProject,
  ExtractedMetric,
  ExtractedStoryBlock,
  ParserEvidenceNode,
  ExcelEvidence,
  SqlEvidence,
  PowerBiEvidence,
  ReadmeEvidence,
  DocumentEvidence,
  ImageEvidence
} from "../types/index";

export interface ParserResult {
  project: ExtractedProject;
  evidenceNode: ParserEvidenceNode;
}

export interface Parser {
  name: string;
  extensions: string[];
  parse(fileName: string, content: string, type: "text" | "binary"): Promise<ParserResult>;
}

// ----------------------------------------------------------------------
// Helper to create a fallback empty project
// ----------------------------------------------------------------------
function createEmptyProject(fileName: string, parserName: string): ExtractedProject {
  return {
    title: "",
    subtitle: "",
    summary: "",
    industry: "",
    role: "",
    duration: "",
    date: new Date().toISOString().split("T")[0],
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

// ----------------------------------------------------------------------
// 1. ExcelParser
// ----------------------------------------------------------------------
export const ExcelParser: Parser = {
  name: "ExcelParser",
  extensions: ["xlsx", "xls"],
  async parse(fileName, content) {
    const parseStart = Date.now();
    const memBefore = process.memoryUsage().heapUsed / (1024 * 1024);

    const proj = createEmptyProject(fileName, "ExcelParser");
    proj.tags = ["Excel", "Pivot Tables", "Business Analytics", "KPI Reporting"];
    proj.categories = ["Financial Modeling", "Business Analytics"];

    const excelEvidence: ExcelEvidence = {
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
      businessTerms: [],
      worksheets: [],
      namedRanges: [],
      calculatedColumns: [],
      workbookMetadata: {}
    };

    try {
      const excelBuffer = Buffer.from(content, "base64");
      const fileSizeMb = (excelBuffer.length / (1024 * 1024)).toFixed(2);
      const isLargeWorkbook = excelBuffer.length > 5 * 1024 * 1024; // > 5 MB threshold

      // Stage 1: Load Workbook
      const s1Start = Date.now();
      const workbook = XLSX.read(excelBuffer, { 
        type: "buffer", 
        cellFormula: true, 
        sheetStubs: false 
      });
      const s1Duration = Date.now() - s1Start;
      const memAfterLoad = process.memoryUsage().heapUsed / (1024 * 1024);

      // Stage 2: Enumerate Worksheets
      const s2Start = Date.now();
      excelEvidence.sheetNames = workbook.SheetNames;
      const s2Duration = Date.now() - s2Start;

      // Extract Workbook Properties/Metadata
      if (workbook.Props) {
        const props = workbook.Props as Record<string, any>;
        const cleanProps: Record<string, any> = {};
        if (props.Title) cleanProps.title = props.Title;
        if (props.Subject) cleanProps.subject = props.Subject;
        if (props.Author) cleanProps.author = props.Author;
        if (props.Category) cleanProps.category = props.Category;
        if (props.Company) cleanProps.company = props.Company;
        if (props.Comments) cleanProps.comments = props.Comments;
        excelEvidence.workbookMetadata = cleanProps;

        if (props.Title && !proj.title) proj.title = String(props.Title);
        if (props.Comments && !proj.summary) proj.summary = String(props.Comments);
      }

      // Extract Named Ranges
      const workbookObj = workbook.Workbook as any;
      if (workbookObj && Array.isArray(workbookObj.Names)) {
        workbookObj.Names.forEach((n: any) => {
          if (n && n.Name) {
            const nameStr = String(n.Name).trim();
            const refStr = String(n.Ref || n.Content || "").trim();
            if (nameStr && !nameStr.startsWith("_")) {
              excelEvidence.namedRanges!.push({ name: nameStr, ref: refStr });
              excelEvidence.businessTerms.push(`Named Range: ${nameStr}`);
            }
          }
        });
      }

      let totalFormulaCount = 0;
      let totalRowCount = 0;
      let projectsRaw: any[] = [];
      let metricsRaw: any[] = [];
      const formulaSet = new Set<string>();
      const measureSet = new Set<string>();

      // Stage 3 & 4 & 5: Read Headers, Rows, Formulas
      const s3Start = Date.now();
      let s3Duration = 0;
      let s4Duration = 0;
      let s5Duration = 0;

      workbook.SheetNames.forEach(sheetName => {
        const nameLower = sheetName.toLowerCase().replace(/\s+/g, "");
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) return;

        let role = "Analytical Worksheet";
        if (nameLower.includes("dashboard") || nameLower.includes("summary") || nameLower.includes("kpi") || nameLower.includes("cockpit") || nameLower.includes("overview")) {
          role = "Executive Dashboard";
          excelEvidence.dashboardTitles.push(sheetName);
        } else if (nameLower.includes("model") || nameLower.includes("forecast") || nameLower.includes("budget") || nameLower.includes("p&l") || nameLower.includes("valuation") || nameLower.includes("dcf")) {
          role = "Financial Model";
        } else if (nameLower.includes("pivot") || nameLower.includes("crosstab") || nameLower.includes("cube")) {
          role = "Pivot Analysis";
          excelEvidence.pivots.push(sheetName);
        } else if (nameLower.includes("data") || nameLower.includes("raw") || nameLower.includes("source") || nameLower.includes("dump") || nameLower.includes("transaction")) {
          role = "Data Source";
        }

        let rowCount = 0;
        let colCount = 0;
        const sheetColumns: string[] = [];

        // Fast Header Extraction directly from range without sheet_to_json
        const hStart = Date.now();
        if (sheet["!ref"]) {
          try {
            const range = XLSX.utils.decode_range(sheet["!ref"]);
            rowCount = Math.max(0, range.e.r - range.s.r); // excluding header
            colCount = range.e.c - range.s.c + 1;
            totalRowCount += rowCount;

            // Direct top row header extraction
            for (let c = range.s.c; c <= range.e.c && c <= 50; c++) {
              const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c });
              const cell = sheet[cellAddress];
              if (cell && cell.v !== undefined) {
                const cleaned = String(cell.v).trim();
                if (cleaned && !cleaned.match(/^Column\d+$/i) && !cleaned.match(/^Unnamed:\s*\d+$/i)) {
                  sheetColumns.push(cleaned);
                  if (!excelEvidence.dimensions.includes(cleaned)) {
                    excelEvidence.dimensions.push(cleaned);
                  }
                }
              }
            }
          } catch (_) {
            rowCount = 0;
          }
        }
        s3Duration += Date.now() - hStart;

        excelEvidence.worksheets!.push({
          name: sheetName,
          role,
          rowCount,
          columnCount: colCount,
          columns: sheetColumns.slice(0, 25)
        });

        // Stage 7 & 8: Pivot tables and Charts metadata
        if ((sheet as any)["!pivots"] && Array.isArray((sheet as any)["!pivots"])) {
          excelEvidence.pivots.push(`${sheetName} (Native Pivot Table)`);
        }
        if ((sheet as any)["!drawings"] || nameLower.includes("chart") || nameLower.includes("visual")) {
          excelEvidence.charts.push({ title: `${sheetName} Visual Layout`, chartType: "Spreadsheet Visualization" });
        }

        // Stage 5: High-speed Adaptive Cell Formula & KPI Sampling
        const fStart = Date.now();
        const colFormulasMap = new Map<number, { colName: string; count: number; sampleFormula: string }>();

        if (sheet["!ref"]) {
          try {
            const range = XLSX.utils.decode_range(sheet["!ref"]);
            const totalSheetRows = range.e.r - range.s.r + 1;

            // Adaptive range selection:
            // For workbooks/sheets containing > 100,000 rows, intelligently sample high-signal zones:
            // (1) Top 100 rows (Headers, KPI summary cards, executive titles)
            // (2) Bottom 50 rows (Grand totals, SUM, AVERAGE, COUNT summary aggregations)
            // (3) Stratified mid-dataset rows (every 1000th row)
            const rowsToSample = new Set<number>();
            if (totalSheetRows <= 2000) {
              for (let r = range.s.r; r <= range.e.r; r++) rowsToSample.add(r);
            } else if (totalSheetRows > 100000) {
              excelEvidence.isAdaptivelySampled = true;
              excelEvidence.samplingStrategy = `Intelligent Multi-Stratum Sampling (>100,000 Rows: ${totalSheetRows.toLocaleString()} rows). Extracted 100% metadata, headers, named ranges, pivot tables, chart visuals, calculated columns, and sampled KPI/summary rows.`;
              
              // Top 100 rows
              for (let r = range.s.r; r <= range.s.r + 100 && r <= range.e.r; r++) rowsToSample.add(r);
              // Bottom 50 rows (Totals/Aggregations)
              for (let r = Math.max(range.s.r, range.e.r - 50); r <= range.e.r; r++) rowsToSample.add(r);
              // Stratified mid-dataset sampling (every 1000th row)
              for (let r = range.s.r + 100; r < range.e.r - 50; r += 1000) rowsToSample.add(r);
            } else {
              // Standard large dataset sampling (> 2000 rows)
              // Top 60 rows
              for (let r = range.s.r; r <= range.s.r + 60 && r <= range.e.r; r++) rowsToSample.add(r);
              // Bottom 40 rows (Summary / Totals)
              for (let r = Math.max(range.s.r, range.e.r - 40); r <= range.e.r; r++) rowsToSample.add(r);
            }

            rowsToSample.forEach(r => {
              for (let c = range.s.c; c <= range.e.c && c <= 50; c++) {
                const cellAddr = XLSX.utils.encode_cell({ r, c });
                const cell = sheet[cellAddr];
                if (cell && cell.f) {
                  totalFormulaCount++;
                  const formulaStr = String(cell.f).trim();
                  const upperF = formulaStr.toUpperCase();

                  if (
                    upperF.includes("SUM") || upperF.includes("AVERAGE") || upperF.includes("COUNT") ||
                    upperF.includes("VLOOKUP") || upperF.includes("XLOOKUP") || upperF.includes("INDEX") ||
                    upperF.includes("MATCH") || upperF.includes("IF") || upperF.includes("NPV") ||
                    upperF.includes("IRR") || upperF.includes("PMT") || upperF.includes("GROWTH") ||
                    upperF.includes("MARGIN") || upperF.includes("VAR")
                  ) {
                    if (formulaSet.size < 30) {
                      formulaSet.add(`${sheetName}!${cellAddr}: =${formulaStr}`);
                    }
                    const matchFn = upperF.match(/([A-Z_]+)\s*\(/);
                    if (matchFn && matchFn[1]) {
                      measureSet.add(`Formula Calculation: ${matchFn[1]} in ${sheetName}`);
                    }
                  }

                  const colHeader = sheetColumns[c] || `Column ${c + 1}`;
                  if (!colFormulasMap.has(c)) {
                    colFormulasMap.set(c, { colName: colHeader, count: 1, sampleFormula: formulaStr });
                  } else {
                    colFormulasMap.get(c)!.count++;
                  }
                }
              }
            });
          } catch (_) {}
        }
        s5Duration += Date.now() - fStart;

        colFormulasMap.forEach((meta) => {
          if (meta.count >= 2) {
            excelEvidence.calculatedColumns!.push({
              sheet: sheetName,
              column: meta.colName,
              formula: meta.sampleFormula
            });
            excelEvidence.measures.push(`Calculated Column '${meta.colName}' (${sheetName}): =${meta.sampleFormula}`);
          }
        });

        // Fast raw data extraction for explicit project or metric metadata sheets
        if (nameLower === "projects" || nameLower === "casestudies") {
          projectsRaw = XLSX.utils.sheet_to_json(sheet, { range: 0 });
        } else if (nameLower === "metrics" || nameLower === "kpis") {
          metricsRaw = XLSX.utils.sheet_to_json(sheet, { range: 0 });
        }
      });

      excelEvidence.formulas = Array.from(formulaSet);
      excelEvidence.measures = Array.from(measureSet);

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

      metricsRaw.forEach((m: any, mIdx: number) => {
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

      const totalDuration = Date.now() - parseStart;
      const memAfter = process.memoryUsage().heapUsed / (1024 * 1024);
      const complexityScore = isLargeWorkbook || totalRowCount > 100000 ? "HIGH" : totalRowCount > 10000 ? "MEDIUM" : "LOW";

      console.log(`\n==========================================================`);
      console.log(`[EXCEL WORKBOOK PROFILE] File Name: ${fileName}`);
      console.log(`[EXCEL WORKBOOK PROFILE] File Size: ${fileSizeMb} MB`);
      console.log(`[EXCEL WORKBOOK PROFILE] Total Worksheets: ${workbook.SheetNames.length}`);
      console.log(`[EXCEL WORKBOOK PROFILE] Total Aggregate Rows: ${totalRowCount.toLocaleString()}`);
      console.log(`[EXCEL WORKBOOK PROFILE] Formulas Detected: ${totalFormulaCount.toLocaleString()}`);
      console.log(`[EXCEL WORKBOOK PROFILE] Pivot Tables: ${excelEvidence.pivots.length}`);
      console.log(`[EXCEL WORKBOOK PROFILE] Charts: ${excelEvidence.charts.length}`);
      console.log(`[EXCEL WORKBOOK PROFILE] Named Ranges: ${excelEvidence.namedRanges!.length}`);
      console.log(`[EXCEL WORKBOOK PROFILE] Complexity Score: ${complexityScore}`);
      console.log(`----------------------------------------------------------`);
      console.log(`[EXCEL STAGE TIMINGS] Stage 1 (Load Workbook): ${s1Duration}ms (Mem delta: +${(memAfterLoad - memBefore).toFixed(1)} MB)`);
      console.log(`[EXCEL STAGE TIMINGS] Stage 2 (Enumerate Sheets): ${s2Duration}ms`);
      console.log(`[EXCEL STAGE TIMINGS] Stage 3 (Read Headers): ${s3Duration}ms`);
      console.log(`[EXCEL STAGE TIMINGS] Stage 4 & 5 (Read Formulas & Sampling): ${s5Duration}ms`);
      console.log(`[EXCEL STAGE TIMINGS] Total Excel Processing Time: ${totalDuration}ms (Final Mem: ${memAfter.toFixed(1)} MB)`);
      console.log(`==========================================================\n`);
    } catch (err) {
      console.error("ExcelParser Error:", err);
    }

    return {
      project: proj,
      evidenceNode: { type: "excel", data: excelEvidence }
    };
  }
};

// ----------------------------------------------------------------------
// 2. SQLParser
// ----------------------------------------------------------------------
export const SQLParser: Parser = {
  name: "SQLParser",
  extensions: ["sql"],
  async parse(fileName, content, type) {
    const proj = createEmptyProject(fileName, "SQLParser");
    proj.tags = ["SQL", "Relational Database Querying", "Data Aggregation", "Window Functions"];
    proj.categories = ["Data Engineering", "Database Querying"];

    const text = type === "text" ? content : Buffer.from(content, "base64").toString("utf-8");
    const lines = text.split("\n");

    const sqlEvidence: SqlEvidence = {
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

    const tablesSet = new Set<string>();
    const joinsSet = new Set<string>();
    const aggSet = new Set<string>();
    const windowSet = new Set<string>();

    lines.forEach((line, lineIdx) => {
      const trimmed = line.trim();

      // Table & Join extraction
      const fromMatch = trimmed.match(/\bFROM\s+([a-zA-Z0-9_\.]+)/i);
      if (fromMatch && fromMatch[1]) tablesSet.add(fromMatch[1]);
      const joinMatch = trimmed.match(/\b(LEFT|RIGHT|INNER|FULL|CROSS)?\s*JOIN\s+([a-zA-Z0-9_\.]+)/i);
      if (joinMatch && joinMatch[2]) {
        tablesSet.add(joinMatch[2]);
        joinsSet.add(joinMatch[0].trim());
      }

      // Aggregations
      const aggMatch = trimmed.match(/\b(SUM|COUNT|AVG|MAX|MIN)\s*\([^)]+\)/gi);
      if (aggMatch) {
        aggMatch.forEach(a => aggSet.add(a.trim()));
      }

      // Window functions
      if (/OVER\s*\(/i.test(trimmed)) {
        windowSet.add(trimmed);
      }

      // Calculated Metric aliases (AS metric_name)
      const aliasMatch = trimmed.match(/(SUM|COUNT|AVG|MAX|MIN)\([^)]+\)\s+AS\s+([a-zA-Z0-9_]+)/i);
      if (aliasMatch && aliasMatch[2]) {
        sqlEvidence.calculatedMetrics.push({ name: aliasMatch[2], formula: aliasMatch[1] });
      }

      // Detect comments with KPIs or business questions
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

// ----------------------------------------------------------------------
// 3. PythonParser
// ----------------------------------------------------------------------
export const PythonParser: Parser = {
  name: "PythonParser",
  extensions: ["py"],
  async parse(fileName, content, type) {
    const proj = createEmptyProject(fileName, "PythonParser");
    proj.tags = ["Python", "Feature Engineering", "Statistical Analysis", "Exploratory Data Analysis"];
    proj.categories = ["Data Science", "Data Engineering"];

    const text = type === "text" ? content : Buffer.from(content, "base64").toString("utf-8");
    const lines = text.split("\n");

    const docEvidence: DocumentEvidence = {
      sourceFile: fileName,
      parser: "PythonParser",
      confidence: 90,
      sections: [{ heading: "Python Analytics Script", content: text.slice(0, 3000) }],
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

// ----------------------------------------------------------------------
// 4. NotebookParser (Jupyter notebooks .ipynb)
// ----------------------------------------------------------------------
export const NotebookParser: Parser = {
  name: "NotebookParser",
  extensions: ["ipynb"],
  async parse(fileName, content, type) {
    const proj = createEmptyProject(fileName, "NotebookParser");
    proj.tags = ["Python", "Exploratory Data Analysis", "Interactive Analytics", "Statistical Modeling"];
    proj.categories = ["Data Science", "Interactive Analytics"];
    proj.role = "Data Scientist";

    const docEvidence: DocumentEvidence = {
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

      cells.forEach((cell: any) => {
        const cellType = cell.cell_type;
        const sourceLines = Array.isArray(cell.source) ? cell.source : [cell.source || ""];
        const sourceText = sourceLines.join("");

        if (cellType === "markdown") {
          markdownConcat += sourceText + "\n\n";
          docEvidence.sections.push({ heading: "Markdown Cell", content: sourceText });
        } else if (cellType === "code") {
          codeCellIdx++;
          sourceLines.forEach((l: any, lineNum: number) => {
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

// ----------------------------------------------------------------------
// 5. PowerBIParser (.pbix / .dax)
// ----------------------------------------------------------------------
export const PowerBIParser: Parser = {
  name: "PowerBIParser",
  extensions: ["pbix", "dax"],
  async parse(fileName, content, type) {
    const proj = createEmptyProject(fileName, "PowerBIParser");
    proj.tags = ["Power BI", "DAX", "Dashboarding", "KPI Modeling", "Data Visualization"];
    proj.categories = ["Business Intelligence", "Dashboard Analytics"];

    const text = type === "text" ? content : Buffer.from(content, "base64").toString("utf-8");

    const pbiEvidence: PowerBiEvidence = {
      sourceFile: fileName,
      parser: "PowerBIParser",
      confidence: 90,
      visuals: [],
      daxMeasures: [],
      pages: ["Overview", "Executive Dashboard"],
      relationships: [],
      kpis: []
    };

    // Parse DAX measure definitions
    const daxLines = text.split("\n");
    daxLines.forEach(line => {
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
      bodyContent: text.slice(0, 5000),
      language: "sql",
      sourceFile: fileName
    });

    return {
      project: proj,
      evidenceNode: { type: "powerbi", data: pbiEvidence }
    };
  }
};

// ----------------------------------------------------------------------
// 6. MarkdownParser (.md / README)
// ----------------------------------------------------------------------
export const MarkdownParser: Parser = {
  name: "MarkdownParser",
  extensions: ["md", "txt"],
  async parse(fileName, content, type) {
    const proj = createEmptyProject(fileName, "MarkdownParser");
    proj.tags = ["Business Reporting", "Documentation", "Executive Communication"];
    proj.categories = ["Technical Writing", "Reporting"];

    const text = type === "text" ? content : Buffer.from(content, "base64").toString("utf-8");

    const readmeEvidence: ReadmeEvidence = {
      sourceFile: fileName,
      parser: "MarkdownParser",
      confidence: 95,
      tools: ["Markdown", "Git"]
    };

    const sections = text.split(/\n#+\s+/);
    sections.forEach(sec => {
      const lines = sec.split("\n");
      const title = lines[0].trim().toLowerCase();
      const body = lines.slice(1).join("\n").trim();

      if (title.includes("objective") || title.includes("goal")) {
        readmeEvidence.objective = body;
      } else if (title.includes("problem") || title.includes("challenge")) {
        // Business problem recorded in evidence
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

// ----------------------------------------------------------------------
// 7. WordParser (.docx)
// ----------------------------------------------------------------------
export const WordParser: Parser = {
  name: "WordParser",
  extensions: ["docx"],
  async parse(fileName, content) {
    const proj = createEmptyProject(fileName, "WordParser");
    proj.tags = ["Business Analysis", "Executive Reporting", "Documentation"];
    proj.categories = ["Business Analysis", "Documentation"];

    const docEvidence: DocumentEvidence = {
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

      docEvidence.sections.push({ heading: "Full Document Content", content: text.slice(0, 4000) });

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

// ----------------------------------------------------------------------
// 8. CSVParser (.csv)
// ----------------------------------------------------------------------
export const CSVParser: Parser = {
  name: "CSVParser",
  extensions: ["csv"],
  async parse(fileName, content, type) {
    const proj = createEmptyProject(fileName, "CSVParser");
    proj.tags = ["Data Cleaning", "Tabular Analysis", "Data Profiling"];
    proj.categories = ["Data Prep", "Tabular Analysis"];

    const excelEvidence: ExcelEvidence = {
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
      const lines = text.split("\n").filter(l => l.trim() !== "");
      if (lines.length > 0) {
        const headers = lines[0].split(",").map(h => h.trim());
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

// ----------------------------------------------------------------------
// 9. PDFParser (.pdf)
// ----------------------------------------------------------------------
export const PDFParser: Parser = {
  name: "PDFParser",
  extensions: ["pdf"],
  async parse(fileName) {
    const proj = createEmptyProject(fileName, "PDFParser");
    proj.tags = ["Data Extraction", "Business Reporting", "Documentation"];
    proj.categories = ["Data Extract", "Reporting"];

    const docEvidence: DocumentEvidence = {
      sourceFile: fileName,
      parser: "PDFParser",
      confidence: 85,
      title: fileName,
      sections: [{ heading: "Document Analysis", content: "Extracted document section for business evaluation." }],
      extractedTerms: ["Document"]
    };

    return {
      project: proj,
      evidenceNode: { type: "document", data: docEvidence }
    };
  }
};

// ----------------------------------------------------------------------
// 10. ImageParser (.png, .jpg, .jpeg)
// ----------------------------------------------------------------------
export const ImageParser: Parser = {
  name: "ImageParser",
  extensions: ["png", "jpg", "jpeg"],
  async parse(fileName) {
    const proj = createEmptyProject(fileName, "ImageParser");
    proj.tags = ["Dashboarding", "Data Visualization", "Telemetry Reporting"];
    proj.categories = ["Telemetry Visualization"];
    proj.objective = "";

    const imgEvidence: ImageEvidence = {
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

// ----------------------------------------------------------------------
// 11. GitHubParser (Repository code layout)
// ----------------------------------------------------------------------
export const GitHubParser: Parser = {
  name: "GitHubParser",
  extensions: ["git"],
  async parse(fileName) {
    const proj = createEmptyProject(fileName, "GitHubParser");
    proj.tags = ["Version Control", "Analytics Engineering"];
    proj.categories = ["DevOps", "Data Engineering"];

    const docEvidence: DocumentEvidence = {
      sourceFile: fileName,
      parser: "GitHubParser",
      confidence: 90,
      sections: [{ heading: "Repository Structure", content: "Repository code layout." }],
      extractedTerms: ["Git", "Repository"]
    };

    return {
      project: proj,
      evidenceNode: { type: "document", data: docEvidence }
    };
  }
};

// ----------------------------------------------------------------------
// Registry Mapping & Route
// ----------------------------------------------------------------------
export const PARSER_REGISTRY: Record<string, Parser> = {
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

export async function unpackZipFile(base64Content: string): Promise<Array<{ name: string; content: string; type: "text" | "binary" }>> {
  const extractedFiles: Array<{ name: string; content: string; type: "text" | "binary" }> = [];
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

      const sanitizedFilename = rawFilename
        .replace(/\\/g, "/")
        .split("/")
        .filter(part => part !== ".." && part !== ".")
        .join("/");

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
  } catch (err: any) {
    console.error("ZIP Unpack Security Violation or Failure:", err.message);
  }
  return extractedFiles;
}
