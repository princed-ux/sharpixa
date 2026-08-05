export type ProcessingResolution =
  | "original"
  | "2x"
  | "4x"
  | "8k";

export type ImageOperation =
  | "enhance"
  | "manual-background"
  | "inpaint"
  | "automatic-background";

export type DeviceTier =
  | "low"
  | "default"
  | "high";

export type VideoProcessingMode =
  | "standard"
  | "balanced"
  | "extended"
  | "maximum";

export interface Dimensions {
  width: number;
  height: number;
}

export interface DeviceHints {
  deviceMemory?: number;
  hardwareConcurrency?: number;
}

export interface SafetyProfile {
  tier: DeviceTier;
  maxProcessingPixels: number;
  maxOutputPixels: number;
  maxDecodePixels: number;
  maxEstimatedBytes: number;
  maxInpaintRegionPixels: number;
}

export interface ImageProcessingPlan {
  operation: ImageOperation;
  requested: Dimensions;
  output: Dimensions;
  working: Dimensions;
  capped: boolean;
  capReason: string | null;
  estimatedRequestedBytes: number;
  estimatedOutputBytes: number;
  estimatedBufferCount: number;
  safetyProfile: SafetyProfile;
}

export interface VideoMetadata {
  width: number;
  height: number;
  duration: number;
}

export interface VideoAdaptiveProfile {
  mode: VideoProcessingMode;
  label: string;
  maxLongEdge: number;
  maxShortEdge: number;
  maxPixelsPerFrame: number;
  frameRate: number;
  warning: string | null;
}

export interface VideoOutputPlan {
  requested: Dimensions;
  output: Dimensions;
  capped: boolean;
  capReason: string | null;
  frameRate: number;
  adaptiveProfile: VideoAdaptiveProfile;
}

export interface VideoPreflightResult {
  supported: boolean;
  message: string | null;
  warning: string | null;
  adaptiveProfile: VideoAdaptiveProfile | null;
}

/**
 * Pixel filters use tile-sized buffers, but the browser still needs backing
 * stores for decoded, working, and output canvases. These conservative limits
 * keep unavoidable memory bounded. Device hints are advisory only.
 */
export const DEFAULT_MAX_PROCESSING_PIXELS =
  6_000_000;

export const LOW_MEMORY_MAX_PROCESSING_PIXELS =
  3_000_000;

export const HIGH_MEMORY_MAX_PROCESSING_PIXELS =
  10_000_000;

export const DEFAULT_MAX_OUTPUT_PIXELS =
  12_000_000;

export const LOW_MEMORY_MAX_OUTPUT_PIXELS =
  6_000_000;

export const HIGH_MEMORY_MAX_OUTPUT_PIXELS =
  20_000_000;

export const DEFAULT_MAX_DECODE_PIXELS =
  24_000_000;

export const LOW_MEMORY_MAX_DECODE_PIXELS =
  12_000_000;

export const HIGH_MEMORY_MAX_DECODE_PIXELS =
  32_000_000;

export const DEFAULT_MAX_INPAINT_REGION_PIXELS =
  1_000_000;

export const LOW_MEMORY_MAX_INPAINT_REGION_PIXELS =
  500_000;

export const HIGH_MEMORY_MAX_INPAINT_REGION_PIXELS =
  1_500_000;

export const MAX_IMAGE_DIMENSION = 7680;
export const ESTIMATED_IMAGE_BUFFER_COUNT = 4;
export const ESTIMATED_BACKGROUND_BUFFER_COUNT = 6;
export const MAX_INPAINT_SELECTION_RATIO = 0.25;

/**
 * Sharpixa accepts videos up to five minutes, but long clips are processed in
 * an adaptive reduced-resolution mode. This keeps the page responsive while
 * making it clear that browser processing may take a long time.
 */
export const MAX_CLIENT_VIDEO_DURATION_SECONDS =
  5 * 60;

export const MAX_CLIENT_VIDEO_FILE_SIZE_BYTES =
  300 * 1024 * 1024;

/**
 * These legacy names are retained because the worker imports them.
 *
 * Both are set to the maximum long edge so portrait 1080 × 1920 files are not
 * rejected merely because their height exceeds 1080.
 *
 * Exact orientation-safe validation uses MAX_CLIENT_VIDEO_LONG_EDGE and
 * MAX_CLIENT_VIDEO_SHORT_EDGE below.
 */
