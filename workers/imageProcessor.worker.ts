import type {
  ImageWorkerProcessRequest,
  ImageWorkerRequest,
  ImageWorkerResponse,
} from "../lib/imageWorkerTypes";
import type { ProcessingStage } from "../lib/progress";
import type { WorkerErrorCode } from "../lib/workerProtocol";
import {
  analyzeMask,
  applyInpaintPlan,
  applyTransparencyMask,
  createInpaintPlan,
  createOffscreenCanvas,
  getOffscreenContext,
  processEnhancementTiles,
  releaseCanvas,
} from "./pixelProcessing";

interface ImageWorkerScope {
  onmessage:
    | ((event: MessageEvent<ImageWorkerRequest>) => void)
    | null;

  postMessage(
    message: ImageWorkerResponse,
  ): void;
}

class WorkerCancelledError extends Error {
  constructor() {
    super("cancelled");

    this.name =
      "WorkerCancelledError";
  }
}

const workerScope =
  self as unknown as ImageWorkerScope;

const cancelledJobs =
  new Set<string>();

let activeJobId:
  | string
  | null = null;

let backgroundRemovalModulePromise:
  | Promise<
      typeof import(
        "@imgly/background-removal"
      )
    >
  | null = null;

const THIRD_PARTY_HEARTBEAT_MS =
  1_500;

function send(
  message: ImageWorkerResponse,
): void {
  workerScope.postMessage(
    message,
  );
}

function reportStage(
  jobId: string,
  stage: ProcessingStage,
  ratio: number,
): void {
  send({
    type: "progress",
    jobId,
    stage,

    ratio: Math.min(
      1,
      Math.max(
        0,
        ratio,
      ),
    ),
  });
}

function reportResource(
  jobId: string,
  key: string,
  current: number,
  total: number,
): void {
  send({
    type:
      "resource-progress",

    jobId,

    stage:
      "loading-model",

    key,
    current,
    total,
  });
}

function checkCancelled(
  jobId: string,
): void {
  if (
    cancelledJobs.has(
      jobId,
    )
  ) {
    throw new WorkerCancelledError();
  }
}

async function yieldControl(
  jobId: string,
): Promise<void> {
  await new Promise<void>(
    (resolve) => {
      setTimeout(
        resolve,
        0,
      );
    },
  );

  checkCancelled(
    jobId,
  );
}

async function decodeBitmap(
  source: Blob,
  width: number,
  height: number,
): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(
      source,
      {
        resizeWidth:
          width,

        resizeHeight:
          height,

        resizeQuality:
          "high",
      },
    );
  } catch {
    try {
      const original =
        await createImageBitmap(
          source,
        );

      if (
        original.width ===
          width &&
        original.height ===
          height
      ) {
        return original;
      }

      const resized =
        await createImageBitmap(
          original,
          {
            resizeWidth:
              width,

            resizeHeight:
              height,

            resizeQuality:
              "high",
          },
        );

      original.close();

      return resized;
    } catch {
      throw new Error(
        "decode-failed",
      );
    }
  }
}

function drawBitmap(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  willReadFrequently: boolean,
): {
  canvas: OffscreenCanvas;

  context:
    OffscreenCanvasRenderingContext2D;
} {
  const canvas =
    createOffscreenCanvas(
      width,
      height,
    );

  const context =
    getOffscreenContext(
      canvas,
      willReadFrequently,
    );

  context.imageSmoothingEnabled =
    true;

  context.imageSmoothingQuality =
    "high";

  context.drawImage(
    bitmap,
    0,
    0,
    width,
    height,
  );

  return {
    canvas,
    context,
  };
}

async function encodeCanvas(
  canvas: OffscreenCanvas,
  format:
    | "image/png"
    | "image/jpeg",
): Promise<Blob> {
  let blob: Blob;

  try {
    blob =
      await canvas.convertToBlob(
        {
          type:
            format,

          quality:
            format ===
            "image/jpeg"
              ? 0.95
              : undefined,
        },
      );
  } catch {
    throw new Error(
      "encode-failed",
    );
  }

  if (!blob.size) {
    throw new Error(
      "empty-output",
    );
  }

  return blob;
}

