import {
  isTimestampInsideVideoMaskRange,
  normalizeVideoMaskTimeRange,
  type VideoMaskTimeRange,
  type VideoWorkerProcessRequest,
  type VideoWorkerRequest,
  type VideoWorkerResponse,
} from "../lib/videoWorkerTypes";
import type { ProcessingStage } from "../lib/progress";
import type { WorkerErrorCode } from "../lib/workerProtocol";
import {
  MAX_CLIENT_VIDEO_DURATION_SECONDS,
  MAX_CLIENT_VIDEO_FILE_SIZE_BYTES,
  MAX_CLIENT_VIDEO_LONG_EDGE,
  MAX_CLIENT_VIDEO_PIXELS_PER_FRAME,
  MAX_CLIENT_VIDEO_SHORT_EDGE,
  createVideoOutputPlan,
  getAdaptiveVideoProfile,
  getSafetyProfile,
  validateVideoPreflight,
} from "../lib/processingLimits";
import {
  analyzeMask,
  applyInpaintPlan,
  createInpaintPlan,
  createOffscreenCanvas,
  getOffscreenContext,
  processEnhancementTiles,
  releaseCanvas,
  type InpaintPlan,
} from "./pixelProcessing";

interface VideoWorkerScope {
  onmessage: ((event: MessageEvent<VideoWorkerRequest>) => void) | null;

  postMessage(message: VideoWorkerResponse): void;
}

interface CancellableConversion {
  cancel(): Promise<void>;
}

interface DisposableInput {
  dispose(): void;
}

class WorkerCancelledError extends Error {
  constructor() {
    super("cancelled");
    this.name = "WorkerCancelledError";
  }
}

const workerScope = self as unknown as VideoWorkerScope;

const cancelledJobs = new Set<string>();

const THIRD_PARTY_HEARTBEAT_MS = 1_500;

let activeJobId: string | null = null;

let activeConversion: CancellableConversion | null = null;

let activeInput: DisposableInput | null = null;

let mediabunnyModulePromise: Promise<typeof import("mediabunny")> | null = null;

function send(message: VideoWorkerResponse): void {
  workerScope.postMessage(message);
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

    ratio: Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0,
  });
}

function checkCancelled(jobId: string): void {
  if (cancelledJobs.has(jobId)) {
    throw new WorkerCancelledError();
  }
}

async function yieldControl(jobId: string): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

  checkCancelled(jobId);
}

function assertWorkerCapabilities(): void {
  if (
    typeof OffscreenCanvas === "undefined" ||
    typeof createImageBitmap !== "function" ||
    typeof VideoDecoder === "undefined" ||
    typeof VideoEncoder === "undefined"
  ) {
    throw new Error("unsupported-browser");
  }
}

function assertVideoSafety(
  request: VideoWorkerProcessRequest,

  width: number,
  height: number,
  duration: number,
): void {
  const validation = validateVideoPreflight(
    request.source.size,

    {
      width,
      height,
      duration,
    },
  );

  if (!validation.supported) {
    throw new Error("video-too-large");
  }

  const longEdge = Math.max(width, height);

  const shortEdge = Math.min(width, height);

  if (
    request.source.size > MAX_CLIENT_VIDEO_FILE_SIZE_BYTES ||
    duration > MAX_CLIENT_VIDEO_DURATION_SECONDS ||
    longEdge > MAX_CLIENT_VIDEO_LONG_EDGE ||
    shortEdge > MAX_CLIENT_VIDEO_SHORT_EDGE ||
    width * height > MAX_CLIENT_VIDEO_PIXELS_PER_FRAME
  ) {
    throw new Error("video-too-large");
  }
}

function safeDisposeInput(input: DisposableInput | null): void {
  if (!input) {
    return;
  }

  try {
    input.dispose();
  } catch {
    /*
     * Cancellation may already have
     * released the input.
     */
  }
}

async function cancelActiveConversion(jobId: string): Promise<void> {
  if (activeJobId !== jobId) {
    return;
  }

  const conversion = activeConversion;

  if (!conversion) {
    return;
  }

  try {
    await conversion.cancel();
  } catch {
    /*
     * The client terminates the worker
     * if graceful cancellation stalls.
     */
  }
}

function getMediabunnyModule(): Promise<typeof import("mediabunny")> {
  if (!mediabunnyModulePromise) {
    mediabunnyModulePromise = import("mediabunny").catch((error: unknown) => {
      mediabunnyModulePromise = null;

      throw error;
    });
  }

  return mediabunnyModulePromise;
}

