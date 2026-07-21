/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CreatorProfile, ProjectRecord } from "../types";
import { defaultCreatorProfile, seedProjects } from "../data/seedData";
import { createClient } from "@supabase/supabase-js";

const PROFILE_KEY = "portfolio_os_profile";
const PROJECTS_KEY = "portfolio_os_projects";
const VERSION_KEY = "portfolio_os_version";
const CURRENT_VERSION = "v0.3";

// Lazy-initialize Supabase client to avoid crash if env keys are not populated on startup
let supabaseClient: any = null;

export function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;

  // Retrieve environment variables with fallback support for Vite environment conventions
  const supabaseUrl = 
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_SUPABASE_URL) || 
    (typeof process !== "undefined" && process.env?.VITE_SUPABASE_URL) ||
    (typeof process !== "undefined" && process.env?.SUPABASE_URL) || 
    "";
  
  const supabaseKey = 
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) || 
    (typeof process !== "undefined" && process.env?.VITE_SUPABASE_ANON_KEY) ||
    (typeof process !== "undefined" && process.env?.SUPABASE_ANON_KEY) || 
    "";

  if (supabaseUrl && supabaseKey) {
    try {
      const sanitizedUrl = supabaseUrl.trim().replace(/\/rest\/v1\/?$/, "");
      supabaseClient = createClient(sanitizedUrl, supabaseKey);
      return supabaseClient;
    } catch (e) {
      console.error("StorageService: Failed to initialize Supabase Client:", e);
    }
  }
  return null;
}

