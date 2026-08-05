import type {
  AdvancedControls,
  PresetName,
} from "./constants";
import type {
  Dimensions,
  ImageOperation,
  ImageProcessingPlan,
  ProcessingResolution,
} from "./processingLimits";
import type {
  WorkerCancelRequest,
  WorkerCancelledMessage,
  WorkerErrorMessage,
  WorkerProgressMessage,
  WorkerResourceProgressMessage,
} from "./workerProtocol";

export interface ImageWorkerProcessRequest {
  type: "process";
  jobId: string;
  operation: ImageOperation;
  source: Blob;
  sourceDimensions: Dimensions;
  plan: ImageProcessingPlan;
  resolution: ProcessingResolution;
  preset: PresetName;
  controls: AdvancedControls;
  mask: Blob | null;
  outputFormat: "image/png" | "image/jpeg";
}

export type ImageWorkerRequest =
  | ImageWorkerProcessRequest
  | WorkerCancelRequest;

export interface ImageWorkerResultMessage {
  type: "result";
  jobId: string;
  blob: Blob;
  width: number;
  height: number;
  requestedWidth: number;
  requestedHeight: number;
  capped: boolean;
}

export type ImageWorkerResponse =
  | WorkerProgressMessage
  | WorkerResourceProgressMessage
  | ImageWorkerResultMessage
  | WorkerCancelledMessage
  | WorkerErrorMessage;

export interface ImageWorkerCallbacks {
  onProgress?: (
    message:
      | WorkerProgressMessage
      | WorkerResourceProgressMessage,
  ) => void;
}

export interface ImageWorkerResult {
  blob: Blob;
  width: number;
  height: number;
  requestedWidth: number;
  requestedHeight: number;
  capped: boolean;
}