async function resizeCanvas(
  source: OffscreenCanvas,
  width: number,
  height: number,
  jobId: string,
): Promise<OffscreenCanvas> {
  if (
    source.width ===
      width &&
    source.height ===
      height
  ) {
    reportStage(
      jobId,
      "resizing-output",
      1,
    );

    return source;
  }

  const output =
    createOffscreenCanvas(
      width,
      height,
    );

  const context =
    getOffscreenContext(
      output,
    );

  context.imageSmoothingEnabled =
    true;

  context.imageSmoothingQuality =
    "high";

  const stripHeight =
    512;

  const stripCount =
    Math.ceil(
      height /
        stripHeight,
    );

  for (
    let destinationY = 0;
    destinationY < height;
    destinationY +=
      stripHeight
  ) {
    checkCancelled(
      jobId,
    );

    const destinationHeight =
      Math.min(
        stripHeight,
        height -
          destinationY,
      );

    const sourceY =
      (
        destinationY /
        height
      ) *
      source.height;

    const sourceHeight =
      (
        destinationHeight /
        height
      ) *
      source.height;

    context.drawImage(
      source,

      0,
      sourceY,
      source.width,
      sourceHeight,

      0,
      destinationY,
      width,
      destinationHeight,
    );

    reportStage(
      jobId,

      "resizing-output",

      Math.min(
        1,

        (
          destinationY /
            stripHeight +
          1
        ) /
          stripCount,
      ),
    );

    await yieldControl(
      jobId,
    );
  }

  return output;
}

async function processEnhancement(
  request:
    ImageWorkerProcessRequest,
): Promise<{
  blob: Blob;
  width: number;
  height: number;
}> {
  const {
    jobId,
    plan,
  } = request;

  let bitmap:
    | ImageBitmap
    | null = null;

  let sourceCanvas:
    | OffscreenCanvas
    | null = null;

  let processedCanvas:
    | OffscreenCanvas
    | null = null;

  let outputCanvas:
    | OffscreenCanvas
    | null = null;

  try {
    reportStage(
      jobId,
      "decoding",
      0,
    );

    bitmap =
      await decodeBitmap(
        request.source,

        plan.working.width,

        plan.working.height,
      );

    checkCancelled(
      jobId,
    );

    reportStage(
      jobId,
      "decoding",
      1,
    );

    const source =
      drawBitmap(
        bitmap,

        plan.working.width,

        plan.working.height,

        true,
      );

    sourceCanvas =
      source.canvas;

    processedCanvas =
      createOffscreenCanvas(
        plan.working.width,

        plan.working.height,
      );

    const processedContext =
      getOffscreenContext(
        processedCanvas,
        true,
      );

    await processEnhancementTiles(
      {
        source:
          source.context,

        output:
          processedContext,

        width:
          plan.working.width,

        height:
          plan.working.height,

        presetName:
          request.preset,

        controls:
          request.controls,

        checkCancelled:
          () =>
            checkCancelled(
              jobId,
            ),

        yieldControl:
          () =>
            yieldControl(
              jobId,
            ),

        onProgress:
          (
            ratio,
          ) => {
            reportStage(
              jobId,

              "applying-enhancement",

              ratio,
            );
          },
      },
    );

    outputCanvas =
      await resizeCanvas(
        processedCanvas,

        plan.output.width,

        plan.output.height,

        jobId,
      );

    reportStage(
      jobId,
      "encoding-output",
      0,
    );

    const blob =
      await encodeCanvas(
        outputCanvas,

        request.outputFormat,
      );

    reportStage(
      jobId,
      "encoding-output",
      1,
    );

    return {
      blob,

      width:
        outputCanvas.width,

      height:
        outputCanvas.height,
    };
  } finally {
    bitmap?.close();

    releaseCanvas(
      sourceCanvas,
    );

    if (
      processedCanvas &&
      processedCanvas !==
        outputCanvas
    ) {
      releaseCanvas(
        processedCanvas,
      );
    }

    releaseCanvas(
      outputCanvas,
    );
  }
}

