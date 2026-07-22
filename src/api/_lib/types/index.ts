/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PipelineStage =
  | "File Upload"
  | "Parsing"
  | "Evidence Graph"
  | "Evidence Prioritization"
  | "Gemini API"
  | "Schema Validation"
  | "Portfolio Mapping";

export class PipelineError extends Error {
  stage: PipelineStage;
  errorType: string;
  fileName?: string;
  lineNumber?: number;

  constructor(
    stage: PipelineStage,
    message: string,
    errorType = "PipelineError",
    cause?: any
  ) {
    super(message);
    this.name = "PipelineError";
    this.stage = stage;
    this.errorType = errorType;
    if (cause?.stack) {
      this.stack = cause.stack;
    }
    const location = parseStackLocation(this.stack);
    if (location) {
      this.fileName = location.fileName;
      this.lineNumber = location.lineNumber;
    }
  }
}

export function parseStackLocation(stack?: string): { fileName: string; lineNumber: number } | null {
  if (!stack) return null;
  const lines = stack.split("\n");
  for (const line of lines) {
    const match = line.match(/(?:[a-zA-Z]:\\|\/)[^:()]+\.[a-zA-Z0-9]+:(\d+):(\d+)/) || line.match(/([^\s()]+\.[a-zA-Z0-9]+):(\d+):(\d+)/);
    if (match) {
      const fullPath = match[0];
      const parts = fullPath.split(":");
      if (parts.length >= 3) {
        const lineNo = parseInt(parts[parts.length - 2], 10);
        const filePath = parts.slice(0, parts.length - 2).join(":");
        const fileName = filePath.split(/[/\\]/).pop() || filePath;
        return { fileName, lineNumber: lineNo };
      }
    }
  }
  return null;
}

export interface ExtractedMetric {
  id: string;
  label: string;
  value: string;
  description: string;
  iconName?: string;
  sourceFile: string;
  sourceLocation?: string;
}

export interface ExtractedStoryBlock {
  id: string;
  type: "markdown" | "code_snippet" | "quote";
  title?: string;
  bodyContent: string;
  language?: string;
  sourceFile: string;
}

export interface ExtractedProject {
  title: string;
  subtitle: string;
  summary: string;
  industry: string;
  role: string;
  duration: string;
  date: string;
  tags: string[];
  categories: string[];
  objective: string;
  businessProblem: string;
  methodology: string;
  datasetDesc: string;
  dataCleaning: string;
  findings: string;
  recommendations: string;
  challengesText: string;
  lessonsLearned: string;
  metrics: ExtractedMetric[];
  storyBlocks: ExtractedStoryBlock[];
  githubUrl?: string;
  liveUrl?: string;
  sourceFiles: string[];
}

export interface ConflictRecord {
  field: string;
  values: Array<{
    value: string;
    sourceFile: string;
    location?: string;
  }>;
}

// ----------------------------------------------------------------------
// AI Portfolio Compiler: Intermediate Evidence Node Schemas
// ----------------------------------------------------------------------

export interface EvidenceMeta {
  sourceFile: string;
  parser: string;
  confidence: number; // 0 - 100
  location?: string;
}

export interface ExcelEvidence extends EvidenceMeta {
  metrics: Array<{ label: string; value: string; description?: string }>;
  kpis: Array<{ name: string; target?: string; actual?: string }>;
  charts: Array<{ title: string; chartType?: string }>;
  pivots: string[];
  dashboardTitles: string[];
  formulas: string[];
  dimensions: string[];
  measures: string[];
  sheetNames: string[];
  businessTerms: string[];
}

export interface SqlEvidence extends EvidenceMeta {
  tables: string[];
  joins: string[];
  aggregations: string[];
  windowFunctions: string[];
  businessQuestions: string[];
  calculatedMetrics: Array<{ name: string; formula: string }>;
}

export interface PowerBiEvidence extends EvidenceMeta {
  visuals: Array<{ title: string; type: string }>;
  daxMeasures: Array<{ name: string; expression: string }>;
  pages: string[];
  relationships: Array<{ from: string; to: string }>;
  kpis: Array<{ label: string; value: string }>;
}

export interface ReadmeEvidence extends EvidenceMeta {
  objective?: string;
  methodology?: string;
  tools?: string[];
  dataset?: string;
  findings?: string;
  recommendations?: string;
}

export interface DocumentEvidence extends EvidenceMeta {
  title?: string;
  sections: Array<{ heading: string; content: string }>;
  extractedTerms: string[];
}

export interface ImageEvidence extends EvidenceMeta {
  dashboardDetected: boolean;
  kpiCards: string[];
  charts: string[];
  legends: string[];
  filters: string[];
  tables: string[];
}

export type ParserEvidenceNode =
  | { type: "excel"; data: ExcelEvidence }
  | { type: "sql"; data: SqlEvidence }
  | { type: "powerbi"; data: PowerBiEvidence }
  | { type: "readme"; data: ReadmeEvidence }
  | { type: "document"; data: DocumentEvidence }
  | { type: "image"; data: ImageEvidence };

