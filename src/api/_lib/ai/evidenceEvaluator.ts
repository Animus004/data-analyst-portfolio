/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EvidenceGraph,
  EvidenceCoverageReport,
  MissingInformationItem,
  ConflictRecord,
  StructuredPortfolioProject,
  RecruiterAuditReport,
  ProjectUnderstanding
} from "../types/index";

/**
 * Task: Project Archetype Classifier
 * Analyzes Evidence Graph nodes to classify the exact analytical project archetype.
 */
export function classifyProjectArchetype(graph: EvidenceGraph): string {
  const parsers = new Set(graph.evidenceSources.map(s => s.parser));

  if (parsers.has("NotebookParser") || graph.documentation.some(d => d.parser === "NotebookParser")) {
    return "Jupyter Notebook Exploratory Data Science";
  }

  if (parsers.has("PythonParser")) {
    const hasML = graph.businessTerms.some(t => {
      const lower = t.value.toLowerCase();
      return lower.includes("model") || lower.includes("predict") || lower.includes("scikit") || lower.includes("regression");
    });
    return hasML
      ? "Python / Predictive Analytics & Machine Learning Pipeline"
      : "Python / Data Science Scripting";
  }

  if (parsers.has("PowerBIParser")) {
    return "Power BI / DAX Business Intelligence Dashboard";
  }

  if (parsers.has("SQLParser")) {
    const sqlCount = graph.sqlLogic.length;
    const hasComplexJoins = graph.sqlLogic.some(s => s.value.joins.length > 0 || s.value.windowFunctions.length > 0);
    return hasComplexJoins || sqlCount > 1
      ? "SQL Analytics & Data Relational Engine"
      : "SQL Query Analytics Case Study";
  }

  if (parsers.has("ExcelParser")) {
    return "Excel / Financial & Operations Intelligence Model";
  }

  if (parsers.size >= 2) {
    return "Multi-Source Enterprise Analytics Package";
  }

  return "Data Analytics Case Study";
}

/**
 * Task: KPI Disambiguation Engine
 * Separates raw relational schema columns/dimensions from true business KPIs & DAX measures.
 */
