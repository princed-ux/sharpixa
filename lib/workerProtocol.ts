import type { ProcessingStage } from "./progress";

export interface WorkerProgressMessage {
  type: "progress";
  jobId: string;
  stage: ProcessingStage;
  ratio: number;
}

export interface WorkerResourceProgressMessage {
  type: "resource-progress";
  jobId: string;
  stage: ProcessingStage;
  key: string;
  current: number;
  total: number;
}

export interface WorkerCancelledMessage {
  type: "cancelled";
  jobId: string;
}

export interface WorkerErrorMessage {
  type: "error";
  jobId: string;
  code: WorkerErrorCode;
  message: string;
}

export type WorkerErrorCode =
  | "busy"
  | "unsupported-browser"
  | "decode-failed"
  | "canvas-failed"
  | "unsafe-dimensions"
  | "selection-empty"
  | "selection-too-large"
  | "model-load-failed"
  | "processing-failed"
  | "encode-failed"
  | "empty-output"
  | "unsupported-codec"
  | "video-too-large";

export interface WorkerCancelRequest {
  type: "cancel";
  jobId: string;
}

export class ProcessingCancelledError extends Error {
  constructor(message = "Processing was cancelled.") {
    super(message);
    this.name = "ProcessingCancelledError";
  }
}

export class WorkerProcessingError extends Error {
  readonly code: WorkerErrorCode;

  constructor(code: WorkerErrorCode, message: string) {
    super(message);
    this.name = "WorkerProcessingError";
    this.code = code;
  }
}

export function isProcessingCancelledError(
  error: unknown,
): error is ProcessingCancelledError {
  return error instanceof ProcessingCancelledError;
}

