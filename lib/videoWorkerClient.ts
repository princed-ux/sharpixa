import type {
  VideoWorkerCallbacks,
  VideoWorkerProcessRequest,
  VideoWorkerResponse,
  VideoWorkerResult,
} from "./videoWorkerTypes";
import {
  ProcessingCancelledError,
  WorkerProcessingError,
} from "./workerProtocol";

interface ActiveVideoJob {
  jobId: string;
  callbacks: VideoWorkerCallbacks;
  resolve: (result: VideoWorkerResult) => void;
  reject: (error: Error) => void;

  durationSeconds: number;
  overallTimeoutMs: number;

  cancelRequested: boolean;
  cancelWaiters: Array<() => void>;

  startupTimer: ReturnType<typeof setTimeout> | null;
  inactivityTimer: ReturnType<typeof setTimeout> | null;
  overallTimer: ReturnType<typeof setTimeout> | null;
  cancelTimer: ReturnType<typeof setTimeout> | null;

  receivedFirstMessage: boolean;
  settled: boolean;
}

/**
 * A healthy worker sends its first "preparing" progress message quickly.
 * A broken worker bundle must not leave the page loading forever.
 */
const WORKER_STARTUP_TIMEOUT_MS = 20_000;

/**
 * The worker emits heartbeat/progress messages during Mediabunny and frame
 * processing. A long silence therefore indicates a genuinely stalled job.
 */
const WORKER_INACTIVITY_TIMEOUT_MS = 150_000;

/**
 * Some codec/WASM operations do not honour graceful cancellation instantly.
 * The worker is force-terminated after this short cleanup window.
 */
const CANCEL_GRACE_MS = 1_500;

const MIN_OVERALL_TIMEOUT_MS = 12 * 60_000;
const MAX_OVERALL_TIMEOUT_MS = 75 * 60_000;
const OVERALL_BASE_ALLOWANCE_MS = 5 * 60_000;
const OVERALL_DURATION_MULTIPLIER = 12;

function clampDurationSeconds(
  value: number,
): number {
  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return 1;
  }

  return Math.min(
    5 * 60,
    Math.max(1, value),
  );
}

/**
 * Longer adaptive jobs are intentionally given more time than short clips.
 *
 * A five-minute clip receives approximately 65 minutes before the final
 * safety timeout. Progress heartbeats still detect a dead worker much sooner
 * through the separate inactivity watchdog.
 */
function getOverallTimeoutMs(
  durationSeconds: number,
): number {
  const duration =
    clampDurationSeconds(
      durationSeconds,
    );

  const calculated =
    OVERALL_BASE_ALLOWANCE_MS +
    duration *
      1_000 *
      OVERALL_DURATION_MULTIPLIER;

  return Math.min(
    MAX_OVERALL_TIMEOUT_MS,

    Math.max(
      MIN_OVERALL_TIMEOUT_MS,
      calculated,
    ),
  );
}

function createWorkerStartupError(): WorkerProcessingError {
  return new WorkerProcessingError(
    "processing-failed",

    "The safe video-processing worker could not start. Reload the page and try again in a current Chrome or Edge browser.",
  );
}

function createWorkerInactivityError(): WorkerProcessingError {
  return new WorkerProcessingError(
    "processing-failed",

    "Video processing stopped responding and was ended to protect your browser. Try the file again, or use a shorter or smaller MP4 or WEBM clip.",
  );
}

function createWorkerOverallTimeoutError(
  active: ActiveVideoJob,
): WorkerProcessingError {
  const minutes =
    Math.max(
      1,

      Math.round(
        active.overallTimeoutMs /
          60_000,
      ),
    );

  return new WorkerProcessingError(
    "processing-failed",

    `This video operation exceeded its ${minutes}-minute safety window and was stopped. Try a shorter clip or a lower-resolution source.`,
  );
}