export const MAX_CLIENT_VIDEO_WIDTH = 1920;
export const MAX_CLIENT_VIDEO_HEIGHT = 1920;

export const MAX_CLIENT_VIDEO_LONG_EDGE = 1920;
export const MAX_CLIENT_VIDEO_SHORT_EDGE = 1080;

export const MAX_CLIENT_VIDEO_PIXELS_PER_FRAME =
  2_073_600;

export const MAX_CLIENT_VIDEO_FRAME_RATE = 24;

const LOW_MEMORY_MAX_ESTIMATED_BYTES =
  128 * 1024 * 1024;

const DEFAULT_MAX_ESTIMATED_BYTES =
  224 * 1024 * 1024;

const HIGH_MEMORY_MAX_ESTIMATED_BYTES =
  384 * 1024 * 1024;

const STANDARD_VIDEO_PROFILE: VideoAdaptiveProfile = {
  mode: "standard",

  label:
    "Standard browser mode",

  maxLongEdge:
    1920,

  maxShortEdge:
    1080,

  maxPixelsPerFrame:
    2_073_600,

  frameRate:
    24,

  warning:
    null,
};

const BALANCED_VIDEO_PROFILE: VideoAdaptiveProfile = {
  mode:
    "balanced",

  label:
    "Balanced browser mode",

  maxLongEdge:
    1280,

  maxShortEdge:
    720,

  maxPixelsPerFrame:
    921_600,

  frameRate:
    18,

  warning:
    "This clip is longer than 30 seconds. Sharpixa will reduce the processing resolution and frame rate to keep the page responsive. Processing may take several times the video duration.",
};

const EXTENDED_VIDEO_PROFILE: VideoAdaptiveProfile = {
  mode:
    "extended",

  label:
    "Extended browser mode",

  maxLongEdge:
    960,

  maxShortEdge:
    540,

  maxPixelsPerFrame:
    518_400,

  frameRate:
    15,

  warning:
    "This is an extended browser-processing job. Sharpixa will use a reduced output size and frame rate. Keep this tab open; processing may take much longer than the video itself.",
};

const MAXIMUM_VIDEO_PROFILE: VideoAdaptiveProfile = {
  mode:
    "maximum",

  label:
    "Five-minute browser mode",

  maxLongEdge:
    854,

  maxShortEdge:
    480,

  maxPixelsPerFrame:
    409_920,

  frameRate:
    12,

  warning:
    "This long clip will be processed in a reduced 480p-class mode at up to 12 fps. It may take a long time and use significant CPU, but the worker keeps the page responsive. Keep the device plugged in and leave this tab open.",
};

function clampPositiveInteger(
  value: number,
): number {
  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return 1;
  }

  return Math.max(
    1,
    Math.floor(value),
  );
}

function makeEven(
  value: number,
): number {
  const safe =
    Math.max(
      2,
      Math.floor(value),
    );

  return safe % 2 === 0
    ? safe
    : safe - 1;
}

function getPixelCount(
  dimensions: Dimensions,
): number {
  return (
    dimensions.width *
    dimensions.height
  );
}

function getLongEdge(
  dimensions: Dimensions,
): number {
  return Math.max(
    dimensions.width,
    dimensions.height,
  );
}

function getShortEdge(
  dimensions: Dimensions,
): number {
  return Math.min(
    dimensions.width,
    dimensions.height,
  );
}

function constrainDimensions(
  dimensions: Dimensions,
  maxWidth: number,
  maxHeight: number,
  maxPixels: number,
  allowUpscale = false,
): Dimensions {
  const width =
    clampPositiveInteger(
      dimensions.width,
    );

  const height =
    clampPositiveInteger(
      dimensions.height,
    );

  const pixels =
    width * height;

  const ratio =
    Math.min(
      allowUpscale
        ? Number.POSITIVE_INFINITY
        : 1,

      maxWidth /
        width,

      maxHeight /
        height,

      pixels >
      maxPixels
        ? Math.sqrt(
            maxPixels /
              pixels,
          )
        : 1,
    );

  return {
    width:
      Math.max(
        1,
        Math.floor(
          width *
            ratio,
        ),
      ),

    height:
      Math.max(
        1,
        Math.floor(
          height *
            ratio,
        ),
      ),
  };
}