export const storageService = {
  /**
   * Performs data migrations if the schema or data version has evolved.
   * Can be easily extended to fetch initial seeds from cloud datastores.
   */
  migrateIfNeeded(): void {
    const cachedVersion = localStorage.getItem(VERSION_KEY);

    if (cachedVersion !== CURRENT_VERSION) {
      // Version mismatch or fresh start: seed authentic data
      const currentProjects = this.loadProjects();
      const updatedProjects = currentProjects.map((p, idx) => ({
        ...p,
        featured: p.featured ?? false,
        visibility: p.visibility ?? "public",
        order: p.order ?? idx,
        createdAt: p.createdAt || new Date().toISOString(),
        updatedAt: p.updatedAt || new Date().toISOString()
      }));
      this.saveProfile(defaultCreatorProfile);
      this.saveProjects(updatedProjects.length > 0 ? updatedProjects : seedProjects);
      localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
    }
  },

  /**
   * Loads the current creator profile.
   * Ready to be swapped for async Firestore fetching inside a custom hook or service.
   */
  loadProfile(): CreatorProfile {
    const cached = localStorage.getItem(PROFILE_KEY);
    if (!cached) {
      this.saveProfile(defaultCreatorProfile);
      return defaultCreatorProfile;
    }
    try {
      const parsed = JSON.parse(cached);
      return {
        ...defaultCreatorProfile,
        ...parsed
      };
    } catch (e) {
      console.error("StorageService: failed to parse profile, fallback to seed.", e);
      return defaultCreatorProfile;
    }
  },

  /**
   * Saves the creator profile.
   * In a future multi-device sync module, this will also trigger a background write to Firestore.
   */
  saveProfile(profile: CreatorProfile): void {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  },

  /**
   * Loads the project list.
   */
  loadProjects(): ProjectRecord[] {
    const cached = localStorage.getItem(PROJECTS_KEY);
    if (!cached) {
      // Seed initially
      const seeded = seedProjects.map((p, idx) => ({
        ...p,
        featured: p.featured ?? (idx === 0), // default feature the first project
        visibility: p.visibility ?? "public",
        order: p.order ?? idx
      }));
      this.saveProjects(seeded);
      return seeded;
    }
    try {
      const parsed = JSON.parse(cached) as ProjectRecord[];
      // Guarantee fields are present
      return parsed.map((p, idx) => ({
        ...p,
        featured: p.featured ?? false,
        visibility: p.visibility ?? "public",
        order: p.order ?? idx
      })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    } catch (e) {
      console.error("StorageService: failed to parse projects, fallback to seed.", e);
      return seedProjects;
    }
  },

  /**
   * Saves the list of projects.
   */
  saveProjects(projects: ProjectRecord[]): void {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  },

  /**
   * Safely parses and imports a JSON backup file.
   */
  importBackup(jsonString: string): { profile: CreatorProfile; projects: ProjectRecord[] } | null {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed && typeof parsed === "object" && parsed.profile && Array.isArray(parsed.projects)) {
        this.saveProfile(parsed.profile);
        this.saveProjects(parsed.projects);
        return { profile: parsed.profile, projects: parsed.projects };
      }
    } catch (e) {
      console.error("StorageService: failed to import state backup payload", e);
    }
    return null;
  },

  /**
   * Fetches the entire portfolio data structure directly from Supabase.
   * Caches the loaded data in local storage as a fallback.
   */
  async fetchFromServer(): Promise<{ profile: CreatorProfile; projects: ProjectRecord[] } | null> {
    const client = getSupabaseClient();
    if (!client) {
      console.warn("StorageService: Supabase is not configured. Falling back to local storage cache.");
      return null;
    }

    try {
      // 1. Attempt read on primary 'portfolio_state' table
      const { data, error } = await client
        .from("portfolio_state")
        .select("payload")
        .eq("id", "current")
        .maybeSingle();

      if (!error && data?.payload) {
        const payload = data.payload;
        if (payload && payload.profile && Array.isArray(payload.projects)) {
          this.saveProfile(payload.profile);
          this.saveProjects(payload.projects);
          return { profile: payload.profile, projects: payload.projects };
        }
      }

      if (error) {
        console.warn("StorageService: 'portfolio_state' lookup error, trying fallback 'portfolio_data':", error.message);
      }

      // 2. Fallback read on 'portfolio_data' table
      const { data: altData, error: altError } = await client
        .from("portfolio_data")
        .select("payload")
        .eq("id", "current")
        .maybeSingle();

      if (!altError && altData?.payload) {
        const payload = altData.payload;
        if (payload && payload.profile && Array.isArray(payload.projects)) {
          this.saveProfile(payload.profile);
          this.saveProjects(payload.projects);
          return { profile: payload.profile, projects: payload.projects };
        }
      }

      if (altError) {
        console.error("StorageService: 'portfolio_data' fallback lookup also failed:", altError.message);
      }
    } catch (e: any) {
      console.error("StorageService: Direct Supabase fetch threw exception:", e);
    }
    return null;
  },

  /**
   * Saves the entire portfolio structure to Supabase directly using upsert.
   */
  async saveToServer(profile: CreatorProfile, projects: ProjectRecord[]): Promise<{ success: boolean; error?: string }> {
    // Check local network connectivity first
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return { success: false, error: "Offline Mode: No active internet connection detected." };
    }

    const client = getSupabaseClient();
    if (!client) {
      return { success: false, error: "Database Connection Error: Supabase client is unconfigured or invalid." };
    }

    const payload = {
      version: "1.0.0",
      schemaVersion: "v1.0",
      profile,
      projects
    };

    try {
      // 1. Attempt upsert into primary 'portfolio_state' table
      const { error } = await client
        .from("portfolio_state")
        .upsert({
          id: "current",
          payload: payload,
          updated_at: new Date().toISOString()
        });

      if (!error) {
        console.log("StorageService: Saved portfolio state to primary 'portfolio_state' table successfully.");
        return { success: true };
      }

      // Check for common connection / authentication / permission errors
      const isAuthError = error.code === "PGRST116" || error.code === "PGRST301" || error.message?.toLowerCase().includes("auth") || error.message?.toLowerCase().includes("permission");
      console.warn(`StorageService: Upsert failed on 'portfolio_state' (Code: ${error.code}):`, error.message);

      if (isAuthError) {
        return { success: false, error: `Authentication/Authorization Failure: ${error.message}` };
      }

      // 2. Try secondary 'portfolio_data' table
      console.log("StorageService: Retrying save operation on fallback table 'portfolio_data'...");
      const { error: altError } = await client
        .from("portfolio_data")
        .upsert({
          id: "current",
          payload: payload,
          updated_at: new Date().toISOString()
        });

      if (!altError) {
        console.log("StorageService: Saved portfolio state to fallback 'portfolio_data' table successfully.");
        return { success: true };
      }

      return { success: false, error: `Database Save Error: ${altError.message || error.message}` };
    } catch (e: any) {
      console.error("StorageService: Direct Supabase save threw critical exception:", e);
      return { success: false, error: `Network/Connectivity Error: ${e.message || "Request timed out."}` };
    }
  },

  /**
   * Fetches all snapshots/backups directly from Supabase portfolio_state or portfolio_data.
   */
  async fetchBackupsFromServer(): Promise<{ filename: string; createdAt: string; size: number }[]> {
    const client = getSupabaseClient();
    if (!client) return [];

    try {
      const { data, error } = await client
        .from("portfolio_state")
        .select("id, updated_at, payload")
        .neq("id", "current");

      if (!error && Array.isArray(data)) {
        return data.map(row => ({
          filename: row.id,
          createdAt: row.updated_at || new Date().toISOString(),
          size: row.payload ? JSON.stringify(row.payload).length : 0
        })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      }

      // Try fallback
      const { data: altData, error: altError } = await client
        .from("portfolio_data")
        .select("id, updated_at, payload")
        .neq("id", "current");

      if (!altError && Array.isArray(altData)) {
        return altData.map(row => ({
          filename: row.id,
          createdAt: row.updated_at || new Date().toISOString(),
          size: row.payload ? JSON.stringify(row.payload).length : 0
        })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      }
    } catch (e) {
      console.error("StorageService: Failed to fetch backups from server:", e);
    }
    return [];
  },

  /**
   * Creates a snapshot/backup directly on Supabase.
   */
  async createBackupOnServer(profile: CreatorProfile, projects: ProjectRecord[]): Promise<{ success: boolean; filename?: string; error?: string }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: "Supabase client not initialized" };

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    const filename = `portfolio-backup-${year}-${month}-${day}-${hours}-${minutes}-${seconds}`;

    const payload = {
      version: "1.0.0",
      schemaVersion: "v1.0",
      profile,
      projects
    };

    try {
      const { error } = await client
        .from("portfolio_state")
        .insert({
          id: filename,
          payload,
          updated_at: now.toISOString()
        });

      if (!error) return { success: true, filename };

      // Try fallback
      const { error: altError } = await client
        .from("portfolio_data")
        .insert({
          id: filename,
          payload,
          updated_at: now.toISOString()
        });

      if (!altError) return { success: true, filename };

      return { success: false, error: altError.message || error.message };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  /**
   * Restores a backup from Supabase.
   */
  async restoreBackupOnServer(filename: string): Promise<{ success: boolean; profile?: CreatorProfile; projects?: ProjectRecord[]; error?: string }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: "Supabase client not initialized" };

    try {
      // 1. Fetch the backup payload
      let backupPayload: any = null;
      const { data, error } = await client
        .from("portfolio_state")
        .select("payload")
        .eq("id", filename)
        .maybeSingle();

      if (!error && data?.payload) {
        backupPayload = data.payload;
      } else {
        const { data: altData, error: altError } = await client
          .from("portfolio_data")
          .select("payload")
          .eq("id", filename)
          .maybeSingle();
        if (!altError && altData?.payload) {
          backupPayload = altData.payload;
        }
      }

      if (!backupPayload || !backupPayload.profile || !Array.isArray(backupPayload.projects)) {
        return { success: false, error: "Invalid backup data structure or backup not found." };
      }

      // 2. Set as 'current' in Supabase
      const { error: upsertError } = await client
        .from("portfolio_state")
        .upsert({
          id: "current",
          payload: backupPayload,
          updated_at: new Date().toISOString()
        });

      if (upsertError) {
        await client
          .from("portfolio_data")
          .upsert({
            id: "current",
            payload: backupPayload,
            updated_at: new Date().toISOString()
          });
      }

      // Save locally
      this.saveProfile(backupPayload.profile);
      this.saveProjects(backupPayload.projects);

      return { success: true, profile: backupPayload.profile, projects: backupPayload.projects };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  /**
   * Deletes a backup from Supabase.
   */
  async deleteBackupOnServer(filename: string): Promise<{ success: boolean; error?: string }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: "Supabase client not initialized" };

    try {
      const { error } = await client
        .from("portfolio_state")
        .delete()
        .eq("id", filename);

      if (!error) return { success: true };

      const { error: altError } = await client
        .from("portfolio_data")
        .delete()
        .eq("id", filename);

      if (!altError) return { success: true };

      return { success: false, error: altError.message || error.message };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  /**
   * Run comprehensive Supabase diagnostics directly from the client.
   */
  async runSupabaseDiagnostics() {
    const diags = {
      supabase_conn: { status: "WARNING" as "PENDING" | "PASS" | "WARNING" | "FAILED", message: "" },
      supabase_init: { status: "PASS" as "PENDING" | "PASS" | "WARNING" | "FAILED", message: "" },
      supabase_sync: { status: "PASS" as "PENDING" | "PASS" | "WARNING" | "FAILED", message: "" }
    };

    const client = getSupabaseClient();
    if (!client) {
      diags.supabase_conn = {
        status: "WARNING",
        message: "Supabase parameters are unconfigured. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables."
      };
      diags.supabase_init = {
        status: "PASS",
        message: "Pending Initialization: Supabase not configured. Next Required Action: Set up your Supabase project keys."
      };
      diags.supabase_sync = {
        status: "PASS",
        message: "Never Synced (Supabase unconfigured)"
      };
      return diags;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      diags.supabase_conn = {
        status: "FAILED",
        message: "Network Connection Error: Client is currently offline."
      };
      diags.supabase_init = {
        status: "PASS",
        message: "Pending Initialization: Offline. Verification of database tables is deferred."
      };
      diags.supabase_sync = {
        status: "PASS",
        message: "Never Synced (Offline mode)"
      };
      return diags;
    }

    try {
      // Light check on portfolio_state
      const { data, error } = await client
        .from("portfolio_state")
        .select("id")
        .eq("id", "current")
        .maybeSingle();

      if (error) {
        const isTableMissing = error.code === "PGRST116" || error.code === "42P01" || error.message?.toLowerCase().includes("does not exist");
        const isAuthError = error.code === "PGRST301" || error.message?.toLowerCase().includes("auth") || error.message?.toLowerCase().includes("permission") || error.message?.toLowerCase().includes("key");

        if (isAuthError) {
          diags.supabase_conn = {
            status: "FAILED",
            message: `Authentication/Authorization Failure: Invalid API key or URL. Msg: ${error.message}`
          };
          diags.supabase_init = {
            status: "PASS",
            message: "Pending Initialization: Verification deferred due to authentication error."
          };
          diags.supabase_sync = {
            status: "PASS",
            message: "Never Synced"
          };
          return diags;
        }

        if (isTableMissing) {
          diags.supabase_conn = {
            status: "PASS",
            message: "Supabase Connection: Network connectivity and authentication verified."
          };
          diags.supabase_init = {
            status: "PASS", // Must be PASS, not treated as warning or failure
            message: "Pending Initialization: Required portfolio tables do not exist yet. Next Required Action: Run schema.sql migrations inside your Supabase SQL editor."
          };
          diags.supabase_sync = {
            status: "PASS",
            message: "Never Synced (Tables pending initialization)"
          };
          return diags;
        }

        diags.supabase_conn = {
          status: "FAILED",
          message: `Query Error (Code: ${error.code}): ${error.message}`
        };
        diags.supabase_init = {
          status: "PASS",
          message: "Pending Initialization: Query failed."
        };
        diags.supabase_sync = {
          status: "PASS",
          message: "Never Synced"
        };
        return diags;
      }

      // Success, connection and table exist!
      diags.supabase_conn = {
        status: "PASS",
        message: "Supabase Connection: Network connectivity and authentication verified."
      };
      diags.supabase_init = {
        status: "PASS",
        message: "Initialized: Required portfolio tables are detected."
      };

      // Retrieve synchronization status facts
      const { data: syncData, error: syncError } = await client
        .from("portfolio_state")
        .select("payload, updated_at")
        .eq("id", "current")
        .maybeSingle();

      if (!syncError && syncData?.payload) {
        const totalRecords = Array.isArray(syncData.payload.projects) ? syncData.payload.projects.length : 0;
        const lastSync = syncData.updated_at ? new Date(syncData.updated_at).toLocaleString() : "Never";
        diags.supabase_sync = {
          status: "PASS",
          message: `Last Sync Time: ${lastSync} | Total Records: ${totalRecords}`
        };
      } else {
        diags.supabase_sync = {
          status: "PASS",
          message: "Never Synced: Database contains no records yet."
        };
      }

    } catch (e: any) {
      diags.supabase_conn = {
        status: "FAILED",
        message: `Connection Error: ${e.message || "Failed to contact Supabase host."}`
      };
      diags.supabase_init = {
        status: "PASS",
        message: "Pending Initialization: Offline or unreachable."
      };
      diags.supabase_sync = {
        status: "PASS",
        message: "Never Synced"
      };
    }

    return diags;
  }
};