async function runWithHeartbeat<T>(options: {
  jobId: string;
  stage: ProcessingStage;
  getRatio: () => number;
  task: () => Promise<T>;
}): Promise<T> {
  const heartbeat = setInterval(() => {
    if (!cancelledJobs.has(options.jobId)) {
      reportStage(options.jobId, options.stage, options.getRatio());
    }
  }, THIRD_PARTY_HEARTBEAT_MS);

  try {
    const result = await options.task();

    checkCancelled(options.jobId);

    return result;
  } finally {
    clearInterval(heartbeat);
  }
}

function getWorkerDeviceHints(): {
  deviceMemory?: number;
  hardwareConcurrency?: number;
} {
  if (typeof navigator === "undefined") {
    return {};
  }

  const workerNavigator = navigator as unknown as {
    deviceMemory?: number;
    hardwareConcurrency?: number;
  };

  return {
    deviceMemory: workerNavigator.deviceMemory,
    hardwareConcurrency: workerNavigator.hardwareConcurrency,
  };
}

function getEffectiveMaskTimeRange(
  request: VideoWorkerProcessRequest,
  duration: number,
): VideoMaskTimeRange | null {
  if (!request.mask) {
    return null;
  }

  /*
   * Retain compatibility with an older UploadZone by applying a mask with no
   * supplied range to the complete video.
   */
  const requestedRange = request.maskTimeRange ?? {
    startTime: 0,
    endTime: duration,
  };

  const normalized = normalizeVideoMaskTimeRange(requestedRange, duration);

  if (!normalized) {
    throw new Error("invalid-mask-time-range");
  }

  return normalized;
}

async function createVideoInpaintPlan(options: {
  request: VideoWorkerProcessRequest;

  width: number;
  height: number;
}): Promise<{
  bitmap: ImageBitmap | null;

  plan: InpaintPlan | null;
}> {
  const { request, width, height } = options;

  if (!request.mask) {
    return {
      bitmap: null,
      plan: null,
    };
  }

  reportStage(request.jobId, "reading-mask", 0);

  let bitmap: ImageBitmap;

  try {
    bitmap = await createImageBitmap(request.mask);
  } catch {
    throw new Error("selection-empty");
  }

  try {
    const analysis = await analyzeMask({
      mask: bitmap,

      width,
      height,

      checkCancelled: () => checkCancelled(request.jobId),

      yieldControl: () => yieldControl(request.jobId),

      onProgress: (ratio) => {
        reportStage(
          request.jobId,

          "reading-mask",

          ratio * 0.7,
        );
      },
    });

    const profile = getSafetyProfile(getWorkerDeviceHints());

    const plan = await createInpaintPlan({
      mask: bitmap,

      targetWidth: width,

      targetHeight: height,

      analysis,

      maxRegionPixels: profile.maxInpaintRegionPixels,

      checkCancelled: () => checkCancelled(request.jobId),

      yieldControl: () => yieldControl(request.jobId),
    });

    reportStage(request.jobId, "reading-mask", 1);

    return {
      bitmap,
      plan,
    };
  } catch (error) {
    bitmap.close();

    throw error;
  }
}

function serializeError(error: unknown): {
  code: WorkerErrorCode;

  message: string;
} {
  const rawMessage =
    error instanceof Error ? error.message : "processing-failed";

  const message = rawMessage.toLowerCase();

  if (message === "unsupported-browser") {
    return {
      code: "unsupported-browser",

      message:
        "Safe video processing is not supported by this browser. Use a current Chrome or Edge browser.",
    };
  }

  if (message === "video-too-large") {
    return {
      code: "video-too-large",

      message:
        "This video exceeds Sharpixa's browser limit of five minutes, 300MB, or 1080p input. Portrait 1080 × 1920 and landscape 1920 × 1080 are supported.",
    };
  }

  if (message === "unsafe-dimensions") {
    return {
      code: "unsafe-dimensions",

      message:
        "The requested video dimensions are not safe for browser processing. Sharpixa could not create a valid adaptive output size.",
    };
  }

  if (message === "invalid-mask-time-range") {
    return {
      code: "processing-failed",

      message:
        "The selected video start and end time are invalid. Return to the editor and choose a valid interval.",
    };
  }

  if (message === "decode-failed") {
    return {
      code: "decode-failed",

      message:
        "The video metadata or frames could not be decoded. Try MP4 or WEBM in a current Chrome or Edge browser.",
    };
  }

  if (
    message === "canvas-allocation-failed" ||
    message === "canvas-context-unavailable"
  ) {
    return {
      code: "canvas-failed",

      message:
        "The browser could not allocate a safe video canvas. Try a smaller or lower-resolution clip.",
    };
  }

  if (message === "selection-empty") {
    return {
      code: "selection-empty",

      message:
        "The selection is empty. Paint the stationary watermark or object and try again.",
    };
  }

  if (message === "selection-too-large") {
    return {
      code: "selection-too-large",

      message:
        "This selection is too large for safe frame-by-frame reconstruction. Use a smaller, stationary selection.",
    };
  }

  if (
    message.includes("codec") ||
    message.includes("decoder") ||
    message.includes("encoder") ||
    message.includes("unsupported input format")
  ) {
    return {
      code: "unsupported-codec",

      message:
        "This browser cannot safely decode or encode the selected video. Try MP4 or WEBM in a current Chrome or Edge browser.",
    };
  }

  if (message.includes("empty-output") || message.includes("empty")) {
    return {
      code: "empty-output",

      message:
        "Video encoding produced an empty file. Try another supported video.",
    };
  }

  if (message.includes("encode")) {
    return {
      code: "encode-failed",

      message:
        "The processed video could not be encoded. Try a shorter or lower-resolution clip.",
    };
  }

  return {
    code: "processing-failed",

    message: "The video could not be processed safely in this browser.",
  };
}

