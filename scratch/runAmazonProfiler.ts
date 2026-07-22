import fs from "fs";
import path from "path";
import { compileProjectPackage } from "../src/api/_lib/compiler/index";
import { PipelineProfiler } from "../src/api/_lib/utils/pipelineProfiler";

async function main() {
  console.log("\n==========================================================");
  console.log("STARTING ONE E2E PROFILER RUN FOR AMAZON PROJECT");
  console.log("==========================================================\n");

  const profiler = new PipelineProfiler();

  const files = [
    {
      name: "README.md",
      path: "D:\\DSA\\Amazon Product Review Dashboard Project\\README.md"
    },
    {
      name: "Amazon customer engagemebt analysis.xlsx",
      path: "D:\\DSA\\Amazon Product Review Dashboard Project\\analysis\\Amazon customer engagemebt analysis.xlsx"
    },
    {
      name: "Dashboard.png",
      path: "D:\\DSA\\Amazon Product Review Dashboard Project\\assets\\screenshots\\Dashboard.png"
    },
    {
      name: "Dashboard.pdf",
      path: "D:\\DSA\\Amazon Product Review Dashboard Project\\dashboards\\Dashboard.pdf"
    },
    {
      name: "Data interpretation on Amazon customer review data.docx",
      path: "D:\\DSA\\Amazon Product Review Dashboard Project\\reports\\Data interpretation on Amazon customer review data.docx"
    }
  ];

  const rawFiles = files.map(f => {
    const buf = fs.readFileSync(f.path);
    const ext = f.name.split(".").pop()?.toLowerCase() || "";
    const isText = ["md", "txt", "csv", "json", "sql"].includes(ext);
    return {
      name: f.name,
      size: buf.length,
      type: isText ? "text/plain" : "application/octet-stream",
      content: buf.toString("base64")
    };
  });

  // Stage 1: Receive request
  const st1 = profiler.profileStageStart(1, "Receive request", `${rawFiles.length} file(s) total`);
  profiler.profileStageEnd(st1, `${rawFiles.length} file(s) parsed`);

  // Stage 2: Validate descriptors
  const st2 = profiler.profileStageStart(2, "Validate descriptors", `${rawFiles.length} descriptors`);
  profiler.profileStageEnd(st2, "All descriptors valid");

  // Stage 3: Download from Supabase (Simulated Local Resolution)
  const st3 = profiler.profileStageStart(3, "Download from Supabase", "Local File Stream");
  profiler.profileStageEnd(st3, "Local files loaded");

  // Stage 4: Resolve buffers
  const st4 = profiler.profileStageStart(4, "Resolve buffers", "5 buffers resolved");
  profiler.profileStageEnd(st4, "5 buffers verified");

  try {
    const output = await compileProjectPackage(rawFiles, {}, true, undefined, profiler);

    // Stage 15: Final JSON serialization
    const st15 = profiler.profileStageStart(15, "Final JSON serialization", "Compiler Output Object");
    const jsonOutputString = JSON.stringify(output);
    profiler.recordAllocation("Final Output JSON String", jsonOutputString.length);
    profiler.profileStageEnd(st15, `${jsonOutputString.length} bytes`);

    // Stage 16: HTTP Response
    const st16 = profiler.profileStageStart(16, "HTTP Response", `${jsonOutputString.length} bytes`);
    profiler.profileStageEnd(st16, "HTTP 200 OK Sent");

    profiler.printFinalReport();
  } catch (err: any) {
    console.error("PROFILER RUN ERROR:", err);
    profiler.printFinalReport();
  }
}

main();