/**
 * Constrain by long and short edges rather than fixed width and height.
 *
 * This supports both:
 *
 * - Landscape: 1920 × 1080
 * - Portrait: 1080 × 1920
 */
function constrainVideoDimensions(
  dimensions: Dimensions,
  maxLongEdge: number,
  maxShortEdge: number,
  maxPixels: number,
  allowUpscale = false,
): Dimensions {
  const width =
    clampPositiveInteger(
      dimensions.width,
    );

  const height =
    clampPositiveInteger(
      dimensions.height,
    );

  const longEdge =
    Math.max(
      width,
      height,
    );

  const shortEdge =
    Math.min(
      width,
      height,
    );

  const pixels =
    width *
    height;

  const ratio =
    Math.min(
      allowUpscale
        ? Number.POSITIVE_INFINITY
        : 1,

      maxLongEdge /
        longEdge,

      maxShortEdge /
        shortEdge,

      pixels >
      maxPixels
        ? Math.sqrt(
            maxPixels /
              pixels,
          )
        : 1,
    );

  return {
    width:
      makeEven(
        width *
          ratio,
      ),

    height:
      makeEven(
        height *
          ratio,
      ),
  };
}

function getRequestedImageDimensions(
  source: Dimensions,
  resolution: ProcessingResolution,
): Dimensions {
  const sourceWidth =
    clampPositiveInteger(
      source.width,
    );

  const sourceHeight =
    clampPositiveInteger(
      source.height,
    );

  if (
    resolution ===
    "2x"
  ) {
    return {
      width:
        sourceWidth *
        2,

      height:
        sourceHeight *
        2,
    };
  }

  if (
    resolution ===
    "4x"
  ) {
    return {
      width:
        sourceWidth *
        4,

      height:
        sourceHeight *
        4,
    };
  }

  if (
    resolution ===
    "8k"
  ) {
    const longestSide =
      Math.max(
        sourceWidth,
        sourceHeight,
      );

    const factor =
      longestSide <
      MAX_IMAGE_DIMENSION
        ? MAX_IMAGE_DIMENSION /
          longestSide
        : 1;

    return {
      width:
        Math.max(
          1,
          Math.round(
            sourceWidth *
              factor,
          ),
        ),

      height:
        Math.max(
          1,
          Math.round(
            sourceHeight *
              factor,
          ),
        ),
    };
  }

  return {
    width:
      sourceWidth,

    height:
      sourceHeight,
  };
}

export function getBrowserDeviceHints(): DeviceHints {
  if (
    typeof navigator ===
    "undefined"
  ) {
    return {};
  }

  const extendedNavigator =
    navigator as Navigator & {
      deviceMemory?: number;
    };

  return {
    deviceMemory:
      extendedNavigator.deviceMemory,

    hardwareConcurrency:
      navigator.hardwareConcurrency,
  };
}

export function getSafetyProfile(
  hints: DeviceHints = {},
): SafetyProfile {
  const memory =
    hints.deviceMemory;

  const cores =
    hints.hardwareConcurrency;

  if (
    (
      typeof memory ===
        "number" &&
      memory <= 4
    ) ||
    (
      typeof cores ===
        "number" &&
      cores <= 4
    )
  ) {
    return {
      tier:
        "low",

      maxProcessingPixels:
        LOW_MEMORY_MAX_PROCESSING_PIXELS,

      maxOutputPixels:
        LOW_MEMORY_MAX_OUTPUT_PIXELS,

      maxDecodePixels:
        LOW_MEMORY_MAX_DECODE_PIXELS,

      maxEstimatedBytes:
        LOW_MEMORY_MAX_ESTIMATED_BYTES,

      maxInpaintRegionPixels:
        LOW_MEMORY_MAX_INPAINT_REGION_PIXELS,
    };
  }

  if (
    typeof memory ===
      "number" &&
    memory >= 8 &&
    typeof cores ===
      "number" &&
    cores >= 8
  ) {
    return {
      tier:
        "high",

      maxProcessingPixels:
        HIGH_MEMORY_MAX_PROCESSING_PIXELS,

      maxOutputPixels:
        HIGH_MEMORY_MAX_OUTPUT_PIXELS,

      maxDecodePixels:
        HIGH_MEMORY_MAX_DECODE_PIXELS,

      maxEstimatedBytes:
        HIGH_MEMORY_MAX_ESTIMATED_BYTES,

      maxInpaintRegionPixels:
        HIGH_MEMORY_MAX_INPAINT_REGION_PIXELS,
    };
  }

  return {
    tier:
      "default",

    maxProcessingPixels:
      DEFAULT_MAX_PROCESSING_PIXELS,

    maxOutputPixels:
      DEFAULT_MAX_OUTPUT_PIXELS,

    maxDecodePixels:
      DEFAULT_MAX_DECODE_PIXELS,

    maxEstimatedBytes:
      DEFAULT_MAX_ESTIMATED_BYTES,

    maxInpaintRegionPixels:
      DEFAULT_MAX_INPAINT_REGION_PIXELS,
  };
}