async function processVideo(request: VideoWorkerProcessRequest): Promise<{
  blob: Blob;
  width: number;
  height: number;
  duration: number;
}> {
  const { jobId } = request;

  let sourceCanvas: OffscreenCanvas | null = null;

  let processedCanvas: OffscreenCanvas | null = null;

  let maskBitmap: ImageBitmap | null = null;

  let input: DisposableInput | null = null;

  reportStage(jobId, "decoding", 0);

  const media = await runWithHeartbeat({
    jobId,

    stage: "decoding",

    getRatio: () => 0.03,

    task: getMediabunnyModule,
  });

  checkCancelled(jobId);

  const mediaInput = new media.Input({
    source: new media.BlobSource(request.source),

    formats: media.ALL_FORMATS,
  });

  input = mediaInput;

  activeInput = mediaInput;

  try {
    const videoTrack = await runWithHeartbeat({
      jobId,

      stage: "decoding",

      getRatio: () => 0.12,

      task: () => mediaInput.getPrimaryVideoTrack(),
    });

    if (!videoTrack) {
      throw new Error("decode-failed");
    }

    const metadataDuration = await runWithHeartbeat({
      jobId,

      stage: "decoding",

      getRatio: () => 0.24,

      task: () => mediaInput.getDurationFromMetadata([videoTrack]),
    });

    const duration =
      typeof metadataDuration === "number" &&
      Number.isFinite(metadataDuration) &&
      metadataDuration > 0
        ? metadataDuration
        : request.metadata.duration;

    assertVideoSafety(
      request,

      videoTrack.displayWidth,

      videoTrack.displayHeight,

      duration,
    );

    const adaptiveProfile = getAdaptiveVideoProfile(duration);

    const maskTimeRange = getEffectiveMaskTimeRange(request, duration);

    /*
     * The UI may already have produced an adaptive output.
     * The worker applies the duration-based cap again so
     * stale UI code cannot request a five-minute 1080p,
     * 24-fps frame-processing job.
     */
    const safeOutputPlan = createVideoOutputPlan(
      request.output,

      "original",

      duration,
    );

    const width = safeOutputPlan.output.width;

    const height = safeOutputPlan.output.height;

    const frameRate = Math.min(
      adaptiveProfile.frameRate,

      safeOutputPlan.frameRate,
    );

    if (
      width <= 0 ||
      height <= 0 ||
      width * height > adaptiveProfile.maxPixelsPerFrame
    ) {
      throw new Error("unsafe-dimensions");
    }

    const enhancementPreset = request.preset === "none" ? null : request.preset;

    const maskResult = await createVideoInpaintPlan({
      request,
      width,
      height,
    });

    maskBitmap = maskResult.bitmap;

    const inpaintPlan = maskResult.plan;

    const needsFrameProcessing =
      Boolean(inpaintPlan) || Boolean(enhancementPreset);

    if (needsFrameProcessing) {
      sourceCanvas = createOffscreenCanvas(width, height);

      if (enhancementPreset) {
        processedCanvas = createOffscreenCanvas(width, height);
      }
    }

    const sourceContext = sourceCanvas
      ? getOffscreenContext(sourceCanvas, true)
      : null;

    const processedContext = processedCanvas
      ? getOffscreenContext(processedCanvas, true)
      : null;

    if (sourceContext) {
      sourceContext.imageSmoothingEnabled = true;

      sourceContext.imageSmoothingQuality = "high";
    }

    if (processedContext) {
      processedContext.imageSmoothingEnabled = true;

      processedContext.imageSmoothingQuality = "high";
    }

    reportStage(jobId, "decoding", 0.55);

    const mp4 = new media.Mp4OutputFormat();

    const webm = new media.WebMOutputFormat();

    let format:
      | InstanceType<typeof media.Mp4OutputFormat>
      | InstanceType<typeof media.WebMOutputFormat> = mp4;

    let videoCodec = await runWithHeartbeat({
      jobId,

      stage: "decoding",

      getRatio: () => 0.62,

      task: () =>
        media.getFirstEncodableVideoCodec(
          mp4.getSupportedVideoCodecs(),

          {
            width,
            height,
          },
        ),
    });

    if (!videoCodec) {
      format = webm;

      videoCodec = await runWithHeartbeat({
        jobId,

        stage: "decoding",

        getRatio: () => 0.68,

        task: () =>
          media.getFirstEncodableVideoCodec(
            webm.getSupportedVideoCodecs(),

            {
              width,
              height,
            },
          ),
      });
    }

    if (!videoCodec) {
      throw new Error("No compatible video encoder codec is available.");
    }

    const audioTrack = await runWithHeartbeat({
      jobId,

      stage: "decoding",

      getRatio: () => 0.74,

      task: () => mediaInput.getPrimaryAudioTrack(),
    });

    type AudioCodec = Exclude<
      Awaited<ReturnType<typeof media.getFirstEncodableAudioCodec>>,
      null
    >;

    let audioOptions:
      | {
          codec: AudioCodec;

          bitrate: number;
        }
      | {
          discard: true;
        }
      | undefined;

    if (audioTrack) {
      const inputCodec = await audioTrack.getCodec();

      const supportedAudioCodecs = format.getSupportedAudioCodecs();

      if (!inputCodec || !supportedAudioCodecs.includes(inputCodec)) {
        const audioCodec = await media.getFirstEncodableAudioCodec(
          supportedAudioCodecs,

          {
            numberOfChannels: audioTrack.numberOfChannels,

            sampleRate: audioTrack.sampleRate,
          },
        );

        audioOptions = audioCodec
          ? {
              codec: audioCodec,

              bitrate: 192_000,
            }
          : {
              discard: true,
            };
      }
    }

    const target = new media.BufferTarget();

    const output = new media.Output({
      format,
      target,
    });

    let conversionProgress = 0;

    let lastFrameActivityAt = 0;

    const conversion = await runWithHeartbeat({
      jobId,

      stage: "decoding",

      getRatio: () => 0.88,

      task: () =>
        media.Conversion.init({
          input: mediaInput,

          output,

          tracks: "primary",

          showWarnings: false,

          video: {
            width,
            height,

            fit: "fill",

            frameRate,

            codec: videoCodec,

            bitrate: media.QUALITY_HIGH,

            hardwareAcceleration: "no-preference",

            forceTranscode: true,

            ...(needsFrameProcessing && sourceCanvas && sourceContext
              ? {
                  process: async (
                    sample: InstanceType<typeof media.VideoSample>,
                  ) => {
                    checkCancelled(jobId);

                    /*
                     * A video watermark or object selection is applied only while the
                     * frame's presentation timestamp is inside the selected interval.
                     *
                     * Returning the original VideoSample here bypasses Sharpixa's canvas
                     * reconstruction and inpainting for this frame.
                     */
                    if (
                      inpaintPlan &&
                      maskTimeRange &&
                      !isTimestampInsideVideoMaskRange(
                        sample.timestamp,
                        maskTimeRange,
                      )
                    ) {
                      return sample;
                    }

                    sourceContext.clearRect(0, 0, width, height);

                    sourceContext.filter = "none";

                    sample.draw(sourceContext, 0, 0, width, height);

                    if (inpaintPlan) {
                      await applyInpaintPlan({
                        context: sourceContext,

                        plan: inpaintPlan,

                        checkCancelled: () => checkCancelled(jobId),

                        yieldControl: () => yieldControl(jobId),

                        onProgress: () => {
                          const now = Date.now();

                          if (now - lastFrameActivityAt >= 500) {
                            lastFrameActivityAt = now;

                            reportStage(
                              jobId,

                              "processing-video",

                              conversionProgress,
                            );
                          }
                        },
                      });

                      return sourceCanvas;
                    }

                    if (
                      enhancementPreset &&
                      processedContext &&
                      processedCanvas
                    ) {
                      await processEnhancementTiles({
                        source: sourceContext,

                        output: processedContext,

                        width,
                        height,

                        presetName: enhancementPreset,

                        controls: request.controls,

                        checkCancelled: () => checkCancelled(jobId),

                        yieldControl: () => yieldControl(jobId),

                        onProgress: () => {
                          const now = Date.now();

                          if (now - lastFrameActivityAt >= 500) {
                            lastFrameActivityAt = now;

                            reportStage(
                              jobId,

                              "processing-video",

                              conversionProgress,
                            );
                          }
                        },
                      });

                      return processedCanvas;
                    }

                    return sourceCanvas;
                  },

                  processedWidth: width,

                  processedHeight: height,
                }
              : {}),
          },

          ...(audioOptions
            ? {
                audio: audioOptions,
              }
            : {}),
        }),
    });

    activeConversion = conversion;

    if (!conversion.isValid) {
      const reasons = conversion.discardedTracks
        .map(
          (item: {
            track: {
              type: string;
            };

            reason: string;
          }) => `${item.track.type}: ${item.reason}`,
        )
        .join("; ");

      throw new Error(
        reasons
          ? `The video codec combination cannot be converted: ${reasons}`
          : "The video codec combination cannot be converted.",
      );
    }

    conversion.onProgress = (progress: number) => {
      conversionProgress = Math.max(
        conversionProgress,

        Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0,
      );

      reportStage(
        jobId,

        "processing-video",

        conversionProgress,
      );
    };

    reportStage(jobId, "decoding", 1);

    reportStage(jobId, "processing-video", 0);

    await runWithHeartbeat({
      jobId,

      stage: "processing-video",

      getRatio: () => conversionProgress,

      task: () => conversion.execute(),
    });

    checkCancelled(jobId);

    conversionProgress = 1;

    reportStage(jobId, "processing-video", 1);

    reportStage(jobId, "encoding-output", 0.4);

    const buffer = target.buffer;

    if (!buffer?.byteLength) {
      throw new Error("empty-output");
    }

    const blob = new Blob(
      [buffer],

      {
        type: format === mp4 ? "video/mp4" : "video/webm",
      },
    );

    if (!blob.size) {
      throw new Error("empty-output");
    }

    reportStage(jobId, "encoding-output", 1);

    return {
      blob,
      width,
      height,
      duration,
    };
  } finally {
    activeConversion = null;

    safeDisposeInput(input);

    if (activeInput === input) {
      activeInput = null;
    }

    maskBitmap?.close();

    releaseCanvas(sourceCanvas);

    releaseCanvas(processedCanvas);
  }
}

