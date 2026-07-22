/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import {
  EvidenceGraph,
  StructuredPortfolioProject,
  ConflictRecord,
  ExtractedProject
} from "../types/index";

let aiClient: any = null;

function getAiClient(): any {
  if (aiClient) return aiClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  aiClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
  return aiClient;
}

/**
 * /**
 * Calculates dynamic confidence score based on evidence coverage across source files.
 * - 1 source: ~60%
 * - 2 agreeing sources: ~85%
 * - 3+ agreeing sources: ~95%
 */
export function calculateEvidenceConfidence(evidenceSourcesCount: number, agreeingCount: number = 1): number {
  const effectiveCount = Math.max(evidenceSourcesCount, agreeingCount);
  if (effectiveCount >= 3) {
    return 95;
  }
  if (effectiveCount === 2) {
    return 85;
  }
  return 60;
}

/**
 * Infers professional project role from evidence graph nodes.
 */
function inferRoleFromEvidence(graph: EvidenceGraph): string {
  if (graph.dashboards.length > 0 || graph.charts.some(c => c.parser === "PowerBIParser")) {
    return "BI Engineer";
  }
  if (graph.sqlLogic.length > 0) {
    return "Analytics Engineer";
  }
  if (graph.documentation.some(d => d.parser === "NotebookParser" || d.parser === "PythonParser")) {
    return "Data Scientist";
  }
  if (graph.metrics.some(m => m.parser === "ExcelParser")) {
    return "Financial Analyst";
  }
  return "Data Analyst";
}

/**
 * Synthesizes an evidence-derived project title when AI client is unavailable.
 */
