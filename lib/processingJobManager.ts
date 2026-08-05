export type HeavyJobKind =
  | "automatic-background"
  | "image-enhancement"
  | "manual-background"
  | "image-inpaint"
  | "video";

export interface ProcessingJob {
  id: string;
  kind: HeavyJobKind;
  signal: AbortSignal;
}

type CancelUnderlying = () => Promise<void> | void;

interface ActiveJob extends ProcessingJob {
  controller: AbortController;
  cancelUnderlying: CancelUnderlying | null;
}

function createJobId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `sharpixa-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

/** Owns the page's single heavy-processing slot. */
export class ProcessingJobManager {
  private activeJob: ActiveJob | null = null;

  get active(): ProcessingJob | null {
    return this.activeJob;
  }

  get busy(): boolean {
    return this.activeJob !== null;
  }

  begin(kind: HeavyJobKind): ProcessingJob {
    if (this.activeJob) {
      throw new Error("A processing job is already active.");
    }

    const controller = new AbortController();
    const job: ActiveJob = {
      id: createJobId(),
      kind,
      signal: controller.signal,
      controller,
      cancelUnderlying: null,
    };
    this.activeJob = job;
    return job;
  }

  registerCancellation(
    jobId: string,
    cancelUnderlying: CancelUnderlying,
  ): void {
    if (this.activeJob?.id === jobId) {
      this.activeJob.cancelUnderlying = cancelUnderlying;
    }
  }

  isActive(jobId: string): boolean {
    return (
      this.activeJob?.id === jobId &&
      !this.activeJob.signal.aborted
    );
  }

  complete(jobId: string): void {
    if (this.activeJob?.id === jobId) {
      this.activeJob = null;
    }
  }

  async cancel(reason = "cancelled"): Promise<void> {
    const job = this.activeJob;

    if (!job) {
      return;
    }

    job.controller.abort(reason);

    try {
      await job.cancelUnderlying?.();
    } finally {
      if (this.activeJob?.id === job.id) {
        this.activeJob = null;
      }
    }
  }

  dispose(): void {
    const job = this.activeJob;
    this.activeJob = null;

    if (!job) {
      return;
    }

    job.controller.abort("unmounted");
    void job.cancelUnderlying?.();
  }
}