async function processRequest(
  request: VideoWorkerProcessRequest,
): Promise<void> {
  if (activeJobId) {
    send({
      type: "error",

      jobId: request.jobId,

      code: "busy",

      message: "Another video operation is already running.",
    });

    return;
  }

  activeJobId = request.jobId;

  cancelledJobs.delete(request.jobId);

  try {
    reportStage(request.jobId, "preparing", 0);

    assertWorkerCapabilities();

    checkCancelled(request.jobId);

    assertVideoSafety(
      request,

      request.metadata.width,

      request.metadata.height,

      request.metadata.duration,
    );

    reportStage(request.jobId, "preparing", 1);

    const result = await processVideo(request);

    checkCancelled(request.jobId);

    reportStage(request.jobId, "finalizing", 1);

    send({
      type: "result",

      jobId: request.jobId,

      ...result,
    });
  } catch (error) {
    if (
      error instanceof WorkerCancelledError ||
      cancelledJobs.has(request.jobId) ||
      (error instanceof Error && error.name === "ConversionCanceledError")
    ) {
      send({
        type: "cancelled",

        jobId: request.jobId,
      });
    } else {
      const serialized = serializeError(error);

      send({
        type: "error",

        jobId: request.jobId,

        ...serialized,
      });
    }
  } finally {
    cancelledJobs.delete(request.jobId);

    activeConversion = null;

    safeDisposeInput(activeInput);

    activeInput = null;

    if (activeJobId === request.jobId) {
      activeJobId = null;
    }
  }
}

workerScope.onmessage = (event) => {
  const request = event.data;

  if (request.type === "cancel") {
    cancelledJobs.add(request.jobId);

    if (activeJobId === request.jobId) {
      void cancelActiveConversion(request.jobId);
    }

    return;
  }

  void processRequest(request);
};
