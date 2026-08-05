import type {
  ImageWorkerCallbacks,
  ImageWorkerProcessRequest,
  ImageWorkerResponse,
  ImageWorkerResult,
} from "./imageWorkerTypes";
import type { ImageOperation } from "./processingLimits";
import {
  ProcessingCancelledError,
  WorkerProcessingError,
} from "./workerProtocol";

interface ActiveImageJob {
  jobId: string;
  operation: ImageOperation;
  callbacks: ImageWorkerCallbacks;
  resolve: (result: ImageWorkerResult) => void;
  reject: (error: Error) => void;

  cancelRequested: boolean;
  cancelWaiters: Array<() => void>;
  settled: boolean;
  receivedFirstMessage: boolean;

  inactivityTimeoutMs: number;
  overallTimeoutMs: number;

  startupTimer: ReturnType<typeof setTimeout> | null;
  inactivityTimer: ReturnType<typeof setTimeout> | null;
  overallTimer: ReturnType<typeof setTimeout> | null;
  cancelTimer: ReturnType<typeof setTimeout> | null;
}

const WORKER_STARTUP_TIMEOUT_MS = 30_000;

/**
 * Ordinary image operations should keep reporting progress regularly.
 */
const NORMAL_INACTIVITY_TIMEOUT_MS = 150_000;

/**
 * IMG.LY background removal can remain silent while initializing ONNX/WASM
 * or running CPU inference. Give that operation a much larger silence window.
 */
const BACKGROUND_INACTIVITY_TIMEOUT_MS =
  12 * 60_000;

const NORMAL_OVERALL_TIMEOUT_MS =
  10 * 60_000;

const BACKGROUND_MIN_OVERALL_TIMEOUT_MS =
  15 * 60_000;

const BACKGROUND_MAX_OVERALL_TIMEOUT_MS =
  30 * 60_000;

const CANCEL_GRACE_MS = 1_500;

function isAutomaticBackground(
  operation: ImageOperation,
): boolean {
  return (
    operation ===
    "automatic-background"
  );
}

function getOverallTimeoutMs(
  request: ImageWorkerProcessRequest,
): number {
  if (
    !isAutomaticBackground(
      request.operation,
    )
  ) {
    return NORMAL_OVERALL_TIMEOUT_MS;
  }

  const pixels =
    Math.max(
      1,
      request.plan.output.width,
    ) *
    Math.max(
      1,
      request.plan.output.height,
    );

  const megapixels =
    pixels /
    1_000_000;

  /**
   * Larger images need more CPU inference time.
   *
   * Minimum: 15 minutes
   * Maximum: 30 minutes
   */
  const calculated =
    10 * 60_000 +
    megapixels *
      2 *
      60_000;

  return Math.min(
    BACKGROUND_MAX_OVERALL_TIMEOUT_MS,

    Math.max(
      BACKGROUND_MIN_OVERALL_TIMEOUT_MS,
      calculated,
    ),
  );
}

function getInactivityTimeoutMs(
  operation: ImageOperation,
): number {
  return isAutomaticBackground(
    operation,
  )
    ? BACKGROUND_INACTIVITY_TIMEOUT_MS
    : NORMAL_INACTIVITY_TIMEOUT_MS;
}

function createStartupError(): WorkerProcessingError {
  return new WorkerProcessingError(
    "processing-failed",

    "The image-processing worker could not start. Reload the page and try again in a current Chrome or Edge browser.",
  );
}

function createInactivityError(
  operation: ImageOperation,
): WorkerProcessingError {
  if (
    isAutomaticBackground(
      operation,
    )
  ) {
    return new WorkerProcessingError(
      "model-load-failed",

      "Automatic background removal remained silent for too long while downloading or running the browser model. Reload the page and retry; the model may still be cached after the first attempt.",
    );
  }

  return new WorkerProcessingError(
    "processing-failed",

    "Image processing stopped responding and was ended to protect the browser. Try a smaller image or lower output size.",
  );
}

function createOverallTimeoutError(
  active: ActiveImageJob,
): WorkerProcessingError {
  const minutes =
    Math.max(
      1,

      Math.round(
        active.overallTimeoutMs /
          60_000,
      ),
    );

  if (
    isAutomaticBackground(
      active.operation,
    )
  ) {
    return new WorkerProcessingError(
      "model-load-failed",

      `Automatic background removal exceeded its ${minutes}-minute safety window. Reload the page and retry with a smaller image.`,
    );
  }

  return new WorkerProcessingError(
    "processing-failed",

    `This image operation exceeded its ${minutes}-minute safety window and was stopped. Try a smaller image or lower output size.`,
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

    "The browser could not create the safe image-processing worker. Reload the page or use a current Chrome or Edge browser.",
  );
}

