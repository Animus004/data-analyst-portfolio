/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from "@supabase/supabase-js";
import path from "path";
import fs from "fs";
import { defaultCreatorProfile, seedProjects } from "../../../data/seedData";

let supabaseClient: any = null;

export function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      const sanitizedUrl = supabaseUrl.trim().replace(/\/rest\/v1\/?$/, "");
      supabaseClient = createClient(sanitizedUrl, supabaseKey);
      return supabaseClient;
    } catch (e) {
      console.error("ServerStorage: Failed to initialize Supabase:", e);
    }
  }
  return null;
}

// Locate safe data directory
export function getDataDirectory(): string {
  // If running on Vercel or read-only filesystem, use /tmp
  if (process.env.VERCEL === "1") {
    return "/tmp/portfolio-data";
  }
  return path.join(process.cwd(), "data");
}

export function getPortfolioFilePath(): string {
  return path.join(getDataDirectory(), "portfolioon");
}

export function getBackupsDirectory(): string {
  return path.join(getDataDirectory(), "backups");
}

export function ensureDataFile() {
  try {
    const dataDir = getDataDirectory();
    const filePath = getPortfolioFilePath();

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(filePath)) {
      const initialData = {
        version: "1.0.0",
        profile: defaultCreatorProfile,
        projects: seedProjects
      };
      fs.writeFileSync(filePath, JSON.stringify(initialData, null, 2), "utf8");
    }
  } catch (err) {
    console.error("ensureDataFile failed:", err);
  }
}

export function ensureBackupsDir() {
  try {
    const backupDir = getBackupsDirectory();
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
  } catch (err) {
    console.error("ensureBackupsDir failed:", err);
  }
}

export async function fetchFromSupabase() {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from("portfolio_state")
      .select("*")
      .eq("id", "current")
      .maybeSingle();

    if (!error && data?.payload) {
      return data.payload;
    }

    const { data: altData, error: altError } = await client
      .from("portfolio_data")
      .select("*")
      .eq("id", "current")
      .maybeSingle();

    if (!altError && altData?.payload) {
      return altData.payload;
    }
  } catch (e) {
    console.error("fetchFromSupabase exception:", e);
  }
  return null;
}

export async function saveToSupabase(payload: any) {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client
      .from("portfolio_state")
      .upsert({
        id: "current",
        payload,
        updated_at: new Date().toISOString()
      });

    if (!error) return true;

    const { error: altError } = await client
      .from("portfolio_data")
      .upsert({
        id: "current",
        payload,
        updated_at: new Date().toISOString()
      });

    if (!altError) return true;
  } catch (e) {
    console.error("saveToSupabase exception:", e);
  }
  return false;
}

export const syncToSupabase = saveToSupabase;
