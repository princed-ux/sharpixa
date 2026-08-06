"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import CompareSlider from "@/components/CompareSlider";
import { Icon } from "@/components/Icons";
import WatermarkBrush from "@/components/WatermarkBrush";
import {
  DEFAULT_CONTROLS,
  FILE_LIMITS,
  IMAGE_FORMATS,
  PRESETS,
  VIDEO_FORMATS,
  type AdvancedControls,
  type PresetName,
} from "@/lib/constants";
import {
  captureVideoFrame,
  formatBytes,
  generateSampleImage,
  readImageDimensions,
  readVideoMetadata,
} from "@/lib/enhance";
import {
  ImageWorkerClient,
  supportsImageWorkerProcessing,
} from "@/lib/imageWorkerClient";
import {
  MAX_CLIENT_VIDEO_FILE_SIZE_BYTES,
  createImageProcessingPlan,
  createVideoOutputPlan,
  formatDimensions as formatSafeDimensions,
  getBrowserDeviceHints,
  validateImageSource,
  validateVideoPreflight,
  type ImageOperation,
  type ImageProcessingPlan,
  type ProcessingResolution,
  type VideoMetadata,
} from "@/lib/processingLimits";
import {
  BACKGROUND_PROGRESS_PROFILE,
  ENHANCE_PROGRESS_PROFILE,
  MASK_PROGRESS_PROFILE,
  VIDEO_PROGRESS_PROFILE,
  createProgressController,
  type ProgressController,
  type ProgressProfile,
} from "@/lib/progress";
import {
  ProcessingJobManager,
  type HeavyJobKind,
} from "@/lib/processingJobManager";
import {
  normalizeVideoMaskTimeRange,
  type VideoMaskTimeRange,
} from "@/lib/videoWorkerTypes";
import {
  VideoWorkerClient,
  supportsVideoWorkerProcessing,
} from "@/lib/videoWorkerClient";
import {
  isProcessingCancelledError,
  WorkerProcessingError,
  type WorkerProgressMessage,
  type WorkerResourceProgressMessage,
} from "@/lib/workerProtocol";

type Mode =
  | "watermark"
  | "enhance"
  | "background";

type Tab =
  | "image"
  | "video";

type Phase =
  | "upload"
  | "settings"
  | "brush"
  | "processing"
  | "result";

type Dimensions = {
  w: number;
  h: number;
};

type ImageJobOptions = {
  operation: ImageOperation;
  inputFile?: File;
  dimensions?: Dimensions;
};

type ErrorNoticeProps = {
  message: string;
  onDismiss: () => void;
  onRetry?: () => void;
  onManual?: () => void;
};

const IMAGE_ACCEPT =
  ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";

const VIDEO_ACCEPT =
  ".mp4,.mov,.avi,.webm,.mkv,video/mp4,video/quicktime,video/webm";

const IMAGE_RESOLUTIONS: ProcessingResolution[] = [
  "original",
  "2x",
  "4x",
  "8k",
];

const VIDEO_RESOLUTIONS: ProcessingResolution[] = [
  "original",
  "2x",
];

const PREFLIGHT_TIMEOUT_MS =
  20_000;

const RESOLUTION_LABELS: Record<
  ProcessingResolution,
  string
> = {
  original:
    "Original",

  "2x":
    "2× dimensions",

  "4x":
    "4× dimensions",

  "8k":
    "Up to 8K",
};

const PRESET_COPY: Record<
  PresetName,
  {
    label: string;
    description: string;
    icon:
      | "sun"
      | "zap"
      | "wand";
  }
> = {
  light: {
    label:
      "Light",

    description:
      "Gentle cleanup with subtle detail recovery",

    icon:
      "sun",
  },

  standard: {
    label:
      "Standard",

    description:
      "Balanced denoise, clarity, and sharpening",

    icon:
      "zap",
  },

  maximum: {
    label:
      "Maximum",

    description:
      "Stronger processing for soft or compressed files",

    icon:
      "wand",
  },
};

const CONTROL_ROWS: Array<{
  label: string;
  key: keyof AdvancedControls;
  min: number;
  max: number;
  icon:
    | "sun"
    | "contrast"
    | "droplet"
    | "blur";
}> = [
  {
    label:
      "Brightness",

    key:
      "brightness",

    min:
      -50,

    max:
      50,

    icon:
      "sun",
  },

  {
    label:
      "Contrast",

    key:
      "contrast",

    min:
      -50,

    max:
      50,

    icon:
      "contrast",
  },

  {
    label:
      "Saturation",

    key:
      "saturation",

    min:
      -50,

    max:
      50,

    icon:
      "droplet",
  },

  {
    label:
      "Sharpening",

    key:
      "sharpness",

    min:
      0,

    max:
      100,

    icon:
      "blur",
  },
];

function formatDimensions(
  value:
    | Dimensions
    | null,
): string {
  return value
    ? `${value.w.toLocaleString()} × ${value.h.toLocaleString()} px`
    : "Reading dimensions…";
}

function formatVideoTime(
  seconds: number,
): string {
  const safe =
    Number.isFinite(
      seconds,
    )
      ? Math.max(
          0,
          seconds,
        )
      : 0;

  const minutes =
    Math.floor(
      safe /
        60,
    );

  const remainder =
    safe -
    minutes *
      60;

  return `${minutes}:${remainder
    .toFixed(
      2,
    )
    .padStart(
      5,
      "0",
    )}`;
}

function getModeHeading(
  mode: Mode,
): string {
  if (
    mode ===
    "background"
  ) {
    return "Remove Image Background";
  }

  if (
    mode ===
    "watermark"
  ) {
    return "Remove an Object or Text";
  }

  return "Improve Image or Video Quality";
}

function getFriendlyError(
  error: unknown,
  mode: Mode,
): string {
  if (
    error instanceof
    WorkerProcessingError
  ) {
    switch (
      error.code
    ) {
      case "unsupported-browser":
        return "Safe processing is unavailable in this browser. Use a current Chrome or Edge browser.";

      case "unsafe-dimensions":
      case "canvas-failed":
        return "This file exceeds a safe browser memory or canvas limit. Try a smaller file or lower output size.";

      case "selection-empty":
        return "No selected pixels were found. Paint the area again and retry.";

      case "selection-too-large":
        return "The selected area is too large for safe reconstruction. Use a smaller, more precise selection.";

      case "model-load-failed":
        return "The automatic background model could not load. Check your connection, retry, or use Manual mode.";

      case "decode-failed":
        return "The file could not be decoded. Try JPG, PNG, MP4, or WEBM.";

      case "unsupported-codec":
        return "This video codec is not supported safely. Try MP4 or WEBM in Chrome or Edge.";

      case "video-too-large":
        return "This video exceeds Sharpixa's browser limit. Use a clip up to five minutes, 300MB, and 1080p input. Portrait 1080 × 1920 and landscape 1920 × 1080 are supported.";

      case "encode-failed":
      case "empty-output":
        return "The browser could not create the result. Try a smaller file or lower output size.";

      case "busy":
        return "Another file is already being processed. Cancel it before starting a new one.";

      default:
        break;
    }
  }

  if (
    mode ===
    "background"
  ) {
    return "Automatic background removal could not finish. Retry with a smaller image or switch to Manual mode.";
  }

  if (
    mode ===
    "watermark"
  ) {
    return "The selected area could not be rebuilt. Try a smaller and more precise selection.";
  }

  return "The improvement process could not finish. Try a smaller file or lower output size.";
}

