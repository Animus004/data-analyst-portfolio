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

/**
 * Safely parses API HTTP responses to JSON.
 * Prevents front-end SyntaxError crashes when serverless gateways return HTML/text error pages (e.g. 504 Gateway Timeout).
 */
export async function safeParseJsonResponse(res: Response): Promise<{ ok: boolean; data: any; rawText: string }> {
  let rawText = "";
  try {
    rawText = await res.text();
  } catch (e) {
    return {
      ok: false,
      data: { error: `Failed to read network response body (Status ${res.status}).` },
      rawText: ""
    };
  }

  try {
    const data = JSON.parse(rawText);
    return { ok: res.ok, data, rawText };
  } catch (e) {
    let readableError = `Server returned an unformatted non-JSON response (HTTP ${res.status}).`;
    if (res.status === 504) {
      readableError = `Gateway Timeout (HTTP 504): Package processing exceeded the execution time limit. Try uploading fewer or smaller files.`;
    } else if (res.status === 502) {
      readableError = `Bad Gateway (HTTP 502): The serverless process failed to complete.`;
    } else if (res.status === 500) {
      readableError = `Server Error (HTTP 500): ${rawText.slice(0, 150) || "Internal server exception."}`;
    }

    return {
      ok: false,
      data: { error: readableError },
      rawText
    };
  }
}
