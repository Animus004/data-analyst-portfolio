/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const LOCAL_STORAGE_OWNER_KEY = "portfolio_owner_key";
const DEFAULT_OWNER_KEY = "owner-authenticated-session";

/**
 * Retrieves the active owner key from environment variables, localStorage, or fallback defaults.
 */
export function getOwnerKey(): string {
  if (typeof window !== "undefined") {
    const storedKey = localStorage.getItem(LOCAL_STORAGE_OWNER_KEY);
    if (storedKey && storedKey.trim()) {
      return storedKey.trim();
    }
  }

  const viteKey = 
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_PORTFOLIO_OWNER_KEY) ||
    (typeof process !== "undefined" && process.env?.VITE_PORTFOLIO_OWNER_KEY) ||
    (typeof process !== "undefined" && process.env?.PORTFOLIO_OWNER_KEY);

  if (viteKey && viteKey.trim()) {
    return viteKey.trim();
  }

  return DEFAULT_OWNER_KEY;
}

/**
 * Sets and persists a custom owner secret key into localStorage for front-end write permissions.
 */
export function setOwnerKey(newKey: string): void {
  if (typeof window !== "undefined") {
    if (newKey && newKey.trim()) {
      localStorage.setItem(LOCAL_STORAGE_OWNER_KEY, newKey.trim());
    } else {
      localStorage.removeItem(LOCAL_STORAGE_OWNER_KEY);
    }
  }
}

/**
 * Generates single-owner security headers for API requests.
 */
export function getOwnerAuthHeaders(): Record<string, string> {
  const key = getOwnerKey();
  return {
    "Authorization": `Bearer ${key}`,
    "x-owner-access-key": key,
    "x-owner-key": key
  };
}

/**
 * Centralized fetch client wrapper that automatically attaches owner authentication headers
 * to outgoing API requests.
 */
export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const authHeaders = getOwnerAuthHeaders();
  const existingHeaders = init.headers ? (init.headers as Record<string, string>) : {};

  const mergedHeaders: Record<string, string> = {
    ...authHeaders,
    ...existingHeaders
  };

  return fetch(input, {
    ...init,
    headers: mergedHeaders
  });
}