export function supportsImageWorkerProcessing(): boolean {
  if (
    typeof window ===
      "undefined" ||
    typeof Worker ===
      "undefined" ||
    typeof OffscreenCanvas ===
      "undefined" ||
    typeof createImageBitmap !==
      "function"
  ) {
    return false;
  }

  try {
    const canvas =
      new OffscreenCanvas(
        2,
        2,
      );

    return Boolean(
      canvas.getContext(
        "2d",
      ),
    );
  } catch {
    return false;
  }
}

export class ImageWorkerClient {
  private worker:
    | Worker
    | null = null;

  private activeJob:
    | ActiveImageJob
    | null = null;

  process(
    request: ImageWorkerProcessRequest,

    callbacks: ImageWorkerCallbacks = {},
  ): Promise<ImageWorkerResult> {
    if (
      !supportsImageWorkerProcessing()
    ) {
      return Promise.reject(
        new WorkerProcessingError(
          "unsupported-browser",

          "Safe image processing needs Web Workers, OffscreenCanvas, and ImageBitmap support. Use a current Chrome or Edge browser.",
        ),
      );
    }

    if (
      this.activeJob
    ) {
      return Promise.reject(
        new WorkerProcessingError(
          "busy",

          "Another image operation is already running.",
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

    return new Promise<ImageWorkerResult>(
      (
        resolve,
        reject,
      ) => {
        const active:
          ActiveImageJob =
          {
            jobId:
              request.jobId,

            operation:
              request.operation,

            callbacks,
            resolve,
            reject,

            cancelRequested:
              false,

            cancelWaiters:
              [],

            settled:
              false,

            receivedFirstMessage:
              false,

            inactivityTimeoutMs:
              getInactivityTimeoutMs(
                request.operation,
              ),

            overallTimeoutMs:
              getOverallTimeoutMs(
                request,
              ),

            startupTimer:
              null,

            inactivityTimer:
              null,

            overallTimer:
              null,

            cancelTimer:
              null,
          };

        this.activeJob =
          active;

        this.startWatchdogs(
          active,
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
              "Image worker postMessage failed:",

              error,
            );
          }

          this.terminateWorker(
            new WorkerProcessingError(
              "processing-failed",

              "The image job could not be sent to the processing worker.",
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

        if (
          !this.worker
        ) {
          this.terminateWorker(
            new ProcessingCancelledError(),
          );

          return;
        }

        try {
          this.worker.postMessage({
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
              if (
                this.activeJob !==
                  active ||
                active.settled
              ) {
                return;
              }

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
          "Image processing was stopped because the page was closed.",
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
          "../workers/imageProcessor.worker.ts",

          import.meta.url,
        ),

        {
          type:
            "module",

          name:
            "sharpixa-image-processor",
        },
      );

    worker.onmessage =
      (
        event:
          MessageEvent<ImageWorkerResponse>,
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
            "Sharpixa image worker error:",

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

            "The image-processing worker stopped unexpectedly. Reload the page and try again.",
          ),
        );
      };

    worker.onmessageerror =
      () => {
        this.terminateWorker(
          new WorkerProcessingError(
            "processing-failed",

            "The browser could not read the image-processing response.",
          ),
        );
      };

    this.worker =
      worker;

    return worker;
  }

  private startWatchdogs(
    active: ActiveImageJob,
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
            createStartupError(),
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
            createOverallTimeoutError(
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
    active: ActiveImageJob,
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
            createInactivityError(
              active.operation,
            ),
          );
        },

        active.inactivityTimeoutMs,
      );
  }

  private markWorkerActivity(
    active: ActiveImageJob,
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
    message: ImageWorkerResponse,
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
              "Image progress callback failed:",

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
      /**
       * Recreate the worker after an error.
       *
       * A failed dynamic model import may leave a rejected Promise cached in
       * the worker. Reusing that worker would make every retry fail instantly.
       */
      this.terminateWorker(
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
      message.width <=
        0 ||
      message.height <=
        0
    ) {
      this.finishActiveJobWithError(
        new WorkerProcessingError(
          "empty-output",

          "The image worker returned an invalid or empty result.",
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

    active.resolve({
      blob:
        message.blob,

      width:
        message.width,

      height:
        message.height,

      requestedWidth:
        message.requestedWidth,

      requestedHeight:
        message.requestedHeight,

      capped:
        message.capped,
    });
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
    active: ActiveImageJob,
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
    active: ActiveImageJob,
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
    active: ActiveImageJob,
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