async function processMaskOperation(
  request:
    ImageWorkerProcessRequest,
): Promise<{
  blob: Blob;
  width: number;
  height: number;
}> {
  if (!request.mask) {
    throw new Error(
      "selection-empty",
    );
  }

  const {
    jobId,
    plan,
  } = request;

  let bitmap:
    | ImageBitmap
    | null = null;

  let maskBitmap:
    | ImageBitmap
    | null = null;

  let outputCanvas:
    | OffscreenCanvas
    | null = null;

  try {
    reportStage(
      jobId,
      "decoding",
      0,
    );

    [
      bitmap,
      maskBitmap,
    ] =
      await Promise.all([
        decodeBitmap(
          request.source,

          plan.output.width,

          plan.output.height,
        ),

        createImageBitmap(
          request.mask,
        ).catch(() => {
          throw new Error(
            "decode-failed",
          );
        }),
      ]);

    checkCancelled(
      jobId,
    );

    reportStage(
      jobId,
      "decoding",
      1,
    );

    const output =
      drawBitmap(
        bitmap,

        plan.output.width,

        plan.output.height,

        true,
      );

    outputCanvas =
      output.canvas;

    if (
      request.operation ===
      "manual-background"
    ) {
      reportStage(
        jobId,
        "reading-mask",
        1,
      );

      await applyTransparencyMask(
        {
          context:
            output.context,

          mask:
            maskBitmap,

          width:
            plan.output.width,

          height:
            plan.output.height,

          checkCancelled:
            () =>
              checkCancelled(
                jobId,
              ),

          yieldControl:
            () =>
              yieldControl(
                jobId,
              ),

          onProgress:
            (
              ratio,
            ) => {
              reportStage(
                jobId,

                "processing-tiles",

                ratio,
              );
            },
        },
      );
    } else {
      const analysis =
        await analyzeMask(
          {
            mask:
              maskBitmap,

            width:
              plan.output.width,

            height:
              plan.output.height,

            checkCancelled:
              () =>
                checkCancelled(
                  jobId,
                ),

            yieldControl:
              () =>
                yieldControl(
                  jobId,
                ),

            onProgress:
              (
                ratio,
              ) => {
                reportStage(
                  jobId,

                  "reading-mask",

                  ratio,
                );
              },
          },
        );

      const inpaintPlan =
        await createInpaintPlan(
          {
            mask:
              maskBitmap,

            targetWidth:
              plan.output.width,

            targetHeight:
              plan.output.height,

            analysis,

            maxRegionPixels:
              plan
                .safetyProfile
                .maxInpaintRegionPixels,

            checkCancelled:
              () =>
                checkCancelled(
                  jobId,
                ),

            yieldControl:
              () =>
                yieldControl(
                  jobId,
                ),
          },
        );

      await applyInpaintPlan(
        {
          context:
            output.context,

          plan:
            inpaintPlan,

          checkCancelled:
            () =>
              checkCancelled(
                jobId,
              ),

          yieldControl:
            () =>
              yieldControl(
                jobId,
              ),

          onProgress:
            (
              ratio,
            ) => {
              reportStage(
                jobId,

                "processing-tiles",

                ratio,
              );
            },
        },
      );
    }

    reportStage(
      jobId,
      "encoding-output",
      0,
    );

    const blob =
      await encodeCanvas(
        outputCanvas,

        request.outputFormat,
      );

    reportStage(
      jobId,
      "encoding-output",
      1,
    );

    return {
      blob,

      width:
        outputCanvas.width,

      height:
        outputCanvas.height,
    };
  } finally {
    bitmap?.close();

    maskBitmap?.close();

    releaseCanvas(
      outputCanvas,
    );
  }
}

function getBackgroundRemovalModule(): Promise<
  typeof import(
    "@imgly/background-removal"
  )
