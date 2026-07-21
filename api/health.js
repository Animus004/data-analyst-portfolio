// @ts-nocheck
// src/api/_lib/utils/index.ts
function sendSuccess(res, data) {
  return res.status(200).json({
    success: true,
    ...data
  });
}

// src/api/health.ts
function handler(req, res) {
  return sendSuccess(res, {
    status: "healthy",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
}
export {
  handler as default
};
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
