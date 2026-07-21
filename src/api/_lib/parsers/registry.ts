/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from "xlsx";
import mammoth from "mammoth";
import JSZip from "jszip";
import { ExtractedProject, ExtractedMetric, ExtractedStoryBlock } from "../types/index";

export interface Parser {
  name: string;
  extensions: string[];
  parse(fileName: string, content: string, type: "text" | "binary"): Promise<ExtractedProject>;
}

// ----------------------------------------------------------------------
// Helper to create a fallback empty project
// ----------------------------------------------------------------------
function createEmptyProject(fileName: string, parserName: string): ExtractedProject {
  return {
    title: `Analytical Report: ${fileName}`,
    subtitle: `Synthesized analysis from ${parserName}`,
    summary: `Structured dataset analysis parsed from ${fileName} using specialized ${parserName} compiler.`,
    industry: "Analytical Technology",
    role: "Analytics Engineer",
    duration: "1 Week",
    date: new Date().toISOString().split("T")[0],
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

// ----------------------------------------------------------------------
// 1. ExcelParser
// ----------------------------------------------------------------------
export const ExcelParser: Parser = {
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

      let projectsRaw: any[] = [];
      let metricsRaw: any[] = [];

      workbook.SheetNames.forEach(sheetName => {
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

      metricsRaw.forEach((m: any, mIdx: number) => {
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

// ----------------------------------------------------------------------
// 2. SQLParser
// ----------------------------------------------------------------------
export const SQLParser: Parser = {
  name: "SQLParser",
  extensions: ["sql"],
  async parse(fileName, content, type) {
    const proj = createEmptyProject(fileName, "SQLParser");
    proj.tags = ["SQL", "Relational Database"];
    proj.categories = ["Data Engineering", "Database Querying"];
    proj.role = "Database Analyst";

    const text = type === "text" ? content : Buffer.from(content, "base64").toString("utf-8");
    const lines = text.split("\n");
    const tablesReferenced = new Set<string>();

    const cleanName = fileName.replace(/\.sql$/i, "").replace(/[-_]+/g, " ");
    proj.title = `SQL Analytics: ${cleanName.charAt(0).toUpperCase() + cleanName.slice(1)}`;

    lines.forEach((line, lineIdx) => {
      const trimmed = line.trim();

      // Table reference extraction
      const fromMatch = trimmed.match(/\bFROM\s+([a-zA-Z0-9_\.]+)/i);
      if (fromMatch && fromMatch[1]) tablesReferenced.add(fromMatch[1]);
      const joinMatch = trimmed.match(/\bJOIN\s+([a-zA-Z0-9_\.]+)/i);
      if (joinMatch && joinMatch[1]) tablesReferenced.add(joinMatch[1]);

      // Detect comments with KPIs
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

// ----------------------------------------------------------------------
// 3. PythonParser
// ----------------------------------------------------------------------
export const PythonParser: Parser = {
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

// ----------------------------------------------------------------------
// 4. NotebookParser (Jupyter notebooks .ipynb)
// ----------------------------------------------------------------------
export const NotebookParser: Parser = {
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

      cells.forEach((cell: any, cellIdx: number) => {
        const cellType = cell.cell_type;
        const sourceLines = Array.isArray(cell.source) ? cell.source : [cell.source || ""];
        const sourceText = sourceLines.join("");

        if (cellType === "markdown") {
          markdownConcat += sourceText + "\n\n";
          const lines = sourceText.split("\n");
          lines.forEach(l => {
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
          // Check for KPI comments
          sourceLines.forEach((l: any, lineNum: number) => {
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
        proj.findings = `Parsed findings from Notebook Markdown cells:\n${markdownConcat.slice(0, 1000)}`;
      }
    } catch (err) {
      console.error("NotebookParser Error:", err);
    }

    return proj;
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
    proj.tags = ["Power BI", "DAX"];
    proj.categories = ["Business Intelligence", "Dashboard Analytics"];
    proj.role = "BI Engineer";

    const text = type === "text" ? content : Buffer.from(content, "base64").toString("utf-8");
    proj.storyBlocks.push({
      id: `pbi-sb-${Date.now()}`,
      type: "code_snippet",
      title: `DAX Calculations: ${fileName}`,
      bodyContent: text.slice(0, 5000),
      language: "sql", // DAX is highlighted nicely using sql/general coding
      sourceFile: fileName
    });

    return proj;
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
    proj.tags = ["Markdown", "Documentation"];
    proj.categories = ["Technical Writing", "Reporting"];

    const text = type === "text" ? content : Buffer.from(content, "base64").toString("utf-8");
    proj.summary = `Technical documentation compiled from Markdown files: ${fileName}.`;

    const sections = text.split(/\n#+\s+/);
    sections.forEach(sec => {
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

// ----------------------------------------------------------------------
// 7. WordParser (.docx)
// ----------------------------------------------------------------------
export const WordParser: Parser = {
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
      proj.findings = text.slice(0, 2000);

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

// ----------------------------------------------------------------------
// 8. CSVParser (.csv)
// ----------------------------------------------------------------------
export const CSVParser: Parser = {
  name: "CSVParser",
  extensions: ["csv"],
  async parse(fileName, content, type) {
    const proj = createEmptyProject(fileName, "CSVParser");
    proj.tags = ["CSV", "Flat File"];
    proj.categories = ["Data Prep", "Tabular Analysis"];

    try {
      const text = type === "text" ? content : Buffer.from(content, "base64").toString("utf-8");
      const lines = text.split("\n").filter(l => l.trim() !== "");
      if (lines.length > 0) {
        const headers = lines[0].split(",").map(h => h.trim());
        proj.datasetDesc = `Flat-file dataset contains ${lines.length - 1} records across headers: ${headers.join(", ")}.`;

        // Create a quick metrics summary
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

// ----------------------------------------------------------------------
// 9. PDFParser (.pdf)
// ----------------------------------------------------------------------
export const PDFParser: Parser = {
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

// ----------------------------------------------------------------------
// 10. ImageParser (.png, .jpg, .jpeg)
// ----------------------------------------------------------------------
export const ImageParser: Parser = {
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

// ----------------------------------------------------------------------
// 11. GitHubParser (Repository code layout)
// ----------------------------------------------------------------------
export const GitHubParser: Parser = {
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
  const MAX_TOTAL_UNCOMPRESSED_BYTES = 100 * 1024 * 1024; // 100 MB safety limit
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

      // Zip Slip Protection: Sanitize filename to prevent directory traversal attacks
      const sanitizedFilename = rawFilename
        .replace(/\\/g, "/")
        .split("/")
        .filter(part => part !== ".." && part !== ".")
        .join("/");

      if (!sanitizedFilename || fileObj.dir) {
        continue;
      }

      const ext = sanitizedFilename.split(".").pop()?.toLowerCase() || "";
      
      // Prevent processing deeply nested ZIP bombs
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
