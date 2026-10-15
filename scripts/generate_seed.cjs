const fs = require("fs");
const path = require("path");

const raw = fs.readFileSync(path.join(__dirname, "../live_data_dump.json"), "utf8");
const data = JSON.parse(raw.replace(/^\uFEFF/, ""));

// Clean up profile
const profile = {
  name: "Sayan Halder",
  title: "Data Analyst & Operations Intelligence Specialist",
  subtitle: "Translating complex operations, inventory, and retail datasets into executive-grade visual systems and actionable SQL pipelines.",
  bio: "Analytical problem-solver and data analyst specializing in quick-commerce operations diagnostics, multi-echelon inventory modeling, and commercial retail performance. Proficient in transforming raw transactional databases into decision-grade Power BI dashboards, advanced SQL diagnostic models (window functions, lag analytics, CTEs), and structured business case studies that isolate profit leaks and operational bottlenecks.",
  location: "Kolkata, India",
  timezone: "IST (UTC +5:30)",
  email: "sayanhalder813@gmail.com",
  resumeUrl: "/Sayan_Halder_Resume.pdf",
  resumeFileName: "Sayan_Halder_Data_Analyst_Resume_Updated-14-09-2026.pdf",
  resumeLastUpdated: "2026-09-14",
  githubUrl: "https://github.com/Animus004",
  linkedinUrl: "https://linkedin.com/in/sayan-halder-analyst",
  lookingForJob: true,
  statusBadge: "Open to Opportunities",
  heroCtaText: "Explore Case Studies",
  quickStackSkills: [
    "SQL (MySQL / PostgreSQL / Window Functions)",
    "Power BI & Advanced DAX",
    "Microsoft Excel (Pivots, Data Modeling)",
    "Python (Pandas, Exploratory Data Analysis)",
    "Operations Analytics & Fill Rate Tracking",
    "Retail & E-Commerce Margin Optimization",
    "Executive KPI Dashboarding",
    "Data Cleaning & Schema Structuring"
  ],
  currentFocus: "Data Analytics & Quick-Commerce Operations",
  targetRole: "Data Analyst",
  currentlyLearning: "End-to-End Analytics Engineering Pipelines"
};

