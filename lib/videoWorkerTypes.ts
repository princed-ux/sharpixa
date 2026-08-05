import type {
  AdvancedControls,
  PresetName,
} from "./constants";

import type {
  Dimensions,
  ProcessingResolution,
  VideoMetadata,
} from "./processingLimits";

import type {
  WorkerCancelRequest,
  WorkerCancelledMessage,
  WorkerErrorMessage,
  WorkerProgressMessage,
  WorkerResourceProgressMessage,
} from "./workerProtocol";

/**
 * The time interval in which a video mask should be applied.
 *
 * Times are expressed in seconds and use the video's presentation timeline.
 * Frames outside this interval must remain completely unchanged.
 */
export interface VideoMaskTimeRange {
  startTime: number;
  endTime: number;
}

/**
 * Normalizes a user-selected range against the actual video duration.
 */
export function normalizeVideoMaskTimeRange(
  range: VideoMaskTimeRange | null | undefined,
  duration: number,
): VideoMaskTimeRange | null {
  if (!range) {
    return null;
  }

  const safeDuration =
    Number.isFinite(duration) && duration > 0
      ? duration
      : 0;

  if (!safeDuration) {
    return null;
  }

  const rawStart =
    Number.isFinite(range.startTime)
      ? range.startTime
      : 0;

  const rawEnd =
    Number.isFinite(range.endTime)
      ? range.endTime
      : safeDuration;

  const startTime = Math.min(
    safeDuration,
    Math.max(0, rawStart),
  );

  const endTime = Math.min(
    safeDuration,
    Math.max(0, rawEnd),
  );

  if (endTime <= startTime) {
    return null;
  }

  return {
    startTime,
    endTime,
  };
}

/**
 * Returns true only when the supplied frame timestamp is inside the mask
 * interval. The end time is exclusive so the first frame after the selected
 * interval remains untouched.
 */
export function isTimestampInsideVideoMaskRange(
  timestamp: number,
  range: VideoMaskTimeRange | null | undefined,
): boolean {
  if (
    !range ||
    !Number.isFinite(timestamp)
  ) {
    return false;
  }

  return (
    timestamp >= range.startTime &&
    timestamp < range.endTime
  );
}

export interface VideoWorkerProcessRequest {
  type: "process";
  jobId: string;

  source: File;
  metadata: VideoMetadata;

  output: Dimensions;
  resolution: ProcessingResolution;

  preset: PresetName | "none";
  controls: AdvancedControls;

  /**
   * A stationary mask describing the region to rebuild.
   */
  mask: Blob | null;

  /**
   * Limits the stationary mask to a particular part of the video.
   *
   * It remains optional temporarily so the project continues compiling while
   * the editor and UploadZone changes are being applied.
   */
  maskTimeRange?: VideoMaskTimeRange | null;
}

export type VideoWorkerRequest =
  | VideoWorkerProcessRequest
  | WorkerCancelRequest;

export interface VideoWorkerResultMessage {
  type: "result";
  jobId: string;

  blob: Blob;
  width: number;
  height: number;
  duration: number;
}

export type VideoWorkerResponse =
  | WorkerProgressMessage
  | WorkerResourceProgressMessage
  | VideoWorkerResultMessage
  | WorkerCancelledMessage
  | WorkerErrorMessage;

export interface VideoWorkerCallbacks {
  onProgress?: (
    message:
      | WorkerProgressMessage
      | WorkerResourceProgressMessage,
  ) => void;
}

export interface VideoWorkerResult {
  blob: Blob;
  width: number;
  height: number;
  duration: number;
}