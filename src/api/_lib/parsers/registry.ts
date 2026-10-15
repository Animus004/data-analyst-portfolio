/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from "xlsx";
import mammoth from "mammoth";
import JSZip from "jszip";
import zlib from "zlib";
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

import { parseStreamExcel } from "./streamExcel";

export interface ParserResult {
  project: ExtractedProject;
  evidenceNode: ParserEvidenceNode;
}

export interface Parser {
  name: string;
  extensions: string[];
  parse(fileName: string, content: string | Buffer, type: "text" | "binary"): Promise<ParserResult>;
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
// ----------------------------------------------------------------------
// 1. ExcelParser (Delegates to non-blocking StreamExcelParser)
// ----------------------------------------------------------------------
export const ExcelParser: Parser = {
  name: "ExcelParser",
  extensions: ["xlsx", "xls"],
  async parse(fileName, content) {
    return parseStreamExcel(fileName, content);
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

    const text = typeof content === "string"
      ? (type === "text" ? content : Buffer.from(content, "base64").toString("utf-8"))
      : content.toString("utf-8");
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
        const fullFormula = aliasMatch[0].split(/\s+AS\s+/i)[0]?.trim() || aliasMatch[1];
        sqlEvidence.calculatedMetrics.push({ name: aliasMatch[2], formula: fullFormula });
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

    const text = typeof content === "string"
      ? (type === "text" ? content : Buffer.from(content, "base64").toString("utf-8"))
      : content.toString("utf-8");
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
      const text = typeof content === "string"
        ? (type === "text" ? content : Buffer.from(content, "base64").toString("utf-8"))
        : content.toString("utf-8");
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

    const text = typeof content === "string"
      ? (type === "text" ? content : Buffer.from(content, "base64").toString("utf-8"))
      : content.toString("utf-8");

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
// Document Section & PDF Extraction Helpers
// ----------------------------------------------------------------------

/**
 * Decompresses and extracts raw text strings from PDF stream blocks using built-in zlib.
 */
function extractPdfStreamText(buffer: Buffer): string {
  const textChunks: string[] = [];
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

    let decompressed: Buffer | null = null;
    try {
      decompressed = zlib.inflateSync(streamSlice);
    } catch {
      try {
        decompressed = zlib.inflateRawSync(streamSlice);
      } catch {
        // Not compressed or already raw
      }
    }

    const raw = (decompressed || streamSlice).toString("latin1");
    // Extract text in PDF parentheses: (text) Tj or ' or "
    const matches = raw.matchAll(/\(([^)]+)\)\s*(?:Tj|'|")/g);
    for (const m of matches) {
      if (m[1] && m[1].length > 1) {
        textChunks.push(m[1].replace(/\\([()\\])/g, "$1"));
      }
    }
    // Extract text in TJ arrays: [(text) -10 (more)] TJ
    const tjMatches = raw.matchAll(/\[([^\]]+)\]\s*TJ/g);
    for (const tm of tjMatches) {
      const sub = tm[1].matchAll(/\(([^)]+)\)/g);
      const joined = Array.from(sub).map(s => s[1].replace(/\\([()\\])/g, "$1")).join("");
      if (joined.length > 1) {
        textChunks.push(joined);
      }
    }
  }

  return textChunks.join(" ");
}

/**
 * Universal PDF Text Extractor: uses pdf-parse with zlib stream fallback.
 */
async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const pdfModule = await import("pdf-parse");
    const PDFParse = (pdfModule as any).PDFParse || (pdfModule as any).default?.PDFParse || (pdfModule as any).default;
    if (typeof PDFParse === "function") {
      try {
        const parser = new PDFParse({ data: buffer });
        const textResult = await parser.getText();
        await parser.destroy?.();
        if (textResult) {
          const extracted = typeof textResult === "string"
            ? textResult
            : (textResult.text || (Array.isArray(textResult.pages) ? textResult.pages.map((p: any) => p.text).join("\n") : ""));
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

/**
 * Universal Structured Report Section Extractor:
 * Parses Markdown, TXT, Word (.docx), and PDF text to identify and extract
 * Business Problem, Recommendations, Findings, Objectives, Methodology,
 * Challenges, Data Cleaning, and Lessons Learned.
 */
function extractStructuredReportSections(
  fileName: string,
  rawText: string,
  proj: ExtractedProject,
  docEvidence?: DocumentEvidence,
  readmeEvidence?: ReadmeEvidence
): void {
  if (!rawText || rawText.trim().length === 0) return;

  // 1. Check if the top lines provide a clean project title
  const rawLines = rawText.split("\n").map(l => l.trim()).filter(Boolean);
  if (rawLines.length > 0) {
    const firstLine = rawLines[0].replace(/^#+\s*/, "").replace(/^\*+|\*+$/g, "").trim();
    if (firstLine.length > 5 && firstLine.length < 90 && !/^(report|project|summary|document|table of contents|index)$/i.test(firstLine)) {
      proj.title = firstLine;
      if (docEvidence) docEvidence.title = firstLine;
    }
  }

  const sectionKeywordsRegex = /^(?:business problem|problem statement|problem|operational challenge|issue|bottleneck|recommendations?|strategic recommendations?|business recommendations?|action items?|next steps?|priorities|management priorities|key findings|findings|key insights|insights|results|analysis results|discoveries|project objectives?|business objectives?|objectives?|goals?|purpose|methodology|approach|analytical approach|workflow|process|architecture|challenges?|roadblocks?|obstacles?|limitations?|constraints?|data cleaning|data preparation|preprocessing|transformations?|etl|lessons? learned|key takeaways?|retrospective|conclusions?|dataset(?: description)?|data sources?|executive summary|overview|background)$/i;

  const sections: Array<{ heading: string; body: string }> = [];
  let currentHeading = "Overview";
  let currentLines: string[] = [];

  for (const line of rawText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentLines.length > 0) currentLines.push("");
      continue;
    }

    let detectedHeading: string | null = null;

    // Check # Markdown headers
    const mdMatch = trimmed.match(/^#{1,4}\s+(.+)$/);
    if (mdMatch) {
      detectedHeading = mdMatch[1].trim();
    }

    // Check bold headers **Header** or **Header:**
    if (!detectedHeading) {
      const boldMatch = trimmed.match(/^\*{2}(.+?)\*{2}:?$/);
      if (boldMatch) {
        detectedHeading = boldMatch[1].trim();
      }
    }

    // Check numbered headers: 1. Business Problem or 1) Recommendations
    if (!detectedHeading) {
      const numMatch = trimmed.match(/^\d+[\.\)]\s+([A-Za-z\s]{3,40}):?$/);
      if (numMatch && sectionKeywordsRegex.test(numMatch[1].trim())) {
        detectedHeading = numMatch[1].trim();
      }
    }

    // Check standalone short line matching keyword (e.g. "Business Problem:")
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

  // Map captured sections to canonical project fields
  for (const sec of sections) {
    const h = sec.heading.toLowerCase();
    const b = sec.body;
    if (!b || b.length < 5) continue;

    if (h.includes("problem") || h.includes("issue") || h.includes("bottleneck") || h.includes("operational challenge")) {
      proj.businessProblem = proj.businessProblem ? `${proj.businessProblem}\n\n${b}` : b;
      if (readmeEvidence) readmeEvidence.problem = proj.businessProblem;
      if (docEvidence) docEvidence.sections.push({ heading: "Business Problem", content: b });
    } else if (h.includes("recommend") || h.includes("action") || h.includes("next step") || h.includes("priorit")) {
      proj.recommendations = proj.recommendations ? `${proj.recommendations}\n\n${b}` : b;
      if (readmeEvidence) readmeEvidence.recommendations = proj.recommendations;
      if (docEvidence) docEvidence.sections.push({ heading: "Strategic Recommendations", content: b });
    } else if (h.includes("finding") || h.includes("insight") || h.includes("result") || h.includes("discover")) {
      proj.findings = proj.findings ? `${proj.findings}\n\n${b}` : b;
      if (readmeEvidence) readmeEvidence.findings = proj.findings;
      if (docEvidence) docEvidence.sections.push({ heading: "Key Findings", content: b });
    } else if (h.includes("objective") || h.includes("goal") || h.includes("purpose")) {
      proj.objective = proj.objective ? `${proj.objective}\n\n${b}` : b;
      if (readmeEvidence) readmeEvidence.objective = proj.objective;
      if (docEvidence) docEvidence.sections.push({ heading: "Business Objective", content: b });
    } else if (h.includes("methodology") || h.includes("approach") || h.includes("workflow") || h.includes("process") || h.includes("architecture")) {
      proj.methodology = proj.methodology ? `${proj.methodology}\n\n${b}` : b;
      if (readmeEvidence) readmeEvidence.methodology = proj.methodology;
      if (docEvidence) docEvidence.sections.push({ heading: "Methodology", content: b });
    } else if (h.includes("challenge") || h.includes("roadblock") || h.includes("obstacle") || h.includes("limitation")) {
      proj.challengesText = proj.challengesText ? `${proj.challengesText}\n\n${b}` : b;
      if (readmeEvidence) readmeEvidence.challenges = proj.challengesText;
      if (docEvidence) docEvidence.sections.push({ heading: "Challenges", content: b });
    } else if (h.includes("cleaning") || h.includes("prep") || h.includes("transform") || h.includes("etl")) {
      proj.dataCleaning = proj.dataCleaning ? `${proj.dataCleaning}\n\n${b}` : b;
      if (readmeEvidence) readmeEvidence.dataCleaning = proj.dataCleaning;
      if (docEvidence) docEvidence.sections.push({ heading: "Data Cleaning", content: b });
    } else if (h.includes("lesson") || h.includes("takeaway") || h.includes("retrospective") || h.includes("conclusion")) {
      proj.lessonsLearned = proj.lessonsLearned ? `${proj.lessonsLearned}\n\n${b}` : b;
      if (readmeEvidence) readmeEvidence.lessonsLearned = proj.lessonsLearned;
      if (docEvidence) docEvidence.sections.push({ heading: "Lessons Learned", content: b });
    } else if (h.includes("dataset") || h.includes("data source") || h.includes("corpus")) {
      proj.datasetDesc = proj.datasetDesc ? `${proj.datasetDesc}\n\n${b}` : b;
      if (readmeEvidence) readmeEvidence.dataset = proj.datasetDesc;
      if (docEvidence) docEvidence.sections.push({ heading: "Dataset Description", content: b });
    } else if (h.includes("summary") || h.includes("overview") || h.includes("background")) {
      proj.summary = proj.summary ? `${proj.summary}\n\n${b}` : b;
      if (docEvidence) docEvidence.sections.push({ heading: "Executive Summary", content: b });
    } else {
      if (docEvidence) docEvidence.sections.push({ heading: sec.heading, content: b });
    }
  }

  // Narrative Fallback: If problem or recommendations were not caught by explicit headers,
  // scan paragraphs for problem and recommendation sentences
  if (!proj.businessProblem || !proj.recommendations) {
    const paragraphs = rawText.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 40);
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

  // Preserve report storyBlock
  proj.storyBlocks.push({
    id: `report-sb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: "markdown",
    title: `Report: ${fileName}`,
    bodyContent: rawText.slice(0, 10000),
    sourceFile: fileName
  });
}

// ----------------------------------------------------------------------
// 6. MarkdownParser (.md / README / .txt reports)
// ----------------------------------------------------------------------
export const MarkdownParser: Parser = {
  name: "MarkdownParser",
  extensions: ["md", "txt"],
  async parse(fileName, content, type) {
    const proj = createEmptyProject(fileName, "MarkdownParser");
    proj.tags = ["Business Reporting", "Documentation", "Executive Communication"];
    proj.categories = ["Technical Writing", "Reporting"];

    const text = typeof content === "string"
      ? (type === "text" ? content : Buffer.from(content, "base64").toString("utf-8"))
      : content.toString("utf-8");

    const readmeEvidence: ReadmeEvidence = {
      sourceFile: fileName,
      parser: "MarkdownParser",
      confidence: 95,
      tools: ["Markdown", "Git"]
    };

    extractStructuredReportSections(fileName, text, proj, undefined, readmeEvidence);

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
      const text = typeof content === "string"
        ? (type === "text" ? content : Buffer.from(content, "base64").toString("utf-8"))
        : content.toString("utf-8");
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
  async parse(fileName, content, type) {
    const proj = createEmptyProject(fileName, "PDFParser");
    proj.tags = ["Business Analysis", "Executive Reporting", "Documentation"];
    proj.categories = ["Data Extract", "Reporting"];

    const docEvidence: DocumentEvidence = {
      sourceFile: fileName,
      parser: "PDFParser",
      confidence: 90,
      title: fileName,
      sections: [],
      extractedTerms: ["Document", "Report", "PDF Analysis"]
    };

    try {
      const buffer = typeof content === "string"
        ? (type === "text" ? Buffer.from(content, "utf-8") : Buffer.from(content, "base64"))
        : content;

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
// 12. TableauParser (.twb, .twbx)
// ----------------------------------------------------------------------
export const TableauParser: Parser = {
  name: "TableauParser",
  extensions: ["twb", "twbx"],
  async parse(fileName, content, type) {
    const proj = createEmptyProject(fileName, "TableauParser");
    proj.tags = ["Tableau", "Data Visualization", "Worksheet Analytics", "Calculated Fields"];
    proj.categories = ["Business Intelligence", "Data Visualization"];
    proj.role = "BI Specialist";

    let xmlText = "";
    if (fileName.toLowerCase().endsWith(".twbx")) {
      try {
        const zipBuffer = typeof content === "string" ? Buffer.from(content, "base64") : content;
        const zip = new JSZip();
        const zipData = await zip.loadAsync(zipBuffer);
        const twbEntry = Object.keys(zipData.files).find(k => k.toLowerCase().endsWith(".twb"));
        if (twbEntry) {
          xmlText = await zipData.files[twbEntry].async("string");
        }
      } catch (twbxErr) {
        console.warn("[TableauParser] TWBX zip extraction warning:", twbxErr);
      }
    } else {
      xmlText = typeof content === "string"
        ? (type === "text" ? content : Buffer.from(content, "base64").toString("utf-8"))
        : content.toString("utf-8");
    }

    const worksheets: string[] = [];
    const dashboards: string[] = [];
    const calculatedMeasures: Array<{ name: string; expression: string }> = [];

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
        bodyContent: `### Extracted Tableau Worksheets\n${worksheets.map(w => `- **${w}**`).join("\n") || "No worksheets found."}\n\n### Extracted Dashboards\n${dashboards.map(d => `- **${d}**`).join("\n") || "No dashboards found."}`,
        sourceFile: fileName
      });
    }

    const pbiEvidence: PowerBiEvidence = {
      sourceFile: fileName,
      parser: "TableauParser",
      confidence: 92,
      visuals: dashboards.length > 0 ? dashboards.map(d => ({ title: d, type: "Dashboard" })) : worksheets.map(w => ({ title: w, type: "Worksheet" })),
      daxMeasures: calculatedMeasures,
      pages: dashboards.length > 0 ? dashboards : (worksheets.length > 0 ? worksheets : ["Tableau Analytics"]),
      relationships: [],
      kpis: []
    };

    return {
      project: proj,
      evidenceNode: { type: "powerbi", data: pbiEvidence }
    };
  }
};

// ----------------------------------------------------------------------
// 13. RParser (.r, .rmd)
// ----------------------------------------------------------------------
export const RParser: Parser = {
  name: "RParser",
  extensions: ["r", "rmd"],
  async parse(fileName, content, type) {
    const proj = createEmptyProject(fileName, "RParser");
    proj.tags = ["R", "ggplot2", "Statistical Modeling", "Exploratory Data Analysis"];
    proj.categories = ["Statistical Analysis", "Data Science"];
    proj.role = "Statistical Data Analyst";

    const text = typeof content === "string"
      ? (type === "text" ? content : Buffer.from(content, "base64").toString("utf-8"))
      : content.toString("utf-8");

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
        bodyContent: text.slice(0, 5000),
        language: "r",
        sourceFile: fileName
      });
    }

    const docEvidence: DocumentEvidence = {
      sourceFile: fileName,
      parser: "RParser",
      confidence: 90,
      sections: [{ heading: "R Statistical Analysis", content: text.slice(0, 3000) }],
      extractedTerms: ["R", "ggplot2", "dplyr", "Statistical Analysis"]
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
  jpeg: ImageParser,
  twb: TableauParser,
  twbx: TableauParser,
  r: RParser,
  rmd: RParser
};

export async function unpackZipFile(base64Content: string | Buffer): Promise<Array<{ name: string; content: string; type: "text" | "binary" }>> {
  const extractedFiles: Array<{ name: string; content: string; type: "text" | "binary" }> = [];
  const MAX_EXTRACTED_FILES = 100;
  const MAX_TOTAL_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;
  let totalUncompressedBytes = 0;

  try {
    const zipBuffer = typeof base64Content === "string" ? Buffer.from(base64Content, "base64") : base64Content;
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