> {
  if (
    !backgroundRemovalModulePromise
  ) {
    backgroundRemovalModulePromise =
      import(
        "@imgly/background-removal"
      ).catch(
        (
          error: unknown,
        ) => {
          /*
           * Do not permanently cache a rejected dynamic import.
           * A temporary chunk or network failure must be retryable
           * after the worker client recreates this worker.
           */
          backgroundRemovalModulePromise =
            null;

          throw error;
        },
      );
  }

  return backgroundRemovalModulePromise;
}

async function runWithHeartbeat<T>(
  options: {
    jobId: string;

    getStage:
      () => ProcessingStage;

    getRatio:
      () => number;

    task:
      () => Promise<T>;
  },
): Promise<T> {
  const heartbeat =
    setInterval(() => {
      if (
        cancelledJobs.has(
          options.jobId,
        )
      ) {
        return;
      }

      reportStage(
        options.jobId,

        options.getStage(),

        options.getRatio(),
      );
    }, THIRD_PARTY_HEARTBEAT_MS);

  try {
    return await options.task();
  } finally {
    clearInterval(
      heartbeat,
    );
  }
}

async function createCappedBackgroundSource(
  request:
    ImageWorkerProcessRequest,
): Promise<Blob> {
  const unchanged =
    request.plan.output
      .width ===
      request
        .sourceDimensions
        .width &&
    request.plan.output
      .height ===
      request
        .sourceDimensions
        .height;

  if (unchanged) {
    return request.source;
  }

  let bitmap:
    | ImageBitmap
    | null = null;

  let canvas:
    | OffscreenCanvas
    | null = null;

  try {
    reportStage(
      request.jobId,
      "decoding",
      0,
    );

    bitmap =
      await decodeBitmap(
        request.source,

        request.plan.output
          .width,

        request.plan.output
          .height,
      );

    checkCancelled(
      request.jobId,
    );

    const drawn =
      drawBitmap(
        bitmap,

        request.plan.output
          .width,

        request.plan.output
          .height,

        false,
      );

    canvas =
      drawn.canvas;

    reportStage(
      request.jobId,
      "decoding",
      1,
    );

    return await encodeCanvas(
      canvas,
      "image/png",
    );
  } finally {
    bitmap?.close();

    releaseCanvas(
      canvas,
    );
  }
}

