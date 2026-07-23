/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PARSER_REGISTRY, unpackZipFile } from "../parsers/registry";
import {
  ExtractedProject,
  ConflictRecord,
  UniversalCompilerOutput,
  ParserEvidenceNode,
  PipelineError
} from "../types/index";
import { validateFileSignature, computeSha256, executeWithTimeout, getAdaptiveParserTimeout, createStepLogger } from "../utils/security";
import { mergeToEvidenceGraph, detectEvidenceConflicts } from "../evidence/graph";
import { compilePortfolioWithGemini, formatDebugAiContext } from "../ai/portfolioCompiler";
import {
  evaluateEvidenceCompleteness,
  generateMissingInformationRequests,
  mergeUserAnswersWithEvidence,
  classifyProjectArchetype,
  runRecruiterAuditEngine
} from "../ai/evidenceEvaluator";
import { getCachedOrSynthesizeUnderstanding } from "../ai/projectUnderstandingEngine";
import { ProjectUnderstanding } from "../types/index";
import crypto from "crypto";
import { PipelineProfiler } from "../utils/pipelineProfiler";

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

  // Compare KPIs & Metrics (by similarity of labels across evidence sources)
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
          field: `Metric Discrepancy (${group[0].label})`,
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
  rawFiles: Array<{ name: string; size: number; type: string; content: string | Buffer; storagePath?: string }>,
  userAnswers?: Record<string, string>,
  forceCompile?: boolean,
  existingUnderstanding?: ProjectUnderstanding,
  profiler?: PipelineProfiler
): Promise<UniversalCompilerOutput> {
  const logger = createStepLogger("Compiler Pipeline");
  const pipelineStep = logger.start("Full compileProjectPackage Execution");

  const firstRaw = Array.isArray(rawFiles) && rawFiles[0] ? rawFiles[0] : null;

  console.log(`\n----------------------------------------------------------`);
  console.log(`[STAGE 8: compileProjectPackage Input]`);
  console.log(`typeof rawFiles: "${typeof rawFiles}"`);
  console.log(`Array.isArray(rawFiles): ${Array.isArray(rawFiles)}`);
  console.log(`Object.keys(rawFiles): [${rawFiles ? Object.keys(rawFiles).join(", ") : ""}]`);
  console.log(`Object.keys(firstFile): [${firstRaw ? Object.keys(firstRaw).join(", ") : ""}]`);
  console.log(`RAW FILE DESCRIPTOR:\n${JSON.stringify(firstRaw ? { name: firstRaw.name, size: firstRaw.size, type: firstRaw.type, storagePath: firstRaw.storagePath, contentLength: firstRaw.content ? (typeof firstRaw.content === "string" ? firstRaw.content.length : firstRaw.content.length) : 0 } : null, null, 2)}`);
  console.log(`----------------------------------------------------------\n`);

  const pipelineStartTime = Date.now();
  let projectType = "Mixed Analytics";

  // Quotas
  const MAX_RAW_FILES = 50;
  if (rawFiles.length > MAX_RAW_FILES) {
    throw new Error(`Package exceeds maximum file limit (${MAX_RAW_FILES} files). Please reduce file count.`);
  }

  // Stage 1: File Detection, SHA-256 Checksums, Signature Validation & ZIP Unpacking
  const s1 = logger.start("Stage 1: File Detection, Signature Validation & ZIP Unpacking");
  console.log("[Pipeline] Stage 1 Start: File Detection, Signature Validation & ZIP Unpacking");
  console.log("[CHECKPOINT S1-001] Stage 1 Start Logging Completed");
  const stage1Start = Date.now();
  console.log("[CHECKPOINT S1-002] stage1Start Timestamp Captured");
  const allFiles: Array<{ name: string; content: string | Buffer; type: "text" | "binary"; size: number; sha256: string }> = [];
  console.log("[CHECKPOINT S1-003] allFiles Array Initialized");
  const fileCoverage: UniversalCompilerOutput["fileCoverage"] = [];
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
      let fileHash: string;
      try {
        console.log(`[CHECKPOINT S1-010A] computeSha256: typeof file.content = "${typeof file.content}" | Buffer.isBuffer = ${Buffer.isBuffer(file.content)} | length = ${typeof file.content === "string" ? file.content.length : (file.content as Buffer).length}`);
        const sha256Buf = typeof file.content === "string"
          ? (console.log(`[CHECKPOINT S1-010B] computeSha256: calling Buffer.from(content, "base64") — string length: ${(file.content as string).length}`), Buffer.from(file.content as string, "base64"))
          : (console.log(`[CHECKPOINT S1-010B] computeSha256: content is already a Buffer — byteLength: ${(file.content as Buffer).byteLength}`), file.content as Buffer);
        console.log(`[CHECKPOINT S1-010C] computeSha256: Buffer.from/passthrough complete — sha256Buf.length: ${sha256Buf.length}`);
        const sha256Hash = crypto.createHash("sha256");
        console.log(`[CHECKPOINT S1-010D] computeSha256: crypto.createHash("sha256") created`);
        sha256Hash.update(sha256Buf);
        console.log(`[CHECKPOINT S1-010E] computeSha256: hash.update(buffer) complete`);
        fileHash = sha256Hash.digest("hex");
        console.log(`[CHECKPOINT S1-010F] computeSha256: hash.digest("hex") complete — hash prefix: ${fileHash.slice(0, 12)}`);
      } catch (sha256Err: any) {
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
        unpacked.forEach(u => {
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
  } catch (stage1Err: any) {
    console.error(`[CHECKPOINT S1-ERROR] Stage 1 Exception in file '${currentFileProcessing}':`, stage1Err?.message);
    throw stage1Err;
  }

  console.log(`[CHECKPOINT S1-025] Finishing Stage 1 logging & metrics`);

  const stage1Duration = Date.now() - stage1Start;
  s1.end(`${allFiles.length} file(s) prepared`);
  console.log(`[Pipeline] Stage 1 Complete (${stage1Duration}ms)`);

  console.log(`----------------------------------------\n[TRACE]\nLine: 244\nFunction: compileProjectPackage\nEntering: logger.start("Stage 2: Sandboxed Parser Selection & Evidence Extraction")`);
  const t244Start = Date.now();
  const s2 = logger.start("Stage 2: Sandboxed Parser Selection & Evidence Extraction");
  console.log(`Completed: logger.start\nDuration: ${Date.now() - t244Start}ms\n----------------------------------------`);

  console.log(`----------------------------------------\n[TRACE]\nLine: 245\nFunction: compileProjectPackage\nEntering: console.log Stage 2 Start`);
  console.log("[Pipeline] Stage 2 Start: Sandboxed Parser Selection & Evidence Extraction");
  console.log(`Completed: console.log Stage 2 Start\n----------------------------------------`);

  console.log(`----------------------------------------\n[TRACE]\nLine: 246-248\nFunction: compileProjectPackage\nEntering: Initializing parsedProjects & evidenceNodes arrays`);
  const stage2Start = Date.now();
  const parsedProjects: ExtractedProject[] = [];
  const evidenceNodes: ParserEvidenceNode[] = [];
  console.log(`Completed: Array initializations | allFiles.length = ${allFiles.length}\n----------------------------------------`);

  console.log(`\n==========================================================`);
  console.log(`[STAGE 2 FILE INVENTORY: allFiles Array Inspection]`);
  console.log(`TotalPreparedFiles: ${allFiles.length}`);
  allFiles.forEach((f, idx) => {
    const ext = f.name.split(".").pop()?.toLowerCase() || "";
    console.log(`  Index: ${idx} | Name: "${f.name}" | Ext: ".${ext}" | Type: ${f.type} | Size: ${f.size} bytes (${(f.size / (1024 * 1024)).toFixed(2)} MB) | SHA256: ${f.sha256.slice(0, 12)}...`);
  });
  console.log(`==========================================================\n`);

  let fileIndex = 0;
  for (const file of allFiles) {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const parser = PARSER_REGISTRY[ext];

    console.log(`\n================================================`);
    console.log(`FILE INDEX: ${fileIndex}`);
    console.log(`FILE NAME: ${file.name}`);
    console.log(`EXTENSION: .${ext}`);
    console.log(`SELECTED PARSER: ${parser ? parser.name : "NONE"}`);
    console.log(`================================================\n`);

    console.log(`----------------------------------------\n[TRACE]\nFile: ${file.name}\nIteration: ${fileIndex}\nLine: 265\nFunction: compileProjectPackage\nEntering: Parser resolution check\nCompleted: ext=.${ext}, parser=${parser ? parser.name : "NONE"}\n----------------------------------------`);

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

        console.log(`----------------------------------------\n[TRACE]\nFile: ${file.name}\nIteration: ${fileIndex}\nLine: 287\nFunction: compileProjectPackage\nEntering: executeWithTimeout & parser.parse()\n----------------------------------------`);

        const memBefore = process.memoryUsage();
        console.log(`\n--- BEGIN parser.parse() ---`);
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
        console.log(`Elapsed Time: ${parseElapsed} ms\n`);

        console.log(`----------------------------------------\n[TRACE]\nFile: ${file.name}\nIteration: ${fileIndex}\nLine: 292-299\nFunction: compileProjectPackage\nEntering: Pushing results to parsedProjects & evidenceNodes arrays`);
        parsedProjects.push(result.project);
        evidenceNodes.push(result.evidenceNode);
        parserFileStep.end(JSON.stringify(result.evidenceNode).length);

        if (profiler) {
          profiler.recordAllocation(`EvidenceNode [${file.name}]`, JSON.stringify(result.evidenceNode).length);
          profiler.profileStageEnd(st!, `${JSON.stringify(result.evidenceNode).length} bytes`);
        }

        console.log(`Completed: Pushed results for '${file.name}' | Total Parsed: ${parsedProjects.length}\nDuration: ${Date.now() - pStart}ms\n----------------------------------------`);

        fileCoverage.push({
          fileName: file.name,
          status: "Used",
          reason: `Parsed via specialized Vercel-native ${parser.name} in ${Date.now() - pStart}ms. SHA-256 verified.`,
          size: file.size,
          sha256: file.sha256
        });

        // Release duplicate Base64 payload from memory after evidence node extraction
        file.content = "";
      } catch (err: any) {
        console.error(`\n[PARSER EXCEPTION THROWN]`);
        console.error(`Source File: src/api/_lib/compiler/index.ts`);
        console.error(`Line Number: ~290`);
        console.error(`Iteration Number: ${fileIndex}`);
        console.error(`File Name: ${file.name}`);
        console.error(`Parser Name: ${parser.name}`);
        console.error(`Error Message: ${err.message}`);
        console.error(`Stack Trace:\n${err.stack}\n`);

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
  const stage2Duration = Date.now() - stage2Start;
  s2.end(`${evidenceNodes.length} evidence node(s) extracted`);
  console.log(`[Pipeline] Stage 2 Complete (${stage2Duration}ms)`);

  if (parsedProjects.length === 1 && projectType !== "ZIP Package") {
    const ext = rawFiles[0].name.split(".").pop()?.toLowerCase() || "";
    if (ext === "xlsx" || ext === "xls") projectType = "Excel Analytics";
    else if (ext === "sql") projectType = "SQL Analytics";
    else if (ext === "py") projectType = "Python";
    else if (ext === "ipynb") projectType = "Python";
    else if (ext === "pbix" || ext === "dax") projectType = "Power BI";
  }

  // Stage 3: Build Canonical Evidence Graph
  const st8 = profiler ? profiler.profileStageStart(8, "Evidence Graph generation", `${evidenceNodes.length} nodes`) : null;
  const s3 = logger.start("Stage 3: Building Canonical Evidence Graph");
  console.log("[Pipeline] Stage 3 Start: Building Canonical Evidence Graph");
  const stage3Start = Date.now();
  let evidenceGraph: any;
  try {
    evidenceGraph = mergeToEvidenceGraph(evidenceNodes);
    evidenceGraph.projectDomain = projectType;
  } catch (err: any) {
    if (profiler && st8) profiler.profileStageEnd(st8, "0 bytes", "FAILED", err.message);
    throw new PipelineError("Evidence Graph", `Failed to construct evidence graph: ${err.message}`, err.name || "EvidenceGraphError", err);
  }
  const stage3Duration = Date.now() - stage3Start;
  s3.end(JSON.stringify(evidenceGraph).length);
  if (profiler && st8) {
    profiler.recordAllocation("Evidence Graph Object", JSON.stringify(evidenceGraph).length);
    profiler.profileStageEnd(st8, `${JSON.stringify(evidenceGraph).length} bytes`);
  }
  console.log(`[Pipeline] Stage 3 Complete (${stage3Duration}ms)`);

  // Stage 4: Project Understanding Engine
  const st9 = profiler ? profiler.profileStageStart(9, "Project Understanding Engine", "Evidence Graph") : null;
  const s4 = logger.start("Stage 4: Project Understanding Engine (PUE)");
  console.log("[Pipeline] Stage 4 Start: Project Understanding Engine (PUE)");
  const stage4Start = Date.now();
  const packageEvidenceHash = crypto.createHash("sha256")
    .update(allFiles.map(f => f.sha256).sort().join(":"))
    .digest("hex");

  const projectUnderstanding = await executeWithTimeout(
    "Project Understanding Engine (PUE)",
    () => getCachedOrSynthesizeUnderstanding(evidenceGraph, packageEvidenceHash, existingUnderstanding),
    28000 // Raised from 15000ms: live profiler measured gemini-3.5-flash takes >12,000ms (inner timer fires),
          // then gemini-2.5-flash takes 9,674ms → total 21,692ms needed. 28,000ms = 12s+12s+4s safety margin.
  );
  const stage4Duration = Date.now() - stage4Start;
  s4.end(JSON.stringify(projectUnderstanding).length);
  if (profiler && st9) {
    profiler.recordAllocation("Project Understanding Object", JSON.stringify(projectUnderstanding).length);
    profiler.profileStageEnd(st9, `${JSON.stringify(projectUnderstanding).length} bytes`);
  }
  console.log(`[Pipeline] Stage 4 Complete (${stage4Duration}ms)`);

  // Stage 10: Evidence Intelligence
  const st10 = profiler ? profiler.profileStageStart(10, "Evidence Intelligence", "PUE Object") : null;
  const projectArchetype = projectUnderstanding.projectArchetype || classifyProjectArchetype(evidenceGraph);
  if (profiler && st10) profiler.profileStageEnd(st10, `Archetype: ${projectArchetype}`);

  // Stage 11: Completeness Engine
  const st11 = profiler ? profiler.profileStageStart(11, "Completeness Engine", "Evidence Graph & PUE") : null;
  const s5 = logger.start("Stage 5: Completeness Evaluator & Conflict Detection");
  console.log("[Pipeline] Stage 5 Start: Completeness Evaluator & Conflict Detection");
  const stage5Start = Date.now();
  const coverageReport = evaluateEvidenceCompleteness(evidenceGraph, userAnswers, projectUnderstanding);
  const { mergedAnswersContext, answerConflicts } = mergeUserAnswersWithEvidence(evidenceGraph, userAnswers);
  if (profiler && st11) profiler.profileStageEnd(st11, "Coverage Evaluated");

  // Stage 12: Conflict Resolution
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

  // Stage 6: Decision Logic: Evaluate Completeness Thresholds
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
  const isFullySufficient = requiredScores.every(score => score >= 80);
  const stage6Duration = Date.now() - stage6Start;
  s6.end(`Fully Sufficient: ${isFullySufficient}`);
  console.log(`[Pipeline] Stage 6 Complete (${stage6Duration}ms)`);

  const stageTimings = [
    { stage: "Stage 1 (File Prep & Unpack)", durationMs: stage1Duration, status: "Completed" as const },
    { stage: "Stage 2 (Sandboxed Parsers)", durationMs: stage2Duration, status: "Completed" as const },
    { stage: "Stage 3 (Evidence Graph)", durationMs: stage3Duration, status: "Completed" as const },
    { stage: "Stage 4 (Project Understanding)", durationMs: stage4Duration, status: "Completed" as const },
    { stage: "Stage 5 (Completeness & Conflicts)", durationMs: stage5Duration, status: "Completed" as const },
    { stage: "Stage 6 (Decision Logic)", durationMs: stage6Duration, status: "Completed" as const }
  ];

  if (!forceCompile && (!userAnswers || Object.keys(userAnswers).length === 0) && !isFullySufficient) {
    const missingInformation = generateMissingInformationRequests(coverageReport, evidenceGraph, projectUnderstanding);
    if (missingInformation.length > 0) {
      const rawProject = mergeExtractedProjects(parsedProjects);
      console.log(`[Timing Profile] Total Pipeline Duration (NEEDS_USER_INPUT): ${Date.now() - pipelineStartTime}ms`);
      pipelineStep.end("Terminated with NEEDS_USER_INPUT");
      return {
        status: "NEEDS_USER_INPUT",
        projectType,
        projectArchetype,
        projectUnderstanding,
        rawProject: {
          ...rawProject,
          sourceFiles: Array.from(new Set(allFiles.map(f => f.name)))
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

  // Stage 13: Portfolio Compiler (Gemini)
  const st13 = profiler ? profiler.profileStageStart(13, "Portfolio Compiler (Gemini)", "Evidence Graph & Merged Context") : null;
  const s7 = logger.start("Stage 7: Baseline Merged Raw Project Assembly");
  console.log("[Pipeline] Stage 7 Start: Baseline Merged Raw Project Assembly");
  const stage7Start = Date.now();
  const rawProject = mergeExtractedProjects(parsedProjects);
  const stage7Duration = Date.now() - stage7Start;
  s7.end(JSON.stringify(rawProject).length);
  console.log(`[Pipeline] Stage 7 Complete (${stage7Duration}ms)`);
  stageTimings.push({ stage: "Stage 7 (Baseline Raw Project)", durationMs: stage7Duration, status: "Completed" as const });

  // Stage 8: AI Portfolio Compiler Synthesis
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
    40000 // Raised from 15000ms: compilePortfolioWithGemini has 15,000ms inner timeouts per model (×3 models)
          // plus a 15,000ms review pass — the outer 15,000ms always fired before any model could respond.
          // 40,000ms = ~15s primary Gemini call + ~15s review pass + 10s margin.
  );
  const stage8Duration = Date.now() - stage8Start;
  s8.end(JSON.stringify(synthesized.structured).length);
  if (profiler && st13) {
    profiler.recordAllocation("Gemini Portfolio Output", JSON.stringify(synthesized.structured).length);
    profiler.profileStageEnd(st13, `${JSON.stringify(synthesized.structured).length} bytes`);
  }
  console.log(`[Pipeline] Stage 8 Complete (${stage8Duration}ms)`);
  stageTimings.push({ stage: "Stage 8 (Gemini Synthesis)", durationMs: stage8Duration, status: "Completed" as const });

  // Stage 14: Recruiter Audit
  const st14 = profiler ? profiler.profileStageStart(14, "Recruiter Audit", "Synthesized Project") : null;
  console.log("[Pipeline] Stage 9 Start: Recruiter Audit Engine Evaluation");
  const stage9Start = Date.now();
  const recruiterAudit = runRecruiterAuditEngine(synthesized.structured, evidenceGraph, conflicts, projectUnderstanding);
  const stage9Duration = Date.now() - stage9Start;
  if (profiler && st14) profiler.profileStageEnd(st14, `Overall Score: ${recruiterAudit.overallScore}`);
  console.log(`[Pipeline] Stage 9 Complete (${stage9Duration}ms)`);
  stageTimings.push({ stage: "Stage 9 (Recruiter Audit Engine)", durationMs: stage9Duration, status: "Completed" as const });

  const totalDuration = Date.now() - pipelineStartTime;
  console.log(`\n==========================================================`);
  console.log(`[PIPELINE TIMING PROFILE] Total Pipeline Execution: ${totalDuration}ms`);
  console.log(`==========================================================\n`);

  // packageEvidenceHash already computed at Stage 4 — reused here for auditMetadata.

  // Construct source attributions and confidence map
  const sourceAttributions: Record<string, string[]> = {};
  const confidenceScores: Record<string, number> = {};

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

    sourceAttributions.title = synthesized.structured.title.evidence.map(e => e.sourceFile);
    sourceAttributions.summary = synthesized.structured.executiveSummary.evidence.map(e => e.sourceFile);
    sourceAttributions.businessContext = synthesized.structured.businessContext.evidence.map(e => e.sourceFile);
    sourceAttributions.businessProblem = synthesized.structured.businessProblem.evidence.map(e => e.sourceFile);
    sourceAttributions.businessImpact = synthesized.structured.businessImpact.evidence.map(e => e.sourceFile);
    sourceAttributions.methodology = synthesized.structured.methodology.evidence.map(e => e.sourceFile);
    sourceAttributions.analyticalTechniques = synthesized.structured.analyticalTechniques.evidence.map(e => e.sourceFile);
    sourceAttributions.findings = synthesized.structured.findings.evidence.map(e => e.sourceFile);
    sourceAttributions.recommendations = synthesized.structured.recommendations.evidence.map(e => e.sourceFile);
  }

  return {
    status: "COMPLETE",
    projectType,
    projectArchetype,
    projectUnderstanding,
    rawProject: {
      ...synthesized.raw,
      sourceFiles: Array.from(new Set(allFiles.map(f => f.name)))
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
      importTimestamp: new Date().toISOString(),
      parserVersions: "Portfolio OS AI Intelligence Engine v4.1 (PUE-Cached + Evidence Intelligence + Recruiter Audit + Gemini)",
      evidenceHash: packageEvidenceHash,
      projectVersion: "v4.1",
      totalFilesProcessed: allFiles.length,
      debugAiContext: formatDebugAiContext(evidenceGraph, conflicts)
    },
    stageTimings
  };
}

export async function parseUploadedPackage(
  fileName: string,
  buffer: Buffer,
  userAnswers?: Record<string, string>,
  forceCompile?: boolean,
  existingUnderstanding?: ProjectUnderstanding
): Promise<UniversalCompilerOutput> {
  return compileProjectPackage(
    [{
      name: fileName,
      size: buffer.length,
      type: "binary",
      content: buffer.toString("base64")
    }],
    userAnswers,
    forceCompile,
    existingUnderstanding
  );
}

export async function compileSourceCodeToProject(
  fileName: string,
  sourceCode: string,
  userAnswers?: Record<string, string>,
  forceCompile?: boolean,
  existingUnderstanding?: ProjectUnderstanding
): Promise<UniversalCompilerOutput> {
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
