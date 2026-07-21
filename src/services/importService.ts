/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from "xlsx";
import { CreatorProfile, ProjectRecord, ProjectStatus, TechnicalDifficulty, MetricHighlight, ContentBlock } from "../types";

export interface ValidationReport {
  isValid: boolean; // True if can be imported (no critical errors)
  errors: string[];  // Blocking errors
  warnings: string[]; // Missing professional elements
  profileParsed?: CreatorProfile;
  projectsParsed?: ProjectRecord[];
}

// Allowed profile keys to parse from Column-based excel or row-based
const PROFILE_KEYS = [
  "name",
  "title",
  "subtitle",
  "bio",
  "location",
  "timezone",
  "email",
  "resumeUrl",
  "githubUrl",
  "linkedinUrl",
  "avatarUrl",
  "lookingForJob",
  "statusBadge",
  "heroCtaText",
  "quickStackSkills",
  "currentFocus",
  "targetRole",
  "currentlyLearning"
];

/**
 * Validates a parsed profile object against required fields and returns warnings/errors.
 */
function validateProfile(profile: any): { errors: string[]; warnings: string[]; validated: CreatorProfile } {
  const errors: string[] = [];
  const warnings: string[] = [];

  const defaultProfile: CreatorProfile = {
    name: String(profile?.name || "").trim(),
    title: String(profile?.title || "").trim(),
    subtitle: String(profile?.subtitle || "").trim(),
    bio: String(profile?.bio || "").trim(),
    location: String(profile?.location || "").trim(),
    timezone: String(profile?.timezone || "").trim(),
    email: String(profile?.email || "").trim(),
    resumeUrl: String(profile?.resumeUrl || "#").trim(),
    githubUrl: String(profile?.githubUrl || "").trim(),
    linkedinUrl: String(profile?.linkedinUrl || "").trim(),
    avatarUrl: String(profile?.avatarUrl || "").trim(),
    lookingForJob: profile?.lookingForJob === true || String(profile?.lookingForJob).toLowerCase() === "true" || profile?.lookingForJob === 1,
    statusBadge: String(profile?.statusBadge || "Open to Opportunities").trim(),
    heroCtaText: String(profile?.heroCtaText || "Explore Case Studies").trim(),
    quickStackSkills: Array.isArray(profile?.quickStackSkills) 
      ? profile.quickStackSkills.map((s: any) => String(s).trim())
      : typeof profile?.quickStackSkills === "string"
        ? profile.quickStackSkills.split(",").map((s: string) => s.trim()).filter((s: string) => s.length > 0)
        : [],
    currentFocus: String(profile?.currentFocus || "").trim(),
    targetRole: String(profile?.targetRole || "").trim(),
    currentlyLearning: String(profile?.currentlyLearning || "").trim()
  };

  if (!defaultProfile.name) {
    errors.push("Profile: 'name' is required.");
  }
  if (!defaultProfile.title) {
    errors.push("Profile: 'title' is required.");
  }
  if (!defaultProfile.email) {
    errors.push("Profile: 'email' is required.");
  }
  if (!defaultProfile.bio) {
    warnings.push("Profile: 'bio' is empty. Recruiter narrative will be missing.");
  }
  if (!defaultProfile.location) {
    warnings.push("Profile: 'location' is empty.");
  }
  if (defaultProfile.quickStackSkills.length === 0) {
    warnings.push("Profile: 'quickStackSkills' has no technologies listed.");
  }

  return { errors, warnings, validated: defaultProfile };
}

/**
 * Validates a parsed project record and ensures all critical & analytical fields exist.
 */
function isValidUrl(str: string): boolean {
  if (!str) return true;
  const trimmed = str.trim();
  if (trimmed === "#" || trimmed === "" || trimmed.startsWith("/") || trimmed.includes("insert-") || trimmed.includes("...") || trimmed.includes("github.com/...")) {
    return true; // Allow placeholders and relative paths
  }
  // Flexible URL validation regex
  try {
    const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i;
    return urlPattern.test(trimmed);
  } catch (e) {
    return false;
  }
}

/**
 * Validates parsed project records and ensures all critical & analytical fields exist.
 */