function ErrorNotice({
  message,
  onDismiss,
  onRetry,
  onManual,
}: ErrorNoticeProps) {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-rose-200 bg-white shadow-lg shadow-rose-100/60"
      role="alert"
    >
      <div className="h-1 bg-gradient-to-r from-rose-500 via-red-500 to-orange-400" />

      <div className="flex items-start gap-3 p-4 sm:p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-lg font-bold text-rose-600">
          !
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-gray-900">
            Processing needs attention
          </h3>

          <p className="mt-1 break-words text-sm leading-6 text-gray-600">
            {message}
          </p>

          {(onRetry ||
            onManual) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {onRetry && (
                <button
                  type="button"
                  onClick={
                    onRetry
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-gray-950 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-800"
                >
                  <Icon
                    name="refresh"
                    size={14}
                  />

                  Try again
                </button>
              )}

              {onManual && (
                <button
                  type="button"
                  onClick={
                    onManual
                  }
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:border-indigo-200 hover:text-indigo-600"
                >
                  <Icon
                    name="brush"
                    size={14}
                  />

                  Continue in Manual mode
                </button>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          aria-label="Dismiss error"
          onClick={
            onDismiss
          }
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          <Icon
            name="close"
            size={15}
          />
        </button>
      </div>
    </div>
  );
}

export default function UploadZone({
  mode,
}: {
  mode: Mode;
}) {
  const [
    tab,
    setTab,
  ] = useState<Tab>(
    "image",
  );

  const [
    file,
    setFile,
  ] =
    useState<File | null>(
      null,
    );

  const [
    fileURL,
    setFileURL,
  ] =
    useState<string | null>(
      null,
    );

  const [
    posterURL,
    setPosterURL,
  ] =
    useState<string | null>(
      null,
    );

  const [
    fileType,
    setFileType,
  ] = useState<Tab>(
    "image",
  );

  const [
    mask,
    setMask,
  ] =
    useState<Blob | null>(
      null,
    );

  const [
    videoMaskTimeRange,
    setVideoMaskTimeRange,
  ] =
    useState<VideoMaskTimeRange | null>(
      null,
    );

  const [
    preset,
    setPreset,
  ] =
    useState<PresetName>(
      "standard",
    );

  const [
    resolution,
    setResolution,
  ] =
    useState<ProcessingResolution>(
      "original",
    );

  const [
    controls,
    setControls,
  ] =
    useState<AdvancedControls>(
      DEFAULT_CONTROLS,
    );

  const [
    phase,
    setPhase,
  ] =
    useState<Phase>(
      "upload",
    );

  const [
    progress,
    setProgress,
  ] = useState(
    0,
  );

  const [
    processingStage,
    setProcessingStage,
  ] = useState(
    "Preparing file",
  );

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    resultURL,
    setResultURL,
  ] =
    useState<string | null>(
      null,
    );

  const [
    resultBlob,
    setResultBlob,
  ] =
    useState<Blob | null>(
      null,
    );

  const [
    dragover,
    setDragover,
  ] = useState(
    false,
  );

  const [
    autoMode,
    setAutoMode,
  ] = useState(
    true,
  );

  const [
    rightsConfirmed,
    setRightsConfirmed,
  ] = useState(
    false,
  );

  const [
    inputDims,
    setInputDims,
  ] =
    useState<Dimensions | null>(
      null,
    );

  const [
    outputDims,
    setOutputDims,
  ] =
    useState<Dimensions | null>(
      null,
    );

  const [
    videoMetadata,
    setVideoMetadata,
  ] =
    useState<VideoMetadata | null>(
      null,
    );

  const [
    videoWarning,
    setVideoWarning,
  ] =
    useState<string | null>(
      null,
    );

  const [
    safetyNotice,
    setSafetyNotice,
  ] =
    useState<string | null>(
      null,
    );

  const [
    preparing,
    setPreparing,
  ] = useState(
    false,
  );

  const [
    preparingMessage,
    setPreparingMessage,
  ] = useState(
    "Reading file safely…",
  );

  const inputRef =
    useRef<HTMLInputElement>(
      null,
    );

  const fileUrlRef =
    useRef<string | null>(
      null,
    );

  const resultUrlRef =
    useRef<string | null>(
      null,
    );

  const posterUrlRef =
    useRef<string | null>(
      null,
    );

  const mountedRef =
    useRef(
      true,
    );

  const previousModeRef =
    useRef(
      mode,
    );

  const preflightRef =
    useRef<AbortController | null>(
      null,
    );

  const progressRef =
    useRef<ProgressController | null>(
      null,
    );

  const jobsRef =
    useRef(
      new ProcessingJobManager(),
    );

  const imageClientRef =
    useRef(
      new ImageWorkerClient(),
    );

  const videoClientRef =
    useRef(
      new VideoWorkerClient(),
    );

  const expectedImagePlan =
    useMemo<ImageProcessingPlan | null>(
      () => {
        if (
          !inputDims ||
          fileType !==
            "image"
        ) {
          return null;
        }

        const operation:
          ImageOperation =
          mode ===
          "enhance"
            ? "enhance"
            : mode ===
                "background"
              ? autoMode
                ? "automatic-background"
                : "manual-background"
              : "inpaint";

        return createImageProcessingPlan(
          {
            width:
              inputDims.w,

            height:
              inputDims.h,
          },

          mode ===
          "enhance"
            ? resolution
            : "original",

          operation,

          getBrowserDeviceHints(),
        );
      },
      [
        autoMode,
        fileType,
        inputDims,
        mode,
        resolution,
      ],
    );

  const expectedOutputDims =
    useMemo<Dimensions | null>(
      () => {
        if (
          !inputDims
        ) {
          return null;
        }

        if (
          fileType ===
          "image"
        ) {
          return expectedImagePlan
            ? {
                w:
                  expectedImagePlan
                    .output
                    .width,

                h:
                  expectedImagePlan
                    .output
                    .height,
              }
            : null;
        }

        const plan =
          createVideoOutputPlan(
            {
              width:
                inputDims.w,

              height:
                inputDims.h,
            },

            mode ===
            "watermark"
              ? "original"
              : resolution,

            videoMetadata?.duration ??
              0,
          );

        return {
          w:
            plan.output.width,

          h:
            plan.output.height,
        };
      },
      [
        expectedImagePlan,
        fileType,
        inputDims,
        mode,
        resolution,
        videoMetadata,
      ],
    );

  const replaceFileUrl =
    useCallback(
      (
        next:
          | string
          | null,
      ) => {
        if (
          fileUrlRef.current?.startsWith(
            "blob:",
          )
        ) {
          URL.revokeObjectURL(
            fileUrlRef.current,
          );
        }

        fileUrlRef.current =
          next;

        setFileURL(
          next,
        );
      },
      [],
    );

  const replaceResultUrl =
    useCallback(
      (
        next:
          | string
          | null,
      ) => {
        if (
          resultUrlRef.current?.startsWith(
            "blob:",
          )
        ) {
          URL.revokeObjectURL(
            resultUrlRef.current,
          );
        }

        resultUrlRef.current =
          next;

        setResultURL(
          next,
        );
      },
      [],
    );

  const replacePosterUrl =
    useCallback(
      (
        next:
          | string
          | null,
      ) => {
        if (
          posterUrlRef.current?.startsWith(
            "blob:",
          )
        ) {
          URL.revokeObjectURL(
            posterUrlRef.current,
          );
        }

        posterUrlRef.current =
          next;

        setPosterURL(
          next,
        );
      },
      [],
    );

  useEffect(
    () => {
      mountedRef.current =
        true;

      return () => {
        mountedRef.current =
          false;

        preflightRef.current?.abort(
          "unmounted",
        );

        progressRef.current?.dispose();

        jobsRef.current.dispose();

        imageClientRef.current.dispose();

        videoClientRef.current.dispose();

        if (
          fileUrlRef.current?.startsWith(
            "blob:",
          )
        ) {
          URL.revokeObjectURL(
            fileUrlRef.current,
          );
        }

        if (
          resultUrlRef.current?.startsWith(
            "blob:",
          )
        ) {
          URL.revokeObjectURL(
            resultUrlRef.current,
          );
        }

        if (
          posterUrlRef.current?.startsWith(
            "blob:",
          )
        ) {
          URL.revokeObjectURL(
            posterUrlRef.current,
          );
        }
      };
    },
    [],
  );

  const createJobProgress =
    useCallback(
      (
        jobId: string,
        profile:
          ProgressProfile,
      ) => {
        progressRef.current?.dispose();

        const controller =
          createProgressController({
            jobId,
            profile,

            throttleMs:
              125,

            onUpdate:
              (
                update,
              ) => {
                if (
                  !mountedRef.current ||
                  !jobsRef.current.isActive(
                    update.jobId,
                  )
                ) {
                  return;
                }

                setProgress(
                  (
                    previous,
                  ) =>
                    Math.max(
                      previous,
                      update.value,
                    ),
                );

                setProcessingStage(
                  update.label,
                );
              },
          });

        progressRef.current =
          controller;

        controller.reportStage(
          "preparing",
          1,
          true,
        );

        return controller;
      },
      [],
    );

  const reportWorkerProgress =
    useCallback(
      (
        controller:
          ProgressController,

        message:
          | WorkerProgressMessage
          | WorkerResourceProgressMessage,
      ) => {
        if (
          message.type ===
          "resource-progress"
        ) {
          controller.reportResource(
            message.stage,
            message.key,
            message.current,
            message.total,
          );
        } else {
          controller.reportStage(
            message.stage,
            message.ratio,
          );
        }
      },
      [],
    );

  const cancelCurrentWork =
    useCallback(
      async () => {
        preflightRef.current?.abort(
          "cancelled",
        );

        preflightRef.current =
          null;

        progressRef.current?.dispose();

        progressRef.current =
          null;

        if (
          jobsRef.current.busy &&
          mountedRef.current
        ) {
          setProcessingStage(
            "Cancellation completing safely",
          );
        }

        await jobsRef.current.cancel();
      },
      [],
    );

  const reset =
    useCallback(
      async () => {
        await cancelCurrentWork();

        if (
          !mountedRef.current
        ) {
          return;
        }

        replaceFileUrl(
          null,
        );

        replaceResultUrl(
          null,
        );

        replacePosterUrl(
          null,
        );

        if (
          inputRef.current
        ) {
          inputRef.current.value =
            "";
        }

        setFile(
          null,
        );

        setResultBlob(
          null,
        );

        setMask(
          null,
        );

        setVideoMaskTimeRange(
          null,
        );

        setPreset(
          "standard",
        );

        setResolution(
          "original",
        );

        setControls(
          DEFAULT_CONTROLS,
        );

        setInputDims(
          null,
        );

        setOutputDims(
          null,
        );

        setVideoMetadata(
          null,
        );

        setVideoWarning(
          null,
        );

        setSafetyNotice(
          null,
        );

        setProgress(
          0,
        );

        setProcessingStage(
          "Preparing file",
        );

        setPreparing(
          false,
        );

        setPreparingMessage(
          "Reading file safely…",
        );

        setError(
          null,
        );

        setPhase(
          "upload",
        );
      },
      [
        cancelCurrentWork,
        replaceFileUrl,
        replacePosterUrl,
        replaceResultUrl,
      ],
    );

  useEffect(
    () => {
      if (
        previousModeRef.current !==
        mode
      ) {
        previousModeRef.current =
          mode;

        void reset();

        return;
      }

      if (
        mode ===
          "background" &&
        tab !==
          "image"
      ) {
        setTab(
          "image",
        );
      }
    },
    [
      mode,
      reset,
      tab,
    ],
  );

  const runImageJob =
    useCallback(
      async ({
        operation,

        inputFile =
          file ??
          undefined,

        dimensions =
          inputDims ??
          undefined,
      }: ImageJobOptions) => {
        if (
          !inputFile ||
          !dimensions ||
          jobsRef.current.busy
        ) {
          return;
        }

        if (
          !supportsImageWorkerProcessing()
        ) {
          setError(
            "Safe image processing needs Web Workers, OffscreenCanvas, and ImageBitmap. Use a current Chrome or Edge browser.",
          );

          setPhase(
            operation ===
              "automatic-background"
              ? "upload"
              : operation ===
                  "enhance"
                ? "settings"
                : "brush",
          );

          return;
        }

        const selectedResolution:
          ProcessingResolution =
          operation ===
          "enhance"
            ? resolution
            : "original";

        const plan =
          createImageProcessingPlan(
            {
              width:
                dimensions.w,

              height:
                dimensions.h,
            },

            selectedResolution,

            operation,

            getBrowserDeviceHints(),
          );

        const kind:
          HeavyJobKind =
          operation ===
          "automatic-background"
            ? "automatic-background"
            : operation ===
                "enhance"
              ? "image-enhancement"
              : operation ===
                  "manual-background"
                ? "manual-background"
                : "image-inpaint";

        const profile =
          operation ===
          "automatic-background"
            ? BACKGROUND_PROGRESS_PROFILE
            : operation ===
                "enhance"
              ? ENHANCE_PROGRESS_PROFILE
              : MASK_PROGRESS_PROFILE;

        const fallbackPhase:
          Phase =
          operation ===
          "automatic-background"
            ? "upload"
            : operation ===
                "enhance"
              ? "settings"
              : "brush";

        const job =
          jobsRef.current.begin(
            kind,
          );

        const progressController =
          createJobProgress(
            job.id,
            profile,
          );

        setPhase(
          "processing",
        );

        setProgress(
          0,
        );

        setProcessingStage(
          "Preparing file",
        );

        setError(
          null,
        );

        setSafetyNotice(
          plan.capped
            ? `Requested ${formatSafeDimensions(
                plan.requested,
              )}; capped to ${formatSafeDimensions(
                plan.output,
              )} to protect browser memory.`
            : null,
        );

        try {
          const client =
            imageClientRef.current;

          jobsRef.current.registerCancellation(
            job.id,

            () =>
              client.cancel(
                job.id,
              ),
          );

          const outputFormat:
            | "image/png"
            | "image/jpeg" =
            operation ===
              "automatic-background" ||
            operation ===
              "manual-background"
              ? "image/png"
              : inputFile.type ===
                  "image/jpeg"
                ? "image/jpeg"
                : "image/png";

          const result =
            await client.process(
              {
                type:
                  "process",

                jobId:
                  job.id,

                operation,

                source:
                  inputFile,

                sourceDimensions: {
                  width:
                    dimensions.w,

                  height:
                    dimensions.h,
                },

                plan,

                resolution:
                  selectedResolution,

                preset,

                controls,

                mask:
                  operation ===
                    "manual-background" ||
                  operation ===
                    "inpaint"
                    ? mask
                    : null,

                outputFormat,
              },

              {
                onProgress:
                  (
                    message,
                  ) =>
                    reportWorkerProgress(
                      progressController,
                      message,
                    ),
              },
            );

          if (
            !jobsRef.current.isActive(
              job.id,
            )
          ) {
            return;
          }

          if (
            !result.blob.size
          ) {
            throw new WorkerProcessingError(
              "empty-output",

              "The processed image was empty.",
            );
          }

          setResultBlob(
            result.blob,
          );

          setOutputDims({
            w:
              result.width,

            h:
              result.height,
          });

          replaceResultUrl(
            URL.createObjectURL(
              result.blob,
            ),
          );

          progressController.completeSuccess();

          jobsRef.current.complete(
            job.id,
          );

          progressRef.current =
            null;

          progressController.dispose();

          setPhase(
            "result",
          );
        } catch (
          processingError
        ) {
          const wasActive =
            jobsRef.current.isActive(
              job.id,
            );

          jobsRef.current.complete(
            job.id,
          );

          progressController.dispose();

          if (
            isProcessingCancelledError(
              processingError,
            ) ||
            !wasActive ||
            !mountedRef.current
          ) {
            return;
          }

          if (
            process.env.NODE_ENV !==
            "production"
          ) {
            if (
              processingError instanceof
              WorkerProcessingError
            ) {
              console.warn(
                "Image processing was safely stopped:",
                processingError.code,
                processingError.message,
              );
            } else {
              console.error(
                "Unexpected image processing failure:",
                processingError,
              );
            }
          }

          setError(
            getFriendlyError(
              processingError,
              mode,
            ),
          );

          setProgress(
            0,
          );

          setPhase(
            fallbackPhase,
          );
        }
      },
      [
        controls,
        createJobProgress,
        file,
        inputDims,
        mask,
        mode,
        preset,
        replaceResultUrl,
        reportWorkerProgress,
        resolution,
      ],
    );

  const processVideo =
    useCallback(
      async () => {
        if (
          !file ||
          !fileURL ||
          !inputDims ||
          !videoMetadata ||
          jobsRef.current.busy
        ) {
          return;
        }

        const validation =
          validateVideoPreflight(
            file.size,
            videoMetadata,
          );

        if (
          !validation.supported
        ) {
          setError(
            validation.message,
          );

          return;
        }

        if (
          !supportsVideoWorkerProcessing()
        ) {
          setError(
            "Safe video processing needs Web Workers, WebCodecs, and OffscreenCanvas. Use current Chrome or Edge.",
          );

          return;
        }

        const selectedResolution:
          ProcessingResolution =
          mode ===
          "watermark"
            ? "original"
            : resolution;

        const safeMaskTimeRange =
          mode ===
          "watermark"
            ? normalizeVideoMaskTimeRange(
                videoMaskTimeRange,
                videoMetadata.duration,
              )
            : null;

        if (
          mode ===
            "watermark" &&
          !safeMaskTimeRange
        ) {
          setError(
            "Choose a valid start and end time for the video selection before processing.",
          );

          return;
        }

        const outputPlan =
          createVideoOutputPlan(
            {
              width:
                inputDims.w,

              height:
                inputDims.h,
            },

            selectedResolution,

            videoMetadata.duration,
          );

        const notices = [
          validation.warning,

          outputPlan.capped
            ? `Requested ${formatSafeDimensions(
                outputPlan.requested,
              )}; Sharpixa will output ${formatSafeDimensions(
                outputPlan.output,
              )} at up to ${outputPlan.frameRate} fps using ${outputPlan.adaptiveProfile.label.toLowerCase()}.`
            : null,

          safeMaskTimeRange
            ? `The selected mask will apply only from ${formatVideoTime(
                safeMaskTimeRange.startTime,
              )} to ${formatVideoTime(
                safeMaskTimeRange.endTime,
              )}. Frames outside that interval will remain untouched.`
            : null,
        ].filter(
          (
            notice,
          ): notice is string =>
            Boolean(
              notice,
            ),
        );

        const job =
          jobsRef.current.begin(
            "video",
          );

        const progressController =
          createJobProgress(
            job.id,
            VIDEO_PROGRESS_PROFILE,
          );

        setPhase(
          "processing",
        );

        setProgress(
          0,
        );

        setProcessingStage(
          "Preparing file",
        );

        setError(
          null,
        );

        setSafetyNotice(
          notices.length
            ? notices.join(
                " ",
              )
            : null,
        );

        try {
          const client =
            videoClientRef.current;

          jobsRef.current.registerCancellation(
            job.id,

            () =>
              client.cancel(
                job.id,
              ),
          );

          const result =
            await client.process(
              {
                type:
                  "process",

                jobId:
                  job.id,

                source:
                  file,

                metadata:
                  videoMetadata,

                output:
                  outputPlan.output,

                resolution:
                  selectedResolution,

                preset:
                  mode ===
                  "watermark"
                    ? "none"
                    : preset,

                controls,

                mask:
                  mode ===
                  "watermark"
                    ? mask
                    : null,

                maskTimeRange:
                  mode ===
                  "watermark"
                    ? safeMaskTimeRange
                    : null,
              },

              {
                onProgress:
                  (
                    message,
                  ) =>
                    reportWorkerProgress(
                      progressController,
                      message,
                    ),
              },
            );

          if (
            !jobsRef.current.isActive(
              job.id,
            )
          ) {
            return;
          }

          if (
            !result.blob.size
          ) {
            throw new WorkerProcessingError(
              "empty-output",

              "The processed video was empty.",
            );
          }

          setResultBlob(
            result.blob,
          );

          setOutputDims({
            w:
              result.width,

            h:
              result.height,
          });

          replaceResultUrl(
            URL.createObjectURL(
              result.blob,
            ),
          );

          progressController.completeSuccess();

          jobsRef.current.complete(
            job.id,
          );

          progressRef.current =
            null;

          progressController.dispose();

          setPhase(
            "result",
          );
        } catch (
          processingError
        ) {
          const wasActive =
            jobsRef.current.isActive(
              job.id,
            );

          jobsRef.current.complete(
            job.id,
          );

          progressController.dispose();

          if (
            isProcessingCancelledError(
              processingError,
            ) ||
            !wasActive ||
            !mountedRef.current
          ) {
            return;
          }

          if (
            process.env.NODE_ENV !==
            "production"
          ) {
            console.error(
              "Video processing failed:",

              processingError,
            );
          }

          setError(
            getFriendlyError(
              processingError,
              mode,
            ),
          );

          setProgress(
            0,
          );

          setPhase(
            mode ===
            "enhance"
              ? "settings"
              : "brush",
          );
        }
      },
      [
        controls,
        createJobProgress,
        file,
        fileURL,
        inputDims,
        mask,
        mode,
        preset,
        replaceResultUrl,
        reportWorkerProgress,
        resolution,
        videoMaskTimeRange,
        videoMetadata,
      ],
    );

  const handleFile =
    useCallback(
      async (
        inputFile: File,
        trustedSample =
          false,
      ) => {
        if (
          !rightsConfirmed &&
          !trustedSample
        ) {
          setError(
            "Confirm that you own this file or have permission to edit it before uploading.",
          );

          return;
        }

        await cancelCurrentWork();

        if (
          !mountedRef.current
        ) {
          return;
        }

        const extension =
          inputFile.name
            .split(
              ".",
            )
            .pop()
            ?.toLowerCase() ??
          "";

        const isImage =
          inputFile.type.startsWith(
            "image/",
          ) ||
          (
            IMAGE_FORMATS as readonly string[]
          ).includes(
            extension,
          );

        const isVideo =
          inputFile.type.startsWith(
            "video/",
          ) ||
          (
            VIDEO_FORMATS as readonly string[]
          ).includes(
            extension,
          );

        if (
          !isImage &&
          !isVideo
        ) {
          setError(
            "Unsupported format. Use JPG, JPEG, PNG, WEBP, MP4, MOV, AVI, WEBM, or MKV.",
          );

          return;
        }

        const nextType:
          Tab =
          isImage
            ? "image"
            : "video";

        if (
          mode ===
            "background" &&
          nextType ===
            "video"
        ) {
          setError(
            "Background removal currently supports images only.",
          );

          return;
        }

        const fileSizeLimit =
          nextType ===
          "video"
            ? MAX_CLIENT_VIDEO_FILE_SIZE_BYTES
            : FILE_LIMITS.image;

        if (
          inputFile.size >
          fileSizeLimit
        ) {
          const mb =
            Math.round(
              fileSizeLimit /
                (
                  1024 *
                  1024
                ),
            );

          setError(
            `File too large. The maximum ${nextType} size is ${mb}MB.`,
          );

          return;
        }

        if (
          nextType ===
            "image" &&
          !supportsImageWorkerProcessing()
        ) {
          setError(
            "Safe image processing is unavailable in this browser. Use current Chrome or Edge.",
          );

          return;
        }

        if (
          nextType ===
            "video" &&
          !supportsVideoWorkerProcessing()
        ) {
          setError(
            "Safe video processing is unavailable in this browser. Use current Chrome or Edge with WebCodecs support.",
          );

          return;
        }

        const nextUrl =
          URL.createObjectURL(
            inputFile,
          );

        replaceFileUrl(
          nextUrl,
        );

        replaceResultUrl(
          null,
        );

        replacePosterUrl(
          null,
        );

        setFile(
          null,
        );

        setResultBlob(
          null,
        );

        setMask(
          null,
        );

        setVideoMaskTimeRange(
          null,
        );

        setInputDims(
          null,
        );

        setOutputDims(
          null,
        );

        setVideoMetadata(
          null,
        );

        setVideoWarning(
          null,
        );

        setSafetyNotice(
          null,
        );

        setError(
          null,
        );

        setProgress(
          0,
        );

        setProcessingStage(
          "Preparing file",
        );

        setPreparing(
          true,
        );

        setPreparingMessage(
          nextType ===
          "image"
            ? "Reading image safely…"
            : "Reading video details safely…",
        );

        const preflight =
          new AbortController();

        preflightRef.current =
          preflight;

        const timeout =
          window.setTimeout(
            () => {
              if (
                !preflight.signal.aborted
              ) {
                preflight.abort(
                  "preflight-timeout",
                );
              }
            },

            PREFLIGHT_TIMEOUT_MS,
          );

        try {
          let dimensions:
            Dimensions;

          let metadata:
            | VideoMetadata
            | null =
            null;

          if (
            nextType ===
            "image"
          ) {
            const decoded =
              await readImageDimensions(
                nextUrl,
                preflight.signal,
              );

            const validationError =
              validateImageSource(
                decoded,
                getBrowserDeviceHints(),
              );

            if (
              validationError
            ) {
              throw new WorkerProcessingError(
                "unsafe-dimensions",

                validationError,
              );
            }

            dimensions = {
              w:
                decoded.width,

              h:
                decoded.height,
            };
          } else {
            metadata =
              await readVideoMetadata(
                nextUrl,
                preflight.signal,
              );

            const validation =
              validateVideoPreflight(
                inputFile.size,
                metadata,
              );

            if (
              !validation.supported
            ) {
              throw new WorkerProcessingError(
                "video-too-large",

                validation.message ??
                  "This video is not safe to process in the browser.",
              );
            }

            setVideoWarning(
              validation.warning,
            );

            dimensions = {
              w:
                metadata.width,

              h:
                metadata.height,
            };
          }

          if (
            !mountedRef.current ||
            fileUrlRef.current !==
              nextUrl ||
            preflight.signal.aborted
          ) {
            return;
          }

          setFile(
            inputFile,
          );

          setFileType(
            nextType,
          );

          setTab(
            nextType,
          );

          setPreset(
            "standard",
          );

          setResolution(
            "original",
          );

          setControls(
            DEFAULT_CONTROLS,
          );

          setInputDims(
            dimensions,
          );

          setVideoMetadata(
            metadata,
          );

          setVideoMaskTimeRange(
            metadata
              ? {
                  startTime:
                    0,

                  endTime:
                    metadata.duration,
                }
              : null,
          );

          if (
            mode ===
              "background" &&
            autoMode
          ) {
            preflightRef.current =
              null;

            setPreparing(
              false,
            );

            await runImageJob({
              operation:
                "automatic-background",

              inputFile,

              dimensions,
            });

            return;
          }

          if (
            mode ===
              "watermark" &&
            nextType ===
              "video"
          ) {
            setPreparingMessage(
              "Preparing the video editor…",
            );

            const poster =
              await captureVideoFrame(
                nextUrl,
                preflight.signal,
              );

            if (
              mountedRef.current &&
              fileUrlRef.current ===
                nextUrl &&
              !preflight.signal.aborted
            ) {
              replacePosterUrl(
                URL.createObjectURL(
                  poster,
                ),
              );
            }
          }

          setPhase(
            mode ===
            "enhance"
              ? "settings"
              : "brush",
          );
        } catch (
          preflightError
        ) {
          const aborted =
            preflightError instanceof
              DOMException &&
            preflightError.name ===
              "AbortError";

          const timedOut =
            preflight.signal.reason ===
            "preflight-timeout";

          if (
            aborted &&
            !timedOut
          ) {
            return;
          }

          if (
            mountedRef.current &&
            fileUrlRef.current ===
              nextUrl
          ) {
            replaceFileUrl(
              null,
            );

            replacePosterUrl(
              null,
            );

            setFile(
              null,
            );

            setInputDims(
              null,
            );

            setVideoMetadata(
              null,
            );

            setVideoMaskTimeRange(
              null,
            );

            setVideoWarning(
              null,
            );

            setPhase(
              "upload",
            );

            setError(
              timedOut
                ? "Sharpixa stopped waiting because this file took too long to open. Try a smaller file or convert it to JPG, PNG, MP4, or WEBM."
                : preflightError instanceof
                    WorkerProcessingError
                  ? preflightError.message
                  : "This file could not be decoded safely. It may be corrupt or unsupported.",
            );
          }
        } finally {
          window.clearTimeout(
            timeout,
          );

          if (
            preflightRef.current ===
            preflight
          ) {
            preflightRef.current =
              null;
          }

          if (
            mountedRef.current
          ) {
            setPreparing(
              false,
            );
          }
        }
      },
      [
        autoMode,
        cancelCurrentWork,
        mode,
        replaceFileUrl,
        replacePosterUrl,
        replaceResultUrl,
        rightsConfirmed,
        runImageJob,
      ],
    );

  const switchToManual =
    useCallback(
      async () => {
        await cancelCurrentWork();

        if (
          !mountedRef.current
        ) {
          return;
        }

        setAutoMode(
          false,
        );

        setError(
          null,
        );

        setMask(
          null,
        );

        setProgress(
          0,
        );

        setOutputDims(
          null,
        );

        setResultBlob(
          null,
        );

        replaceResultUrl(
          null,
        );

        if (
          file &&
          fileURL
        ) {
          setPhase(
            "brush",
          );
        }
      },
      [
        cancelCurrentWork,
        file,
        fileURL,
        replaceResultUrl,
      ],
    );

  const retryAutomatic =
    useCallback(
      async () => {
        if (
          !file ||
          !inputDims ||
          fileType !==
            "image"
        ) {
          return;
        }

        await cancelCurrentWork();

        if (
          !mountedRef.current
        ) {
          return;
        }

        setAutoMode(
          true,
        );

        await runImageJob({
          operation:
            "automatic-background",

          inputFile:
            file,

          dimensions:
            inputDims,
        });
      },
      [
        cancelCurrentWork,
        file,
        fileType,
        inputDims,
        runImageJob,
      ],
    );

  const processCurrent =
    useCallback(
      () => {
        if (
          jobsRef.current.busy
        ) {
          return;
        }

        if (
          fileType ===
          "video"
        ) {
          void processVideo();

          return;
        }

        const operation:
          ImageOperation =
          mode ===
          "enhance"
            ? "enhance"
            : mode ===
                "background"
              ? "manual-background"
              : "inpaint";

        void runImageJob({
          operation,
        });
      },
      [
        fileType,
        mode,
        processVideo,
        runImageJob,
      ],
    );

  const downloadResult =
    useCallback(
      () => {
        if (
          !resultBlob ||
          !file
        ) {
          return;
        }

        const temporary =
          resultURL ??
          URL.createObjectURL(
            resultBlob,
          );

        const base =
          file.name.replace(
            /\.[^/.]+$/,
            "",
          );

        const extension =
          resultBlob.type.includes(
            "mp4",
          )
            ? "mp4"
            : resultBlob.type.startsWith(
                  "video/",
                )
              ? "webm"
              : resultBlob.type ===
                  "image/jpeg"
                ? "jpg"
                : "png";

        const anchor =
          document.createElement(
            "a",
          );

        anchor.href =
          temporary;

        anchor.download =
          `${base}_sharpixa.${extension}`;

        document.body.appendChild(
          anchor,
        );

        anchor.click();

        anchor.remove();

        if (
          !resultURL
        ) {
          window.setTimeout(
            () =>
              URL.revokeObjectURL(
                temporary,
              ),
            0,
          );
        }
      },
      [
        file,
        resultBlob,
        resultURL,
      ],
    );

  const onDrop =
    useCallback(
      (
        event:
          DragEvent<HTMLDivElement>,
      ) => {
        event.preventDefault();

        setDragover(
          false,
        );

        const dropped =
          event.dataTransfer.files[0];

        if (
          dropped
        ) {
          void handleFile(
            dropped,
          );
        }
      },
      [
        handleFile,
      ],
    );

  const onFileChange =
    useCallback(
      (
        event:
          ChangeEvent<HTMLInputElement>,
      ) => {
        const selected =
          event.target.files?.[0];

        if (
          selected
        ) {
          void handleFile(
            selected,
          );
        }
      },
      [
        handleFile,
      ],
    );

  const loadSample =
    useCallback(
      async () => {
        try {
          setRightsConfirmed(
            true,
          );

          setError(
            null,
          );

          const sample =
            await generateSampleImage();

          await handleFile(
            sample,
            true,
          );
        } catch {
          setError(
            "The sample image could not be created.",
          );
        }
      },
      [
        handleFile,
      ],
    );

  const accept =
    tab ===
    "image"
      ? IMAGE_ACCEPT
      : VIDEO_ACCEPT;

  const resolutionOptions =
    fileType ===
    "video"
      ? VIDEO_RESOLUTIONS
      : IMAGE_RESOLUTIONS;

  if (
    preparing &&
    phase ===
      "upload"
  ) {
    return (
      <div className="mx-auto max-w-2xl animate-fade-in">
        <div className="glass rounded-2xl p-8 text-center md:p-10">
          <div className="spinner mx-auto mb-5" />

          <h3 className="text-xl font-bold text-gray-900">
            Preparing your file
          </h3>

          <p className="mt-2 text-sm text-gray-500">
            {preparingMessage}
          </p>

          <p className="mx-auto mt-3 max-w-md text-xs leading-5 text-gray-400">
            This validation stops automatically if the browser cannot open the file safely.
          </p>

          <button
            type="button"
            className="btn-secondary mt-6 text-sm"
            onClick={() =>
              void cancelCurrentWork()
            }
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (
    phase ===
    "processing"
  ) {
    const title =
      mode ===
      "watermark"
        ? "Removing the selected area"
        : mode ===
            "background"
          ? "Separating the subject"
          : `Improving your ${fileType}`;

    const radius =
      52;

    const circumference =
      2 *
      Math.PI *
      radius;

    const offset =
      circumference -
      (
        progress /
        100
      ) *
        circumference;

    return (
      <div className="mx-auto max-w-2xl animate-fade-in">
        <div className="glass relative overflow-hidden rounded-2xl p-8 text-center md:p-12">
          <div className="pointer-events-none absolute -left-20 -top-20 h-40 w-40 rounded-full bg-indigo-500/10 blur-3xl" />

          <div className="pointer-events-none absolute -bottom-20 -right-20 h-40 w-40 rounded-full bg-pink-500/10 blur-3xl" />

          <div className="relative flex flex-col items-center">
            <div className="relative mb-6">
              <svg
                width="140"
                height="140"
                viewBox="0 0 120 120"
                className="-rotate-90"
              >
                <defs>
                  <linearGradient
                    id="sharpixa-progress-gradient"
                    x1="0"
                    y1="0"
                    x2="1"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="#6366f1"
                    />

                    <stop
                      offset="50%"
                      stopColor="#a855f7"
                    />

                    <stop
                      offset="100%"
                      stopColor="#ec4899"
                    />
                  </linearGradient>
                </defs>

                <circle
                  cx="60"
                  cy="60"
                  r={
                    radius
                  }
                  fill="none"
                  stroke="rgba(99,102,241,0.08)"
                  strokeWidth="8"
                />

                <circle
                  cx="60"
                  cy="60"
                  r={
                    radius
                  }
                  fill="none"
                  stroke="url(#sharpixa-progress-gradient)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={
                    circumference
                  }
                  strokeDashoffset={
                    offset
                  }
                  className="transition-all duration-300"
                />
              </svg>

              <div className="absolute inset-0 flex items-center justify-center">
                <span className="gradient-text text-3xl font-bold">
                  {progress}%
                </span>
              </div>
            </div>

            <h3 className="text-xl font-bold text-gray-900">
              {title}
            </h3>

            <p className="mt-2 inline-flex items-center gap-2 text-sm text-gray-500">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse-soft" />

              {
                processingStage
              }
            </p>

            <div className="mt-5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-[width] duration-300"
                style={{
                  width:
                    `${progress}%`,
                }}
              />
            </div>

            {expectedOutputDims && (
              <p className="mt-4 text-xs text-gray-500">
                Target:{" "}
                {formatDimensions(
                  expectedOutputDims,
                )}
              </p>
            )}

            {safetyNotice && (
              <p className="mt-3 max-w-md rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
                {safetyNotice}
              </p>
            )}

            {fileType ===
              "video" && (
              <p className="mt-3 max-w-md text-xs leading-5 text-gray-500">
                Longer clips use adaptive dimensions and frame rate. Keep this tab open; processing may take several times the video duration.
              </p>
            )}

            <p className="mt-4 text-xs text-amber-600">
              Keep this tab open until processing finishes.
            </p>

            <button
              type="button"
              className="btn-secondary mt-6 text-sm"
              onClick={() =>
                void reset()
              }
            >
              Cancel processing
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (
    phase ===
      "result" &&
    resultURL
  ) {
    return (
      <div className="mx-auto max-w-5xl animate-fade-in">
        <div className="glass rounded-2xl p-5 md:p-8">
          <div className="mb-6 text-center">
            <div className="success-checkmark mb-4 text-white">
              <Icon
                name="check"
                size={24}
              />
            </div>

            <h3 className="text-xl font-bold text-gray-900">
              Your {fileType} is ready
            </h3>
          </div>

          {fileType ===
          "image" ? (
            <CompareSlider
              beforeUrl={
                fileURL ??
                ""
              }
              afterUrl={
                resultURL
              }
              mode={
                mode
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-semibold text-gray-500">
                  Before
                </p>

                <div className="result-preview p-2">
                  <video
                    src={
                      fileURL ??
                      ""
                    }
                    controls
                    className="max-h-[60vh] w-full rounded-lg object-contain"
                  />
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-indigo-500">
                  After
                </p>

                <div className="result-preview p-2">
                  <video
                    src={
                      resultURL
                    }
                    controls
                    className="max-h-[60vh] w-full rounded-lg object-contain"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <p className="text-xs font-semibold text-gray-500">
                Source
              </p>

              <p className="mt-1 text-sm font-bold text-gray-900">
                {formatDimensions(
                  inputDims,
                )}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <p className="text-xs font-semibold text-gray-500">
                Output
              </p>

              <p className="mt-1 text-sm font-bold text-gray-900">
                {formatDimensions(
                  outputDims,
                )}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <p className="text-xs font-semibold text-gray-500">
                File size
              </p>

              <p className="mt-1 text-sm font-bold text-gray-900">
                {resultBlob
                  ? formatBytes(
                      resultBlob.size,
                    )
                  : "Ready"}
              </p>
            </div>
          </div>

          {mode ===
            "background" && (
            <p className="mt-4 text-center text-xs leading-5 text-gray-500">
              The checkerboard represents transparent pixels. The downloaded PNG keeps the transparency.
            </p>
          )}

          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              className="btn-primary justify-center"
              onClick={
                downloadResult
              }
            >
              <Icon
                name="download"
                size={17}
              />

              Download{" "}
              {fileType ===
              "image"
                ? "Image"
                : "Video"}
            </button>

            <button
              type="button"
              className="btn-secondary justify-center"
              onClick={() =>
                void reset()
              }
            >
              Process Another File
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (
    phase ===
      "brush" &&
    fileURL &&
    (
      mode ===
        "watermark" ||
      mode ===
        "background"
    )
  ) {
    const editorImage =
      fileType ===
      "video"
        ? posterURL
        : fileURL;

    const validVideoRange =
      fileType ===
        "video" &&
      videoMetadata
        ? normalizeVideoMaskTimeRange(
            videoMaskTimeRange,
            videoMetadata.duration,
          )
        : null;

    return (
      <div className="mx-auto max-w-5xl animate-fade-in">
        <div className="glass rounded-2xl p-5 md:p-7">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {mode ===
                "background"
                  ? "Mark the Background"
                  : "Mark the Object, Text, or Watermark"}
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                Paint directly over the exact area you want Sharpixa to process.
              </p>
            </div>

            <button
              type="button"
              className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-rose-600"
              onClick={() =>
                void reset()
              }
            >
              <Icon
                name="close"
                size={14}
              />

              Remove File
            </button>
          </div>

          {editorImage ? (
            <WatermarkBrush
              imageUrl={
                editorImage
              }
              videoUrl={
                fileType ===
                "video"
                  ? fileURL
                  : undefined
              }
              onMaskChange={
                setMask
              }
              onMaskTimeRangeChange={
                fileType ===
                "video"
                  ? setVideoMaskTimeRange
                  : undefined
              }
            />
          ) : (
            <div className="flex min-h-72 flex-col items-center justify-center gap-4 rounded-2xl border border-gray-200 bg-gray-50">
              <div className="spinner" />

              <p className="text-sm text-gray-500">
                Preparing the video editor…
              </p>
            </div>
          )}

          {fileType ===
            "video" &&
            videoMetadata && (
              <div className="mt-5 space-y-3">
                {validVideoRange && (
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs leading-5 text-indigo-800">
                    This selection will apply from{" "}

                    <strong>
                      {formatVideoTime(
                        validVideoRange.startTime,
                      )}
                    </strong>

                    {" "}to{" "}

                    <strong>
                      {formatVideoTime(
                        validVideoRange.endTime,
                      )}
                    </strong>

                    . Frames before and after this interval will remain untouched.
                  </div>
                )}

                {videoWarning && (
                  <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
                    {videoWarning}
                  </div>
                )}

                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs leading-5 text-gray-600">
                  A single selection works best for a stationary logo, timestamp, caption, or overlay. A moving object requires separate tracking or keyframe support.
                </div>
              </div>
            )}

          {error && (
            <div className="mt-5">
              <ErrorNotice
                message={
                  error
                }
                onDismiss={() =>
                  setError(
                    null,
                  )
                }
              />
            </div>
          )}

          <div className="mt-5 flex flex-col items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 sm:flex-row">
            <div>
              <p className="text-sm font-bold text-gray-900">
                {mask
                  ? "Selection ready"
                  : "Paint an area to continue"}
              </p>

              <p className="mt-1 text-xs text-gray-500">
                {mask
                  ? fileType ===
                      "video" &&
                    validVideoRange
                    ? `Ready for ${formatVideoTime(
                        validVideoRange.startTime,
                      )}–${formatVideoTime(
                        validVideoRange.endTime,
                      )}.`
                    : "Review the selection and process it when ready."
                  : "Use Brush, Precision, Circle, or Erase to mark the unwanted area."}
              </p>
            </div>

            <button
              type="button"
              className="btn-primary shrink-0 justify-center disabled:cursor-not-allowed disabled:opacity-50"
              disabled={
                !mask ||
                (
                  fileType ===
                    "video" &&
                  mode ===
                    "watermark" &&
                  !validVideoRange
                )
              }
              onClick={
                processCurrent
              }
            >
              <Icon
                name={
                  mode ===
                  "background"
                    ? "brush"
                    : "eraser"
                }
                size={15}
              />

              {mode ===
              "background"
                ? "Make Area Transparent"
                : "Remove Selected Area"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (
    phase ===
      "settings" &&
    file &&
    fileURL
  ) {
    const selectedPreset =
      PRESETS[
        preset
      ];

    const liveFilter =
      `brightness(${
        1 +
        (
          selectedPreset.brightness +
          controls.brightness
        ) /
          100
      }) contrast(${
        1 +
        (
          selectedPreset.contrast +
          controls.contrast
        ) /
          100
      }) saturate(${
        1 +
        (
          selectedPreset.saturation +
          controls.saturation
        ) /
          100
      })`;

    const activeVideoPlan =
      fileType ===
        "video" &&
      inputDims
        ? createVideoOutputPlan(
            {
              width:
                inputDims.w,

              height:
                inputDims.h,
            },

            resolution,

            videoMetadata?.duration ??
              0,
          )
        : null;

    return (
      <div className="mx-auto max-w-6xl animate-fade-in">
        <div className="glass rounded-2xl p-5 md:p-7">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                Quality Improvement Settings
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                Choose the strength and safe output dimensions.
              </p>
            </div>

            <button
              type="button"
              className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-rose-600"
              onClick={() =>
                void reset()
              }
            >
              <Icon
                name="close"
                size={14}
              />

              Remove File
            </button>
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <p className="mb-2 text-sm font-semibold text-gray-500">
                Complete-file preview
              </p>

              <div className="flex min-h-[360px] max-h-[72vh] items-center justify-center overflow-auto rounded-2xl border border-gray-200 bg-slate-950 p-4">
                {fileType ===
                "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={
                      fileURL
                    }
                    alt="Enhancement preview"
                    className="block h-auto max-h-[66vh] w-auto max-w-full rounded-lg object-contain"
                    style={{
                      filter:
                        liveFilter,
                    }}
                  />
                ) : (
                  <video
                    src={
                      fileURL
                    }
                    controls
                    className="block h-auto max-h-[66vh] w-auto max-w-full rounded-lg object-contain"
                    style={{
                      filter:
                        liveFilter,
                    }}
                  />
                )}
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-gray-200 bg-white p-3">
                  <p className="text-xs text-gray-500">
                    Source
                  </p>

                  <p className="mt-1 text-sm font-bold">
                    {formatDimensions(
                      inputDims,
                    )}
                  </p>
                </div>

                <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3">
                  <p className="text-xs text-indigo-600">
                    Target
                  </p>

                  <p className="mt-1 text-sm font-bold text-indigo-700">
                    {formatDimensions(
                      expectedOutputDims,
                    )}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-3">
                  <p className="text-xs text-gray-500">
                    File size
                  </p>

                  <p className="mt-1 text-sm font-bold">
                    {formatBytes(
                      file.size,
                    )}
                  </p>
                </div>
              </div>

              {activeVideoPlan && (
                <div className="mt-4 space-y-2">
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs leading-5 text-indigo-800">
                    <strong>
                      {
                        activeVideoPlan
                          .adaptiveProfile
                          .label
                      }
                    </strong>

                    :{" "}

                    {formatSafeDimensions(
                      activeVideoPlan.output,
                    )}

                    {" "}at up to{" "}

                    {
                      activeVideoPlan
                        .frameRate
                    }

                    {" "}fps.
                  </div>

                  {activeVideoPlan.capped && (
                    <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
                      Requested{" "}

                      {formatSafeDimensions(
                        activeVideoPlan.requested,
                      )}

                      . Sharpixa will use{" "}

                      {formatSafeDimensions(
                        activeVideoPlan.output,
                      )}

                      {" "}for this duration to reduce browser freezes and memory pressure.
                    </div>
                  )}

                  {videoWarning && (
                    <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
                      {videoWarning}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-5 lg:col-span-2">
              <section>
                <p className="mb-2 text-sm font-semibold text-gray-700">
                  Processing strength
                </p>

                <div className="space-y-2">
                  {(
                    Object.keys(
                      PRESET_COPY,
                    ) as PresetName[]
                  ).map(
                    (
                      key,
                    ) => {
                      const item =
                        PRESET_COPY[
                          key
                        ];

                      const active =
                        preset ===
                        key;

                      return (
                        <button
                          key={
                            key
                          }
                          type="button"
                          onClick={() =>
                            setPreset(
                              key,
                            )
                          }
                          className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                            active
                              ? "border-indigo-200 bg-indigo-50"
                              : "border-gray-200 bg-white hover:border-indigo-200"
                          }`}
                        >
                          <span
                            className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                              active
                                ? "bg-white text-indigo-600"
                                : "bg-gray-50 text-gray-500"
                            }`}
                          >
                            <Icon
                              name={
                                item.icon
                              }
                              size={17}
                            />
                          </span>

                          <span>
                            <span className="block text-sm font-bold text-gray-900">
                              {
                                item.label
                              }
                            </span>

                            <span className="mt-0.5 block text-xs leading-5 text-gray-500">
                              {
                                item.description
                              }
                            </span>
                          </span>
                        </button>
                      );
                    },
                  )}
                </div>
              </section>

              <section>
                <p className="mb-2 text-sm font-semibold text-gray-700">
                  Output dimensions
                </p>

                <div className="grid grid-cols-2 gap-2">
                  {resolutionOptions.map(
                    (
                      option,
                    ) => {
                      const optionPlan =
                        fileType ===
                          "image" &&
                        inputDims
                          ? createImageProcessingPlan(
                              {
                                width:
                                  inputDims.w,

                                height:
                                  inputDims.h,
                              },

                              option,

                              "enhance",

                              getBrowserDeviceHints(),
                            )
                          : inputDims
                            ? createVideoOutputPlan(
                                {
                                  width:
                                    inputDims.w,

                                  height:
                                    inputDims.h,
                                },

                                option,

                                videoMetadata?.duration ??
                                  0,
                              )
                            : null;

                      const dims =
                        optionPlan
                          ? {
                              w:
                                optionPlan
                                  .output
                                  .width,

                              h:
                                optionPlan
                                  .output
                                  .height,
                            }
                          : null;

                      const active =
                        resolution ===
                        option;

                      return (
                        <button
                          key={
                            option
                          }
                          type="button"
                          onClick={() =>
                            setResolution(
                              option,
                            )
                          }
                          className={`rounded-xl border px-3 py-3 text-left ${
                            active
                              ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                              : "border-gray-200 bg-white text-gray-600 hover:border-indigo-200"
                          }`}
                        >
                          <span className="block text-xs font-bold">
                            {
                              RESOLUTION_LABELS[
                                option
                              ]
                            }
                          </span>

                          <span className="mt-1 block text-xs text-gray-400">
                            {formatDimensions(
                              dims,
                            )}
                          </span>
                        </button>
                      );
                    },
                  )}
                </div>

                <p className="mt-2 text-xs leading-5 text-gray-400">
                  {fileType ===
                  "video"
                    ? "Longer clips automatically use reduced dimensions and frame rate. The shown target is the real planned output."
                    : "Image output follows your selection while respecting browser-memory limits."}
                </p>
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-700">
                    Fine-tune
                  </p>

                  <button
                    type="button"
                    className="text-xs font-semibold text-indigo-600"
                    onClick={() =>
                      setControls(
                        DEFAULT_CONTROLS,
                      )
                    }
                  >
                    Reset
                  </button>
                </div>

                <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  {CONTROL_ROWS.map(
                    (
                      control,
                    ) => (
                      <label
                        key={
                          control.key
                        }
                        className="block"
                      >
                        <span className="mb-1.5 flex items-center justify-between text-xs">
                          <span className="inline-flex items-center gap-2 font-semibold text-gray-600">
                            <Icon
                              name={
                                control.icon
                              }
                              size={13}
                            />

                            {
                              control.label
                            }
                          </span>

                          <span className="font-semibold text-gray-500">
                            {controls[
                              control.key
                            ] >
                            0
                              ? "+"
                              : ""}

                            {
                              controls[
                                control.key
                              ]
                            }
                          </span>
                        </span>

                        <input
                          type="range"
                          min={
                            control.min
                          }
                          max={
                            control.max
                          }
                          value={
                            controls[
                              control.key
                            ]
                          }
                          onChange={(
                            event,
                          ) =>
                            setControls(
                              (
                                current,
                              ) => ({
                                ...current,

                                [control.key]:
                                  Number(
                                    event
                                      .target
                                      .value,
                                  ),
                              }),
                            )
                          }
                          className="w-full"
                        />
                      </label>
                    ),
                  )}
                </div>
              </section>

              {error && (
                <ErrorNotice
                  message={
                    error
                  }
                  onDismiss={() =>
                    setError(
                      null,
                    )
                  }
                />
              )}

              <button
                type="button"
                className="btn-primary w-full justify-center"
                onClick={
                  processCurrent
                }
              >
                <Icon
                  name="wand"
                  size={17}
                />

                Improve{" "}
                {fileType ===
                "image"
                  ? "Image"
                  : "Video"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl animate-fade-in">
      {mode ===
        "background" && (
        <div className="mx-auto mb-6 max-w-2xl rounded-2xl border border-gray-200 bg-white p-2 shadow-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setAutoMode(
                  false,
                );

                setError(
                  null,
                );
              }}
              className={`rounded-xl border p-4 text-left ${
                !autoMode
                  ? "border-indigo-200 bg-indigo-50"
                  : "border-transparent bg-gray-50 hover:border-gray-200"
              }`}
            >
              <span className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-indigo-600">
                  <Icon
                    name="brush"
                    size={18}
                  />
                </span>

                <span>
                  <span className="block text-sm font-bold text-gray-900">
                    Manual
                  </span>

                  <span className="mt-1 block text-xs leading-5 text-gray-500">
                    Paint the exact background pixels to remove.
                  </span>
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAutoMode(
                  true,
                );

                setError(
                  null,
                );
              }}
              className={`rounded-xl border p-4 text-left ${
                autoMode
                  ? "border-purple-200 bg-purple-50"
                  : "border-transparent bg-gray-50 hover:border-gray-200"
              }`}
            >
              <span className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-purple-600">
                  <Icon
                    name="sparkles"
                    size={18}
                  />
                </span>

                <span>
                  <span className="block text-sm font-bold text-gray-900">
                    Auto AI
                  </span>

                  <span className="mt-1 block text-xs leading-5 text-gray-500">
                    Detect and separate the main subject automatically.
                  </span>
                </span>
              </span>
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto mb-5 flex max-w-sm gap-1 rounded-xl bg-gray-100 p-1">
        <button
          type="button"
          className={`tab-btn flex flex-1 items-center gap-1.5 ${
            tab ===
            "image"
              ? "active"
              : ""
          }`}
          onClick={() => {
            setTab(
              "image",
            );

            setError(
              null,
            );
          }}
        >
          <Icon
            name="image"
            size={16}
          />

          Image
        </button>

        {mode !==
          "background" && (
          <button
            type="button"
            className={`tab-btn flex flex-1 items-center gap-1.5 ${
              tab ===
              "video"
                ? "active"
                : ""
            }`}
            onClick={() => {
              setTab(
                "video",
              );

              setError(
                null,
              );
            }}
          >
            <Icon
              name="video"
              size={16}
            />

            Video
          </button>
        )}
      </div>

      <label
        className={`mb-4 flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${
          rightsConfirmed
            ? "border-emerald-200 bg-emerald-50/70"
            : "border-gray-200 bg-white"
        }`}
      >
        <input
          type="checkbox"
          checked={
            rightsConfirmed
          }
          onChange={(
            event,
          ) => {
            setRightsConfirmed(
              event.target.checked,
            );

            if (
              event.target.checked
            ) {
              setError(
                null,
              );
            }
          }}
          className="mt-1 h-4 w-4 accent-emerald-600"
        />

        <span className="flex-1">
          <span className="block text-sm font-bold text-gray-800">
            I am authorized to edit this file
          </span>

          <span className="mt-1 block text-xs leading-5 text-gray-500">
            I own this file or have permission to remove objects, text, marks, or backgrounds from it.
          </span>
        </span>

        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full ${
            rightsConfirmed
              ? "bg-emerald-600 text-white"
              : "bg-gray-100 text-gray-400"
          }`}
        >
          <Icon
            name={
              rightsConfirmed
                ? "check"
                : "shield"
            }
            size={14}
          />
        </span>
      </label>

      <div
        className={`dropzone glass relative overflow-hidden ${
          dragover
            ? "dragover"
            : ""
        }`}
        role="button"
        tabIndex={0}
        onClick={() =>
          rightsConfirmed
            ? inputRef.current?.click()
            : setError(
                "Confirm your right to edit the file before uploading.",
              )
        }
        onKeyDown={(
          event,
        ) => {
          if (
            event.key !==
              "Enter" &&
            event.key !==
              " "
          ) {
            return;
          }

          event.preventDefault();

          rightsConfirmed
            ? inputRef.current?.click()
            : setError(
                "Confirm your right to edit the file before uploading.",
              );
        }}
        onDragOver={(
          event,
        ) => {
          event.preventDefault();

          setDragover(
            true,
          );
        }}
        onDragLeave={() =>
          setDragover(
            false,
          )
        }
        onDrop={
          onDrop
        }
      >
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 text-indigo-500">
            <Icon
              name={
                tab ===
                "image"
                  ? "image"
                  : "film"
              }
              size={31}
            />
          </div>
        </div>

        <h3 className="mt-5 text-lg font-bold text-gray-900">
          {getModeHeading(
            mode,
          )}
        </h3>

        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
          {mode ===
          "watermark"
            ? `Drop your ${tab} here to mark and remove an unwanted object, text, logo, or authorized watermark.`
            : mode ===
                "background"
              ? autoMode
                ? "Drop an image here and Sharpixa will automatically separate the main subject."
                : "Drop an image here, then paint the background area that should become transparent."
              : `Drop your ${tab} here to resize, denoise, sharpen, and improve it.`}
        </p>

        <button
          type="button"
          tabIndex={-1}
          className="btn-primary mt-5"
        >
          <Icon
            name="upload"
            size={16}
          />

          Choose{" "}
          {tab ===
          "image"
            ? "Image"
            : "Video"}
        </button>

        <p className="mt-4 text-xs font-medium text-gray-400">
          {tab ===
          "image"
            ? "JPG · JPEG · PNG · WEBP — maximum 20MB"
            : "MP4 · MOV · AVI · WEBM · MKV — up to 5 minutes, 1080p input, and 300MB"}
        </p>
      </div>

      <div className="mt-4 text-center">
        <button
          type="button"
          className="btn-secondary text-sm"
          onClick={() =>
            void loadSample()
          }
        >
          Try Sample Image
        </button>
      </div>

      {error && (
        <div className="mt-5">
          <ErrorNotice
            message={
              error
            }
            onDismiss={() =>
              setError(
                null,
              )
            }
            onRetry={
              mode ===
                "background" &&
              autoMode &&
              file
                ? retryAutomatic
                : undefined
            }
            onManual={
              mode ===
                "background" &&
              autoMode &&
              file
                ? switchToManual
                : undefined
            }
          />
        </div>
      )}

      <input
        ref={
          inputRef
        }
        type="file"
        className="hidden"
        accept={
          accept
        }
        onChange={
          onFileChange
        }
      />
    </div>
  );
}