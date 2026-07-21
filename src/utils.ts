/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Generates a clean, random alphanumeric unique string identifier.
 * This helper replaces the deprecated String.prototype.substr() with slice()
 * to ensure long-term runtime compatibility and remove architectural technical debt.
 * 
 * @param prefix The prefix for the generated identifier.
 * @returns A unique identifier string (e.g., "input-abc123xyz").
 */
export function generateId(prefix: string): string {
  const randomSegment = Math.random().toString(36).slice(2, 11);
  return `${prefix}-${randomSegment}`;
}
