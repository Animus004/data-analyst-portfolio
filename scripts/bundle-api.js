/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import esbuild from "esbuild";
import fs from "fs";
import path from "path";

const entryMap = [
  { src: "src/api/portfolio/ai.ts", dest: "api/portfolio/ai.js" },
  { src: "src/api/portfolio/index.ts", dest: "api/portfolio/index.js" },
  { src: "src/api/import.ts", dest: "api/import.js" },
  { src: "src/api/generate.ts", dest: "api/generate.js" },
  { src: "src/api/health.ts", dest: "api/health.js" }
];

console.log("[BUNDLE-API] Inlining all backend dependencies into Vercel Serverless Function entrypoints...");

// Step 1: Ensure destination directories exist
for (const entry of entryMap) {
  const destDir = path.dirname(path.resolve(process.cwd(), entry.dest));
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
}

// Step 2: Clean up any old .ts files in /api so Vercel only sees .js files
const apiDir = path.resolve(process.cwd(), "api");
function removeTsFiles(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) {
      removeTsFiles(full);
    } else if (file.endsWith(".ts")) {
      fs.unlinkSync(full);
      console.log(`[BUNDLE-API] Removed TypeScript source from /api: ${full}`);
    }
  }
}
removeTsFiles(apiDir);

// Step 3: Bundle each source entrypoint into a single self-contained JS file in /api
for (const entry of entryMap) {
  const srcPath = path.resolve(process.cwd(), entry.src);
  const destPath = path.resolve(process.cwd(), entry.dest);

  if (!fs.existsSync(srcPath)) {
    console.error(`[BUNDLE-API] ERROR: Missing source file ${entry.src}`);
    process.exit(1);
  }

  const result = esbuild.buildSync({
    entryPoints: [srcPath],
    bundle: true,
    platform: "node",
    target: "node18",
    format: "esm",
    packages: "external",
    write: false
  });

  const bundledCode = "// @ts-nocheck\n" + result.outputFiles[0].text;

  // Verify zero relative imports remain
  const lines = bundledCode.split("\n");
  const relativeImports = lines.filter((line) => {
    const trimmed = line.trim();
    return (
      (trimmed.startsWith("import ") || trimmed.startsWith("import(")) &&
      (trimmed.includes("./") || trimmed.includes("../") || trimmed.includes("_lib") || trimmed.includes("src/"))
    );
  });

  if (relativeImports.length > 0) {
    console.error(`[BUNDLE-API] ERROR: ${entry.dest} still contains relative imports:`, relativeImports);
    process.exit(1);
  }

  fs.writeFileSync(destPath, bundledCode, "utf8");
  console.log(`[BUNDLE-API] Successfully bundled ${entry.src} -> ${entry.dest} (${bundledCode.length} bytes, 0 relative imports).`);
}

console.log("[BUNDLE-API] All API endpoints successfully bundled into self-contained Vercel JS functions.");
