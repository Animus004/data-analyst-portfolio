/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
  businessTerms: Array<CanonicalEvidenceNode<string>>;
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
  businessProblem: FieldWithEvidence<string>;
  stakeholders: FieldWithEvidence<string[]>;
  methodology: FieldWithEvidence<string>;
  industry: FieldWithEvidence<string>;
  role: FieldWithEvidence<string>;
  duration: FieldWithEvidence<string>;
  findings: FieldWithEvidence<string>;
  recommendations: FieldWithEvidence<string>;
  resumeBullets: FieldWithEvidence<string[]>;
  linkedInSummary: FieldWithEvidence<string>;
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
  };
}