export function createImageProcessingPlan(
  source: Dimensions,
  resolution: ProcessingResolution,
  operation: ImageOperation,
  hints: DeviceHints = {},
): ImageProcessingPlan {
  const safetyProfile =
    getSafetyProfile(
      hints,
    );

  const requested =
    getRequestedImageDimensions(
      source,
      resolution,
    );

  const estimatedBufferCount =
    operation ===
    "automatic-background"
      ? ESTIMATED_BACKGROUND_BUFFER_COUNT
      : ESTIMATED_IMAGE_BUFFER_COUNT;

  const memoryPixelLimit =
    Math.floor(
      safetyProfile.maxEstimatedBytes /
        (
          4 *
          estimatedBufferCount
        ),
    );

  const operationPixelLimit =
    operation ===
    "automatic-background"
      ? safetyProfile.maxProcessingPixels
      : safetyProfile.maxOutputPixels;

  const maxOutputPixels =
    Math.max(
      1,

      Math.min(
        operationPixelLimit,
        memoryPixelLimit,
      ),
    );

  const output =
    constrainDimensions(
      requested,
      MAX_IMAGE_DIMENSION,
      MAX_IMAGE_DIMENSION,
      maxOutputPixels,
    );

  const workingPixelLimit =
    Math.min(
      safetyProfile.maxProcessingPixels,
      getPixelCount(
        output,
      ),
    );

  const working =
    constrainDimensions(
      output,
      MAX_IMAGE_DIMENSION,
      MAX_IMAGE_DIMENSION,
      workingPixelLimit,
    );

  const capped =
    output.width !==
      requested.width ||
    output.height !==
      requested.height;

  const cappedByDimension =
    requested.width >
      MAX_IMAGE_DIMENSION ||
    requested.height >
      MAX_IMAGE_DIMENSION;

  return {
    operation,
    requested,
    output,
    working,
    capped,

    capReason:
      capped
        ? cappedByDimension
          ? "The requested edge exceeded the browser-safe 7,680 px canvas limit."
          : "The requested output exceeded this device's conservative browser-memory limit."
        : null,

    estimatedRequestedBytes:
      getPixelCount(
        requested,
      ) *
      4 *
      estimatedBufferCount,

    estimatedOutputBytes:
      getPixelCount(
        output,
      ) *
      4 *
      estimatedBufferCount,

    estimatedBufferCount,
    safetyProfile,
  };
}

export function getAdaptiveVideoProfile(
  durationSeconds: number,
): VideoAdaptiveProfile {
  const duration =
    Number.isFinite(
      durationSeconds,
    )
      ? Math.max(
          0,
          durationSeconds,
        )
      : 0;

  if (
    duration <= 30
  ) {
    return STANDARD_VIDEO_PROFILE;
  }

  if (
    duration <= 90
  ) {
    return BALANCED_VIDEO_PROFILE;
  }

  if (
    duration <= 180
  ) {
    return EXTENDED_VIDEO_PROFILE;
  }

  return MAXIMUM_VIDEO_PROFILE;
}

