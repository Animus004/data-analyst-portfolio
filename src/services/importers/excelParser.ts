/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from "xlsx";
import { ExtractedProject, ExtractedMetric, ExtractedStoryBlock } from "./types";

export function parseExcelWorkbook(fileName: string, base64Content: string): ExtractedProject {
  const sourceFiles = [fileName];
  
  let title = "Spreadsheet Financial & Operational Analytics";
  let subtitle = "Numerical modeling, pivot insights, and metric dashboarding";
  let objective = "Build spreadsheet models to analyze operational datasets.";
  let businessProblem = "";
  let datasetDesc = "Tabular spreadsheet workbook.";
  let dataCleaning = "";
  let methodology = "1. Imported tabular worksheets.\n2. Executed functions and aggregations.\n3. Rendered charts and summary metrics.";
  let findings = "";
  let recommendations = "";
  let challengesText = "";
  let lessonsLearned = "";
  const metrics: ExtractedMetric[] = [];
  const storyBlocks: ExtractedStoryBlock[] = [];
  const tags: string[] = ["Excel", "Spreadsheets"];
  const categories: string[] = ["Financial Modeling", "Business Analytics"];

  try {
    const excelBuffer = Buffer.from(base64Content, "base64");
    const workbook = XLSX.read(excelBuffer, { type: "buffer" });

    let projectsRaw: any[] = [];
    let metricsRaw: any[] = [];

    workbook.SheetNames.forEach(sheetName => {
      const nameLower = sheetName.toLowerCase().replace(/\s+/g, "");
      const sheet = workbook.Sheets[sheetName];

      if (nameLower === "projects" || nameLower === "casestudies") {
        projectsRaw = XLSX.utils.sheet_to_json(sheet);
      } else if (nameLower === "metrics" || nameLower === "kpis") {
        metricsRaw = XLSX.utils.sheet_to_json(sheet);
      }
    });

    if (projectsRaw.length > 0) {
      const firstProj = projectsRaw[0];
      title = firstProj.title || title;
      subtitle = firstProj.subtitle || subtitle;
      objective = firstProj.objective || firstProj.businessProblem || objective;
      businessProblem = firstProj.businessProblem || businessProblem;
      methodology = firstProj.methodology || methodology;
      datasetDesc = firstProj.datasetDesc || datasetDesc;
      dataCleaning = firstProj.dataCleaning || dataCleaning;
      findings = firstProj.findings || findings;
      recommendations = firstProj.recommendations || recommendations;
      challengesText = firstProj.challengesText || challengesText;
      lessonsLearned = firstProj.lessonsLearned || lessonsLearned;
    }

    metricsRaw.forEach((m: any, mIdx: number) => {
      metrics.push({
        id: `xls-metric-${mIdx}-${Date.now()}`,
        label: String(m.label || m.name || m.title || "KPI Metric").trim(),
        value: String(m.value || m.amount || "N/A").trim(),
        description: String(m.description || m.details || "").trim(),
        iconName: m.iconName || m.icon || "Activity",
        sourceFile: fileName,
        sourceLocation: `Sheet: Metrics, Row ${mIdx + 2}`
      });
    });

  } catch (err: any) {
    console.error(`Failed parsing Excel spreadsheet ${fileName}:`, err);
  }

  return {
    title,
    subtitle,
    summary: `Operational analytics compiled from Excel spreadsheet: ${fileName}.`,
    industry: "Spreadsheet Analytics",
    role: "Financial Analyst",
    duration: "1 Week",
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
