# Portfolio OS Case Study & Portfolio Schema Documentation

This document describes the structure and fields required to automatically compile and import entire professional data analytics case studies into the **Portfolio OS** system. By following this schema, you can write or generate a single `.json` or `.xlsx` file to completely publish your work in under a minute without filling out forms.

---

## Data Structure Overview

A standard Portfolio OS backup/import payload is a single JSON object with three root properties:

1. `version`: Schema standard version (set to `"1.0.0"`).
2. `profile`: Object representing the professional identity, bio, and contact details of the creator.
3. `projects`: Array of objects, where each object is a deep, fully comprehensive Case Study.

---

## 1. Profile Schema Definition

The `profile` object defines the personal brand, location, resume, and skills showcased in the Snapshot section.

| Field Name | Type | Required | Description | Example |
| :--- | :--- | :---: | :--- | :--- |
| `name` | String | **Yes** | Your display full name. | `"Sayan Halder"` |
| `title` | String | **Yes** | Primary professional heading. | `"Aspiring Data Analyst"` |
| `subtitle` | String | No | Explanatory sub-header. | `"Translating datasets into decision-grade systems."` |
| `bio` | String | **Yes** | Full biographical narrative & recruiter statement. | `"Analytical problem solver combining BI with Python..."` |
| `location` | String | **Yes** | Current city & country location. | `"Kolkata, India"` |
| `timezone` | String | No | Timezone offset or identification. | `"IST (UTC +5:30)"` |
| `email` | String | **Yes** | Active communication email. | `"sayanhalder813@gmail.com"` |
| `resumeUrl` | String | No | Link or path to downloadable Resume. | `"https://sayan.link/resume.pdf"` |
| `githubUrl` | String | No | GitHub profile link. | `"https://github.com/Animus004"` |
| `linkedinUrl` | String | No | LinkedIn profile link. | `"https://linkedin.com/in/sayan-halder-analyst"` |
| `lookingForJob` | Boolean | **Yes** | Sets availability status badge toggle. | `true` |
| `statusBadge` | String | No | Customizable text of availability badge. | `"Open to Opportunities"` |
| `heroCtaText` | String | No | Label of hero button. | `"Explore Case Studies"` |
| `quickStackSkills` | Array[Str] | No | Top skills shown in Snapshot panel. | `["Excel", "SQL", "Power BI", "Python"]` |
| `currentFocus` | String | No | Main analytics segment currently in focus. | `"Data Analytics"` |
| `targetRole` | String | No | Desired title. | `"Data Analyst"` |
| `currentlyLearning` | String | No | Active technical study topic. | `"Python"` |

---

## 2. Project (Case Study) Schema Definition

Each object in the `projects` array is a comprehensive case study.

