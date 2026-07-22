/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EvidenceGraph,
  EvidenceCoverageReport,
  MissingInformationItem,
  ConflictRecord
} from "../types/index";

/**
 * Task: Evidence Completeness Evaluator
 * Evaluates canonical evidence graph nodes to compute deterministic coverage scores (0 - 100)
 * for all 9 core portfolio dimensions.
 */
export function evaluateEvidenceCompleteness(
  graph: EvidenceGraph,
  userAnswers?: Record<string, string>
): EvidenceCoverageReport {
  const hasUserAns = (key: string): boolean => {
    if (!userAnswers) return false;
    const lowerKey = key.toLowerCase();
    return Object.keys(userAnswers).some(
      k => k.toLowerCase().includes(lowerKey) && userAnswers[k]?.trim().length > 0
    );
  };

  // 1. KPIs Coverage (Metrics, calculated SQL logic, DAX measures)
  const totalMetrics =
    graph.metrics.length +
    graph.kpis.length +
    graph.detectedKPIs.length +
    graph.sqlLogic.flatMap(s => s.value.aggregations).length;
  let kpisScore = 15;
  if (totalMetrics >= 3) kpisScore = 100;
  else if (totalMetrics === 2) kpisScore = 85;
  else if (totalMetrics === 1) kpisScore = 65;
  if (hasUserAns("kpi") || hasUserAns("metric")) kpisScore = Math.min(100, kpisScore + 30);

  // 2. Methodology Coverage (SQL joins, analytical techniques, doc methodology)
  const techCount = graph.analyticalTechniques.length + graph.methodology.length + graph.sqlLogic.length;
  let methodologyScore = 30;
  if (techCount >= 3) methodologyScore = 95;
  else if (techCount >= 1) methodologyScore = 80;
  if (hasUserAns("methodology") || hasUserAns("tech")) methodologyScore = Math.min(100, methodologyScore + 20);

  // 3. Executive Summary Coverage
  const sourceCount = graph.evidenceSources.length;
  let execScore = 40;
  if (sourceCount >= 3) execScore = 95;
  else if (sourceCount === 2) execScore = 80;
  else if (sourceCount === 1) execScore = 60;
  if (graph.documentation.length > 0) execScore = Math.min(100, execScore + 15);
  if (hasUserAns("summary") || hasUserAns("context")) execScore = Math.min(100, execScore + 25);

  // 4. Business Objective Coverage
  const objectiveDocs = graph.documentation.filter(
    d => d.value.key.toLowerCase().includes("objective") || d.value.key.toLowerCase().includes("goal")
  );
  let objectiveScore = 20;
  if (objectiveDocs.length > 0 || graph.businessQuestions.length > 0) {
    objectiveScore = 90;
  } else if (graph.projectDomain && graph.projectDomain !== "Mixed Analytics") {
    objectiveScore = 45;
  }
  if (hasUserAns("objective") || hasUserAns("goal")) objectiveScore = 90;

  // 5. Business Problem Coverage
  const problemDocs = graph.documentation.filter(
    d => d.value.key.toLowerCase().includes("problem") || d.value.key.toLowerCase().includes("challenge")
  );
  let problemScore = 25;
  if (problemDocs.length > 0) problemScore = 90;
  else if (graph.businessQuestions.length > 0) problemScore = 75;
  if (hasUserAns("problem") || hasUserAns("challenge")) problemScore = 90;

  // 6. Stakeholders Coverage
  let stakeholdersScore = 15;
  if (graph.stakeholderIndicators.length > 0) stakeholdersScore = 90;
  if (hasUserAns("stakeholder") || hasUserAns("audience")) stakeholdersScore = 90;

  // 7. Recommendations Coverage
  let recommendationsScore = 10;
  if (graph.recommendations.length > 0) recommendationsScore = 95;
  if (hasUserAns("recommendation") || hasUserAns("next steps")) recommendationsScore = 90;

  // 8. Business Impact Coverage
  const impactMetrics = graph.detectedKPIs.filter(k => k.value.actual || k.value.target);
  let impactScore = 10;
  if (impactMetrics.length > 0 || graph.documentation.some(d => d.value.key.toLowerCase().includes("impact"))) {
    impactScore = 85;
  }
  if (hasUserAns("impact") || hasUserAns("outcome")) impactScore = 90;

  // 9. Interview STAR Story Coverage
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

/**
 * Task: Missing Information Engine
 * Identifies sections with coverage < 80 and generates up to 5 targeted questions.
 * Never requests information already supported by evidence.
 */
export function generateMissingInformationRequests(
  report: EvidenceCoverageReport,
  graph: EvidenceGraph
): MissingInformationItem[] {
  const requests: MissingInformationItem[] = [];

  if (report.businessObjective < 80) {
    requests.push({
      field: "Business Objective",
      reason: "No explicit business objective or analytical goal was detected in parsed source files.",
      question: "What primary business objective or strategic question was this analysis trying to solve?",
      type: "textarea"
    });
  }

  if (report.stakeholders < 80) {
    requests.push({
      field: "Stakeholders",
      reason: "Target audience or key decision-maker roles were not identified in evidence.",
      question: "Who were the key business stakeholders or executive leaders receiving this report?",
      type: "text"
    });
  }

  if (report.businessImpact < 80) {
    requests.push({
      field: "Business Impact",
      reason: "Quantified business outcomes or operational improvements were missing from parsed assets.",
      question: "What quantifiable business impact, cost savings, or efficiency gains were achieved?",
      type: "textarea"
    });
  }

  if (report.recommendations < 80) {
    requests.push({
      field: "Strategic Recommendations",
      reason: "Strategic action items or executive recommendations were not explicitly stated in source code.",
      question: "What top strategic recommendations or next steps should decision-makers take based on this data?",
      type: "textarea"
    });
  }

  if (report.businessProblem < 80) {
    requests.push({
      field: "Business Problem",
      reason: "Root operational bottleneck or business challenge missing from dataset.",
      question: "What specific operational bottleneck or business challenge prompted this analytical investigation?",
      type: "textarea"
    });
  }

  // Enforce quota: Never ask more than 5 questions
  return requests.slice(0, 5);
}

/**
 * Task: Second Pass & Conflict Resolution
 * Merges user answers into the synthesis context.
 * Enforces absolute priority of Evidence Graph over User Answers.
 * Flags any user answer that contradicts established evidence graph facts.
 */
export function mergeUserAnswersWithEvidence(
  graph: EvidenceGraph,
  userAnswers?: Record<string, string>
): { mergedAnswersContext: string; answerConflicts: ConflictRecord[] } {
  const answerConflicts: ConflictRecord[] = [];
  if (!userAnswers || Object.keys(userAnswers).length === 0) {
    return { mergedAnswersContext: "", answerConflicts };
  }

  const validAnswers: Array<{ field: string; answer: string }> = [];

  for (const [key, rawVal] of Object.entries(userAnswers)) {
    const val = rawVal?.trim();
    if (!val) continue;

    // Check conflict against Evidence Graph metrics
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

  const contextLines = validAnswers.map(a => `- **${a.field}**: ${a.answer}`).join("\n");
  const mergedAnswersContext = `\n### USER-SUPPLIED SUPPLEMENTAL CONTEXT (LEVEL 3 INTEL):\n${contextLines}\n`;

  return { mergedAnswersContext, answerConflicts };
}