function inferTitleFromEvidence(graph: EvidenceGraph): string {
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

/**
 * Builds a deterministic fallback StructuredPortfolioProject from EvidenceGraph
 * if Gemini API is unconfigured or synthesis fails.
 */
export function buildFallbackStructuredProject(
  graph: EvidenceGraph,
  rawBaseProject: ExtractedProject
): { structured: StructuredPortfolioProject; raw: ExtractedProject } {
  const sourceCount = graph.evidenceSources.length || 1;
  const confidence = calculateEvidenceConfidence(sourceCount);
  const primarySource = graph.evidenceSources[0]?.fileName || rawBaseProject.sourceFiles[0] || "Data Package";
  const defaultEvidence = graph.evidenceSources.length > 0 
    ? graph.evidenceSources.map(s => ({ sourceFile: s.fileName, parser: s.parser }))
    : [{ sourceFile: primarySource, parser: "DeterministicFallback" }];

  const synthesizedTitle = inferTitleFromEvidence(graph);
  const synthesizedRole = inferRoleFromEvidence(graph);
  const synthesizedSubtitle = `Quantitative analytics and executive decision support derived from ${sourceCount} evidence source${sourceCount > 1 ? "s" : ""}`;
  const synthesizedSummary = `This analysis evaluates transactional data structures and operational telemetry across parsed artifacts (${graph.evidenceSources.map(s => s.fileName).join(", ")}), delivering executive-level business intelligence and strategic growth recommendations.`;
  const synthesizedContext = `Operating within the ${graph.projectDomain || 'Analytics'} domain, key stakeholders require empirical visibility into performance metrics to drive resource allocation and operational optimization.`;
  const synthesizedProblem = `Strategic decision-makers lack consolidated visibility into underlying operational trends and KPI variances across source data files (${primarySource}).`;
  const synthesizedObjective = `Synthesize multi-source analytical evidence to evaluate performance trends, isolate operational bottlenecks, and formulate strategic business recommendations.`;
  const synthesizedImpact = `Enables executive stakeholders to streamline decision-making workflows, eliminate operational friction, and align tactical execution with high-level performance targets.`;
  const synthesizedMethodology = `1. Ingested raw analytical artifacts and normalized tabular schemas into a canonical evidence graph.\n2. Executed statistical queries, metric aggregations, and dimensional profiling.\n3. Verified data lineage and computed evidence confidence scores.`;
  const synthesizedFindings = graph.metrics.length > 0 
    ? `Empirical evaluation highlights ${graph.metrics.length} key performance indicator(s): ${graph.metrics.map(m => `${m.value.label} = ${m.value.value}`).join("; ")}.`
    : "Data structure profiling confirms consistent schema integrity across extracted tables and query logic.";
  const synthesizedRecommendations = "1. Consolidate key operational metrics into executive decision dashboards.\n2. Establish automated variance alerts to monitor performance thresholds against strategic benchmarks.";

  const extractedTechniques = graph.analyticalTechniques.map(t => t.value);
  const techStack = Array.from(new Set([...rawBaseProject.tags, ...graph.businessTerms.map(b => b.value).filter(v => v.startsWith("Tool:"))])).slice(0, 8);

  const structured: StructuredPortfolioProject = {
    title: {
      value: synthesizedTitle,
      confidence,
      evidence: defaultEvidence
    },
    subtitle: {
      value: synthesizedSubtitle,
      confidence,
      evidence: defaultEvidence
    },
    executiveSummary: {
      value: synthesizedSummary,
      confidence,
      evidence: defaultEvidence
    },
    businessContext: {
      value: synthesizedContext,
      confidence,
      evidence: defaultEvidence
    },
    businessProblem: {
      value: synthesizedProblem,
      confidence,
      evidence: defaultEvidence
    },
    businessObjective: {
      value: synthesizedObjective,
      confidence,
      evidence: defaultEvidence
    },
    businessImpact: {
      value: synthesizedImpact,
      confidence,
      evidence: defaultEvidence
    },
    stakeholders: {
      value: ["Executive Leadership", "Analytics Leads", "Operations Teams"],
      confidence,
      evidence: defaultEvidence
    },
    datasetDescription: {
      value: `Multi-source analytical dataset comprising ${graph.evidenceSources.length} source file(s) across database tables, metrics, and analytical scripts.`,
      confidence,
      evidence: defaultEvidence
    },
    methodology: {
      value: synthesizedMethodology,
      confidence,
      evidence: defaultEvidence
    },
    dataCleaning: {
      value: "Extracted data definitions, validated magic byte file signatures, and constructed a normalized evidence graph.",
      confidence,
      evidence: defaultEvidence
    },
    analysisProcess: {
      value: "1. Structured evidence graph nodes across relational schemas, scripts, and documentation.\n2. Verified metric lineage and calculated cross-source evidence alignment.\n3. Formulated recruiter-ready case study insights.",
      confidence,
      evidence: defaultEvidence
    },
    analyticalTechniques: {
      value: extractedTechniques.length > 0 ? extractedTechniques : ["Relational Query Modeling", "KPI Aggregation", "Dimensional Profiling"],
      confidence,
      evidence: defaultEvidence
    },
    industry: {
      value: graph.projectDomain || "Analytics & Business Intelligence",
      confidence,
      evidence: defaultEvidence
    },
    role: {
      value: synthesizedRole,
      confidence,
      evidence: defaultEvidence
    },
    duration: {
      value: "1 Week",
      confidence,
      evidence: defaultEvidence
    },
    findings: {
      value: synthesizedFindings,
      confidence,
      evidence: defaultEvidence
    },
    recommendations: {
      value: synthesizedRecommendations,
      confidence,
      evidence: defaultEvidence
    },
    challenges: {
      value: "Ensuring cross-source schema alignment and metric accuracy without parser default placeholders.",
      confidence,
      evidence: defaultEvidence
    },
    lessonsLearned: {
      value: "Maintained strict evidence graph lineage to guarantee presentation integrity and auditability.",
      confidence,
      evidence: defaultEvidence
    },
    technologyStack: {
      value: techStack.length > 0 ? techStack : ["SQL", "Excel", "Python", "Power BI"],
      confidence,
      evidence: defaultEvidence
    },
    skillsDemonstrated: {
      value: ["Executive Business Storytelling", "SQL Analytics", "KPI Modeling", "Data Visualization"],
      confidence,
      evidence: defaultEvidence
    },
    resumeBullets: {
      value: [
        `Engineered analytical data pipelines for ${primarySource}, improving KPI visibility and executive reporting speed.`,
        "Evaluated core business performance indicators and SQL query logic to drive strategic operational decisions.",
        "Built interactive analytics reporting artifacts and structured performance models."
      ],
      confidence,
      evidence: defaultEvidence
    },
    linkedInSummary: {
      value: `📊 Strategic Data Case Study: ${synthesizedTitle}\n\nEvaluated dataset insights across ${graph.evidenceSources.length} source file(s) to deliver executive decision support. Check out the metrics, methodology, and strategic impact!`,
      confidence,
      evidence: defaultEvidence
    },
    gitHubReadmeSummary: {
      value: `# ${synthesizedTitle}\n\n## Executive Summary\n${synthesizedSummary}\n\n## Key Metrics\n${graph.metrics.map(m => `- **${m.value.label}**: ${m.value.value}`).join("\n")}`,
      confidence,
      evidence: defaultEvidence
    },
    starStory: {
      value: {
        situation: `Addressed business intelligence requirements across source assets (${primarySource}).`,
        task: "Synthesize disparate raw data files into clear actionable business metrics.",
        action: "Extracted metrics, queries, and spreadsheet data into a canonical evidence graph.",
        result: "Delivered a structured analytics case study with full evidence lineage."
      },
      confidence,
      evidence: defaultEvidence
    },
    metrics: graph.metrics.map((m, idx) => ({
      id: `fallback-m-${idx}`,
      label: m.value.label,
      value: m.value.value,
      description: m.value.description || `Extracted metric from ${m.sourceFile}`,
      iconName: "Activity",
      confidence: calculateEvidenceConfidence(sourceCount),
      sourceFile: m.sourceFile,
      sourceLocation: m.location
    })),
    tags: rawBaseProject.tags.length > 0 ? rawBaseProject.tags : ["Analytics"],
    categories: rawBaseProject.categories.length > 0 ? rawBaseProject.categories : ["Data Analysis"]
  };

  const rawUpdated: ExtractedProject = {
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
    categories: structured.categories
  };

  return { structured, raw: rawUpdated };
}

/**
 * Task 8: Internal AI Quality Reviewer
 * Audits generated case study against hiring manager standards and refines weak narrative sections into McKinsey-caliber executive copy.
 */
async function reviewAndRefinePortfolio(
  structured: StructuredPortfolioProject,
  graph: EvidenceGraph
): Promise<StructuredPortfolioProject> {
  const ai = getAiClient();
  if (!ai) return structured;

  const reviewPrompt = `
You are a Senior Principal Data Analyst & Hiring Manager at a top-tier management consulting firm (McKinsey / BCG / Deloitte).
Your job is to audit and elevate the following Data Analyst portfolio case study payload.

### CANDIDATE CASE STUDY PAYLOAD:
${JSON.stringify({
  title: structured.title.value,
  subtitle: structured.subtitle.value,
  executiveSummary: structured.executiveSummary.value,
  businessContext: structured.businessContext.value,
  businessProblem: structured.businessProblem.value,
  businessObjective: structured.businessObjective.value,
  businessImpact: structured.businessImpact.value,
  findings: structured.findings.value,
  recommendations: structured.recommendations.value,
  resumeBullets: structured.resumeBullets.value,
  linkedInSummary: structured.linkedInSummary.value,
  starStory: structured.starStory.value
}, null, 2)}

### MANDATORY HIRING MANAGER EVALUATION & REFINEMENT CRITERIA:
1. **ELIMINATE GENERIC AI PHRASING**: Completely remove phrases like "This project aims to...", "The dashboard shows...", "In conclusion". Use active executive consulting prose ("This analysis evaluates...", "Empirical evidence reveals...", "Strategic diagnostic indicates...").
2. **BUSINESS THINKING & WHY IT MATTERS**: Ensure every finding explicitly explains *Why it matters* and *What strategic business decision it supports*.
3. **RESUME & INTERVIEW VALUE**: Bullet points must use high-impact action verbs ("Engineered", "Optimized", "Synthesized", "Quantified"), metrics, and clear analytical value.

Return refined executive JSON matching the specified schema properties.
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: reviewPrompt,
      config: {
        systemInstruction: "You are a Senior Data Analyst Hiring Manager auditor. Review candidate case studies, eliminate generic AI filler, and refine all narrative sections into McKinsey-caliber executive copy. Output clean JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            subtitle: { type: Type.STRING },
            executiveSummary: { type: Type.STRING },
            businessContext: { type: Type.STRING },
            businessProblem: { type: Type.STRING },
            businessObjective: { type: Type.STRING },
            businessImpact: { type: Type.STRING },
            findings: { type: Type.STRING },
            recommendations: { type: Type.STRING },
            resumeBullets: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            linkedInSummary: { type: Type.STRING },
            starStory: {
              type: Type.OBJECT,
              properties: {
                situation: { type: Type.STRING },
                task: { type: Type.STRING },
                action: { type: Type.STRING },
                result: { type: Type.STRING }
              }
            }
          }
        }
      }
    });

    const refined = JSON.parse(response.text.trim());
    if (refined.title) structured.title.value = refined.title;
    if (refined.subtitle) structured.subtitle.value = refined.subtitle;
    if (refined.executiveSummary) structured.executiveSummary.value = refined.executiveSummary;
    if (refined.businessContext) structured.businessContext.value = refined.businessContext;
    if (refined.businessProblem) structured.businessProblem.value = refined.businessProblem;
    if (refined.businessObjective) structured.businessObjective.value = refined.businessObjective;
    if (refined.businessImpact) structured.businessImpact.value = refined.businessImpact;
    if (refined.findings) structured.findings.value = refined.findings;
    if (refined.recommendations) structured.recommendations.value = refined.recommendations;
    if (refined.resumeBullets && Array.isArray(refined.resumeBullets) && refined.resumeBullets.length > 0) {
      structured.resumeBullets.value = refined.resumeBullets;
    }
    if (refined.linkedInSummary) structured.linkedInSummary.value = refined.linkedInSummary;
    if (refined.starStory && refined.starStory.situation) structured.starStory.value = refined.starStory;

    return structured;
  } catch (err: any) {
    console.warn("[portfolioCompiler] Internal AI quality review pass bypassed:", err.message);
    return structured;
  }
}

/**
 * Formats full AI Context payload for debug inspection.
 */
export function formatDebugAiContext(graph: EvidenceGraph, conflicts: ConflictRecord[]) {
  const excelAnalysis = graph.evidenceSources.filter(s => s.parser === "ExcelParser");
  const sqlAnalysis = graph.evidenceSources.filter(s => s.parser === "SQLParser");
  const powerbiAnalysis = graph.evidenceSources.filter(s => s.parser === "PowerBIParser");
  const imageAnalysis = graph.evidenceSources.filter(s => s.parser === "ImageParser");
  const readmeAnalysis = graph.evidenceSources.filter(s => s.parser === "MarkdownParser" || s.parser === "GitHubParser");
  const pdfAnalysis = graph.evidenceSources.filter(s => s.parser === "PDFParser");
  const wordAnalysis = graph.evidenceSources.filter(s => s.parser === "WordParser");

  return {
    timestamp: new Date().toISOString(),
    evidenceGraphSummary: {
      totalSourcesProcessed: graph.evidenceSources.length,
      evidenceSources: graph.evidenceSources,
      projectDomain: graph.projectDomain,
      industry: graph.industry
    },
    parserAnalysisBreakdown: {
      excelAnalysis: {
        sources: excelAnalysis,
        sheetCount: graph.dashboardInsights.filter(d => d.parser === "ExcelParser").length,
        extractedMetrics: graph.metrics.filter(m => m.parser === "ExcelParser"),
        extractedDimensions: graph.dimensions.filter(d => d.parser === "ExcelParser"),
        formulas: graph.analyticalTechniques.filter(t => t.parser === "ExcelParser")
      },
      sqlAnalysis: {
        sources: sqlAnalysis,
        sqlQueriesExtracted: graph.sqlLogic,
        calculatedMetrics: graph.metrics.filter(m => m.parser === "SQLParser"),
        businessQuestions: graph.businessQuestions.filter(q => q.parser === "SQLParser")
      },
      powerbiAnalysis: {
        sources: powerbiAnalysis,
        visuals: graph.charts.filter(c => c.parser === "PowerBIParser"),
        daxMeasures: graph.metrics.filter(m => m.parser === "PowerBIParser"),
        kpis: graph.kpis.filter(k => k.parser === "PowerBIParser")
      },
      imageAnalysis: {
        sources: imageAnalysis,
        screenshotsDetected: graph.screenshots,
        visualCards: graph.charts.filter(c => c.parser === "ImageParser"),
        kpisDetected: graph.kpis.filter(k => k.parser === "ImageParser")
      },
      readmeAnalysis: {
        sources: readmeAnalysis,
        documentationNodes: graph.documentation,
        methodology: graph.methodology,
        recommendations: graph.recommendations
      },
      pdfAnalysis: {
        sources: pdfAnalysis,
        sections: graph.documentation.filter(d => d.parser === "PDFParser"),
        extractedTerms: graph.businessTerms.filter(t => t.parser === "PDFParser")
      },
      wordAnalysis: {
        sources: wordAnalysis,
        sections: graph.documentation.filter(d => d.parser === "WordParser"),
        extractedTerms: graph.businessTerms.filter(t => t.parser === "WordParser")
      }
    },
    detectedSemanticEvidence: {
      detectedKPIs: [
        ...graph.detectedKPIs.map(k => ({ name: k.value.name, target: k.value.target, actual: k.value.actual, source: k.sourceFile })),
        ...graph.kpis.map(k => ({ name: k.value.name, target: k.value.target, actual: k.value.value, source: k.sourceFile }))
      ],
      detectedBusinessTerms: [
        ...graph.businessTerms.map(t => ({ term: t.value, source: t.sourceFile })),
        ...graph.businessEntities.map(e => ({ entity: e.value, source: e.sourceFile }))
      ],
      detectedCharts: [
        ...graph.charts.map(c => ({ title: c.value.title, type: c.value.type, source: c.sourceFile })),
        ...graph.visualNarratives.map(v => ({ narrative: v.value, source: v.sourceFile }))
      ],
      detectedDimensions: [
        ...graph.detectedDimensions.map(d => ({ dimension: d.value, source: d.sourceFile })),
        ...graph.dimensions.map(d => ({ dimension: d.value, source: d.sourceFile })),
        ...graph.timeDimensions.map(t => ({ timeDimension: t.value, source: t.sourceFile }))
      ],
      detectedMeasures: [
        ...graph.detectedMeasures.map(m => ({ measure: m.value, source: m.sourceFile })),
        ...graph.metrics.map(m => ({ label: m.value.label, value: m.value.value, source: m.sourceFile }))
      ],
      detectedDashboardTitles: [
        ...graph.dashboards.map(d => ({ name: d.value.name, pages: d.value.pages, source: d.sourceFile })),
        ...graph.dashboardInsights.map(i => ({ insight: i.value, source: i.sourceFile }))
      ],
      detectedMethodology: [
        ...graph.methodology.map(m => ({ methodology: m.value, source: m.sourceFile })),
        ...graph.analyticalTechniques.map(a => ({ technique: a.value, source: a.sourceFile }))
      ],
      detectedParserEvidence: graph.evidenceSources
    },
    fullCanonicalEvidenceGraph: graph,
    identifiedConflicts: conflicts
  };
}

/**
 * AI Portfolio Compiler Service (Gemini Reasoning Engine)
 * Synthesizes EvidenceGraph into a recruiter-ready StructuredPortfolioProject.
 * Operates ONLY on EvidenceGraph nodes and parser summaries—NEVER raw binary files.
 */
export async function compilePortfolioWithGemini(
  graph: EvidenceGraph,
  conflicts: ConflictRecord[],
  rawBaseProject: ExtractedProject
): Promise<{ structured: StructuredPortfolioProject; raw: ExtractedProject }> {
  const debugAiContext = formatDebugAiContext(graph, conflicts);
  console.log("\n==========================================================");
  console.log("             [DEBUG MODE: AI CONTEXT INSPECTOR]           ");
  console.log("==========================================================");
  console.log(JSON.stringify(debugAiContext, null, 2));
  console.log("==========================================================\n");

  const ai = getAiClient();
  if (!ai) {
    console.warn("[portfolioCompiler] Gemini client unconfigured. Returning evidence-graph fallback.");
    return buildFallbackStructuredProject(graph, rawBaseProject);
  }

  const sourceCount = graph.evidenceSources.length || 1;
  const expectedConfidence = calculateEvidenceConfidence(sourceCount);

  const prompt = `
You are the world's leading AI Portfolio Compiler and Strategic Business Intelligence Consultant (McKinsey / BCG / Deloitte level).
Your job is to act as an evidence-driven reasoning engine that synthesizes a normalized Evidence Graph into a recruiter-ready data analytics case study.

### SYSTEM INSTRUCTIONS & EXECUTIVE COPYWRITING DIRECTIVES:
1. **SENIOR CONSULTANT COPYWRITING**: Write like a Senior Business Analyst / Consultant. Never use generic AI phrases like "This project aims to...", "The dashboard shows...", "In summary". Use executive prose: "This analysis evaluates...", "Empirical evidence reveals...", "Strategic evaluation demonstrates...".
2. **BUSINESS UNDERSTANDING & DECISION SUPPORT**: Infer the target industry, business department (e.g. Strategic Finance, Revenue Operations, Growth Marketing, Supply Chain), key stakeholders, and specific business decisions supported by this analysis.
3. **KPI DISCOVERY ENGINE**: Identify all KPIs supported by uploaded evidence (Revenue, Profit, Margin, Retention, Churn, Conversion, AOV, LTV, Review Rating, Inventory, Forecasting). Ground every metric in the Evidence Graph. Never fabricate fake numbers.
4. **EXPLAIN WHY IT MATTERS**: Every finding must explain *Why it matters* and *What business action decision-makers should take*.
5. **DYNAMIC CONFIDENCE SCORING**:
   - 1 source file: score confidence ~60%
   - 2 agreeing source files: score confidence ~85%
   - 3+ agreeing source files: score confidence ~95%
6. **GROUNDED EVIDENCE PRIORITY**: Ground every claim directly in evidence. If evidence is lacking for a section, write "Insufficient evidence."

### CANONICAL EVIDENCE GRAPH:
${JSON.stringify(graph, null, 2)}

### IDENTIFIED CONFLICTS:
${JSON.stringify(conflicts, null, 2)}

Synthesize this Evidence Graph into schema-compliant JSON matching the specified response format.
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction:
          "You are an elite AI Portfolio Compiler and Strategy Consultant reasoning engine. Transform input Evidence Graphs into executive JSON portfolio case studies with confidence scores and evidence attributions. Never output markdown filler.",
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
    });

    const parsed = JSON.parse(response.text.trim());
    const dynamicConfidence = calculateEvidenceConfidence(sourceCount);
    const primarySource = graph.evidenceSources[0]?.fileName || "Source Asset";
    const defaultEvidence = graph.evidenceSources.length > 0 
      ? graph.evidenceSources.map(s => ({ sourceFile: s.fileName, parser: s.parser }))
      : [{ sourceFile: primarySource }];

    let structured: StructuredPortfolioProject = {
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
        value: parsed.businessContext?.value || `Strategic evaluation operating within the ${graph.projectDomain || 'Analytics'} domain.`, 
        confidence: parsed.businessContext?.confidence || dynamicConfidence, 
        evidence: defaultEvidence 
      },
      businessProblem: { 
        value: parsed.businessProblem?.value || "Analyze key operational indicators to isolate growth levers.", 
        confidence: parsed.businessProblem?.confidence || dynamicConfidence, 
        evidence: defaultEvidence 
      },
      businessObjective: { 
        value: parsed.businessObjective?.value || "Deliver evidence-grounded performance metrics and recommendations.", 
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
        value: parsed.analyticalTechniques?.value || (graph.analyticalTechniques.length > 0 ? graph.analyticalTechniques.map(t => t.value) : ["Relational Query Modeling", "KPI Profiling"]), 
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
        value: parsed.gitHubReadmeSummary?.value || `# ${parsed.title?.value || inferTitleFromEvidence(graph)}\n\n${parsed.executiveSummary?.value || ''}`, 
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
      metrics: (parsed.metrics || []).map((m: any, idx: number) => ({
        id: `ai-metric-${idx}-${Date.now()}`,
        label: m.label,
        value: m.value,
        description: m.description,
        iconName: m.iconName || "Activity",
        confidence: m.confidence || dynamicConfidence,
        sourceFile: m.sourceFile || primarySource
      })),
      tags: parsed.tags || (rawBaseProject.tags.length > 0 ? rawBaseProject.tags : ["Analytics"]),
      categories: parsed.categories || (rawBaseProject.categories.length > 0 ? rawBaseProject.categories : ["Data Analysis"])
    };

    // Task 8: Run automated internal AI Quality Review audit & refinement loop
    structured = await reviewAndRefinePortfolio(structured, graph);

    // Update raw base project with Gemini's synthesized narrative for backwards compatibility
    const rawUpdated: ExtractedProject = {
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
      metrics: structured.metrics.length > 0 ? structured.metrics.map(m => ({
        id: m.id,
        label: m.label,
        value: m.value,
        description: m.description,
        iconName: m.iconName,
        sourceFile: m.sourceFile
      })) : rawBaseProject.metrics
    };

    return { structured, raw: rawUpdated };
  } catch (err: any) {
    console.error("[portfolioCompiler] Gemini synthesis error, using fallback:", err.message);
    return buildFallbackStructuredProject(graph, rawBaseProject);
  }
}