// Clean up projects
const projects = data.projects.map(p => {
  const pCopy = { ...p };
  
  if (pCopy.id === "project-hhy3dlaz7" || pCopy.title.includes("Dark Store")) {
    pCopy.title = "Blinkit Kolkata: Dark Store Stock-Out & Operations Intelligence";
    pCopy.subtitle = "An end-to-end SQL and Power BI operations intelligence case study analyzing dark store availability, chronic SKU stock-outs, peak operational failure windows, and replenishment reliability across 12 Kolkata fulfillment hubs.";
    pCopy.industry = "Quick-Commerce & Retail Logistics";
    pCopy.role = "Lead Operations & Data Analyst";
    pCopy.duration = "4 Months (120-Day Network Analysis)";
    pCopy.githubUrl = "https://github.com/Animus004/blinkit-dark-store-stockout-analysis";
    pCopy.images = ["/images/blinkit_dashboard_1.png", "/images/blinkit_dashboard_2.png"];
    pCopy.featured = true;
    pCopy.tags = ["SQL", "Power BI", "DAX", "MySQL", "Inventory Operations", "Logistics Analytics"];
    pCopy.categories = ["Operations Intelligence", "Supply Chain Analytics", "SQL Diagnostics"];
  } else if (pCopy.id === "project-3ei1f2x9q" || pCopy.title.includes("Amazon")) {
    pCopy.title = "Amazon Customer Engagement & Product Sentiment Analytics";
    pCopy.subtitle = "Exploratory customer review and engagement analysis identifying high-velocity rating trends, recurring quality concerns, and product catalog prioritization signals in Excel.";
    pCopy.industry = "E-Commerce & Consumer Electronics";
    pCopy.role = "Product Data Analyst";
    pCopy.duration = "2 Months";
    pCopy.githubUrl = "https://github.com/Animus004/Amazon-Customer-Engagement-Product-Performance-Analysis";
    pCopy.images = ["/images/amazon_dashboard.png"];
    pCopy.featured = true;
    pCopy.tags = ["Excel", "Pivot Tables", "Customer Sentiment", "Data Visualization", "E-Commerce"];
    pCopy.categories = ["Customer Analytics", "Product Performance"];
  } else if (pCopy.id === "project-g40ktfsc7" || pCopy.title.includes("Superstore")) {
    pCopy.title = "Superstore Sales Diagnostic & Margin Optimization Dashboard";
    pCopy.subtitle = "Multi-year commercial retail transaction analysis isolating negative profit corridors, carrier shipping latencies, and customer segment growth in Excel.";
    pCopy.industry = "Retail & Supply Chain";
    pCopy.role = "Business Intelligence Analyst";
    pCopy.duration = "2 Months";
    pCopy.githubUrl = "https://github.com/Animus004/superstore-sales-dashboard-analysis";
    pCopy.images = ["/images/superstore_dashboard.png"];
    pCopy.featured = true;
    pCopy.tags = ["Excel", "Pivot Charts", "Profitability Modeling", "KPI Development", "Retail Sales"];
    pCopy.categories = ["Financial Diagnostics", "Sales Intelligence"];
  } else if (pCopy.id === "project-r4gxqt836" || pCopy.title.includes("Steam")) {
    pCopy.title = "Steam Games Market Intelligence: Publisher Growth & Pricing Strategy";
    pCopy.subtitle = "Market segment analysis across thousands of game titles evaluating demand signals, review distribution, and pricing strategy for portfolio planning.";
    pCopy.industry = "Gaming & Digital Media";
    pCopy.role = "Market Intelligence Analyst";
    pCopy.duration = "2 Months";
    pCopy.githubUrl = "https://github.com/Animus004/steam-games-market-analysis";
    pCopy.images = ["/images/steam_dashboard.png"];
    pCopy.featured = true;
    pCopy.tags = ["Excel", "Market Research", "Pricing Analytics", "Data Visualization", "Trend Analysis"];
    pCopy.categories = ["Market Intelligence", "Strategic Decision Support"];
  }
  return pCopy;
});

// Flagship first: Blinkit Dark Store first!
projects.sort((a, b) => {
  if (a.title.includes("Blinkit") || a.title.includes("Dark Store")) return -1;
  if (b.title.includes("Blinkit") || b.title.includes("Dark Store")) return 1;
  return 0;
});

let fileContent = `/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ProjectRecord, CreatorProfile, ProjectStatus, TechnicalDifficulty } from "../types";

export const defaultCreatorProfile: CreatorProfile = ${JSON.stringify(profile, null, 2)};

export const seedProjects: ProjectRecord[] = ${JSON.stringify(projects, null, 2)};
`;

fileContent = fileContent
  .replace(/"status": "published"/g, 'status: ProjectStatus.PUBLISHED')
  .replace(/"status": "draft"/g, 'status: ProjectStatus.DRAFT')
  .replace(/"status": "archived"/g, 'status: ProjectStatus.ARCHIVED')
  .replace(/"difficulty": "advanced"/g, 'difficulty: TechnicalDifficulty.ADVANCED')
  .replace(/"difficulty": "intermediate"/g, 'difficulty: TechnicalDifficulty.INTERMEDIATE')
  .replace(/"difficulty": "beginner"/g, 'difficulty: TechnicalDifficulty.BEGINNER')
  .replace(/"difficulty": "expert"/g, 'difficulty: TechnicalDifficulty.EXPERT');

fs.writeFileSync(path.join(__dirname, "../src/data/seedData.ts"), fileContent, "utf8");
console.log("Successfully generated typed src/data/seedData.ts!");
