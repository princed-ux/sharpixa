import type {
  Dimensions,
  VideoMetadata,
} from "./processingLimits";

function createAbortError(): DOMException {
  return new DOMException("The operation was cancelled.", "AbortError");
}

function createCanvas(
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function getContext(
  canvas: HTMLCanvasElement,
): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas 2D is unavailable in this browser.");
  }

  return context;
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: "image/png" | "image/jpeg" = "image/png",
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob?.size) {
          resolve(blob);
          return;
        }

        reject(
          new Error(
            "The browser could not encode the image. Try a smaller file.",
          ),
        );
      },
      format,
      format === "image/jpeg" ? 0.92 : undefined,
    );
  });
}

export function readImageDimensions(
  url: string,
  signal?: AbortSignal,
): Promise<Dimensions> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    const cleanup = () => {
      image.onload = null;
      image.onerror = null;
      signal?.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      cleanup();
      image.src = "";
      reject(createAbortError());
    };

    image.onload = () => {
      const dimensions = {
        width: image.naturalWidth,
        height: image.naturalHeight,
      };
      cleanup();

      if (!dimensions.width || !dimensions.height) {
        reject(new Error("The image has invalid dimensions."));
        return;
      }

      resolve(dimensions);
    };
    image.onerror = () => {
      cleanup();
      reject(
        new Error(
          "The image could not be decoded. It may be corrupt or unsupported.",
        ),
      );
    };
    signal?.addEventListener("abort", onAbort, { once: true });

    if (signal?.aborted) {
      onAbort();
      return;
    }

    image.src = url;
  });
}

export function readVideoMetadata(
  url: string,
  signal?: AbortSignal,
): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    let settled = false;
    const timeout = window.setTimeout(() => {
      finish(
        new Error(
          "Video metadata could not be read. Try MP4 or WEBM in current Chrome or Edge.",
        ),
      );
    }, 15_000);

    const cleanup = () => {
      window.clearTimeout(timeout);
      video.onloadedmetadata = null;
      video.onerror = null;
      signal?.removeEventListener("abort", onAbort);
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
    const finish = (
      error: Error | null,
      metadata?: VideoMetadata,
    ) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();

      if (error) {
        reject(error);
      } else if (metadata) {
        resolve(metadata);
      }
    };
    const onAbort = () => {
      finish(createAbortError());
    };

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => {
      const metadata = {
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration,
      };

      if (
        !metadata.width ||
        !metadata.height ||
        !Number.isFinite(metadata.duration) ||
        metadata.duration <= 0
      ) {
        finish(new Error("The video has invalid or incomplete metadata."));
        return;
      }

      finish(null, metadata);
    };
    video.onerror = () => {
      finish(
        new Error(
          "The video could not be decoded. Try MP4 or WEBM in current Chrome or Edge.",
        ),
      );
    };
    signal?.addEventListener("abort", onAbort, { once: true });

    if (signal?.aborted) {
      onAbort();
      return;
    }

    video.src = url;
  });
}

/**
 * Captures one preflight-limited frame for the brush editor. This DOM-only
 * operation performs no pixel loop and releases the media element immediately.
 */
export function captureVideoFrame(
  videoUrl: string,
  signal?: AbortSignal,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    let settled = false;
    const timeout = window.setTimeout(() => {
      finish(new Error("Video frame capture timed out."));
    }, 15_000);

    const cleanup = () => {
      window.clearTimeout(timeout);
      video.onloadedmetadata = null;
      video.onseeked = null;
      video.onerror = null;
      signal?.removeEventListener("abort", onAbort);
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
    const finish = (error: Error | null, blob?: Blob) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();

      if (error) {
        reject(error);
      } else if (blob) {
        resolve(blob);
      }
    };
    const onAbort = () => {
      finish(createAbortError());
    };

    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.onloadedmetadata = () => {
      video.onseeked = () => {
        try {
          const canvas = createCanvas(video.videoWidth, video.videoHeight);
          const context = getContext(canvas);
          context.drawImage(
            video,
            0,
            0,
            canvas.width,
            canvas.height,
          );
          void canvasToBlob(canvas, "image/jpeg")
            .then((blob) => finish(null, blob))
            .catch((error: unknown) => {
              finish(
                error instanceof Error
                  ? error
                  : new Error("The video frame could not be encoded."),
              );
            })
            .finally(() => {
              canvas.width = 1;
              canvas.height = 1;
            });
        } catch (error) {
          finish(
            error instanceof Error
              ? error
              : new Error("The video frame could not be captured."),
          );
        }
      };
      video.currentTime = Math.min(0.05, video.duration || 0.05);
    };
    video.onerror = () => {
      finish(new Error("The video frame could not be decoded."));
    };
    signal?.addEventListener("abort", onAbort, { once: true });

    if (signal?.aborted) {
      onAbort();
      return;
    }

    video.src = videoUrl;
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function generateSampleImage(): Promise<File> {
  const canvas = createCanvas(1000, 700);

  try {
    const context = getContext(canvas);
    const sky = context.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, "#3b82f6");
    sky.addColorStop(0.55, "#93c5fd");
    sky.addColorStop(1, "#dbeafe");
    context.fillStyle = sky;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#1e3a5f";
    context.beginPath();
    context.moveTo(0, 430);
    context.lineTo(180, 270);
    context.lineTo(360, 420);
    context.lineTo(550, 220);
    context.lineTo(760, 430);
    context.lineTo(1000, 310);
    context.lineTo(1000, 700);
    context.lineTo(0, 700);
    context.closePath();
    context.fill();
    const ground = context.createLinearGradient(0, 430, 0, 700);
    ground.addColorStop(0, "#3f7d58");
    ground.addColorStop(1, "#183c2b");
    context.fillStyle = ground;
    context.fillRect(0, 430, canvas.width, 270);
    context.fillStyle = "rgba(255, 255, 255, 0.92)";
    context.font = "700 64px Arial, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("SAMPLE", canvas.width / 2, canvas.height / 2);
    context.strokeStyle = "rgba(99, 102, 241, 0.9)";
    context.lineWidth = 5;
    context.strokeText("SAMPLE", canvas.width / 2, canvas.height / 2);
    const blob = await canvasToBlob(canvas, "image/png");
    return new File([blob], "sharpixa-sample.png", {
      type: "image/png",
    });
  } finally {
    canvas.width = 1;
    canvas.height = 1;
  }
}

