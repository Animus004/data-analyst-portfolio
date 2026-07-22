/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ExtractedProject, ExtractedMetric, ExtractedStoryBlock } from "./types";

export function parseSqlFiles(files: Array<{ name: string; content: string }>): ExtractedProject {
  const sourceFiles = files.map(f => f.name);
  
  let title = "";
  let subtitle = "";
  let objective = "";
  let businessProblem = "";
  let datasetDesc = "";
  let dataCleaning = "";
  let methodology = "";
  let findings = "";
  let recommendations = "";
  let challengesText = "";
  let lessonsLearned = "";
  const metrics: ExtractedMetric[] = [];
  const storyBlocks: ExtractedStoryBlock[] = [];
  const tags: string[] = ["SQL", "Relational Database"];
  const categories: string[] = ["Data Engineering", "Database Querying"];

  // Analyze files for headers and queries
  files.forEach((file, fileIdx) => {
    const content = file.content;
    const lines = content.split("\n");

    // Try to extract comments for metadata
    let currentBlock = "";
    let inBlockComment = false;
    const tablesReferenced = new Set<string>();

    lines.forEach((line, lineIdx) => {
      const trimmed = line.trim();

      // Check for tables referenced (FROM table or JOIN table)
      const fromMatch = trimmed.match(/\bFROM\s+([a-zA-Z0-9_\.]+)/i);
      if (fromMatch && fromMatch[1]) {
        tablesReferenced.add(fromMatch[1]);
      }
      const joinMatch = trimmed.match(/\bJOIN\s+([a-zA-Z0-9_\.]+)/i);
      if (joinMatch && joinMatch[1]) {
        tablesReferenced.add(joinMatch[1]);
      }

      // Check for block comments
      if (trimmed.startsWith("/*")) {
        inBlockComment = true;
        currentBlock += line.substring(line.indexOf("/*") + 2) + "\n";
        return;
      }
      if (trimmed.endsWith("*/")) {
        inBlockComment = false;
        currentBlock += line.substring(0, line.lastIndexOf("*/")) + "\n";
        processCommentBlock(currentBlock, file.name);
        currentBlock = "";
        return;
      }
      if (inBlockComment) {
        currentBlock += line + "\n";
        return;
      }

      // Single line comment parsing
      if (trimmed.startsWith("--")) {
        const comment = trimmed.slice(2).trim();
        processSingleComment(comment, lineIdx + 1, file.name);
      }
    });

    // Extract comment block info
    function processCommentBlock(text: string, source: string) {
      const blockLines = text.split("\n");
      blockLines.forEach(l => {
        const c = l.trim();
        processSingleComment(c, 0, source);
      });
    }

    function processSingleComment(comment: string, lineNum: number, source: string) {
      const lower = comment.toLowerCase();
      
      // Parse KPI comments e.g. KPI: Conversion Rate = 14.5% (E-Commerce funnel optimization)
      if (lower.startsWith("kpi:") || lower.startsWith("metric:")) {
        const parts = comment.substring(comment.indexOf(":") + 1).split("=");
        if (parts.length >= 2) {
          const mLabel = parts[0].trim();
          const rest = parts[1].trim();
          let mVal = rest;
          let mDesc = "";

          const descIndex = rest.indexOf("(");
          if (descIndex !== -1) {
            mVal = rest.substring(0, descIndex).trim();
            mDesc = rest.substring(descIndex + 1, rest.length - 1).trim();
          }

          metrics.push({
            id: `sql-metric-${metrics.length}-${Date.now()}`,
            label: mLabel,
            value: mVal,
            description: mDesc || `Extracted from ${source}`,
            iconName: mLabel.toLowerCase().includes("revenue") ? "DollarSign" : "Activity",
            sourceFile: source,
            sourceLocation: lineNum > 0 ? `Line ${lineNum}` : "Header block"
          });
        }
      } else if (lower.startsWith("tag:") || lower.startsWith("tags:")) {
        const extractedTags = comment.substring(comment.indexOf(":") + 1)
          .split(",")
          .map(t => t.trim())
          .filter(Boolean);
        extractedTags.forEach(t => {
          if (!tags.includes(t)) tags.push(t);
        });
      }
    }

    // Add query script as story block
    storyBlocks.push({
      id: `sql-query-sb-${fileIdx}-${Date.now()}`,
      type: "code_snippet",
      title: `Query: ${file.name}`,
      bodyContent: content,
      language: "sql",
      sourceFile: file.name
    });
  });

  return {
    title,
    subtitle,
    summary: "",
    industry: "",
    role: "",
    duration: "",
    date: new Date().toISOString().split("T")[0],
    tags,
    categories,
    objective,
    businessProblem,
    methodology,
    datasetDesc,
    dataCleaning,
    findings,
    recommendations,
    challengesText,
    lessonsLearned,
    metrics,
    storyBlocks,
    sourceFiles
  };
}