export interface CanonicalEvidenceNode<T> {
  value: T;
  sourceFile: string;
  parser: string;
  confidence: number;
  location?: string;
}

export interface EvidenceGraph {
  projectDomain?: string;
  industry?: string;
  businessTerms: Array<CanonicalEvidenceNode<string>>;
  businessEntities: Array<CanonicalEvidenceNode<string>>;
  businessQuestions: Array<CanonicalEvidenceNode<string>>;
  analyticalTechniques: Array<CanonicalEvidenceNode<string>>;
  detectedKPIs: Array<CanonicalEvidenceNode<{ name: string; category?: string; target?: string; actual?: string }>>;
  detectedDimensions: Array<CanonicalEvidenceNode<string>>;
  detectedMeasures: Array<CanonicalEvidenceNode<string>>;
  dashboardInsights: Array<CanonicalEvidenceNode<string>>;
  visualNarratives: Array<CanonicalEvidenceNode<string>>;
  timeDimensions: Array<CanonicalEvidenceNode<string>>;
  stakeholderIndicators: Array<CanonicalEvidenceNode<string>>;
  metrics: Array<CanonicalEvidenceNode<{ label: string; value: string; description?: string }>>;
  dimensions: Array<CanonicalEvidenceNode<string>>;
  kpis: Array<CanonicalEvidenceNode<{ name: string; value?: string; target?: string }>>;
  charts: Array<CanonicalEvidenceNode<{ title: string; type?: string; dimensions?: string[]; measures?: string[] }>>;
  dashboards: Array<CanonicalEvidenceNode<{ name: string; pages?: string[]; visualCount?: number }>>;
  sqlLogic: Array<CanonicalEvidenceNode<{ tables: string[]; joins: string[]; aggregations: string[]; windowFunctions: string[] }>>;
  documentation: Array<CanonicalEvidenceNode<{ key: string; text: string }>>;
  methodology: Array<CanonicalEvidenceNode<string>>;
  screenshots: Array<CanonicalEvidenceNode<{ detectedElements: string[] }>>;
  recommendations: Array<CanonicalEvidenceNode<string>>;
  evidenceSources: Array<{ fileName: string; parser: string; confidence: number; nodesExtracted: number }>;
}

export interface FieldWithEvidence<T> {
  value: T;
  confidence: number;
  evidence: Array<{ sourceFile: string; parser?: string; location?: string }>;
}

export interface StructuredPortfolioProject {
  title: FieldWithEvidence<string>;
  subtitle: FieldWithEvidence<string>;
  executiveSummary: FieldWithEvidence<string>;
  businessContext: FieldWithEvidence<string>;
  businessProblem: FieldWithEvidence<string>;
  businessObjective: FieldWithEvidence<string>;
  businessImpact: FieldWithEvidence<string>;
  stakeholders: FieldWithEvidence<string[]>;
  datasetDescription: FieldWithEvidence<string>;
  methodology: FieldWithEvidence<string>;
  dataCleaning: FieldWithEvidence<string>;
  analysisProcess: FieldWithEvidence<string>;
  analyticalTechniques: FieldWithEvidence<string[]>;
  industry: FieldWithEvidence<string>;
  role: FieldWithEvidence<string>;
  duration: FieldWithEvidence<string>;
  findings: FieldWithEvidence<string>;
  recommendations: FieldWithEvidence<string>;
  challenges: FieldWithEvidence<string>;
  lessonsLearned: FieldWithEvidence<string>;
  technologyStack: FieldWithEvidence<string[]>;
  skillsDemonstrated: FieldWithEvidence<string[]>;
  resumeBullets: FieldWithEvidence<string[]>;
  linkedInSummary: FieldWithEvidence<string>;
  gitHubReadmeSummary: FieldWithEvidence<string>;
  starStory: FieldWithEvidence<{
    situation: string;
    task: string;
    action: string;
    result: string;
  }>;
  metrics: Array<{
    id: string;
    label: string;
    value: string;
    description: string;
    iconName?: string;
    confidence: number;
    sourceFile: string;
    sourceLocation?: string;
  }>;
  tags: string[];
  categories: string[];
}

export interface UniversalCompilerOutput {
  projectType: string;
  rawProject: ExtractedProject;
  conflicts: ConflictRecord[];
  fileCoverage: Array<{
    fileName: string;
    status: "Used" | "Ignored" | "Failed";
    reason: string;
    size: number;
    sha256?: string;
  }>;
  evidenceGraph?: EvidenceGraph;
  portfolioProject?: StructuredPortfolioProject;
  sourceAttributions?: Record<string, string[]>;
  confidenceScores?: Record<string, number>;
  starStory?: { situation: string; task: string; action: string; result: string };
  resumeBullets?: string[];
  linkedInSummary?: string;
  auditMetadata?: {
    importTimestamp: string;
    parserVersions: string;
    evidenceHash: string;
    packageId?: string;
    projectVersion: string;
    totalFilesProcessed: number;
    debugAiContext?: any;
  };
}