function validateProjects(projects: any[]): { errors: string[]; warnings: string[]; validated: ProjectRecord[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const validated: ProjectRecord[] = [];

  if (!Array.isArray(projects) || projects.length === 0) {
    errors.push("Projects list is empty or invalid.");
    return { errors, warnings, validated };
  }

  const seenProjectIds = new Set<string>();

  projects.forEach((proj, idx) => {
    // Check ID
    const id = String(proj?.id || "").trim();
    if (!id) {
      errors.push(`Project index ${idx}: Invalid ID. Unique 'id' is required.`);
      return;
    }

    // Format check for ID (alphanumeric, hyphens, underscores only)
    const idRegex = /^[a-zA-Z0-9\-_]+$/;
    if (!idRegex.test(id)) {
      errors.push(`Project index ${idx}: Invalid ID '${id}'. IDs must be non-empty and consist only of alphanumeric characters, hyphens, or underscores.`);
      return;
    }

    // Duplicate ID check
    if (seenProjectIds.has(id)) {
      errors.push(`Duplicate ID: Project with ID '${id}' appears multiple times in the import payload.`);
      return;
    }
    seenProjectIds.add(id);

    const label = proj?.title ? `"${proj.title}"` : `Project '${id}'`;

    // Check Title
    const title = String(proj?.title || "").trim();
    if (!title) {
      errors.push(`Project '${id}': Missing Title. 'title' is required.`);
      return;
    }

    // Check Slug
    const slug = String(proj?.slug || "").trim() || id.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    // Status mapping & verification
    let status = ProjectStatus.DRAFT;
    const inputStatus = String(proj?.status || "").toLowerCase();
    if (inputStatus === "published") status = ProjectStatus.PUBLISHED;
    if (inputStatus === "archived") status = ProjectStatus.ARCHIVED;

    // Difficulty mapping
    let difficulty = TechnicalDifficulty.INTERMEDIATE;
    const inputDiff = String(proj?.difficulty || "").toLowerCase();
    if (inputDiff === "beginner") difficulty = TechnicalDifficulty.BEGINNER;
    if (inputDiff === "advanced") difficulty = TechnicalDifficulty.ADVANCED;
    if (inputDiff === "expert") difficulty = TechnicalDifficulty.EXPERT;

    // Tags and Categories
    const tags = Array.isArray(proj?.tags) 
      ? proj.tags.map((t: any) => String(t).trim())
      : typeof proj?.tags === "string"
        ? proj.tags.split(",").map((t: string) => t.trim()).filter((t: string) => t.length > 0)
        : [];
        
    const categories = Array.isArray(proj?.categories)
      ? proj.categories.map((c: any) => String(c).trim())
      : typeof proj?.categories === "string"
        ? proj.categories.split(",").map((c: string) => c.trim()).filter((c: string) => c.length > 0)
        : ["Data Analytics"];

    // Metrics validation
    const rawMetrics = Array.isArray(proj?.metrics) ? proj.metrics : [];
    const seenMetricIds = new Set<string>();
    const metrics: MetricHighlight[] = [];

    rawMetrics.forEach((m: any, mIdx: number) => {
      const mId = String(m?.id || `m-${id}-${mIdx}`).trim();
      if (seenMetricIds.has(mId)) {
        errors.push(`Project ${label}: Duplicate Metric ID '${mId}' detected.`);
      }
      seenMetricIds.add(mId);

      metrics.push({
        id: mId,
        label: String(m?.label || "").trim(),
        value: String(m?.value || "").trim(),
        description: String(m?.description || "").trim(),
        iconName: m?.iconName ? String(m.iconName).trim() : undefined
      });
    });

    // Story blocks validation
    const rawStory = Array.isArray(proj?.storyBlocks) ? proj.storyBlocks : [];
    const seenStoryBlockIds = new Set<string>();
    const storyBlocks: ContentBlock[] = [];

    rawStory.forEach((b: any, bIdx: number) => {
      const sbId = String(b?.id || `sb-${id}-${bIdx}`).trim();
      if (seenStoryBlockIds.has(sbId)) {
        errors.push(`Project ${label}: Duplicate Story Block ID '${sbId}' detected.`);
      }
      seenStoryBlockIds.add(sbId);

      storyBlocks.push({
        id: sbId,
        type: (b?.type === "markdown" || b?.type === "code_snippet" || b?.type === "chart_data" || b?.type === "image_gallery" || b?.type === "quote") 
          ? b.type 
          : "markdown",
        title: b?.title ? String(b.title).trim() : undefined,
        bodyContent: String(b?.bodyContent || "").trim(),
        language: b?.language ? String(b.language).trim() : undefined,
        imageUrl: b?.imageUrl ? String(b.imageUrl).trim() : undefined,
        caption: b?.caption ? String(b.caption).trim() : undefined
      });
    });

    // Supporting images
    const images = Array.isArray(proj?.images)
      ? proj.images.map((img: any) => String(img).trim())
      : typeof proj?.images === "string"
        ? proj.images.split(",").map((i: string) => i.trim()).filter((i: string) => i.length > 0)
        : [];

    const validatedProj: ProjectRecord = {
      id,
      title,
      slug,
      subtitle: String(proj?.subtitle || "").trim(),
      summary: String(proj?.summary || "").trim(),
      industry: String(proj?.industry || "Uncategorized").trim(),
      role: String(proj?.role || "Contributor").trim(),
      duration: String(proj?.duration || "N/A").trim(),
      status,
      difficulty,
      objective: String(proj?.objective || "").trim(),
      datasetDesc: String(proj?.datasetDesc || "").trim(),
      methodology: String(proj?.methodology || "").trim(),
      overviewText: String(proj?.overviewText || proj?.summary || "").trim(),
      businessProblem: String(proj?.businessProblem || proj?.objective || "").trim(),
      dataCleaning: String(proj?.dataCleaning || "").trim(),
      analysisText: String(proj?.analysisText || "").trim(),
      findings: String(proj?.findings || "").trim(),
      recommendations: String(proj?.recommendations || "").trim(),
      challengesText: String(proj?.challengesText || "").trim(),
      lessonsLearned: String(proj?.lessonsLearned || "").trim(),
      tags,
      categories,
      metrics,
      storyBlocks,
      githubUrl: proj?.githubUrl ? String(proj.githubUrl).trim() : undefined,
      liveUrl: proj?.liveUrl ? String(proj.liveUrl).trim() : undefined,
      documentationUrl: proj?.documentationUrl ? String(proj.documentationUrl).trim() : undefined,
      date: proj?.date ? String(proj.date).trim() : undefined,
      timeSpent: proj?.timeSpent ? String(proj.timeSpent).trim() : undefined,
      skills: Array.isArray(proj?.skills) 
        ? proj.skills.map((s: any) => String(s).trim())
        : typeof proj?.skills === "string"
          ? proj.skills.split(",").map((s: string) => s.trim()).filter((s: string) => s.length > 0)
          : [],
      images,
      featured: proj?.featured === true || String(proj?.featured).toLowerCase() === "true" || proj?.featured === 1,
      visibility: (proj?.visibility === "public" || proj?.visibility === "private" || proj?.visibility === "unlisted") ? proj.visibility : "public",
      order: typeof proj?.order === "number" ? proj.order : idx,
      createdAt: proj?.createdAt ? String(proj.createdAt).trim() : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Strict validation warnings/checks matching requirement 7
    if (!validatedProj.summary) {
      warnings.push(`Project ${label}: Missing Summary (Executive Summary description).`);
    }
    if (validatedProj.metrics.length === 0) {
      warnings.push(`Project ${label}: Missing KPIs (No analytical KPIs declared).`);
      warnings.push(`Project ${label}: Missing Metrics (No structured numeric highlights listed).`);
    }
    if (validatedProj.storyBlocks.length === 0) {
      warnings.push(`Project ${label}: Missing Story Blocks (No content narrative blocks added).`);
    }
    if (!validatedProj.recommendations) {
      warnings.push(`Project ${label}: Missing Recommendations (No strategic action suggestions listed).`);
    }
    if (!validatedProj.lessonsLearned) {
      warnings.push(`Project ${label}: Missing Lessons (No lessonsLearned retrospective retrospective summaries).`);
    }
    if (!validatedProj.githubUrl) {
      warnings.push(`Project ${label}: Missing GitHub Repository Link.`);
    }
    if (validatedProj.images.length === 0) {
      warnings.push(`Project ${label}: Missing Media (No supporting gallery images or mock screenshots declared).`);
    }

    // Invalid URLs verification
    if (validatedProj.githubUrl && !isValidUrl(validatedProj.githubUrl)) {
      warnings.push(`Project ${label}: Invalid URL structure for 'githubUrl' ('${validatedProj.githubUrl}').`);
    }
    if (validatedProj.liveUrl && !isValidUrl(validatedProj.liveUrl)) {
      warnings.push(`Project ${label}: Invalid URL structure for 'liveUrl' ('${validatedProj.liveUrl}').`);
    }
    if (validatedProj.documentationUrl && !isValidUrl(validatedProj.documentationUrl)) {
      warnings.push(`Project ${label}: Invalid URL structure for 'documentationUrl' ('${validatedProj.documentationUrl}').`);
    }

    validated.push(validatedProj);
  });

  return { errors, warnings, validated };
}

export const importService = {
  /**
   * Generates a structural ValidationReport for raw JSON data.
   */
  validateJson(rawObj: any): ValidationReport {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!rawObj || typeof rawObj !== "object") {
      return { isValid: false, errors: ["Payload is not a valid JSON object."], warnings: [] };
    }

    // Check Root Structure
    if (!rawObj.profile) {
      errors.push("Missing 'profile' object in root.");
    }
    if (!rawObj.projects) {
      errors.push("Missing 'projects' array in root.");
    }

    if (errors.length > 0) {
      return { isValid: false, errors, warnings };
    }

    // Validate Profile
    const profileVal = validateProfile(rawObj.profile);
    errors.push(...profileVal.errors);
    warnings.push(...profileVal.warnings);

    // Validate Projects
    const projectsVal = validateProjects(rawObj.projects);
    errors.push(...projectsVal.errors);
    warnings.push(...projectsVal.warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      profileParsed: profileVal.validated,
      projectsParsed: projectsVal.validated
    };
  },

  /**
   * Reads and parses a File object, supporting Excel (.xlsx) and JSON (.json)
   */
  async parseAndValidateFile(file: File): Promise<ValidationReport> {
    const fileExtension = file.name.split(".").pop()?.toLowerCase();

    if (fileExtension === "json") {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const rawJson = JSON.parse(e.target?.result as string);
            resolve(this.validateJson(rawJson));
          } catch (err) {
            resolve({ isValid: false, errors: ["Failed to parse file. Ensure it is valid JSON."], warnings: [] });
          }
        };
        reader.onerror = () => resolve({ isValid: false, errors: ["Error reading file."], warnings: [] });
        reader.readAsText(file);
      });
    }

    if (fileExtension === "xlsx" || fileExtension === "xls") {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: "array" });
            
            let profileRaw: any = {};
            let projectsRaw: any[] = [];
            let metricsRaw: any[] = [];
            let kpisRaw: any[] = [];
            let storyBlocksRaw: any[] = [];
            let mediaRaw: any[] = [];
            let recommendationsRaw: any[] = [];
            let lessonsLearnedRaw: any[] = [];
            let challengesRaw: any[] = [];
            let githubRaw: any[] = [];
            
            const warnings: string[] = [];

            // Parse all sheets dynamically
            workbook.SheetNames.forEach(sheetName => {
              const nameLower = sheetName.toLowerCase().replace(/\s+/g, "");
              const sheet = workbook.Sheets[sheetName];
              
              if (nameLower === "profile" || nameLower === "identity") {
                const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                if (rows && rows.length > 0) {
                  const row0 = rows[0].map(k => String(k || "").trim().toLowerCase());
                  const keyIndex = row0.findIndex(k => PROFILE_KEYS.includes(k));
                  
                  if (keyIndex !== -1 && rows[1]) {
                    // Row-based key mapping (Row 1 has headers, Row 2 has values)
                    row0.forEach((k, idx) => {
                      if (k) {
                        profileRaw[k] = rows[1][idx];
                      }
                    });
                  } else {
                    // Column-based mapping (Col A is key, Col B is value)
                    rows.forEach(r => {
                      if (r && r.length >= 2) {
                        const k = String(r[0] || "").trim();
                        if (PROFILE_KEYS.includes(k)) {
                          profileRaw[k] = r[1];
                        }
                      }
                    });
                  }
                }
              } else if (nameLower === "projects" || nameLower === "casestudies" || nameLower === "casestudy") {
                projectsRaw = XLSX.utils.sheet_to_json(sheet);
              } else if (nameLower === "metrics") {
                metricsRaw = XLSX.utils.sheet_to_json(sheet);
              } else if (nameLower === "kpis" || nameLower === "kpi") {
                kpisRaw = XLSX.utils.sheet_to_json(sheet);
              } else if (nameLower === "storyblocks" || nameLower === "storyblocks" || nameLower === "narrative") {
                storyBlocksRaw = XLSX.utils.sheet_to_json(sheet);
              } else if (nameLower === "media" || nameLower === "images" || nameLower === "image") {
                mediaRaw = XLSX.utils.sheet_to_json(sheet);
              } else if (nameLower === "recommendations" || nameLower === "recommendation") {
                recommendationsRaw = XLSX.utils.sheet_to_json(sheet);
              } else if (nameLower === "lessonslearned" || nameLower === "lessons" || nameLower === "lessonslearned") {
                lessonsLearnedRaw = XLSX.utils.sheet_to_json(sheet);
              } else if (nameLower === "challenges" || nameLower === "challenge") {
                challengesRaw = XLSX.utils.sheet_to_json(sheet);
              } else if (nameLower === "github" || nameLower === "githuburl") {
                githubRaw = XLSX.utils.sheet_to_json(sheet);
              }
            });

            if (projectsRaw.length === 0) {
              resolve({ isValid: false, errors: ["Excel workbook must contain a 'Projects' sheet."], warnings: [] });
              return;
            }

            // Check for broken references in Sheet relations
            const validProjectIds = new Set(projectsRaw.map((p: any) => String(p.id || "").trim()).filter(Boolean));
            
            metricsRaw.forEach((m: any, mIdx: number) => {
              const pid = String(m.project_id || m.projectId || "").trim();
              if (pid && !validProjectIds.has(pid)) {
                warnings.push(`Broken Reference: Metric row ${mIdx + 1} references non-existent project_id '${pid}'.`);
              }
            });
            kpisRaw.forEach((k: any, kIdx: number) => {
              const pid = String(k.project_id || k.projectId || "").trim();
              if (pid && !validProjectIds.has(pid)) {
                warnings.push(`Broken Reference: KPI row ${kIdx + 1} references non-existent project_id '${pid}'.`);
              }
            });
            storyBlocksRaw.forEach((sb: any, sbIdx: number) => {
              const pid = String(sb.project_id || sb.projectId || "").trim();
              if (pid && !validProjectIds.has(pid)) {
                warnings.push(`Broken Reference: Story Block row ${sbIdx + 1} references non-existent project_id '${pid}'.`);
              }
            });
            recommendationsRaw.forEach((r: any, rIdx: number) => {
              const pid = String(r.project_id || r.projectId || "").trim();
              if (pid && !validProjectIds.has(pid)) {
                warnings.push(`Broken Reference: Recommendation row ${rIdx + 1} references non-existent project_id '${pid}'.`);
              }
            });

            // Reconstruct nested structures for each project
            const fullyFormedProjects = projectsRaw.map((proj: any, idx: number) => {
              const projectId = String(proj.id || "").trim() || `p-${idx}`;

              // 1. Map Metrics and KPIs
              const mergedMetrics = [
                ...metricsRaw.filter((m: any) => String(m.project_id || m.projectId || "").trim() === projectId),
                ...kpisRaw.filter((k: any) => String(k.project_id || k.projectId || "").trim() === projectId)
              ];
              const projectMetrics = mergedMetrics.map((m: any, mIdx: number) => ({
                id: String(m.id || `m-${projectId}-${mIdx}-${Math.random().toString(36).substr(2, 4)}`).trim(),
                label: String(m.label || m.name || m.title || "KPI Metric").trim(),
                value: String(m.value || m.amount || "N/A").trim(),
                description: String(m.description || m.details || "").trim(),
                iconName: m.iconName || m.icon || undefined
              }));

              // 2. Map Story Blocks
              const projectStories = storyBlocksRaw
                .filter((sb: any) => String(sb.project_id || sb.projectId || "").trim() === projectId)
                .map((sb: any, sbIdx: number) => ({
                  id: String(sb.id || `sb-${projectId}-${sbIdx}-${Math.random().toString(36).substr(2, 4)}`).trim(),
                  type: (sb.type === "markdown" || sb.type === "code_snippet" || sb.type === "chart_data" || sb.type === "image_gallery" || sb.type === "quote") 
                    ? sb.type 
                    : "markdown",
                  title: sb.title ? String(sb.title).trim() : undefined,
                  bodyContent: String(sb.bodyContent || sb.content || sb.text || "").trim(),
                  language: sb.language ? String(sb.language).trim() : undefined,
                  imageUrl: sb.imageUrl || sb.url || undefined,
                  caption: sb.caption ? String(sb.caption).trim() : undefined
                }));

              // 3. Map Media / Images
              const projectImages = [
                ...(Array.isArray(proj.images) ? proj.images : typeof proj.images === "string" ? proj.images.split(",").map((i: string) => i.trim()).filter(Boolean) : []),
                ...mediaRaw
                  .filter((med: any) => String(med.project_id || med.projectId || "").trim() === projectId)
                  .map((med: any) => String(med.imageUrl || med.url || med.imagePath || "").trim())
                  .filter(Boolean)
              ];

              // 4. Map Recommendations
              const projectRecs = recommendationsRaw.filter((r: any) => String(r.project_id || r.projectId || "").trim() === projectId);
              let recommendationsText = proj.recommendations || "";
              if (projectRecs.length > 0) {
                const recLines = projectRecs.map((r: any) => {
                  const author = r.recommender || r.author || r.name || "Anonymous";
                  const role = r.role || r.title || "";
                  const text = r.text || r.content || r.recommendation || "";
                  return `"${text}" - ${author} (${role})`;
                }).join("\n\n");
                
                recommendationsText = recommendationsText 
                  ? `${recommendationsText}\n\n### External Recommendations\n${recLines}`
                  : recLines;

                // Also append as story blocks of type "quote" for premium presentation!
                projectRecs.forEach((r: any, rIdx: number) => {
                  projectStories.push({
                    id: `sb-rec-${projectId}-${rIdx}-${Math.random().toString(36).substr(2, 4)}`,
                    type: "quote",
                    title: r.recommender || r.author || r.name || "Colleague Recommendation",
                    bodyContent: r.text || r.content || r.recommendation || "",
                    caption: `${r.recommender || r.author || r.name || "Colleague"}${r.role ? `, ${r.role}` : ""}`,
                    language: undefined,
                    imageUrl: undefined
                  });
                });
              }

              // 5. Map Lessons Learned
              const lessonsList = lessonsLearnedRaw.filter((l: any) => String(l.project_id || l.projectId || "").trim() === projectId);
              let lessonsText = proj.lessonsLearned || "";
              if (lessonsList.length > 0) {
                const lessonLines = lessonsList.map((l: any) => l.lesson || l.text || l.description || "").filter(Boolean).join("\n- ");
                lessonsText = lessonsText
                  ? `${lessonsText}\n\n### Documented Lessons\n- ${lessonLines}`
                  : `- ${lessonLines}`;
              }

              // 6. Map Challenges
              const challengesList = challengesRaw.filter((c: any) => String(c.project_id || c.projectId || "").trim() === projectId);
              let challengesText = proj.challengesText || "";
              if (challengesList.length > 0) {
                const challengeLines = challengesList.map((c: any) => c.challenge || c.text || c.description || "").filter(Boolean).join("\n- ");
                challengesText = challengesText
                  ? `${challengesText}\n\n### Technical Challenges\n- ${challengeLines}`
                  : `- ${challengeLines}`;
              }

              // 7. Map GitHub URL
              const githubList = githubRaw.filter((g: any) => String(g.project_id || g.projectId || "").trim() === projectId);
              let githubUrl = proj.githubUrl || undefined;
              if (githubList.length > 0) {
                githubUrl = String(githubList[0].githubUrl || githubList[0].url || githubList[0].link || "").trim();
              }

              return {
                ...proj,
                id: projectId,
                metrics: projectMetrics,
                storyBlocks: projectStories,
                images: projectImages,
                recommendations: recommendationsText,
                lessonsLearned: lessonsText,
                challengesText: challengesText,
                githubUrl: githubUrl
              };
            });

            // Re-validate constructed object
            const validatedReport = this.validateJson({
              version: "1.0.0",
              schemaVersion: "v1.0",
              profile: profileRaw,
              projects: fullyFormedProjects
            });

            // Append Excel warnings
            validatedReport.warnings.push(...warnings);
            resolve(validatedReport);

          } catch (err: any) {
            resolve({ isValid: false, errors: [`Failed to parse Excel spreadsheet file: ${err.message}`], warnings: [] });
          }
        };
        reader.onerror = () => resolve({ isValid: false, errors: ["Error reading Excel file."], warnings: [] });
        reader.readAsArrayBuffer(file);
      });
    }

    return { isValid: false, errors: ["Unsupported file format. Please upload a .json or .xlsx file."], warnings: [] };
  },

  /**
   * Helper to trigger download of Portfolio payload JSON.
   */
  exportToJsonFile(profile: CreatorProfile, projects: ProjectRecord[]) {
    const payload = {
      version: "1.0.0",
      profile,
      projects
    };

    const jsonString = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.download = `portfolio-os-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};
