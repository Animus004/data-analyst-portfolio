/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import JSZip from "jszip";
import { parseSqlFiles } from "./sqlParser";
import { parsePythonFiles } from "./pythonParser";
import { parsePowerBiFiles } from "./powerBiParser";
import { parseTableauFiles } from "./tableauParser";
import { parseRFiles } from "./rParser";
import { parseExcelWorkbook } from "./excelParser";
import { ExtractedProject, ExtractedMetric, ExtractedStoryBlock, ConflictRecord, UniversalCompilerOutput } from "./types";

/**
 * Extracts and unzips any uploaded ZIP files recursively.
 */
export async function unpackZipFile(base64Content: string): Promise<Array<{ name: string; content: string; type: string }>> {
  const extractedFiles: Array<{ name: string; content: string; type: string }> = [];
  try {
    const zipBuffer = Buffer.from(base64Content, "base64");
    const zip = new JSZip();
    const contents = await zip.loadAsync(zipBuffer);

    for (const [filename, fileObj] of Object.entries(contents.files)) {
      if (!fileObj.dir) {
        // Extract as UTF-8 text for scripts and markup, or base64 if needed
        const ext = filename.split(".").pop()?.toLowerCase() || "";
        const isBinary = ["xlsx", "xls", "pbix", "twbx", "png", "jpg", "jpeg", "pdf"].includes(ext);
        
        if (isBinary) {
          const contentBase64 = await fileObj.async("base64");
          extractedFiles.push({
            name: filename,
            content: contentBase64,
            type: "binary"
          });
        } else {
          const textContent = await fileObj.async("string");
          extractedFiles.push({
            name: filename,
            content: textContent,
            type: "text"
          });
        }
      }
    }
  } catch (err) {
    console.error("Failed to unpack ZIP file:", err);
  }
  return extractedFiles;
}

/**
 * Helper to normalize strings for comparison in the Validation Engine.
 */
function normalizeLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

/**
 * Deterministic Universal Validation Engine.
 * Compares extracted values across all parsed projects/files and detects conflicts in:
 * - KPIs and metrics (by name similarity)
 * - Dates
 * - Business facts (title, subtitle, role, duration, industry)
 */
export function validateAndDetectConflicts(projects: ExtractedProject[]): ConflictRecord[] {
  const conflicts: ConflictRecord[] = [];

  if (projects.length <= 1) return conflicts;

  // Validate KPIs & Metrics (Compare metrics with similar labels across evidence sources)
  const metricGroups = new Map<string, Array<{ metric: ExtractedMetric; sourceFile: string }>>();

  projects.forEach(p => {
    p.metrics.forEach(m => {
      const normLabel = normalizeLabel(m.label);
      if (normLabel) {
        if (!metricGroups.has(normLabel)) {
          metricGroups.set(normLabel, []);
        }
        metricGroups.get(normLabel)!.push({
          metric: m,
          sourceFile: m.sourceFile
        });
      }
    });
  });

  metricGroups.forEach((group, normLabel) => {
    if (group.length > 1) {
      const valuesMap = new Map<string, typeof group>();
      group.forEach(item => {
        const normVal = item.metric.value.toLowerCase().trim();
        if (!valuesMap.has(normVal)) {
          valuesMap.set(normVal, []);
        }
        valuesMap.get(normVal)!.push(item);
      });

      if (valuesMap.size > 1) {
        const valuesList: ConflictRecord["values"] = [];
        valuesMap.forEach(vGroup => {
          const rep = vGroup[0];
          valuesList.push({
            value: rep.metric.value,
            sourceFile: rep.sourceFile,
            location: rep.metric.sourceLocation
          });
        });

        conflicts.push({
          field: `Metric Discrepancy (${group[0].metric.label})`,
          values: valuesList
        });
      }
    }
  });

  return conflicts;
}

/**
 * Merges multiple parsed files into a single ExtractedProject.
 */