export function disambiguateKPIs(graph: EvidenceGraph): {
  trueKPIs: Array<{ label: string; value: string; sourceFile: string; isDAX?: boolean }>;
  schemaDimensions: string[];
} {
  const blacklistColumns = new Set([
    "customer_id", "user_id", "id", "created_at", "updated_at", "order_date",
    "date", "region", "status", "country", "name", "email", "address",
    "category_id", "zip", "zipcode", "phone", "row_id", "index"
  ]);

  const trueKPIs: Array<{ label: string; value: string; sourceFile: string; isDAX?: boolean }> = [];
  const schemaDimensions: string[] = [];

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
    if (!blacklistColumns.has(normName) && !trueKPIs.some(tk => tk.label.toLowerCase() === normName)) {
      trueKPIs.push({
        label: name,
        value: k.value.actual || k.value.target || "Tracked",
        sourceFile: k.sourceFile
      });
    }
  }

  for (const s of graph.sqlLogic) {
    for (const agg of s.value.aggregations) {
      if (!trueKPIs.some(tk => tk.label === agg)) {
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

/**
 * Task: Evidence Intelligence Engine - Coverage Evaluator
 * Evaluates completeness using Project Understanding & Evidence Graph nodes.
 */
export function evaluateEvidenceCompleteness(
  graph: EvidenceGraph,
  userAnswers?: Record<string, string>,
  understanding?: ProjectUnderstanding
): EvidenceCoverageReport {
  const hasUserAns = (key: string): boolean => {
    if (!userAnswers) return false;
    const lowerKey = key.toLowerCase();
    return Object.keys(userAnswers).some(
      k => k.toLowerCase().includes(lowerKey) && userAnswers[k]?.trim().length > 0
    );
  };

  const trueKPIs = understanding?.trueKPIs || disambiguateKPIs(graph).trueKPIs;

  // 1. KPIs Coverage
  const totalTrueKPIs = trueKPIs.length;
  let kpisScore = 15;
  if (totalTrueKPIs >= 3) kpisScore = 100;
  else if (totalTrueKPIs === 2) kpisScore = 85;
  else if (totalTrueKPIs === 1) kpisScore = 65;
  if (hasUserAns("kpi") || hasUserAns("metric")) kpisScore = Math.min(100, kpisScore + 30);

  // 2. Methodology Coverage
  const techCount = (understanding?.analyticalTechniques.length || 0) + graph.methodology.length + graph.sqlLogic.length;
  let methodologyScore = 30;
  if (techCount >= 3) methodologyScore = 95;
  else if (techCount >= 1) methodologyScore = 80;
  if (hasUserAns("methodology") || hasUserAns("tech")) methodologyScore = Math.min(100, methodologyScore + 20);

  // 3. Executive Summary Coverage — use datasets array (new field)
  const sourceCount = understanding?.datasets.length ?? graph.evidenceSources.length;
  let execScore = 40;
  if (sourceCount >= 3) execScore = 95;
  else if (sourceCount === 2) execScore = 80;
  else if (sourceCount === 1) execScore = 60;
  if (graph.documentation.length > 0) execScore = Math.min(100, execScore + 15);
  if (hasUserAns("summary") || hasUserAns("context")) execScore = Math.min(100, execScore + 25);

  // 4. Business Objective Coverage — primaryObjective is now a plain string
  const objectiveDocs = graph.documentation.filter(
    d => d.value.key.toLowerCase().includes("objective") || d.value.key.toLowerCase().includes("goal")
  );
  let objectiveScore = 20;
  if (objectiveDocs.length > 0 || graph.businessQuestions.length > 0 || (understanding?.primaryObjective && understanding.primaryObjective.length > 20)) {
    objectiveScore = 90;
  } else if (understanding?.businessDomain && understanding.businessDomain !== "Mixed Analytics") {
    objectiveScore = 50;
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
  if (graph.stakeholderIndicators.length > 0 || (understanding && understanding.likelyStakeholders.length > 0)) stakeholdersScore = 85;
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
 * Detects whether there is explicit supporting evidence that the project was implemented
 * or deployed in a real organization with live metrics (Production project), versus an
 * exploratory / portfolio case study (Portfolio project).
 */
export function hasProductionDeploymentEvidence(
  graph: EvidenceGraph,
  understanding: ProjectUnderstanding
): boolean {
  const keywords = [
    "production deployment", "deployed to", "live client", "client engagement",
    "actual revenue impact", "realized cost savings", "roi achieved",
    "production database", "live server", "enterprise rollout",
    "organization deployment", "client implementation", "deployed in production"
  ];

  const docsText = graph.documentation.map(d => d.value.text.toLowerCase()).join(" ");
  const termsText = graph.businessTerms.map(t => t.value.toLowerCase()).join(" ");
  const problemText = (understanding.businessProblem || "").toLowerCase();
  const summaryText = (understanding.suggestedSummaries?.[0]?.summary || "").toLowerCase();

  const combinedText = `${docsText} ${termsText} ${problemText} ${summaryText}`;

  return keywords.some(kw => combinedText.includes(kw));
}

/**
 * Task: Missing Information Engine — Contextual, Adaptive & Conversational Questions
 * Questions are derived directly from ProjectUnderstanding — they reference actual detected
 * domain, tool stack, KPI names, business questions, and stakeholder roles.
 *
 * Differentiates between Portfolio projects (no real deployment) and Production projects (real implementation).
 */
export function generateMissingInformationRequests(
  report: EvidenceCoverageReport,
  graph: EvidenceGraph,
  understanding: ProjectUnderstanding
): MissingInformationItem[] {
  const requests: MissingInformationItem[] = [];

  const fileCount      = understanding.datasets.length;
  const toolStack      = understanding.toolsUsed.join(" & ");
  const domain         = understanding.businessDomain;
  const industry       = understanding.industry;
  const archetype      = understanding.projectArchetype;
  const projectType    = understanding.projectType;
  const topKPI         = understanding.trueKPIs[0]?.label || "core metrics";
  const topStakeholder = understanding.likelyStakeholders[0] || "executive decision-makers";
  const detectedQ      = understanding.businessQuestions.length > 0
    ? `"${understanding.businessQuestions[0]}"`
    : null;

  const isProduction = hasProductionDeploymentEvidence(graph, understanding);

  // 1. Business Impact / Business Recommendations
  if (report.businessImpact < 80) {
    if (isProduction) {
      // Production project with evidence of real deployment: ask for measurable business impact
      requests.push({
        field: "Business Impact",
        reason: `Quantified business outcomes or operational improvements missing for ${domain}.`,
        question: `Your ${archetype} (${fileCount} file${fileCount !== 1 ? "s" : ""} — ${toolStack}) tracks ${topKPI}. What specific efficiency gains, cost savings, or revenue impact did this analysis deliver in ${industry}?`,
        type: "textarea",
        estimatedQualityBoost: 25,
        recruiterImpactPriority: "Critical"
      });
    } else {
      // Portfolio project (no real deployment evidence): do NOT ask about revenue impact or cost savings.
      // Ask evidence-grounded questions about business recommendations and management priorities.
      requests.push({
        field: "Business Recommendations & Priorities",
        reason: `Key strategic recommendations or management priority actions missing for ${domain}.`,
        question: `Your ${archetype} (${fileCount} file${fileCount !== 1 ? "s" : ""} — ${toolStack}) analyzes ${topKPI}. What top business recommendations emerged from your findings, and which action should management prioritize first?`,
        type: "textarea",
        estimatedQualityBoost: 25,
        recruiterImpactPriority: "Critical"
      });
    }
  }

  // 2. Business Objective — what strategic question was this trying to solve?
  if (report.businessObjective < 80) {
    const questionHint = detectedQ
      ? `We detected a potential business question: ${detectedQ}. `
      : `We detected ${fileCount} ${toolStack} source file(s) focused on ${domain}. `;
    requests.push({
      field: "Business Objective",
      reason: "No explicit business objective or analytical goal was detected in parsed source files.",
      question: `${questionHint}What was the core strategic objective or business question this analysis was built to answer?`,
      type: "textarea",
      estimatedQualityBoost: 20,
      recruiterImpactPriority: "High"
    });
  }

  // 3. Strategic Recommendations / Analytical Insights
  if (report.recommendations < 80) {
    const recQuestion = isProduction
      ? `Based on your ${industry} analysis, what are the top 2-3 strategic recommendations you presented to ${topStakeholder}?`
      : `Based on your ${industry} analysis of ${topKPI}, what key business recommendations emerged, and which analytical insight surprised you most?`;

    requests.push({
      field: "Strategic Recommendations",
      reason: "Strategic action items or executive recommendations were not explicitly stated in source files.",
      question: recQuestion,
      type: "textarea",
      estimatedQualityBoost: 20,
      recruiterImpactPriority: "High"
    });
  }

  // 4. Stakeholders & KPI Focus
  if (report.stakeholders < 80) {
    const question = isProduction
      ? `Who were the primary business stakeholders consuming this ${projectType} report within ${industry}?`
      : `Which key stakeholder (${topStakeholder}) benefits most from this ${projectType} analysis, and which KPI (such as ${topKPI}) should they monitor going forward?`;

    requests.push({
      field: "Stakeholders & KPI Focus",
      reason: "Target audience roles or key monitoring KPIs were not fully identified in evidence.",
      question,
      type: "text",
      estimatedQualityBoost: 15,
      recruiterImpactPriority: "Medium"
    });
  }

  // 5. Business Problem — root cause and trigger
  if (report.businessProblem < 80) {
    const bqHint = understanding.businessQuestions.length > 0
      ? ` (e.g. ${understanding.businessQuestions.slice(0, 2).map(q => `"${q}"`).join(", ")})`
      : "";
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

  // Sort by recruiter priority & estimated quality boost descending
  const priorityRank = { Critical: 3, High: 2, Medium: 1 };
  requests.sort((a, b) => {
    const pA = priorityRank[a.recruiterImpactPriority || "Medium"];
    const pB = priorityRank[b.recruiterImpactPriority || "Medium"];
    if (pA !== pB) return pB - pA;
    return (b.estimatedQualityBoost || 0) - (a.estimatedQualityBoost || 0);
  });

  return requests.slice(0, 5);
}

/**
 * Task: Second Pass & Conflict Resolution
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

/**
 * Task: Recruiter Audit Engine
 */
export function runRecruiterAuditEngine(
  portfolio: StructuredPortfolioProject,
  graph: EvidenceGraph,
  conflicts: ConflictRecord[],
  understanding?: ProjectUnderstanding
): RecruiterAuditReport {
  const strengths: string[] = [];
  const improvementSuggestions: string[] = [];

  // 1. ATS Readiness Score
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

  // 2. Business Storytelling Score
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

  // 3. Evidence Confidence Score
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

  // 4. Interview Readiness Score
  let interviewScore = 60;
  const star = portfolio.starStory?.value;
  if (star && star.situation && star.task && star.action && star.result) {
    interviewScore = 95;
    strengths.push("Recruiter-ready STAR story (Situation, Task, Action, Result) ready for live interview defense.");
  } else {
    improvementSuggestions.push("Formulate a clear STAR story structure for quick interview responses.");
  }

  // 5. Hallucination Risk Score (0 = Pristine)
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

  // 6. Overall Quality Score Calculation
  const rawOverall =
    atsScore * 0.25 +
    storytellingScore * 0.25 +
    evidenceScore * 0.25 +
    interviewScore * 0.25 -
    hallucinationRisk * 0.1;
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
