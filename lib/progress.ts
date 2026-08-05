export type ProcessingStage =
  | "preparing"
  | "loading-model"
  | "decoding"
  | "analyzing-subject"
  | "reading-mask"
  | "processing-tiles"
  | "applying-enhancement"
  | "resizing-output"
  | "processing-video"
  | "encoding-output"
  | "finalizing";

export interface ProgressUpdate {
  jobId: string;
  value: number;
  stage: ProcessingStage;
  label: string;
}

export interface ProgressRange {
  start: number;
  end: number;
}

export type ProgressProfile = Record<
  ProcessingStage,
  ProgressRange
>;

export interface ProgressController {
  reportStage(
    stage: ProcessingStage,
    ratio: number,
    force?: boolean,
  ): void;
  reportResource(
    stage: ProcessingStage,
    key: string,
    current: number,
    total: number,
  ): void;
  completeStage(stage: ProcessingStage): void;
  completeSuccess(): void;
  dispose(): void;
}

const STAGE_LABELS: Record<ProcessingStage, string> = {
  preparing: "Preparing file",
  "loading-model": "Loading model",
  decoding: "Decoding image",
  "analyzing-subject": "Analyzing subject",
  "reading-mask": "Reading selection mask",
  "processing-tiles": "Processing tiles",
  "applying-enhancement": "Applying enhancement",
  "resizing-output": "Resizing to safe output dimensions",
  "processing-video": "Processing video frames",
  "encoding-output": "Encoding output",
  finalizing: "Finalizing",
};

const EMPTY_RANGE: ProgressRange = {
  start: 0,
  end: 0,
};

export const BACKGROUND_PROGRESS_PROFILE: ProgressProfile = {
  preparing: { start: 0, end: 5 },
  "loading-model": { start: 5, end: 42 },
  decoding: { start: 42, end: 52 },
  "analyzing-subject": { start: 52, end: 88 },
  "reading-mask": EMPTY_RANGE,
  "processing-tiles": EMPTY_RANGE,
  "applying-enhancement": EMPTY_RANGE,
  "resizing-output": EMPTY_RANGE,
  "processing-video": EMPTY_RANGE,
  "encoding-output": { start: 88, end: 98 },
  finalizing: { start: 98, end: 99 },
};

export const ENHANCE_PROGRESS_PROFILE: ProgressProfile = {
  preparing: { start: 0, end: 5 },
  "loading-model": EMPTY_RANGE,
  decoding: { start: 5, end: 15 },
  "analyzing-subject": EMPTY_RANGE,
  "reading-mask": EMPTY_RANGE,
  "processing-tiles": EMPTY_RANGE,
  "applying-enhancement": { start: 15, end: 78 },
  "resizing-output": { start: 78, end: 90 },
  "processing-video": EMPTY_RANGE,
  "encoding-output": { start: 90, end: 98 },
  finalizing: { start: 98, end: 99 },
};

export const MASK_PROGRESS_PROFILE: ProgressProfile = {
  preparing: { start: 0, end: 5 },
  "loading-model": EMPTY_RANGE,
  decoding: { start: 5, end: 15 },
  "analyzing-subject": EMPTY_RANGE,
  "reading-mask": { start: 15, end: 30 },
  "processing-tiles": { start: 30, end: 88 },
  "applying-enhancement": EMPTY_RANGE,
  "resizing-output": EMPTY_RANGE,
  "processing-video": EMPTY_RANGE,
  "encoding-output": { start: 88, end: 98 },
  finalizing: { start: 98, end: 99 },
};

export const VIDEO_PROGRESS_PROFILE: ProgressProfile = {
  preparing: { start: 0, end: 5 },
  "loading-model": EMPTY_RANGE,
  decoding: { start: 5, end: 12 },
  "analyzing-subject": EMPTY_RANGE,
  "reading-mask": { start: 12, end: 20 },
  "processing-tiles": EMPTY_RANGE,
  "applying-enhancement": EMPTY_RANGE,
  "resizing-output": EMPTY_RANGE,
  "processing-video": { start: 20, end: 92 },
  "encoding-output": { start: 92, end: 98 },
  finalizing: { start: 98, end: 99 },
};

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

