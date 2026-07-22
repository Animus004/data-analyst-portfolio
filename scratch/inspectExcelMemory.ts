import fs from "fs";
import path from "path";
import { parseStreamExcel } from "../src/api/_lib/parsers/streamExcel";

async function runMemoryOwnershipAudit() {
  console.log("==========================================================");
  console.log("[MEMORY OWNERSHIP AUDIT: ExcelParser & Reference Chain]");
  console.log("==========================================================\n");

  const samplePath = "D:\\DSA\\Amazon Product Review Dashboard Project\\analysis\\Amazon customer engagemebt analysis.xlsx";
  const fileBuffer = fs.readFileSync(samplePath);
  let base64Content: string | null = fileBuffer.toString("base64");

  console.log(`[BEFORE PARSE] Base64 Content String Length: ${base64Content.length} chars`);
  if (global.gc) global.gc();
  const memStart = process.memoryUsage();
  console.log(`[BEFORE PARSE] Heap Used: ${(memStart.heapUsed / (1024 * 1024)).toFixed(2)} MB | RSS: ${(memStart.rss / (1024 * 1024)).toFixed(2)} MB`);

  let result: any = await parseStreamExcel("Amazon customer engagemebt analysis.xlsx", base64Content);

  const memAfterParse = process.memoryUsage();
  console.log(`\n[AFTER PARSE (Pre-GC)] Heap Used: ${(memAfterParse.heapUsed / (1024 * 1024)).toFixed(2)} MB | RSS: ${(memAfterParse.rss / (1024 * 1024)).toFixed(2)} MB`);

  // Null out base64Content to simulate scope dereferencing
  base64Content = null;

  if (global.gc) {
    global.gc();
    const memAfterGc1 = process.memoryUsage();
    console.log(`[AFTER GC WITH RESULT RETAINED] Heap Used: ${(memAfterGc1.heapUsed / (1024 * 1024)).toFixed(2)} MB | RSS: ${(memAfterGc1.rss / (1024 * 1024)).toFixed(2)} MB`);
  }

  // Null out result to simulate full cleanup
  result = null;

  if (global.gc) {
    global.gc();
    const memAfterGc2 = process.memoryUsage();
    console.log(`[AFTER GC WITH ALL DEREFERENCED] Heap Used: ${(memAfterGc2.heapUsed / (1024 * 1024)).toFixed(2)} MB | RSS: ${(memAfterGc2.rss / (1024 * 1024)).toFixed(2)} MB`);
  }
}

runMemoryOwnershipAudit().catch(console.error);
