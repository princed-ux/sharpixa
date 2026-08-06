import type {
  ImageWorkerProcessRequest,
  ImageWorkerRequest,
  ImageWorkerResponse,
} from "../lib/imageWorkerTypes";
import type { ProcessingStage } from "../lib/progress";
import type { WorkerErrorCode } from "../lib/workerProtocol";
import { applyLamaInpaint } from "./lamaInpainting";
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

/**
 * A small watermark should never require a 92 MB model download or a long
 * neural inference. The edge-aware local engine is faster and preserves the
 * original resolution, so it is the default for compact selections. LaMa is
 * reserved for genuinely large or deep object-removal regions.
 */
const FAST_LOCAL_INPAINT_MAX_SELECTED_PIXELS = 90_000;
const FAST_LOCAL_INPAINT_MAX_BOUNDS_PIXELS = 220_000;
const FAST_LOCAL_INPAINT_MAX_BOUNDS_SIDE = 720;
const FAST_LOCAL_INPAINT_MAX_REGION_PIXELS = 800_000;

function shouldUseFastLocalInpaint(
  analysis: {
    selectedPixels: number;
    selectedRatio: number;
    bounds: {
      width: number;
      height: number;
    } | null;
  },
  region: {
    width: number;
    height: number;
  },
): boolean {
  const bounds = analysis.bounds;

  if (!bounds) {
    return true;
  }

  const boundsPixels =
    Math.max(1, bounds.width) *
    Math.max(1, bounds.height);

  const regionPixels =
    Math.max(1, region.width) *
    Math.max(1, region.height);

  const compactSelection =
    analysis.selectedPixels <=
      FAST_LOCAL_INPAINT_MAX_SELECTED_PIXELS &&
    boundsPixels <=
      FAST_LOCAL_INPAINT_MAX_BOUNDS_PIXELS &&
    Math.max(bounds.width, bounds.height) <=
      FAST_LOCAL_INPAINT_MAX_BOUNDS_SIDE &&
    regionPixels <=
      FAST_LOCAL_INPAINT_MAX_REGION_PIXELS;

  const deviceMemory =
    typeof navigator === "undefined"
      ? 4
      : navigator.deviceMemory ?? 4;

  const hardwareConcurrency =
    typeof navigator === "undefined"
      ? 4
      : navigator.hardwareConcurrency || 4;

  const highResolutionCompactSelection =
    analysis.selectedRatio <= 0.02 &&
    analysis.selectedPixels <= 250_000 &&
    boundsPixels <= 520_000 &&
    Math.max(bounds.width, bounds.height) <= 900 &&
    regionPixels <= 1_300_000;

  const limitedDeviceSelection =
    (deviceMemory <= 4 || hardwareConcurrency <= 4) &&
    analysis.selectedPixels <= 150_000 &&
    boundsPixels <= 360_000 &&
    regionPixels <= 1_100_000;

  return (
    compactSelection ||
    highResolutionCompactSelection ||
    limitedDeviceSelection
  );
}

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

      const runLocalInpaint = async (): Promise<void> => {
        // Complete the unused model stage so progress moves forward instead of
        // appearing stuck while a small selection is reconstructed locally.
        reportStage(
          jobId,
          "loading-model",
          1,
        );

        reportStage(
          jobId,
          "processing-tiles",
          0.02,
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
      };

      if (
        shouldUseFastLocalInpaint(
          analysis,
          inpaintPlan,
        )
      ) {
        await runLocalInpaint();
      } else {
        let aiStage: ProcessingStage =
          "loading-model";

        let aiRatio = 0;

        try {
          await runWithHeartbeat(
            {
              jobId,

              getStage:
                () => aiStage,

              getRatio:
                () => aiRatio,

              task:
                () =>
                  applyLamaInpaint(
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

                      onResourceProgress:
                        (
                          current,
                          total,
                        ) => {
                          reportResource(
                            jobId,
                            "lama-inpainting-model",
                            current,
                            total,
                          );
                        },

                      onStageProgress:
                        (
                          stage,
                          ratio,
                        ) => {
                          aiStage = stage;
                          aiRatio = ratio;

                          reportStage(
                            jobId,
                            stage,
                            ratio,
                          );
                        },
                    },
                  ),
            },
          );
        } catch (error) {
          if (
            error instanceof
            WorkerCancelledError
          ) {
            throw error;
          }

          /*
           * Model loading can fail on a restricted network, unsupported WASM
           * runtime, or first-load interruption. Keep the operation usable with
           * the edge-aware local fallback instead of failing the entire edit.
           */
          console.warn(
            "LaMa inpainting was unavailable; using the local edge-aware fallback.",
            error,
          );

          await runLocalInpaint();
        }
      }
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
    request.plan.working
      .width ===
      request
        .sourceDimensions
        .width &&
    request.plan.working
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

        request.plan.working
          .width,

        request.plan.working
          .height,
      );

    checkCancelled(
      request.jobId,
    );

    const drawn =
      drawBitmap(
        bitmap,

        request.plan.working
          .width,

        request.plan.working
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

/**
 * IMG.LY returns a transparent foreground at the neural-network input size.
 * For reliability we run inference on plan.working, then scale only the alpha
 * matte back onto the browser-safe plan.output image. This preserves the
 * original RGB detail while avoiding full-resolution ONNX inference.
 */
async function restoreAutomaticBackgroundOutput(
  request:
    ImageWorkerProcessRequest,

  foreground:
    Blob,
): Promise<Blob> {
  const outputWidth =
    request.plan.output
      .width;

  const outputHeight =
    request.plan.output
      .height;

  const workingWidth =
    request.plan.working
      .width;

  const workingHeight =
    request.plan.working
      .height;

  if (
    outputWidth ===
      workingWidth &&
    outputHeight ===
      workingHeight
  ) {
    reportStage(
      request.jobId,
      "resizing-output",
      1,
    );

    return foreground;
  }

  let sourceBitmap:
    | ImageBitmap
    | null = null;

  let foregroundBitmap:
    | ImageBitmap
    | null = null;

  let outputCanvas:
    | OffscreenCanvas
    | null = null;

  try {
    reportStage(
      request.jobId,
      "resizing-output",
      0.05,
    );

    sourceBitmap =
      await decodeBitmap(
        request.source,
        outputWidth,
        outputHeight,
      );

    checkCancelled(
      request.jobId,
    );

    reportStage(
      request.jobId,
      "resizing-output",
      0.38,
    );

    foregroundBitmap =
      await createImageBitmap(
        foreground,
      );

    checkCancelled(
      request.jobId,
    );

    const drawn =
      drawBitmap(
        sourceBitmap,
        outputWidth,
        outputHeight,
        false,
      );

    outputCanvas =
      drawn.canvas;

    drawn.context.save();

    /*
     * destination-in keeps the original source colours and uses only the
     * foreground result's alpha channel as the cut-out mask.
     */
    drawn.context.globalCompositeOperation =
      "destination-in";

    drawn.context.imageSmoothingEnabled =
      true;

    drawn.context.imageSmoothingQuality =
      "high";

    drawn.context.drawImage(
      foregroundBitmap,
      0,
      0,
      outputWidth,
      outputHeight,
    );

    drawn.context.restore();

    reportStage(
      request.jobId,
      "resizing-output",
      1,
    );

    reportStage(
      request.jobId,
      "encoding-output",
      0.05,
    );

    const restored =
      await encodeCanvas(
        outputCanvas,
        "image/png",
      );

    reportStage(
      request.jobId,
      "encoding-output",
      1,
    );

    return restored;
  } finally {
    sourceBitmap?.close();

    foregroundBitmap?.close();

    releaseCanvas(
      outputCanvas,
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

  type BackgroundModel =
    | "isnet_fp16"
    | "isnet_quint8";

  const preferredModel:
    BackgroundModel =
    request.plan
      .safetyProfile
      .tier ===
    "high"
      ? "isnet_fp16"
      : "isnet_quint8";

  const modelAttempts:
    BackgroundModel[] =
    preferredModel ===
    "isnet_fp16"
      ? [
          "isnet_fp16",
          "isnet_quint8",
        ]
      : [
          "isnet_quint8",
        ];

  let blob:
    | Blob
    | null = null;

  let lastFailure:
    unknown = null;

  /*
   * The smaller quantized model is the safer default on ordinary devices.
   * High-memory devices try the higher-quality fp16 model first and fall back
   * once if browser inference rejects or runs out of memory.
   */
  for (
    const model of
    modelAttempts
  ) {
    checkCancelled(
      jobId,
    );

    const configuration = {
      debug:
        false,

      device:
        "cpu" as const,

      model,

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

        type:
          "foreground" as const,
      },

      progress,
    };

    try {
      blob =
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
              async () =>
                backgroundRemoval
                  .removeBackground(
                    source,
                    configuration,
                  ),
          },
        );

      break;
    } catch (
      error
    ) {
      if (
        error instanceof
          WorkerCancelledError ||
        cancelledJobs.has(
          jobId,
        )
      ) {
        throw new WorkerCancelledError();
      }

      lastFailure =
        error;

      if (
        process.env.NODE_ENV !==
        "production"
      ) {
        console.error(
          `Background removal failed with ${model}:`,
          error,
        );
      }

      /*
       * Keep the next attempt alive and visible. The main-thread controller
       * clamps percentage progress upward, so a fallback never jumps back.
       */
      heartbeatStage =
        "loading-model";

      heartbeatRatio =
        Math.max(
          0.12,
          heartbeatRatio,
        );
    }
  }

  if (!blob) {
    const failedWhileLoading =
      heartbeatStage ===
      "loading-model";

    if (
      process.env.NODE_ENV !==
      "production"
    ) {
      console.error(
        "Automatic background removal exhausted all model attempts:",
        lastFailure,
      );
    }

    throw new Error(
      failedWhileLoading
        ? "model-load-failed"
        : "background-processing-failed",
    );
  }


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

  const outputBlob =
    await restoreAutomaticBackgroundOutput(
      request,
      blob,
    );

  checkCancelled(
    jobId,
  );

  if (!outputBlob.size) {
    throw new Error(
      "empty-output",
    );
  }

  reportStage(
    jobId,
    "encoding-output",
    1,
  );

  return {
    blob:
      outputBlob,

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