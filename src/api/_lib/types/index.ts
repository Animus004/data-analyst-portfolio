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
  auditMetadata?: {
    importTimestamp: string;
    parserVersions: string;
    evidenceHash: string;
    packageId?: string;
    projectVersion: string;
    totalFilesProcessed: number;
  };
}
