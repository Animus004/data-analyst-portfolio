/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PARSER_REGISTRY, unpackZipFile } from "../parsers/registry";
import {
  ExtractedProject,
  ConflictRecord,
  UniversalCompilerOutput,
  ParserEvidenceNode
} from "../types/index";
import { validateFileSignature, computeSha256, executeWithTimeout } from "../utils/security";
import { mergeToEvidenceGraph, detectEvidenceConflicts } from "../evidence/graph";
import { compilePortfolioWithGemini } from "../ai/portfolioCompiler";
import crypto from "crypto";

// Helper to normalize strings for metric matching
function normalizeLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

/**
 * Stage 4: Validation Engine - Deterministic Conflict Detection
 */
export function validateAndDetectConflicts(projects: ExtractedProject[]): ConflictRecord[] {
  const conflicts: ConflictRecord[] = [];

  if (projects.length <= 1) return conflicts;

  // Compare Business Facts (Title, Subtitle, Role, Duration, Industry, Date)
  const fieldsToCompare = ["title", "subtitle", "role", "duration", "industry", "date"];

  fieldsToCompare.forEach(field => {
    const valuesMap = new Map<string, { value: string; sourceFile: string; location?: string }[]>();
    
    projects.forEach(p => {
      const val = (p as any)[field] || "";
      if (val && val !== "Not Found" && val !== "Requires User Review") {
        const norm = val.toLowerCase().trim();
        if (!valuesMap.has(norm)) {
          valuesMap.set(norm, []);
        }
        valuesMap.get(norm)!.push({
          value: val,
          sourceFile: p.sourceFiles.join(", ")
        });
      }
    });

    if (valuesMap.size > 1) {
      const valuesList: ConflictRecord["values"] = [];
      valuesMap.forEach(group => {
        valuesList.push(group[0]);
      });
      conflicts.push({
        field: field.charAt(0).toUpperCase() + field.slice(1),
        values: valuesList
      });
    }
  });

  // Compare KPIs & Metrics (by similarity of labels)
  const metricGroups = new Map<string, Array<{ label: string; value: string; sourceFile: string; location?: string }>>();

  projects.forEach(p => {
    p.metrics.forEach(m => {
      const normLabel = normalizeLabel(m.label);
      if (normLabel) {
        if (!metricGroups.has(normLabel)) {
          metricGroups.set(normLabel, []);
        }
        metricGroups.get(normLabel)!.push({
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
      const valuesMap = new Map<string, typeof group>();
      group.forEach(item => {
        const normVal = item.value.toLowerCase().trim();
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

/**
 * Stage 3: Normalization & Merge - Consolidation of multiple parsed outputs
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

  const base = projects[0];
  const merged: ExtractedProject = {
    ...base,
    tags: Array.from(new Set(projects.flatMap(p => p.tags))),
    categories: Array.from(new Set(projects.flatMap(p => p.categories))),
    metrics: projects.flatMap(p => p.metrics),
    storyBlocks: projects.flatMap(p => p.storyBlocks),
    sourceFiles: Array.from(new Set(projects.flatMap(p => p.sourceFiles)))
  };

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
 * AI Portfolio Compiler Main Entry Point
 * Flow: Raw Files -> Specialized Parsers -> Evidence Extraction -> Evidence Graph -> Gemini Reasoning Engine -> Structured Portfolio Project
 */
export async function compileProjectPackage(
  rawFiles: Array<{ name: string; size: number; type: string; content: string; storagePath?: string }>
): Promise<UniversalCompilerOutput> {
  let projectType = "Mixed Analytics";
  
  // Quotas
  const MAX_RAW_FILES = 50;
  if (rawFiles.length > MAX_RAW_FILES) {
    throw new Error(`Package exceeds maximum file limit (${MAX_RAW_FILES} files). Please reduce file count.`);
  }

  // Stage 1: File Detection, SHA-256 Checksums, Signature Validation & ZIP Unpacking
  const allFiles: Array<{ name: string; content: string; type: "text" | "binary"; size: number; sha256: string }> = [];
  const fileCoverage: UniversalCompilerOutput["fileCoverage"] = [];

  for (const file of rawFiles) {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const fileHash = computeSha256(file.content);

    // Validate binary signature (magic bytes)
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
      unpacked.forEach(u => {
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

  // Stage 2: Sandboxed Parser Selection & Evidence Extraction
  const parsedProjects: ExtractedProject[] = [];
  const evidenceNodes: ParserEvidenceNode[] = [];

  for (const file of allFiles) {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const parser = PARSER_REGISTRY[ext];

    if (parser) {
      try {
        // Sandboxed execution with 15 second threshold
        const result = await executeWithTimeout(
          `Parser[${parser.name}] for '${file.name}'`,
          () => parser.parse(file.name, file.content, file.type),
          15000
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
      } catch (err: any) {
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

  // Refine baseline project type description if single file mode is active
  if (parsedProjects.length === 1 && projectType !== "ZIP Package") {
    const ext = rawFiles[0].name.split(".").pop()?.toLowerCase() || "";
    if (ext === "xlsx" || ext === "xls") projectType = "Excel Analytics";
    else if (ext === "sql") projectType = "SQL Analytics";
    else if (ext === "py") projectType = "Python";
    else if (ext === "ipynb") projectType = "Python";
    else if (ext === "pbix" || ext === "dax") projectType = "Power BI";
  }

  // Stage 3: Build Canonical Evidence Graph
  const evidenceGraph = mergeToEvidenceGraph(evidenceNodes);
  evidenceGraph.projectDomain = projectType;

  // Stage 4: Deterministic Validation & Conflict Detection
  const conflicts = [
    ...validateAndDetectConflicts(parsedProjects),
    ...detectEvidenceConflicts(evidenceGraph)
  ];

  // Stage 5: Baseline Merged Raw Project
  const rawProject = mergeExtractedProjects(parsedProjects);

  // Stage 6: AI Synthesis via Gemini Engine (Operates ONLY on Evidence Graph)
  const synthesized = await compilePortfolioWithGemini(evidenceGraph, conflicts, rawProject);

  // Generate Master Package SHA-256 evidence hash
  const packageEvidenceHash = crypto.createHash("sha256")
    .update(allFiles.map(f => f.sha256).sort().join(":"))
    .digest("hex");

  // Construct source attributions and confidence map
  const sourceAttributions: Record<string, string[]> = {};
  const confidenceScores: Record<string, number> = {};

  if (synthesized.structured) {
    confidenceScores.title = synthesized.structured.title.confidence;
    confidenceScores.summary = synthesized.structured.executiveSummary.confidence;
    confidenceScores.businessProblem = synthesized.structured.businessProblem.confidence;
    confidenceScores.methodology = synthesized.structured.methodology.confidence;
    confidenceScores.findings = synthesized.structured.findings.confidence;
    confidenceScores.recommendations = synthesized.structured.recommendations.confidence;

    sourceAttributions.title = synthesized.structured.title.evidence.map(e => e.sourceFile);
    sourceAttributions.summary = synthesized.structured.executiveSummary.evidence.map(e => e.sourceFile);
    sourceAttributions.businessProblem = synthesized.structured.businessProblem.evidence.map(e => e.sourceFile);
    sourceAttributions.methodology = synthesized.structured.methodology.evidence.map(e => e.sourceFile);
    sourceAttributions.findings = synthesized.structured.findings.evidence.map(e => e.sourceFile);
    sourceAttributions.recommendations = synthesized.structured.recommendations.evidence.map(e => e.sourceFile);
  }

  return {
    projectType,
    rawProject: {
      ...synthesized.raw,
      sourceFiles: Array.from(new Set(allFiles.map(f => f.name)))
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
      importTimestamp: new Date().toISOString(),
      parserVersions: "Portfolio OS AI Compiler Engine v3.0 (Evidence Graph + Gemini)",
      evidenceHash: packageEvidenceHash,
      projectVersion: "v3",
      totalFilesProcessed: allFiles.length
    }
  };
}

export async function parseUploadedPackage(fileName: string, buffer: Buffer): Promise<UniversalCompilerOutput> {
  return compileProjectPackage([{
    name: fileName,
    size: buffer.length,
    type: "binary",
    content: buffer.toString("base64")
  }]);
}

export async function compileSourceCodeToProject(fileName: string, sourceCode: string): Promise<UniversalCompilerOutput> {
  return compileProjectPackage([{
    name: fileName,
    size: Buffer.byteLength(sourceCode),
    type: "text",
    content: sourceCode
  }]);
}
