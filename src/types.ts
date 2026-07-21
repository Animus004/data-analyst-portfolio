/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum ProjectStatus {
  DRAFT = "draft",
  PUBLISHED = "published",
  ARCHIVED = "archived"
}

export enum TechnicalDifficulty {
  BEGINNER = "beginner",
  INTERMEDIATE = "intermediate",
  ADVANCED = "advanced",
  EXPERT = "expert"
}

export interface MetricHighlight {
  id: string;
  label: string;      // e.g., "Model Accuracy"
  value: string;      // e.g., "98.4%"
  description: string;// e.g., "Improved from 85% baseline"
  iconName?: string;  // Lucide icon identifier
}

export interface ContentBlock {
  id: string;
  type: "markdown" | "code_snippet" | "chart_data" | "image_gallery" | "quote";
  title?: string;
  bodyContent: string; // Contains Markdown, code, or JSON payload depending on type
  language?: string;   // For code snippets (e.g., "python", "typescript", "sql")
  imageUrl?: string;
  caption?: string;
}

export interface ProjectRecord {
  id: string;
  title: string;
  slug: string;
  subtitle: string;
  summary: string;     // Short high-impact 2-sentence description for cards
  industry: string;    // e.g., "Fintech", "Healthcare", "Logistics"
  role: string;        // e.g., "Lead Data Analyst", "Frontend Architect"
  duration: string;    // e.g., "3 Months", "Ongoing"
  status: ProjectStatus;
  difficulty: TechnicalDifficulty;
  
  // High-Impact Content Blocks
  objective: string;   // Strategic objective / problem statement
  datasetDesc?: string;// Details on data parsed or technologies built
  methodology: string; // The workflow or path followed

  // Structured Sections
  overviewText?: string;
  businessProblem?: string;
  dataCleaning?: string;
  analysisText?: string;
  findings?: string;
  recommendations?: string;
  challengesText?: string;
  lessonsLearned?: string;
  
  // Categorization tags
  tags: string[];      // e.g., ["Python", "Pandas", "Scikit-Learn"]
  categories: string[];// e.g., ["Machine Learning", "Data Science", "Full Stack"]

  // Metrics Dashboard (For instant recruiter visual impact)
  metrics: MetricHighlight[];

  // Dynamic Narrative Flow
  storyBlocks: ContentBlock[];

  // Links
  githubUrl?: string;
  liveUrl?: string;
  documentationUrl?: string;

  // Advanced Metadata
  date?: string;          // e.g., "2026-07-20"
  timeSpent?: string;     // e.g., "12 hours"
  skills?: string[];      // e.g., ["Data Pipeline Optimization", "Linear Regression"]
  images?: string[];      // Array of image paths/URLs
  featured?: boolean;     // Featured on public homepage
  visibility?: "public" | "private" | "unlisted";
  order?: number;         // Sort order of the projects

  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface CreatorProfile {
  name: string;
  title: string;
  subtitle: string;
  bio: string;
  location: string;
  timezone: string;
  email: string;
  resumeUrl?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  avatarUrl?: string;
  lookingForJob: boolean;
  statusBadge?: string;
  heroCtaText?: string;
  quickStackSkills?: string[];
  currentFocus?: string;
  targetRole?: string;
  currentlyLearning?: string;
}

export interface VisitorAnalytics {
  id: string;
  timestamp: string;
  eventType: "page_view" | "project_view" | "resume_download" | "outbound_link";
  targetId?: string; // ID of the project, link etc.
  userAgent?: string;
  location?: string;
}

export interface SyncStatus {
  status: "synced" | "pending" | "failed" | "offline";
  lastSyncTime: string | null;
  errorMsg: string | null;
}

