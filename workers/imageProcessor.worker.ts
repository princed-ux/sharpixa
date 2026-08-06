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
 * Watermark quality is more important than avoiding the model download. The
 * local directional filler remains an emergency fallback only; it can smear
 * hard geometric edges when a watermark crosses multiple regions.
 */
function shouldUseFastLocalInpaint(
  _analysis: {
    selectedPixels: number;
    selectedRatio: number;
    bounds: {
      width: number;
      height: number;
    } | null;
  },
  _region: {
    width: number;
    height: number;
  },
): boolean {
  return false;
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

      const runLocalInpaint =
        async (): Promise<void> => {
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

        let aiRatio =
          0;

        try {
          await runWithHeartbeat(
            {
              jobId,

              getStage:
                () =>
                  aiStage,

              getRatio:
                () =>
                  aiRatio,

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
                          aiStage =
                            stage;

                          aiRatio =
                            ratio;

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
        } catch (
          error
        ) {
          if (
            error instanceof
            WorkerCancelledError
          ) {
            throw error;
          }

          /*
           * The local method is used only when the AI model genuinely cannot
           * load or execute. It prevents the entire edit from being lost.
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
           * A temporary chunk or network failure must be retryable after the
           * image worker is recreated.
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
    setInterval(
      () => {
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
      },

      THIRD_PARTY_HEARTBEAT_MS,
    );

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
 * Sharpixa runs inference on plan.working and scales only the alpha matte back
 * onto the larger browser-safe output. This keeps the original image colours
 * and details rather than enlarging the model's processed RGB output.
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
     * destination-in preserves the original source RGB and uses only the
     * generated foreground's alpha channel as the cut-out mask.
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
          async () =>
            getBackgroundRemovalModule()
              .catch(
                () => {
                  throw new Error(
                    "model-load-failed",
                  );
                },
              ),
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
       * Unknown package keys remain separate resources. The main-thread
       * progress controller tracks each key independently.
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
   * The quantized model is safer on ordinary devices. High-memory devices try
   * the FP16 model first and automatically fall back to the quantized model.
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
       * Sharpixa already runs the operation in a dedicated image worker.
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
        "Sharpixa could not read this image. Try saving it as a standard JPG, PNG, or WEBP file and upload it again.",
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
        "Sharpixa could not prepare the image workspace on this device. Close unused browser tabs and try again.",
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
        "Paint directly over the watermark or object before starting removal.",
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
        "The selected area is too broad. Paint closely over only the watermark or unwanted object.",
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
        "Sharpixa could not load the required AI model. Check the connection and try again.",
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
        "Automatic background removal could not finish on this device. Try again or use Manual mode.",
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
        "Sharpixa finished processing but could not create the downloadable image. Try again.",
    };
  }

  return {
    code:
      "processing-failed",

    message:
      "Sharpixa could not complete this image operation. Try again with a more precise selection.",
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
  } catch (
    error
  ) {
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