function now(): number {
  return typeof performance === "undefined"
    ? Date.now()
    : performance.now();
}

/**
 * Aggregates independently restarting resource callbacks, applies stage
 * weights, throttles React-facing updates, and permanently clamps a job's
 * progress upward. Only completeSuccess is allowed to emit 100%.
 */
export function createProgressController(options: {
  jobId: string;
  profile: ProgressProfile;
  onUpdate: (update: ProgressUpdate) => void;
  throttleMs?: number;
}): ProgressController {
  const throttleMs = Math.min(
    200,
    Math.max(100, options.throttleMs ?? 125),
  );
  const resources = new Map<
    string,
    { current: number; total: number }
  >();
  let emittedValue = 0;
  let lastEmittedAt = -Infinity;
  let pendingUpdate: ProgressUpdate | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const flush = () => {
    timer = null;

    if (disposed || !pendingUpdate) {
      return;
    }

    const update = pendingUpdate;
    pendingUpdate = null;
    emittedValue = Math.max(emittedValue, update.value);
    lastEmittedAt = now();
    options.onUpdate({
      ...update,
      value: emittedValue,
    });
  };

  const queueUpdate = (
    stage: ProcessingStage,
    rawValue: number,
    force = false,
  ) => {
    if (disposed) {
      return;
    }

    const value = Math.min(
      99,
      Math.max(emittedValue, Math.round(rawValue)),
    );
    const nextUpdate: ProgressUpdate = {
      jobId: options.jobId,
      value,
      stage,
      label: STAGE_LABELS[stage],
    };

    if (
      force ||
      now() - lastEmittedAt >= throttleMs
    ) {
      pendingUpdate = nextUpdate;

      if (timer) {
        clearTimeout(timer);
        timer = null;
      }

      flush();
      return;
    }

    if (
      !pendingUpdate ||
      nextUpdate.value >= pendingUpdate.value ||
      nextUpdate.stage !== pendingUpdate.stage
    ) {
      pendingUpdate = nextUpdate;
    }

    if (!timer) {
      timer = setTimeout(
        flush,
        Math.max(0, throttleMs - (now() - lastEmittedAt)),
      );
    }
  };

  const reportStage = (
    stage: ProcessingStage,
    ratio: number,
    force = false,
  ) => {
    const range = options.profile[stage];
    const value =
      range.start +
      (range.end - range.start) * clampRatio(ratio);
    queueUpdate(stage, value, force);
  };

  return {
    reportStage,

    reportResource(stage, key, current, total) {
      if (disposed || total <= 0 || !Number.isFinite(total)) {
        return;
      }

      const resourceKey = `${stage}:${key}`;
      const previous = resources.get(resourceKey);
      resources.set(resourceKey, {
        current: Math.max(previous?.current ?? 0, current),
        total: Math.max(previous?.total ?? 0, total),
      });

      let currentSum = 0;
      let totalSum = 0;

      for (const [storedKey, resource] of resources) {
        if (!storedKey.startsWith(`${stage}:`)) {
          continue;
        }

        currentSum += Math.min(resource.current, resource.total);
        totalSum += resource.total;
      }

      reportStage(
        stage,
        totalSum > 0 ? currentSum / totalSum : 0,
      );
    },

    completeStage(stage) {
      reportStage(stage, 1, true);
    },

    completeSuccess() {
      if (disposed) {
        return;
      }

      if (timer) {
        clearTimeout(timer);
        timer = null;
      }

      pendingUpdate = null;
      emittedValue = 100;
      lastEmittedAt = now();
      options.onUpdate({
        jobId: options.jobId,
        value: 100,
        stage: "finalizing",
        label: "Complete",
      });
    },

    dispose() {
      disposed = true;
      resources.clear();
      pendingUpdate = null;

      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}