async function processAutomaticBackground(
  request:
    ImageWorkerProcessRequest,
): Promise<{
  blob: Blob;
  width: number;
  height: number;
}> {
  const {
    jobId,
  } = request;

  let heartbeatStage:
    ProcessingStage =
      "loading-model";

  let heartbeatRatio =
    0.02;

  reportStage(
    jobId,
    "loading-model",
    heartbeatRatio,
  );

  const backgroundRemoval =
    await runWithHeartbeat(
      {
        jobId,

        getStage:
          () =>
            heartbeatStage,

        getRatio:
          () =>
            heartbeatRatio,

        task:
          async () => {
            return getBackgroundRemovalModule()
              .catch(() => {
                throw new Error(
                  "model-load-failed",
                );
              });
          },
      },
    );

  checkCancelled(
    jobId,
  );

  heartbeatRatio =
    0.08;

  reportStage(
    jobId,
    "loading-model",
    heartbeatRatio,
  );

  const source =
    await createCappedBackgroundSource(
      request,
    );

  checkCancelled(
    jobId,
  );

  const progress =
    (
      key: string,
      current: number,
      total: number,
    ) => {
      checkCancelled(
        jobId,
      );

      const safeCurrent =
        Number.isFinite(
          current,
        )
          ? Math.max(
              0,
              current,
            )
          : 0;

      const safeTotal =
        Number.isFinite(
          total,
        ) &&
        total > 0
          ? total
          : 1;

      const ratio =
        Math.min(
          1,

          safeCurrent /
            safeTotal,
        );

      if (
        key.startsWith(
          "fetch:",
        )
      ) {
        heartbeatStage =
          "loading-model";

        heartbeatRatio =
          Math.max(
            heartbeatRatio,

            Math.min(
              0.96,

              0.08 +
                ratio *
                  0.88,
            ),
          );

        reportResource(
          jobId,

          key,

          safeCurrent,

          safeTotal,
        );

        return;
      }

      if (
        key ===
        "compute:decode"
      ) {
        heartbeatStage =
          "decoding";

        heartbeatRatio =
          ratio;

        reportStage(
          jobId,
          "loading-model",
          1,
        );

        reportStage(
          jobId,
          "decoding",
          ratio,
        );

        return;
      }

      if (
        key ===
        "compute:inference"
      ) {
        heartbeatStage =
          "analyzing-subject";

        heartbeatRatio =
          Math.max(
            0.05,

            ratio *
              0.82,
          );

        reportStage(
          jobId,
          "loading-model",
          1,
        );

        reportStage(
          jobId,
          "decoding",
          1,
        );

        reportStage(
          jobId,

          "analyzing-subject",

          heartbeatRatio,
        );

        return;
      }

      if (
        key ===
        "compute:mask"
      ) {
        heartbeatStage =
          "analyzing-subject";

        heartbeatRatio =
          Math.max(
            0.82,

            0.82 +
              ratio *
                0.16,
          );

        reportStage(
          jobId,

          "analyzing-subject",

          heartbeatRatio,
        );

        return;
      }

      if (
        key ===
        "compute:encode"
      ) {
        heartbeatStage =
          "encoding-output";

        heartbeatRatio =
          Math.max(
            0.05,
            ratio,
          );

        reportStage(
          jobId,

          "analyzing-subject",

          1,
        );

        reportStage(
          jobId,

          "encoding-output",

          heartbeatRatio,
        );

        return;
      }

      /*
       * Unknown package keys are still forwarded as independent
       * resources. The main-thread progress controller tracks each key
       * separately and therefore does not move backwards when another
       * package resource starts from zero.
       */
      reportResource(
        jobId,

        key ||
          "background-resource",

        safeCurrent,

        safeTotal,
      );
    };

  const configuration = {
    debug:
      false,

    device:
      "cpu" as const,

    model:
      "isnet_fp16" as const,

    /*
     * Sharpixa has already placed the whole operation inside its own
     * dedicated worker. Creating another nested proxy worker would add
     * another lifecycle and failure path.
     */
    proxyToWorker:
      false,

    output: {
      format:
        "image/png" as const,

      quality:
        1,
    },

    progress,
  };

  /*
   * Do not call preload() and then removeBackground() on every job.
   * removeBackground() performs the required asset loading and can use
   * the browser's package/model cache. Avoiding the separate preload
   * removes an additional promise that previously had no completion
   * watchdog.
   */
  const blob =
    await runWithHeartbeat(
      {
        jobId,

        getStage:
          () =>
            heartbeatStage,

        getRatio:
          () =>
            heartbeatRatio,

        task:
          async () => {
            return backgroundRemoval
              .removeBackground(
                source,
                configuration,
              )
              .catch(
                (
                  error:
                    unknown,
                ) => {
                  if (
                    error instanceof
                      WorkerCancelledError ||
                    cancelledJobs.has(
                      jobId,
                    )
                  ) {
                    throw new WorkerCancelledError();
                  }

                  throw new Error(
                    "background-processing-failed",
                  );
                },
              );
          },
      },
    );

  checkCancelled(
    jobId,
  );

  if (!blob.size) {
    throw new Error(
      "empty-output",
    );
  }

  reportStage(
    jobId,
    "loading-model",
    1,
  );

  reportStage(
    jobId,
    "decoding",
    1,
  );

  reportStage(
    jobId,
    "analyzing-subject",
    1,
  );

  reportStage(
    jobId,
    "encoding-output",
    1,
  );

  return {
    blob,

    width:
      request.plan.output
        .width,

    height:
      request.plan.output
        .height,
  };
}

