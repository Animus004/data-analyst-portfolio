/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from "xlsx";
import { ExtractedProject, ExtractedMetric, ExtractedStoryBlock } from "./types";

export function parseExcelWorkbook(fileName: string, base64Content: string): ExtractedProject {
  const sourceFiles = [fileName];
  
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
  const tags: string[] = ["Excel", "Spreadsheets"];
  const categories: string[] = ["Financial Modeling", "Business Analytics"];

  try {
    const excelBuffer = Buffer.from(base64Content, "base64");
    const workbook = XLSX.read(excelBuffer, { type: "buffer" });

    let metricsRaw: any[] = [];

    workbook.SheetNames.forEach(sheetName => {
      const nameLower = sheetName.toLowerCase().replace(/\s+/g, "");
      const sheet = workbook.Sheets[sheetName];

      if (nameLower === "metrics" || nameLower === "kpis") {
        metricsRaw = XLSX.utils.sheet_to_json(sheet);
      }
    });

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