function normalizeWorkerCreationError(
  error: unknown,
): WorkerProcessingError {
  if (
    error instanceof
    WorkerProcessingError
  ) {
    return error;
  }

  return new WorkerProcessingError(
    "unsupported-browser",

    "The browser could not create the safe video-processing worker. Reload the page or use a current Chrome or Edge browser.",
  );
}

export function supportsVideoWorkerProcessing(): boolean {
  if (
    typeof window ===
      "undefined" ||
    typeof Worker ===
      "undefined" ||
    typeof OffscreenCanvas ===
      "undefined" ||
    typeof createImageBitmap !==
      "function" ||
    typeof VideoDecoder ===
      "undefined" ||
    typeof VideoEncoder ===
      "undefined" ||
    typeof VideoFrame ===
      "undefined"
  ) {
    return false;
  }

  try {
    const canvas =
      new OffscreenCanvas(
        2,
        2,
      );

    const context =
      canvas.getContext(
        "2d",
      );

    return Boolean(
      context,
    );
  } catch {
    return false;
  }
}

export class VideoWorkerClient {
  private worker:
    | Worker
    | null = null;

  private activeJob:
    | ActiveVideoJob
    | null = null;

  process(
    request: VideoWorkerProcessRequest,

    callbacks: VideoWorkerCallbacks = {},
  ): Promise<VideoWorkerResult> {
    if (
      !supportsVideoWorkerProcessing()
    ) {
      return Promise.reject(
        new WorkerProcessingError(
          "unsupported-browser",

          "Safe browser video processing needs Web Workers, WebCodecs, OffscreenCanvas, and ImageBitmap support. Use a current Chrome or Edge browser.",
        ),
      );
    }

    if (
      this.activeJob
    ) {
      return Promise.reject(
        new WorkerProcessingError(
          "busy",

          "Another video operation is already running.",
        ),
      );
    }

    let worker:
      Worker;

    try {
      worker =
        this.ensureWorker();
    } catch (
      error
    ) {
      return Promise.reject(
        normalizeWorkerCreationError(
          error,
        ),
      );
    }

    return new Promise<VideoWorkerResult>(
      (
        resolve,
        reject,
      ) => {
        const durationSeconds =
          clampDurationSeconds(
            request.metadata
              .duration,
          );

        const activeJob:
          ActiveVideoJob =
          {
            jobId:
              request.jobId,

            callbacks,
            resolve,
            reject,

            durationSeconds,

            overallTimeoutMs:
              getOverallTimeoutMs(
                durationSeconds,
              ),

            cancelRequested:
              false,

            cancelWaiters:
              [],

            startupTimer:
              null,

            inactivityTimer:
              null,

            overallTimer:
              null,

            cancelTimer:
              null,

            receivedFirstMessage:
              false,

            settled:
              false,
          };

        this.activeJob =
          activeJob;

        this.startWatchdogs(
          activeJob,
        );

        try {
          worker.postMessage(
            request,
          );
        } catch (
          error
        ) {
          if (
            process.env.NODE_ENV !==
            "production"
          ) {
            console.error(
              "Video worker postMessage failed:",

              error,
            );
          }

          this.terminateWorker(
            new WorkerProcessingError(
              "processing-failed",

              "The video job could not be sent to the processing worker.",
            ),
          );
        }
      },
    );
  }

  cancel(
    jobId: string,
  ): Promise<void> {
    const active =
      this.activeJob;

    if (
      !active ||
      active.jobId !==
        jobId ||
      active.settled
    ) {
      return Promise.resolve();
    }

    return new Promise<void>(
      (
        resolve,
      ) => {
        active.cancelWaiters.push(
          resolve,
        );

        if (
          active.cancelRequested
        ) {
          return;
        }

        active.cancelRequested =
          true;

        this.clearProcessingWatchdogs(
          active,
        );

        const worker =
          this.worker;

        if (
          !worker
        ) {
          this.terminateWorker(
            new ProcessingCancelledError(),
          );

          return;
        }

        try {
          worker.postMessage({
            type:
              "cancel",

            jobId,
          });
        } catch {
          this.terminateWorker(
            new ProcessingCancelledError(),
          );

          return;
        }

        active.cancelTimer =
          setTimeout(
            () => {
              const current =
                this.activeJob;

              if (
                !current ||
                current !==
                  active ||
                current.settled
              ) {
                return;
              }

              /*
               * Termination is the reliable final stop for codecs or
               * third-party conversion calls that cannot be interrupted
               * synchronously.
               */
              this.terminateWorker(
                new ProcessingCancelledError(),
              );
            },

            CANCEL_GRACE_MS,
          );
      },
    );
  }