function serializeError(
  error: unknown,
): {
  code:
    WorkerErrorCode;

  message:
    string;
} {
  const message =
    error instanceof Error
      ? error.message
      : "processing-failed";

  if (
    message ===
    "decode-failed"
  ) {
    return {
      code:
        "decode-failed",

      message:
        "The image could not be decoded. It may be corrupt or use an unsupported format.",
    };
  }

  if (
    message ===
      "canvas-allocation-failed" ||
    message ===
      "canvas-context-unavailable"
  ) {
    return {
      code:
        "canvas-failed",

      message:
        "The browser could not allocate a safe image canvas.",
    };
  }

  if (
    message ===
    "selection-empty"
  ) {
    return {
      code:
        "selection-empty",

      message:
        "The selection is empty. Paint the area you want to process and try again.",
    };
  }

  if (
    message ===
    "selection-too-large"
  ) {
    return {
      code:
        "selection-too-large",

      message:
        "The selected area is too large for safe browser reconstruction. Use a smaller, more precise selection.",
    };
  }

  if (
    message ===
    "model-load-failed"
  ) {
    return {
      code:
        "model-load-failed",

      message:
        "The automatic background model could not be loaded. Check your connection and try again, or use Manual mode.",
    };
  }

  if (
    message ===
    "background-processing-failed"
  ) {
    return {
      code:
        "processing-failed",

      message:
        "Automatic background removal could not finish safely. Try a smaller image or switch to Manual mode.",
    };
  }

  if (
    message ===
      "encode-failed" ||
    message ===
      "empty-output"
  ) {
    return {
      code:
        message ===
        "empty-output"
          ? "empty-output"
          : "encode-failed",

      message:
        "The browser could not encode the result. Try a smaller output size.",
    };
  }

  return {
    code:
      "processing-failed",

    message:
      "The image operation could not be completed safely.",
  };
}

async function processRequest(
  request:
    ImageWorkerProcessRequest,
): Promise<void> {
  if (activeJobId) {
    send({
      type:
        "error",

      jobId:
        request.jobId,

      code:
        "busy",

      message:
        "Another image operation is already running.",
    });

    return;
  }

  activeJobId =
    request.jobId;

  cancelledJobs.delete(
    request.jobId,
  );

  try {
    reportStage(
      request.jobId,
      "preparing",
      0,
    );

    checkCancelled(
      request.jobId,
    );

    reportStage(
      request.jobId,
      "preparing",
      1,
    );

    const result =
      request.operation ===
      "automatic-background"
        ? await processAutomaticBackground(
            request,
          )
        : request.operation ===
            "enhance"
          ? await processEnhancement(
              request,
            )
          : await processMaskOperation(
              request,
            );

    checkCancelled(
      request.jobId,
    );

    reportStage(
      request.jobId,
      "finalizing",
      1,
    );

    send({
      type:
        "result",

      jobId:
        request.jobId,

      blob:
        result.blob,

      width:
        result.width,

      height:
        result.height,

      requestedWidth:
        request.plan
          .requested.width,

      requestedHeight:
        request.plan
          .requested.height,

      capped:
        request.plan.capped,
    });
  } catch (error) {
    if (
      error instanceof
        WorkerCancelledError ||
      cancelledJobs.has(
        request.jobId,
      )
    ) {
      send({
        type:
          "cancelled",

        jobId:
          request.jobId,
      });
    } else {
      const serialized =
        serializeError(
          error,
        );

      send({
        type:
          "error",

        jobId:
          request.jobId,

        ...serialized,
      });
    }
  } finally {
    cancelledJobs.delete(
      request.jobId,
    );

    if (
      activeJobId ===
      request.jobId
    ) {
      activeJobId =
        null;
    }
  }
}

workerScope.onmessage =
  (
    event,
  ) => {
    const request =
      event.data;

    if (
      request.type ===
      "cancel"
    ) {
      cancelledJobs.add(
        request.jobId,
      );

      return;
    }

    void processRequest(
      request,
    );
  };