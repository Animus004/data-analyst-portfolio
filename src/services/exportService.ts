/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from "xlsx";
import { CreatorProfile, ProjectRecord } from "../types";

// Helper to trigger browser download
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Downloads a text-based string as a file
 */
export function downloadTextFile(content: string, filename: string, mimeType: string = "text/plain") {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, filename);
}

/**
 * Export portfolio state to Excel spreadsheet (.xlsx) with multi-sheet workbook structure.
 */
export function exportToExcel(profile: CreatorProfile, projects: ProjectRecord[], filterProjectId?: string) {
  const wb = XLSX.utils.book_new();

  // 1. Profile Sheet
  const profileRows = [
    ["Field", "Value"],
    ["name", profile.name],
    ["title", profile.title],
    ["subtitle", profile.subtitle],
    ["bio", profile.bio],
    ["location", profile.location],
    ["timezone", profile.timezone],
    ["email", profile.email],
    ["resumeUrl", profile.resumeUrl || ""],
    ["githubUrl", profile.githubUrl || ""],
    ["linkedinUrl", profile.linkedinUrl || ""],
    ["avatarUrl", profile.avatarUrl || ""],
    ["lookingForJob", profile.lookingForJob ? "true" : "false"],
    ["statusBadge", profile.statusBadge || ""],
    ["heroCtaText", profile.heroCtaText || ""],
    ["quickStackSkills", profile.quickStackSkills?.join(",") || ""],
    ["currentFocus", profile.currentFocus || ""],
    ["targetRole", profile.targetRole || ""],
    ["currentlyLearning", profile.currentlyLearning || ""]
  ];
  const profileWs = XLSX.utils.aoa_to_sheet(profileRows);
  XLSX.utils.book_append_sheet(wb, profileWs, "Profile");

  // Filter projects if only exporting a single project
  const targetProjects = filterProjectId 
    ? projects.filter(p => p.id === filterProjectId) 
    : projects;

  // 2. Projects Sheet
  const projectFields = [
    "id", "title", "slug", "subtitle", "summary", "industry", "role", "duration", 
    "status", "difficulty", "objective", "datasetDesc", "methodology", "overviewText",
    "businessProblem", "dataCleaning", "analysisText", "findings", "recommendations", 
    "challengesText", "lessonsLearned", "githubUrl", "liveUrl", "documentationUrl", 
    "date", "timeSpent", "featured", "visibility", "order", "createdAt"
  ];
  const projectHeader = [...projectFields, "tags", "categories", "skills"];
  const projectRows = [
    projectHeader,
    ...targetProjects.map(p => [
      p.id, p.title, p.slug, p.subtitle, p.summary, p.industry, p.role, p.duration,
      p.status, p.difficulty, p.objective, p.datasetDesc || "", p.methodology, p.overviewText || "",
      p.businessProblem || "", p.dataCleaning || "", p.analysisText || "", p.findings || "", p.recommendations || "",
      p.challengesText || "", p.lessonsLearned || "", p.githubUrl || "", p.liveUrl || "", p.documentationUrl || "",
      p.date || "", p.timeSpent || "", p.featured ? "true" : "false", p.visibility || "public", p.order ?? 0, p.createdAt || "",
      p.tags?.join(",") || "", p.categories?.join(",") || "", p.skills?.join(",") || ""
    ])
  ];
  const projectsWs = XLSX.utils.aoa_to_sheet(projectRows);
  XLSX.utils.book_append_sheet(wb, projectsWs, "Projects");

  // 3. Metrics/KPIs Sheet
  const metricsHeader = ["project_id", "id", "label", "value", "description", "iconName"];
  const metricsRows = [metricsHeader];
  targetProjects.forEach(p => {
    p.metrics?.forEach(m => {
      metricsRows.push([p.id, m.id, m.label, m.value, m.description, m.iconName || ""]);
    });
  });
  const metricsWs = XLSX.utils.aoa_to_sheet(metricsRows);
  XLSX.utils.book_append_sheet(wb, metricsWs, "Metrics");

  // 4. Story Blocks Sheet
  const storyHeader = ["project_id", "id", "type", "title", "bodyContent", "language", "imageUrl", "caption"];
  const storyRows = [storyHeader];
  targetProjects.forEach(p => {
    p.storyBlocks?.forEach(s => {
      storyRows.push([p.id, s.id, s.type, s.title || "", s.bodyContent, s.language || "", s.imageUrl || "", s.caption || ""]);
    });
  });
  const storyWs = XLSX.utils.aoa_to_sheet(storyRows);
  XLSX.utils.book_append_sheet(wb, storyWs, "Story Blocks");

  // 5. Media Sheet
  const mediaHeader = ["project_id", "imageUrl"];
  const mediaRows = [mediaHeader];
  targetProjects.forEach(p => {
    p.images?.forEach(img => {
      mediaRows.push([p.id, img]);
    });
  });
  const mediaWs = XLSX.utils.aoa_to_sheet(mediaRows);
  XLSX.utils.book_append_sheet(wb, mediaWs, "Media");

  // Generate and download
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/octet-stream" });
  const filename = filterProjectId 
    ? `project-export-${filterProjectId}-${new Date().toISOString().slice(0, 10)}.xlsx`
    : `portfolio-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
  downloadBlob(blob, filename);
}

/**
 * Format project or portfolio metadata as standard Markdown files.
 */
export function generateMarkdownExport(profile: CreatorProfile, projects: ProjectRecord[], filterProjectId?: string): string {
  if (filterProjectId) {
    const project = projects.find(p => p.id === filterProjectId);
    if (!project) return "# Project Not Found";
    return formatProjectMarkdown(project);
  }

  // Entire Portfolio Markdown
  let md = `# Creator Portfolio: ${profile.name}\n\n`;
  md += `## Profile Details\n\n`;
  md += `- **Name:** ${profile.name}\n`;
  md += `- **Title:** ${profile.title}\n`;
  md += `- **Subtitle:** ${profile.subtitle}\n`;
  md += `- **Email:** ${profile.email}\n`;
  md += `- **Location:** ${profile.location} (Timezone: ${profile.timezone})\n`;
  if (profile.githubUrl) md += `- **GitHub:** [${profile.githubUrl}](${profile.githubUrl})\n`;
  if (profile.linkedinUrl) md += `- **LinkedIn:** [${profile.linkedinUrl}](${profile.linkedinUrl})\n`;
  md += `- **Status Badge:** ${profile.statusBadge || "N/A"}\n`;
  md += `- **Target Role:** ${profile.targetRole || "N/A"}\n\n`;
  md += `### Bio\n\n${profile.bio}\n\n`;
  md += `### Quick Stack Skills\n\n${profile.quickStackSkills?.map(s => `- ${s}`).join("\n") || "N/A"}\n\n`;
  
  md += `---\n\n## Case Studies\n\n`;
  
  projects.forEach((p, idx) => {
    md += `### ${idx + 1}. ${p.title}\n\n`;
    md += formatProjectMarkdown(p);
    md += `\n\n---\n\n`;
  });

  return md;
}

