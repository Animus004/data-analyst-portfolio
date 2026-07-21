/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TimingStats {
  endpoint: string;
  totalDurationMs: number;
  parserSelected?: string;
  aiDurationMs?: number;
  supabaseDurationMs?: number;
  error?: string;
}

/**
 * Standard API error structure.
 */
export function sendError(res: any, status: number, message: string, details?: any, traceId?: string) {
  const tId = traceId || `err-${Math.random().toString(36).substring(2, 11)}`;
  return res.status(status).json({
    success: false,
    error: message,
    code: status,
    details: details || null,
    traceId: tId
  });
}

/**
 * Standard API success structure.
 */
export function sendSuccess(res: any, data: any) {
  return res.status(200).json({
    success: true,
    ...data
  });
}

/**
 * Centralized logging system for Portfolio OS requests.
 */
export function logExecution(stats: TimingStats) {
  console.log(`[PORTFOLIO-OS] API REQUEST METRICS:
  - Endpoint: ${stats.endpoint}
  - Exec Time: ${stats.totalDurationMs}ms
  - Parser: ${stats.parserSelected || "None"}
  - AI Exec Time: ${stats.aiDurationMs !== undefined ? `${stats.aiDurationMs}ms` : "N/A"}
  - Supabase Latency: ${stats.supabaseDurationMs !== undefined ? `${stats.supabaseDurationMs}ms` : "N/A"}
  - Errors: ${stats.error || "None"}
  - Timestamp: ${new Date().toISOString()}
  `);
}