export function createVideoOutputPlan(
  source: Dimensions,
  resolution: ProcessingResolution,
  durationSeconds = 0,
): VideoOutputPlan {
  const multiplier =
    resolution ===
    "2x"
      ? 2
      : 1;

  const requested = {
    width:
      clampPositiveInteger(
        source.width,
      ) *
      multiplier,

    height:
      clampPositiveInteger(
        source.height,
      ) *
      multiplier,
  };

  const adaptiveProfile =
    getAdaptiveVideoProfile(
      durationSeconds,
    );

  const output =
    constrainVideoDimensions(
      requested,
      adaptiveProfile.maxLongEdge,
      adaptiveProfile.maxShortEdge,
      adaptiveProfile.maxPixelsPerFrame,
    );

  const capped =
    output.width !==
      requested.width ||
    output.height !==
      requested.height;

  return {
    requested,
    output,
    capped,

    capReason:
      capped
        ? `${adaptiveProfile.label} limits this job to approximately ${adaptiveProfile.maxShortEdge}p-class output to protect browser responsiveness.`
        : null,

    frameRate:
      adaptiveProfile.frameRate,

    adaptiveProfile,
  };
}

export function validateImageSource(
  source: Dimensions,
  hints: DeviceHints = {},
): string | null {
  const width =
    clampPositiveInteger(
      source.width,
    );

  const height =
    clampPositiveInteger(
      source.height,
    );

  const profile =
    getSafetyProfile(
      hints,
    );

  if (
    width > 16_384 ||
    height > 16_384
  ) {
    return "This image has an edge longer than 16,384 pixels and cannot be decoded safely in the browser. Try a smaller image.";
  }

  if (
    width *
      height >
    profile.maxDecodePixels
  ) {
    return `This image contains ${Math.round(
      (
        width *
        height
      ) /
        1_000_000,
    )} megapixels, which is above this device's safe browser decode limit. Resize it before processing.`;
  }

  return null;
}

export function validateVideoPreflight(
  fileSize: number,
  metadata: VideoMetadata,
): VideoPreflightResult {
  const width =
    clampPositiveInteger(
      metadata.width,
    );

  const height =
    clampPositiveInteger(
      metadata.height,
    );

  const duration =
    Number.isFinite(
      metadata.duration,
    )
      ? metadata.duration
      : 0;

  const dimensions = {
    width,
    height,
  };

  const longEdge =
    getLongEdge(
      dimensions,
    );

  const shortEdge =
    getShortEdge(
      dimensions,
    );

  const pixels =
    getPixelCount(
      dimensions,
    );

  if (
    duration <= 0 ||
    width <= 0 ||
    height <= 0
  ) {
    return {
      supported:
        false,

      message:
        "Sharpixa could not read valid video metadata. Try MP4 or WEBM in a current Chrome or Edge browser.",

      warning:
        null,

      adaptiveProfile:
        null,
    };
  }

  if (
    duration >
    MAX_CLIENT_VIDEO_DURATION_SECONDS
  ) {
    return {
      supported:
        false,

      message:
        "This video is longer than Sharpixa's five-minute browser-processing limit. Trim it to 5:00 or less and try again.",

      warning:
        null,

      adaptiveProfile:
        null,
    };
  }

  if (
    fileSize >
    MAX_CLIENT_VIDEO_FILE_SIZE_BYTES
  ) {
    return {
      supported:
        false,

      message:
        "This video is larger than 300MB. Compress it or export a smaller MP4 or WEBM before processing.",

      warning:
        null,

      adaptiveProfile:
        null,
    };
  }

  if (
    longEdge >
      MAX_CLIENT_VIDEO_LONG_EDGE ||
    shortEdge >
      MAX_CLIENT_VIDEO_SHORT_EDGE ||
    pixels >
      MAX_CLIENT_VIDEO_PIXELS_PER_FRAME
  ) {
    return {
      supported:
        false,

      message:
        "This video exceeds the safe 1080p browser input limit. Both landscape 1920 × 1080 and portrait 1080 × 1920 are supported.",

      warning:
        null,

      adaptiveProfile:
        null,
    };
  }

  const adaptiveProfile =
    getAdaptiveVideoProfile(
      duration,
    );

  return {
    supported:
      true,

    message:
      null,

    warning:
      adaptiveProfile.warning,

    adaptiveProfile,
  };
}

export function formatDimensions(
  dimensions: Dimensions | null,
): string {
  if (!dimensions) {
    return "Reading dimensions…";
  }

  return `${dimensions.width.toLocaleString()} × ${dimensions.height.toLocaleString()} px`;
}