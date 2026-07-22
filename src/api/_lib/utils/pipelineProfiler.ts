/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface StageMetrics {
  stageName: string;
  stageNumber: number;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  heapUsedStart: number;
  heapUsedEnd?: number;
  rssStart: number;
  rssEnd?: number;
  externalStart: number;
  externalEnd?: number;
  uptimeStart: number;
  uptimeEnd?: number;
  inputSize?: string;
  outputSize?: string;
  status: "BEGIN" | "END" | "FAILED" | "TIMED OUT";
  errorMsg?: string;
}

export class PipelineProfiler {
  private stages: StageMetrics[] = [];
  private pipelineStartTime: number;
  private peakHeap: number = 0;
  private peakRss: number = 0;
  private maxAllocatedSize: number = 0;
  private maxAllocatedLabel: string = "None";

  constructor() {
    this.pipelineStartTime = Date.now();
    const mem = process.memoryUsage();
    this.updatePeaks(mem);
  }

  private updatePeaks(mem: NodeJS.MemoryUsage) {
    if (mem.heapUsed > this.peakHeap) this.peakHeap = mem.heapUsed;
    if (mem.rss > this.peakRss) this.peakRss = mem.rss;
  }

  public recordAllocation(label: string, sizeInBytes: number) {
    if (sizeInBytes > this.maxAllocatedSize) {
      this.maxAllocatedSize = sizeInBytes;
      this.maxAllocatedLabel = label;
    }
  }

  public profileStageStart(stageNumber: number, stageName: string, inputSize?: string): StageMetrics {
    const mem = process.memoryUsage();
    this.updatePeaks(mem);
    const now = Date.now();

    const metric: StageMetrics = {
      stageName,
      stageNumber,
      startTime: now,
      heapUsedStart: mem.heapUsed,
      rssStart: mem.rss,
      externalStart: mem.external,
      uptimeStart: process.uptime(),
      inputSize: inputSize || "N/A",
      status: "BEGIN"
    };

    console.time(`[PIPELINE PROFILER] Stage ${stageNumber}: ${stageName}`);
    console.log(`\n====================================================`);
    console.log(`[PIPELINE PROFILER] BEGIN Stage ${stageNumber}: ${stageName}`);
    console.log(`Start: ${new Date(now).toISOString()}`);
    console.log(`Process Uptime: ${metric.uptimeStart.toFixed(2)}s`);
    console.log(`Heap Used: ${(mem.heapUsed / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`RSS: ${(mem.rss / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`External: ${(mem.external / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`Input Size: ${metric.inputSize}`);
    console.log(`====================================================\n`);

    this.stages.push(metric);
    return metric;
  }

  public profileStageEnd(metric: StageMetrics, outputSize?: string, status: "END" | "FAILED" | "TIMED OUT" = "END", errorMsg?: string) {
    const now = Date.now();
    const mem = process.memoryUsage();
    this.updatePeaks(mem);

    metric.endTime = now;
    metric.durationMs = now - metric.startTime;
    metric.heapUsedEnd = mem.heapUsed;
    metric.rssEnd = mem.rss;
    metric.externalEnd = mem.external;
    metric.uptimeEnd = process.uptime();
    metric.outputSize = outputSize || "N/A";
    metric.status = status;
    metric.errorMsg = errorMsg;

    console.timeEnd(`[PIPELINE PROFILER] Stage ${metric.stageNumber}: ${metric.stageName}`);

    console.log(`\n====================================================`);
    console.log(`[PIPELINE PROFILER] ${status} Stage ${metric.stageNumber}: ${metric.stageName}`);
    console.log(`Start: ${new Date(metric.startTime).toISOString()}`);
    console.log(`End: ${new Date(now).toISOString()}`);
    console.log(`Duration: ${metric.durationMs} ms (${(metric.durationMs / 1000).toFixed(2)}s)`);
    console.log(`Heap Used: ${(mem.heapUsed / (1024 * 1024)).toFixed(2)} MB (Delta: ${((mem.heapUsed - metric.heapUsedStart) / (1024 * 1024)).toFixed(2)} MB)`);
    console.log(`RSS: ${(mem.rss / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`External: ${(mem.external / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`Input Size: ${metric.inputSize}`);
    console.log(`Output Size: ${metric.outputSize}`);

    if (metric.durationMs > 15000) {
      console.warn(`🚨 EXECUTION BUDGET RISK - Stage ${metric.stageNumber}: ${metric.stageName} took ${metric.durationMs}ms (>15s threshold)!`);
    } else if (metric.durationMs > 5000) {
      console.warn(`⚠ LONG RUNNING STAGE - Stage ${metric.stageNumber}: ${metric.stageName} took ${metric.durationMs}ms (>5s threshold)!`);
    }
    console.log(`====================================================\n`);
  }

  public printFinalReport() {
    const totalDuration = Date.now() - this.pipelineStartTime;
    const sorted = [...this.stages].sort((a, b) => (b.durationMs || 0) - (a.durationMs || 0));
    const top5 = sorted.slice(0, 5);

    const getStageDuration = (namePattern: string): number => {
      const found = this.stages.find(s => s.stageName.toLowerCase().includes(namePattern.toLowerCase()));
      return found && found.durationMs ? found.durationMs : 0;
    };

    const excelDuration = getStageDuration("excel");
    const geminiDuration = getStageDuration("gemini") || getStageDuration("compiler (gemini)") || getStageDuration("portfolio compiler");
    const serializationDuration = getStageDuration("serialization") || getStageDuration("final json");

    console.log(`\n==============================`);
    console.log(`PIPELINE SUMMARY`);
    console.log(`==============================`);
    console.log(`Total Execution Time: ${totalDuration} ms (${(totalDuration / 1000).toFixed(2)}s)`);
    console.log(`Memory Peak (Heap): ${(this.peakHeap / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`Memory Peak (RSS): ${(this.peakRss / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`Largest Object Allocated: ${this.maxAllocatedLabel} (${(this.maxAllocatedSize / (1024 * 1024)).toFixed(2)} MB)`);
    console.log(`Excel Duration: ${excelDuration} ms (${(excelDuration / 1000).toFixed(2)}s)`);
    console.log(`Gemini Duration: ${geminiDuration} ms (${(geminiDuration / 1000).toFixed(2)}s)`);
    console.log(`Serialization Duration: ${serializationDuration} ms (${(serializationDuration / 1000).toFixed(2)}s)`);
    console.log(`------------------------------`);
    console.log(`Top 5 Slowest Stages:`);
    top5.forEach((s, idx) => {
      console.log(` ${idx + 1}. [Stage ${s.stageNumber}] ${s.stageName}: ${s.durationMs || 0} ms (${((s.durationMs || 0) / 1000).toFixed(2)}s) - Status: ${s.status}`);
    });
    console.log(`==============================\n`);
  }
}