function formatProjectMarkdown(p: ProjectRecord): string {
  let md = `## Case Study: ${p.title}\n`;
  md += `> **Subtitle:** ${p.subtitle}\n`;
  md += `> **Industry:** ${p.industry} | **Role:** ${p.role} | **Duration:** ${p.duration}\n`;
  md += `> **Technical Difficulty:** ${p.difficulty} | **Status:** ${p.status}\n\n`;

  md += `### Executive Summary\n\n${p.summary}\n\n`;
  md += `### Strategic Objective & Business Problem\n\n${p.objective}\n\n`;
  
  if (p.datasetDesc) {
    md += `### Dataset Description\n\n${p.datasetDesc}\n\n`;
  }
  
  md += `### Methodology & Workflow\n\n${p.methodology}\n\n`;

  if (p.metrics && p.metrics.length > 0) {
    md += `### Key Performance Indicators & Metrics\n\n`;
    p.metrics.forEach(m => {
      md += `- **${m.label}:** \`${m.value}\` - ${m.description}\n`;
    });
    md += `\n`;
  }

  if (p.findings) {
    md += `### Findings & Diagnostic Insights\n\n${p.findings}\n\n`;
  }

  if (p.recommendations) {
    md += `### Strategic Recommendations\n\n${p.recommendations}\n\n`;
  }

  if (p.challengesText) {
    md += `### Technical Challenges & Obstacles\n\n${p.challengesText}\n\n`;
  }

  if (p.lessonsLearned) {
    md += `### Retrospective Lessons Learned\n\n${p.lessonsLearned}\n\n`;
  }

  if (p.storyBlocks && p.storyBlocks.length > 0) {
    md += `### Detailed Narrative blocks\n\n`;
    p.storyBlocks.forEach(sb => {
      if (sb.title) md += `#### ${sb.title}\n\n`;
      if (sb.type === "code_snippet") {
        md += `\`\`\`${sb.language || "text"}\n${sb.bodyContent}\n\`\`\`\n\n`;
      } else if (sb.type === "quote") {
        md += `> "${sb.bodyContent}"\n`;
        if (sb.caption) md += `> — ${sb.caption}\n`;
        md += `\n`;
      } else {
        md += `${sb.bodyContent}\n\n`;
      }
    });
  }

  if (p.githubUrl) md += `- **GitHub Repository:** [${p.githubUrl}](${p.githubUrl})\n`;
  if (p.liveUrl) md += `- **Live Deployment:** [${p.liveUrl}](${p.liveUrl})\n`;
  if (p.documentationUrl) md += `- **Documentation URL:** [${p.documentationUrl}](${p.documentationUrl})\n`;

  return md;
}

/**
 * Trigger dynamic single creator profile markdown or raw JSON download
 */
export function exportCreatorProfile(profile: CreatorProfile, format: "json" | "markdown") {
  if (format === "json") {
    const payload = {
      schemaVersion: "v1.0",
      version: "1.0.0",
      profile
    };
    downloadTextFile(JSON.stringify(payload, null, 2), `profile-export-${new Date().toISOString().slice(0,10)}.json`, "application/json");
  } else {
    let md = `# Creator Profile: ${profile.name}\n\n`;
    md += `**Title:** ${profile.title}\n`;
    md += `**Subtitle:** ${profile.subtitle}\n`;
    md += `**Location:** ${profile.location} (Timezone: ${profile.timezone})\n`;
    md += `**Email:** ${profile.email}\n`;
    if (profile.resumeUrl) md += `**Resume:** [Link](${profile.resumeUrl})\n`;
    if (profile.githubUrl) md += `**GitHub:** [Link](${profile.githubUrl})\n`;
    if (profile.linkedinUrl) md += `**LinkedIn:** [Link](${profile.linkedinUrl})\n\n`;
    md += `## Professional Bio\n\n${profile.bio}\n\n`;
    md += `## Target Role\n\n${profile.targetRole || "N/A"}\n\n`;
    md += `## Current Focus\n\n${profile.currentFocus || "N/A"}\n\n`;
    md += `## Core Tech Stack\n\n${profile.quickStackSkills?.map(s => `- ${s}`).join("\n") || "None listed"}\n`;
    downloadTextFile(md, `profile-export-${new Date().toISOString().slice(0,10)}.md`, "text/markdown");
  }
}
