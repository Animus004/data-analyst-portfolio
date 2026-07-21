/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendSuccess } from "./_lib/utils/index";

export default function handler(req: VercelRequest, res: VercelResponse) {
  return sendSuccess(res, {
    status: "healthy",
    timestamp: new Date().toISOString()
  });
}