  dispose(): void {
    if (
      this.activeJob
    ) {
      this.terminateWorker(
        new ProcessingCancelledError(
          "Video processing was stopped because the page was closed.",
        ),
      );

      return;
    }

    this.destroyIdleWorker();
  }

  private ensureWorker(): Worker {
    if (
      this.worker
    ) {
      return this.worker;
    }

    const worker =
      new Worker(
        new URL(
          "../workers/videoProcessor.worker.ts",

          import.meta.url,
        ),

        {
          type:
            "module",

          name:
            "sharpixa-video-processor",
        },
      );

    worker.onmessage =
      (
        event:
          MessageEvent<VideoWorkerResponse>,
      ) => {
        this.handleMessage(
          event.data,
        );
      };

    worker.onerror =
      (
        event:
          ErrorEvent,
      ) => {
        event.preventDefault();

        if (
          process.env.NODE_ENV !==
          "production"
        ) {
          console.error(
            "Sharpixa video worker error:",

            event.message,

            {
              filename:
                event.filename,

              line:
                event.lineno,

              column:
                event.colno,
            },
          );
        }

        this.terminateWorker(
          new WorkerProcessingError(
            "processing-failed",

            "The video-processing worker stopped unexpectedly. Try the file again or use a smaller video.",
          ),
        );
      };

    worker.onmessageerror =
      () => {
        this.terminateWorker(
          new WorkerProcessingError(
            "processing-failed",

            "The browser could not read the video-processing response.",
          ),
        );
      };

    this.worker =
      worker;

    return worker;
  }

  private startWatchdogs(
    active: ActiveVideoJob,
  ): void {
    active.startupTimer =
      setTimeout(
        () => {
          if (
            this.activeJob !==
              active ||
            active.settled ||
            active.receivedFirstMessage
          ) {
            return;
          }

          this.terminateWorker(
            createWorkerStartupError(),
          );
        },

        WORKER_STARTUP_TIMEOUT_MS,
      );

    active.overallTimer =
      setTimeout(
        () => {
          if (
            this.activeJob !==
              active ||
            active.settled ||
            active.cancelRequested
          ) {
            return;
          }

          this.terminateWorker(
            createWorkerOverallTimeoutError(
              active,
            ),
          );
        },

        active.overallTimeoutMs,
      );

    this.restartInactivityWatchdog(
      active,
    );
  }

  private restartInactivityWatchdog(
    active: ActiveVideoJob,
  ): void {
    if (
      active.inactivityTimer
    ) {
      clearTimeout(
        active.inactivityTimer,
      );
    }

    active.inactivityTimer =
      setTimeout(
        () => {
          if (
            this.activeJob !==
              active ||
            active.settled ||
            active.cancelRequested
          ) {
            return;
          }

          this.terminateWorker(
            createWorkerInactivityError(),
          );
        },

        WORKER_INACTIVITY_TIMEOUT_MS,
      );
  }

  private markWorkerActivity(
    active: ActiveVideoJob,
  ): void {
    if (
      !active.receivedFirstMessage
    ) {
      active.receivedFirstMessage =
        true;

      if (
        active.startupTimer
      ) {
        clearTimeout(
          active.startupTimer,
        );

        active.startupTimer =
          null;
      }
    }

    this.restartInactivityWatchdog(
      active,
    );
  }