| Field Name | Type | Required | Description | Example / Notes |
| :--- | :--- | :---: | :--- | :--- |
| `id` | String | **Yes** | Unique, URL-safe alphanumeric ID. | `"superstore-sales"` |
| `title` | String | **Yes** | Title of the project. | `"Superstore Sales Dashboard & Diagnostic Analysis"` |
| `slug` | String | **Yes** | URL-friendly slug. | `"superstore-sales-dashboard-analysis"` |
| `subtitle` | String | No | Explanatory subtitle. | `"Diagnostic business intelligence dashboard..."` |
| `summary` | String | **Yes** | High-impact 2-sentence executive summary. | `"Built an interactive, responsive Power BI analytical interface..."` |
| `industry` | String | No | Target industry sector. | `"E-Commerce & Retail"` |
| `role` | String | No | Your specific role on this project. | `"Lead Business Intelligence Analyst"` |
| `duration` | String | No | Project duration. | `"2 Months"` |
| `status` | String | **Yes** | Workflow state: `"draft"`, `"published"`, `"archived"`. | `"published"` |
| `difficulty` | String | **Yes** | Technical depth: `"beginner"`, `"intermediate"`, `"advanced"`, `"expert"`. | `"advanced"` |
| `objective` | String | **Yes** | Strategic objective / Problem statement. | `"To isolate critical profit-bleeding categories..."` |
| `datasetDesc` | String | No | Metadata and description of datasets parsed. | `" transactional data of retail superstore spanning 10k+ rows..."` |
| `methodology` | String | **Yes** | Sequenced step-by-step analytical workflow. | `"1. Cleaned tables in Python\n2. Modeled schema..."` |
| `businessProblem` | String | No | Expanded business context. | `"Describe stakeholders, customer pain points..."` |
| `dataCleaning` | String | No | Specific procedures used to clean data. | `"Dropped nulls, handled data types, created calendar table..."` |
| `findings` | String | No | High-level diagnostic findings. | `"Furniture segments bleed profits due to shipping..."` |
| `recommendations` | String | No | Data-driven recommendations. | `"1. Limit discount thresholds to 15% on high-volume items..."` |
| `challengesText` | String | No | Roadblocks and limitations faced. | `"Overcoming extreme outliers in regional shipping metrics..."` |
| `lessonsLearned` | String | No | Post-project lessons & technical takeaways. | `"Learned optimized DAX row context optimization..."` |
| `tags` | Array[Str] | **Yes** | Visual tool chips (min 1). | `["Power BI", "DAX", "SQL", "Python"]` |
| `categories` | Array[Str] | **Yes** | High-level fields of study (min 1). | `["Business Intelligence", "Data Science"]` |
| `metrics` | Array[Obj] | **Yes** | Executive KPIs (minimally empty array). | See [Metrics Structure](#metrics-structure) below. |
| `storyBlocks` | Array[Obj] | **Yes** | Deep-dive storytelling content blocks. | See [Story Blocks Structure](#story-blocks-structure) below. |
| `githubUrl` | String | No | Code repository. | `"https://github.com/Animus004/superstore-sales"` |
| `liveUrl` | String | No | Link to live dashboard or app. | `"https://public.powerbi.com/view?r=..."` |
| `documentationUrl` | String | No | External PDF report or documentation. | `"https://my-docs.com/analysis-report.pdf"` |
| `date` | String | No | Project completion date (YYYY-MM-DD). | `"2026-07-20"` |
| `timeSpent` | String | No | Total hours spent on project. | `"45 hours"` |
| `skills` | Array[Str] | No | Analytical sub-skills applied. | `["DAX Modelling", "Star Schemas"]` |
| `images` | Array[Str] | No | Accompanying showcase image paths/URLs. | `["/images/dashboard_main.png"]` |
| `featured` | Boolean | No | Pin the case study on the homepage. | `true` |
| `visibility` | String | No | `"public"`, `"private"`, or `"unlisted"`. | `"public"` |
| `order` | Integer | No | Sorter index (lower numbers display first). | `0` |

---

### Metrics Structure

Metrics are stored in the `metrics` array:

```json
{
  "id": "ss-m1",
  "label": "Identified Cash Bleeds",
  "value": "$32,500+",
  "description": "Isolated negative margin product categories such as tables.",
  "iconName": "TrendingDown"
}
```

---

### Story Blocks Structure

Story blocks let you craft an interactive narrative layout with mixed content. Supported types are `"markdown"`, `"code_snippet"`, `"chart_data"`, `"image_gallery"`, and `"quote"`.

```json
{
  "id": "ss-sb1",
  "type": "markdown",
  "title": "The Furniture Dilemma",
  "bodyContent": "Furniture sales had extremely high volume but negative margins because..."
}
```

*For `"code_snippet"`, supply `language` (e.g. `"python"`, `"sql"`, `"typescript"`).*
*For `"chart_data"`, `bodyContent` must contain a JSON string representing data points (compatible with Recharts/D3).*

---

## Excel (.xlsx) Import Format Guide

To import your data via Excel, format your workbook with up to **4 sheets** as named below:

### 1. `Profile` Sheet
A flat list of key-value parameters. Format either with row 1 as Headers, and row 2 as Values, OR with Column A as keys (e.g. `name`, `title`) and Column B as values.
*Arrays (like `quickStackSkills`) should be written as comma-separated values (e.g., `Excel, SQL, Python`).*

### 2. `Projects` Sheet
Each row represents a single case study. Column headers must match the JSON field keys (e.g., `id`, `title`, `slug`, `summary`, `objective`, `status`, `difficulty`, etc.).
*Write arrays like `tags` and `categories` as comma-separated values (e.g. `Power BI, SQL`).*

### 3. `Metrics` Sheet
Links KPIs to projects. Columns:
* `project_id`: Must match the parent project's `id` from the `Projects` sheet.
* `id`: Unique metric identifier.
* `label`: e.g., `"Shipping Lag"`
* `value`: e.g., `"22%"`
* `description`: Explanatory text.
* `iconName`: (Optional) e.g., `"Truck"`

### 4. `StoryBlocks` Sheet
Links content blocks to projects. Columns:
* `project_id`: Must match the parent project's `id`.
* `id`: Unique block identifier.
* `type`: `"markdown"`, `"code_snippet"`, `"chart_data"`, `"image_gallery"`, or `"quote"`.
* `title`: Section heading.
* `bodyContent`: The narrative, code block, or JSON chart dataset.
* `language`: (Optional, for code snippets).
* `imageUrl`: (Optional).
* `caption`: (Optional).

---

## Complete Blueprint JSON Template

Here is a full compatible import template you can copy and edit:

```json
{
  "version": "1.0.0",
  "profile": {
    "name": "Sayan Halder",
    "title": "Lead Data Analyst & Systems Engineer",
    "subtitle": "Uncovering operational insights with robust programmatic pipelines.",
    "bio": "I am an analytical business intelligence consultant specializing in E-commerce diagnostic auditing...",
    "location": "Kolkata, India",
    "timezone": "IST (UTC +5:30)",
    "email": "sayanhalder813@gmail.com",
    "lookingForJob": true,
    "statusBadge": "Open to Opportunities",
    "heroCtaText": "Explore Case Studies",
    "quickStackSkills": ["Excel", "SQL", "Power BI", "Python"]
  },
  "projects": [
    {
      "id": "inventory-optimization",
      "title": "Predictive Inventory Optimization & Supply Chain Logistics",
      "slug": "predictive-inventory-optimization",
      "subtitle": "Applying timeseries analysis to eliminate regional warehouse stockouts.",
      "summary": "Engineered SQL pipelines and timeseries models that decreased backorders by 18% in regional warehouses.",
      "industry": "Supply Chain & Logistics",
      "role": "Lead Inventory Analyst",
      "duration": "3 Months",
      "status": "published",
      "difficulty": "advanced",
      "objective": "Identify stockout patterns in retail distribution and forecast optimal safety stock levels.",
      "datasetDesc": "80,000 transaction line records containing stock levels, transit times, and warehouse capacity logs.",
      "methodology": "1. Built SQL data models mapping warehouse SKUs.\n2. Formulated safety stock parameters using Python.\n3. Designed dashboard alerts.",
      "businessProblem": "Frequent stockouts during peak retail promotions led to $45,000 in lost revenue.",
      "dataCleaning": "Imputed missing SKU historical parameters and standardized datetime structures.",
      "findings": "Safety stock values did not adjust for shipping latency variances across carriers.",
      "recommendations": "Deploy dynamic safety buffers adjusted for carrier lead times.",
      "challengesText": "Merging unstructured shipping carrier text logs into analytical SQL servers.",
      "lessonsLearned": "Standardized logging formats save weeks of analytical preprocessing time.",
      "tags": ["SQL", "Python", "Pandas", "Power BI"],
      "categories": ["Business Intelligence", "Machine Learning"],
      "metrics": [
        {
          "id": "inv-kpi1",
          "label": "Backorders Prevented",
          "value": "18.4%",
          "description": "Stockout frequencies reduced significantly over Q3."
        }
      ],
      "storyBlocks": [
        {
          "id": "inv-sb1",
          "type": "markdown",
          "title": "The Safety Stock Deficit",
          "bodyContent": "Traditional formulas failed because standard deviation values did not incorporate transit delays..."
        }
      ],
      "githubUrl": "https://github.com/Animus004/inventory-optimization"
    }
  ]
}
```