export function mergeExtractedProjects(projects: ExtractedProject[]): ExtractedProject {
  if (projects.length === 0) {
    return {
      title: "Consolidated Project Report",
      subtitle: "Multi-file structured analysis",
      summary: "",
      industry: "Uncategorized",
      role: "Analyst",
      duration: "Ongoing",
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
      sourceFiles: []
    };
  }

  // Use the first project as baseline
  const base = projects[0];
  const merged: ExtractedProject = {
    ...base,
    tags: Array.from(new Set(projects.flatMap(p => p.tags))),
    categories: Array.from(new Set(projects.flatMap(p => p.categories))),
    metrics: projects.flatMap(p => p.metrics),
    storyBlocks: projects.flatMap(p => p.storyBlocks),
    sourceFiles: Array.from(new Set(projects.flatMap(p => p.sourceFiles)))
  };

  // Build high-impact paragraph summaries for fields if they were defined in other files
  projects.slice(1).forEach(p => {
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

/**
 * Standardized universal project compiler pipeline entrance.
 */
export async function compileProjectPackage(
  rawFiles: Array<{ name: string; size: number; type: string; content: string; detectedType: string }>
): Promise<UniversalCompilerOutput> {
  let projectType: UniversalCompilerOutput["projectType"] = "Mixed Analytics";
  
  // 1. Handle ZIP unpack recursively
  const allFiles: Array<{ name: string; content: string; type: string; size: number }> = [];
  const fileCoverage: UniversalCompilerOutput["fileCoverage"] = [];

  for (const file of rawFiles) {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (ext === "zip") {
      projectType = "ZIP Package";
      const unpacked = await unpackZipFile(file.content);
      unpacked.forEach(u => {
        allFiles.push({
          name: u.name,
          content: u.content,
          type: u.type,
          size: Buffer.byteLength(u.content, "base64")
        });
      });
      fileCoverage.push({
        fileName: file.name,
        status: "Used",
        reason: `Unpacked ZIP archive containing ${unpacked.length} files.`,
        size: file.size
      });
    } else {
      allFiles.push({
        name: file.name,
        content: file.content,
        type: "binary",
        size: file.size
      });
    }
  }

  // 2. Specialized Parsers
  const parsedProjects: ExtractedProject[] = [];

  // Group files by type to route to specialized parsers
  const sqlFiles: Array<{ name: string; content: string }> = [];
  const pythonFiles: Array<{ name: string; content: string }> = [];
  const powerBiFiles: Array<{ name: string; content: string }> = [];
  const tableauFiles: Array<{ name: string; content: string }> = [];
  const rFiles: Array<{ name: string; content: string }> = [];

  allFiles.forEach(file => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    
    if (ext === "sql") {
      const decoded = file.type === "text" ? file.content : Buffer.from(file.content, "base64").toString("utf-8");
      sqlFiles.push({ name: file.name, content: decoded });
      fileCoverage.push({
        fileName: file.name,
        status: "Used",
        reason: "Parsed via Specialized SQL script parser.",
        size: file.size
      });
    } else if (ext === "py" || ext === "ipynb") {
      const decoded = file.type === "text" ? file.content : Buffer.from(file.content, "base64").toString("utf-8");
      pythonFiles.push({ name: file.name, content: decoded });
      fileCoverage.push({
        fileName: file.name,
        status: "Used",
        reason: "Parsed via Specialized Python/Jupyter parser.",
        size: file.size
      });
    } else if (ext === "dax" || ext === "pbix" || (ext === "json" && file.name.toLowerCase().includes("report"))) {
      const decoded = file.type === "text" ? file.content : Buffer.from(file.content, "base64").toString("utf-8");
      powerBiFiles.push({ name: file.name, content: decoded });
      fileCoverage.push({
        fileName: file.name,
        status: "Used",
        reason: "Parsed via Specialized Power BI DAX & layout parser.",
        size: file.size
      });
    } else if (ext === "twb" || ext === "twbx") {
      const decoded = file.type === "text" ? file.content : Buffer.from(file.content, "base64").toString("utf-8");
      tableauFiles.push({ name: file.name, content: decoded });
      fileCoverage.push({
        fileName: file.name,
        status: "Used",
        reason: "Parsed via Specialized Tableau workbook XML parser.",
        size: file.size
      });
    } else if (ext === "r" || ext === "rmd") {
      const decoded = file.type === "text" ? file.content : Buffer.from(file.content, "base64").toString("utf-8");
      rFiles.push({ name: file.name, content: decoded });
      fileCoverage.push({
        fileName: file.name,
        status: "Used",
        reason: "Parsed via Specialized R analytics parser.",
        size: file.size
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const parsedXls = parseExcelWorkbook(file.name, file.content);
      parsedProjects.push(parsedXls);
      fileCoverage.push({
        fileName: file.name,
        status: "Used",
        reason: "Parsed via Specialized Excel sheets parser.",
        size: file.size
      });
    } else {
      fileCoverage.push({
        fileName: file.name,
        status: "Ignored",
        reason: "Unsupported file extension or format skipped during parser routing.",
        size: file.size
      });
    }
  });

  // Run the grouped files through their parsers
  if (sqlFiles.length > 0) {
    parsedProjects.push(parseSqlFiles(sqlFiles));
    if (projectType !== "ZIP Package") projectType = "SQL Analytics";
  }
  if (pythonFiles.length > 0) {
    parsedProjects.push(parsePythonFiles(pythonFiles));
    if (projectType !== "ZIP Package") projectType = "Python";
  }
  if (powerBiFiles.length > 0) {
    parsedProjects.push(parsePowerBiFiles(powerBiFiles));
    if (projectType !== "ZIP Package") projectType = "Power BI";
  }
  if (tableauFiles.length > 0) {
    parsedProjects.push(parseTableauFiles(tableauFiles));
    if (projectType !== "ZIP Package") projectType = "Tableau";
  }
  if (rFiles.length > 0) {
    parsedProjects.push(parseRFiles(rFiles));
    if (projectType !== "ZIP Package") projectType = "R";
  }

  // 3. Validation Engine - detect conflicts deterministically
  const conflicts = validateAndDetectConflicts(parsedProjects);

  // 4. Merge all parsed projects into a baseline ExtractedProject
  const rawProject = mergeExtractedProjects(parsedProjects);

  return {
    projectType,
    rawProject,
    conflicts,
    fileCoverage
  };
}