  private handleMessage(
    message: VideoWorkerResponse,
  ): void {
    const active =
      this.activeJob;

    if (
      !active ||
      active.settled ||
      message.jobId !==
        active.jobId
    ) {
      return;
    }

    this.markWorkerActivity(
      active,
    );

    if (
      message.type ===
        "progress" ||
      message.type ===
        "resource-progress"
    ) {
      if (
        !active.cancelRequested
      ) {
        try {
          active.callbacks.onProgress?.(
            message,
          );
        } catch (
          error
        ) {
          if (
            process.env.NODE_ENV !==
            "production"
          ) {
            console.error(
              "Video progress callback failed:",

              error,
            );
          }
        }
      }

      return;
    }

    if (
      message.type ===
      "cancelled"
    ) {
      this.finishActiveJobWithError(
        new ProcessingCancelledError(),
      );

      return;
    }

    if (
      message.type ===
      "error"
    ) {
      this.finishActiveJobWithError(
        new WorkerProcessingError(
          message.code,

          message.message,
        ),
      );

      return;
    }

    if (
      active.cancelRequested
    ) {
      this.finishActiveJobWithError(
        new ProcessingCancelledError(),
      );

      return;
    }

    if (
      !message.blob?.size ||
      !Number.isFinite(
        message.width,
      ) ||
      !Number.isFinite(
        message.height,
      ) ||
      !Number.isFinite(
        message.duration,
      ) ||
      message.width <= 0 ||
      message.height <= 0 ||
      message.duration <= 0
    ) {
      this.finishActiveJobWithError(
        new WorkerProcessingError(
          "empty-output",

          "The video worker returned an invalid or empty result.",
        ),
      );

      return;
    }

    this.activeJob =
      null;

    active.settled =
      true;

    this.clearAllTimers(
      active,
    );

    this.resolveCancelWaiters(
      active,
    );

    const result:
      VideoWorkerResult =
      {
        blob:
          message.blob,

        width:
          message.width,

        height:
          message.height,

        duration:
          message.duration,
      };

    /*
     * A fresh worker for each video releases codec, Mediabunny, Canvas,
     * and frame-buffer memory before another potentially long operation.
     */
    this.destroyIdleWorker();

    active.resolve(
      result,
    );
  }

  private finishActiveJobWithError(
    error: Error,
  ): void {
    const active =
      this.activeJob;

    if (
      !active ||
      active.settled
    ) {
      return;
    }

    this.activeJob =
      null;

    active.settled =
      true;

    this.clearAllTimers(
      active,
    );

    this.resolveCancelWaiters(
      active,
    );

    active.reject(
      error,
    );
  }

  private clearProcessingWatchdogs(
    active: ActiveVideoJob,
  ): void {
    if (
      active.startupTimer
    ) {
      clearTimeout(
        active.startupTimer,
      );

      active.startupTimer =
        null;
    }

    if (
      active.inactivityTimer
    ) {
      clearTimeout(
        active.inactivityTimer,
      );

      active.inactivityTimer =
        null;
    }

    if (
      active.overallTimer
    ) {
      clearTimeout(
        active.overallTimer,
      );

      active.overallTimer =
        null;
    }
  }

  private clearAllTimers(
    active: ActiveVideoJob,
  ): void {
    this.clearProcessingWatchdogs(
      active,
    );

    if (
      active.cancelTimer
    ) {
      clearTimeout(
        active.cancelTimer,
      );

      active.cancelTimer =
        null;
    }
  }

  private resolveCancelWaiters(
    active: ActiveVideoJob,
  ): void {
    for (
      const resolve of
      active.cancelWaiters
    ) {
      resolve();
    }

    active.cancelWaiters.length =
      0;
  }

  private destroyIdleWorker(): void {
    const worker =
      this.worker;

    this.worker =
      null;

    if (
      !worker
    ) {
      return;
    }

    worker.onmessage =
      null;

    worker.onerror =
      null;

    worker.onmessageerror =
      null;

    worker.terminate();
  }

  private terminateWorker(
    error: Error,
  ): void {
    this.destroyIdleWorker();

    this.finishActiveJobWithError(
      error,
    );
  }
}