# Portfolio OS CMS Intake & Import Guide

This guide is designed to help you prepare your portfolio profile and data analytics case studies for seamless import into **Portfolio OS**.

---

## 🚀 Overview

Portfolio OS includes a strict verification engine to guarantee complete data integrity. This prevents broken routes, incomplete metrics, and layout issues. You can import your portfolio data in two formats:
1. **JSON (.json)**: Fully customizable, supporting nested story blocks, custom KPI lists, and metadata.
2. **Excel (.xlsx)**: Ideal for rapid bulk creation using standardized columns.

---

## 📁 1. The Excel (.xlsx) Import System

Excel spreadsheets must be structured precisely so the parser can map columns to database fields. Download the default template to use as a baseline, or set up your columns as follows:

### Column Ordering and Definitions

Your sheet MUST contain the following column headers in Row 1:

| Column Position | Header Name | Type | Description |
| :--- | :--- | :--- | :--- |
| **A** | `id` | String (Required) | Unique lowercase identifier (e.g. `superstore-sales`). |
| **B** | `title` | String (Required) | Full title of the project. |
| **C** | `slug` | String (Required) | URL-friendly unique slug. |
| **D** | `subtitle` | String | Supporting headline. |
| **E** | `summary` | String (Required) | 2-sentence executive overview. |
| **F** | `industry` | String | Target market or sector. |
| **G** | `role` | String | Your professional role. |
| **H** | `duration` | String | Project duration (e.g., `3 Months`). |
| **I** | `status` | String (Required) | Status: `draft` or `published`. |
| **J** | `difficulty` | String (Required) | Depth: `beginner`, `intermediate`, `advanced`, `expert`. |
| **K** | `objective` | String (Required) | Strategic problem/objective statement. |
| **L** | `datasetDesc` | String | Sources, dimensions, and rows. |
| **M** | `methodology` | String (Required) | Sequenced analytical stages. |
| **N** | `businessProblem` | String | Expanded business context. |
| **O** | `dataCleaning` | String | Specific cleaning/modeling actions. |
| **P** | `findings` | String | Actionable diagnostic insights. |
| **Q** | `recommendations`| String | Numbered business recommendations. |
| **R** | `challengesText` | String | Structural roadblocks and workarounds. |
| **S** | `lessonsLearned` | String | Professional takeaways. |
| **T** | `tags` | List (Required) | Comma-separated tools used (e.g. `Power BI, DAX, SQL`). |
| **U** | `categories` | List (Required) | Comma-separated domains (e.g. `Business Intelligence, Retail`). |
| **V** | `githubUrl` | String | Repository URL. |
| **W** | `liveUrl` | String | Interactive dashboard URL. |
| **X** | `date` | Date / String | Date of completion (e.g., `2026-07-21`). |

*Note: Excel sheets do not support deep nested structures like `storyBlocks` natively. When importing via Excel, default story blocks will be auto-generated based on your executive summary and methodology to keep the UI fully populated.*

---

## 🗃️ 2. The JSON (.json) Import System

JSON is the native data model of Portfolio OS. It supports full, deep case studies with multiple metrics and story blocks.

### The Import Payload Structure
An import payload must be a JSON object containing either:
- A full portfolio backup (with both `"profile"` and `"projects"` properties)
- Or a standalone `"projects"` collection.

```json
{
  "version": "1.0.0",
  "profile": {
    "name": "Alex Carter",
    "title": "Lead Analytics Architect",
    "bio": "Detailed bio here...",
    "email": "alex@carter.io",
    "location": "Boston, MA",
    "lookingForJob": true
  },
  "projects": [
    {
      "id": "financial-churn",
      "title": "Customer Churn Diagnostic Analysis",
      "slug": "customer-churn-diagnostic",
      "summary": "Engineered a predictive churn pipeline...",
      "status": "published",
      "difficulty": "expert",
      "objective": "Isolate high-churn segments...",
      "methodology": "1. Cleaned datasets...",
      "tags": ["Python", "SQL", "Tableau"],
      "categories": ["Predictive Analytics"],
      "metrics": [
        {
          "id": "churn-m1",
          "label": "Churn Rate Reduced",
          "value": "-14.2%",
          "description": "Implemented proactive contact recommendations.",
          "iconName": "TrendingDown"
        }
      ]
    }
  ]
}
```

---

## 🔍 3. Pre-Import Validation Checklist

Before applying any import, the Portfolio OS compiler runs static analysis and security checks:

1. **Unique IDs**: The engine checks for duplicate IDs within the file or with already loaded case studies.
2. **Missing Hard Requirements**: Title, Summary, Methodology, and Tags are audited. Missing fields are shown in an interactive pre-import alert.
3. **Overwrite Safeguard**: The system will warn you if any imported case studies will replace existing files. You must explicitly toggle the *"Authorize overwriting"* checkbox to approve.
4. **Invalid URLs**: URLs must begin with `http://` or `https://` to ensure perfect hyperlinks.
