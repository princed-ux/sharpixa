"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

type CompareMode =
  | "watermark"
  | "background"
  | "enhance";

type MediaStatus =
  | "loading"
  | "ready"
  | "error";

type MediaSize = {
  width: number;
  height: number;
};

interface CompareSliderProps {
  beforeUrl: string;
  afterUrl: string;
  isVideo?: boolean;
  mode?: CompareMode;
}

const FALLBACK_MEDIA_SIZE: MediaSize = {
  width: 4,
  height: 3,
};

const MAX_PREVIEW_WIDTH = 860;
const MAX_PREVIEW_HEIGHT = 620;
const MEDIA_LOAD_TIMEOUT_MS = 15_000;

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(
    maximum,
    Math.max(minimum, value),
  );
}

function getModeLabel(
  mode?: CompareMode,
): string {
  if (mode === "background") {
    return "Transparent result";
  }

  if (mode === "watermark") {
    return "Cleaned result";
  }

  return "Enhanced result";
}

function calculateDisplaySize(
  media: MediaSize,
  availableWidth: number,
  availableHeight: number,
): MediaSize {
  const sourceWidth = Math.max(
    1,
    media.width,
  );

  const sourceHeight = Math.max(
    1,
    media.height,
  );

  const scale = Math.min(
    1,
    Math.max(1, availableWidth) /
      sourceWidth,
    Math.max(1, availableHeight) /
      sourceHeight,
  );

  return {
    width: Math.max(
      1,
      Math.round(sourceWidth * scale),
    ),

    height: Math.max(
      1,
      Math.round(sourceHeight * scale),
    ),
  };
}

export default function CompareSlider({
  beforeUrl,
  afterUrl,
  isVideo = false,
  mode,
}: CompareSliderProps) {
  const hostRef =
    useRef<HTMLDivElement>(null);

  const containerRef =
    useRef<HTMLDivElement>(null);

  const beforeImageRef =
    useRef<HTMLImageElement>(null);

  const afterImageRef =
    useRef<HTMLImageElement>(null);

  const beforeVideoRef =
    useRef<HTMLVideoElement>(null);

  const afterVideoRef =
    useRef<HTMLVideoElement>(null);

  const activePointerRef =
    useRef<number | null>(null);

  const loadAttemptRef =
    useRef(0);

  const beforeLoadedRef =
    useRef(false);

  const afterLoadedRef =
    useRef(false);

  const [
    position,
    setPosition,
  ] = useState(50);

  const [
    mediaSize,
    setMediaSize,
  ] = useState<MediaSize>(
    FALLBACK_MEDIA_SIZE,
  );

  const [
    hostWidth,
    setHostWidth,
  ] = useState(
    MAX_PREVIEW_WIDTH,
  );

  const [
    viewportHeight,
    setViewportHeight,
  ] = useState(
    MAX_PREVIEW_HEIGHT,
  );

  const [
    status,
    setStatus,
  ] =
    useState<MediaStatus>(
      "loading",
    );

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState<string | null>(
      null,
    );

  const displaySize = useMemo(
    () =>
      calculateDisplaySize(
        mediaSize,

        Math.min(
          MAX_PREVIEW_WIDTH,
          hostWidth,
        ),

        Math.min(
          MAX_PREVIEW_HEIGHT,

          Math.max(
            280,
            viewportHeight * 0.68,
          ),
        ),
      ),
    [
      hostWidth,
      mediaSize,
      viewportHeight,
    ],
  );

  const checkerboardStyle =
    mode === "background"
      ? {
          backgroundColor:
            "#f8fafc",

          backgroundImage:
            "linear-gradient(45deg, #d1d5db 25%, transparent 25%), linear-gradient(-45deg, #d1d5db 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d1d5db 75%), linear-gradient(-45deg, transparent 75%, #d1d5db 75%)",

          backgroundSize:
            "22px 22px",

          backgroundPosition:
            "0 0, 0 11px, 11px -11px, -11px 0",
        }
      : {
          backgroundColor:
            "transparent",
        };

  const markReadyIfComplete =
    useCallback(() => {
      if (
        beforeLoadedRef.current &&
        afterLoadedRef.current
      ) {
        setStatus(
          "ready",
        );

        setErrorMessage(
          null,
        );
      }
    }, []);

  const failMedia =
    useCallback(
      (
        message: string,
      ) => {
        setStatus(
          "error",
        );

        setErrorMessage(
          message,
        );
      },
      [],
    );

  const updatePosition =
    useCallback(
      (
        clientX: number,
      ) => {
        const container =
          containerRef.current;

        if (!container) {
          return;
        }

        const bounds =
          container.getBoundingClientRect();

        if (!bounds.width) {
          return;
        }

        const offset = clamp(
          clientX -
            bounds.left,

          0,
          bounds.width,
        );

        setPosition(
          (
            offset /
            bounds.width
          ) *
            100,
        );
      },
      [],
    );

  const beginDrag =
    useCallback(
      (
        event:
          ReactPointerEvent<HTMLDivElement>,
      ) => {
        if (
          status !==
            "ready" ||
          (
            event.pointerType ===
              "mouse" &&
            event.button !==
              0
          )
        ) {
          return;
        }

        event.preventDefault();

        event.currentTarget.setPointerCapture(
          event.pointerId,
        );

        activePointerRef.current =
          event.pointerId;

        updatePosition(
          event.clientX,
        );
      },
      [
        status,
        updatePosition,
      ],
    );

  const continueDrag =
    useCallback(
      (
        event:
          ReactPointerEvent<HTMLDivElement>,
      ) => {
        if (
          activePointerRef.current !==
          event.pointerId
        ) {
          return;
        }

        event.preventDefault();

        updatePosition(
          event.clientX,
        );
      },
      [
        updatePosition,
      ],
    );

  const finishDrag =
    useCallback(
      (
        event:
          ReactPointerEvent<HTMLDivElement>,
      ) => {
        if (
          activePointerRef.current !==
          event.pointerId
        ) {
          return;
        }

        if (
          event.currentTarget.hasPointerCapture(
            event.pointerId,
          )
        ) {
          event.currentTarget.releasePointerCapture(
            event.pointerId,
          );
        }

        activePointerRef.current =
          null;
      },
      [],
    );

  const handleKeyboard =
    useCallback(
      (
        event:
          ReactKeyboardEvent<HTMLDivElement>,
      ) => {
        if (
          status !==
            "ready" ||
          (
            event.key !==
              "ArrowLeft" &&
            event.key !==
              "ArrowRight"
          )
        ) {
          return;
        }

        event.preventDefault();

        const amount =
          event.shiftKey
            ? 10
            : 2;

        setPosition(
          (
            current,
          ) =>
            clamp(
              current +
                (
                  event.key ===
                  "ArrowRight"
                    ? amount
                    : -amount
                ),

              0,
              100,
            ),
        );
      },
      [
        status,
      ],
    );

  const handleBeforeImageLoaded =
    useCallback(
      (
        image:
          HTMLImageElement,

        attempt =
          loadAttemptRef.current,
      ) => {
        if (
          attempt !==
            loadAttemptRef.current ||
          !image.naturalWidth ||
          !image.naturalHeight
        ) {
          return;
        }

        /*
         * The comparison frame always uses the ORIGINAL image dimensions.
         * The processed output is fitted into this exact same rectangle.
         */
        setMediaSize({
          width:
            image.naturalWidth,

          height:
            image.naturalHeight,
        });

        beforeLoadedRef.current =
          true;

        markReadyIfComplete();
      },
      [
        markReadyIfComplete,
      ],
    );

  const handleAfterImageLoaded =
    useCallback(
      (
        image:
          HTMLImageElement,

        attempt =
          loadAttemptRef.current,
      ) => {
        if (
          attempt !==
            loadAttemptRef.current ||
          !image.naturalWidth ||
          !image.naturalHeight
        ) {
          return;
        }

        afterLoadedRef.current =
          true;

        markReadyIfComplete();
      },
      [
        markReadyIfComplete,
      ],
    );

  const handleBeforeVideoLoaded =
    useCallback(
      (
        video:
          HTMLVideoElement,

        attempt =
          loadAttemptRef.current,
      ) => {
        if (
          attempt !==
            loadAttemptRef.current ||
          !video.videoWidth ||
          !video.videoHeight
        ) {
          return;
        }

        setMediaSize({
          width:
            video.videoWidth,

          height:
            video.videoHeight,
        });

        beforeLoadedRef.current =
          true;

        markReadyIfComplete();
      },
      [
        markReadyIfComplete,
      ],
    );

  const handleAfterVideoLoaded =
    useCallback(
      (
        video:
          HTMLVideoElement,

        attempt =
          loadAttemptRef.current,
      ) => {
        if (
          attempt !==
            loadAttemptRef.current ||
          !video.videoWidth ||
          !video.videoHeight
        ) {
          return;
        }

        afterLoadedRef.current =
          true;

        markReadyIfComplete();
      },
      [
        markReadyIfComplete,
      ],
    );

  const inspectCachedMedia =
    useCallback(
      (
        attempt: number,
      ) => {
        if (
          attempt !==
          loadAttemptRef.current
        ) {
          return;
        }

        if (isVideo) {
          const beforeVideo =
            beforeVideoRef.current;

          const afterVideo =
            afterVideoRef.current;

          if (
            beforeVideo &&
            beforeVideo.readyState >=
              1
          ) {
            handleBeforeVideoLoaded(
              beforeVideo,
              attempt,
            );
          }

          if (
            afterVideo &&
            afterVideo.readyState >=
              1
          ) {
            handleAfterVideoLoaded(
              afterVideo,
              attempt,
            );
          }

          return;
        }

        const beforeImage =
          beforeImageRef.current;

        const afterImage =
          afterImageRef.current;

        if (
          beforeImage?.complete &&
          beforeImage.naturalWidth >
            0
        ) {
          handleBeforeImageLoaded(
            beforeImage,
            attempt,
          );
        }

        if (
          afterImage?.complete &&
          afterImage.naturalWidth >
            0
        ) {
          handleAfterImageLoaded(
            afterImage,
            attempt,
          );
        }
      },
      [
        handleAfterImageLoaded,
        handleAfterVideoLoaded,
        handleBeforeImageLoaded,
        handleBeforeVideoLoaded,
        isVideo,
      ],
    );

  useEffect(() => {
    const host =
      hostRef.current;

    if (!host) {
      return;
    }

    const update =
      () => {
        setHostWidth(
          Math.max(
            1,
            host.clientWidth,
          ),
        );

        setViewportHeight(
          window.innerHeight,
        );
      };

    update();

    const observer =
      typeof ResizeObserver ===
        "undefined"
        ? null
        : new ResizeObserver(
            update,
          );

    observer?.observe(
      host,
    );

    window.addEventListener(
      "resize",
      update,
    );

    return () => {
      observer?.disconnect();

      window.removeEventListener(
        "resize",
        update,
      );
    };
  }, []);

  useEffect(() => {
    loadAttemptRef.current +=
      1;

    const attempt =
      loadAttemptRef.current;

    activePointerRef.current =
      null;

    beforeLoadedRef.current =
      false;

    afterLoadedRef.current =
      false;

    setPosition(
      50,
    );

    setStatus(
      "loading",
    );

    setErrorMessage(
      null,
    );

    setMediaSize(
      FALLBACK_MEDIA_SIZE,
    );

    const firstCheck =
      window.requestAnimationFrame(
        () => {
          inspectCachedMedia(
            attempt,
          );
        },
      );

    const secondCheck =
      window.setTimeout(
        () => {
          inspectCachedMedia(
            attempt,
          );
        },
        250,
      );

    const timeout =
      window.setTimeout(
        () => {
          /*
           * The previous implementation always displayed an error when
           * this timer finished—even if both files had loaded already.
           */
          if (
            attempt !==
              loadAttemptRef.current ||
            (
              beforeLoadedRef.current &&
              afterLoadedRef.current
            )
          ) {
            return;
          }

          failMedia(
            isVideo
              ? "The before-and-after videos could not be opened for comparison."
              : "The before-and-after images could not be opened for comparison.",
          );
        },
        MEDIA_LOAD_TIMEOUT_MS,
      );

    return () => {
      window.cancelAnimationFrame(
        firstCheck,
      );

      window.clearTimeout(
        secondCheck,
      );

      window.clearTimeout(
        timeout,
      );
    };
  }, [
    afterUrl,
    beforeUrl,
    failMedia,
    inspectCachedMedia,
    isVideo,
  ]);

  return (
    <div
      ref={
        hostRef
      }
      className="w-full overflow-hidden"
    >
      <div
        ref={
          containerRef
        }
        className="relative mx-auto touch-none select-none overflow-hidden rounded-2xl border border-gray-200 shadow-lg outline-none ring-indigo-500/30 focus-visible:ring-4"
        style={{
          ...checkerboardStyle,

          width:
            displaySize.width,

          height:
            displaySize.height,

          maxWidth:
            "100%",

          userSelect:
            "none",

          WebkitUserSelect:
            "none",
        }}
        role="slider"
        tabIndex={0}
        aria-label="Before and after comparison"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={
          Math.round(
            position,
          )
        }
        aria-disabled={
          status !==
          "ready"
        }
        onPointerDown={
          beginDrag
        }
        onPointerMove={
          continueDrag
        }
        onPointerUp={
          finishDrag
        }
        onPointerCancel={
          finishDrag
        }
        onKeyDown={
          handleKeyboard
        }
      >
        {isVideo ? (
          <video
            ref={
              afterVideoRef
            }
            src={
              afterUrl
            }
            muted
            loop
            autoPlay
            playsInline
            preload="metadata"
            className="pointer-events-none absolute inset-0 z-0 block h-full w-full select-none object-fill"
            onLoadedMetadata={(
              event,
            ) =>
              handleAfterVideoLoaded(
                event.currentTarget,
              )
            }
            onCanPlay={(
              event,
            ) =>
              handleAfterVideoLoaded(
                event.currentTarget,
              )
            }
            onError={() =>
              failMedia(
                "The processed video could not be displayed.",
              )
            }
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={
              afterImageRef
            }
            src={
              afterUrl
            }
            alt="Processed result"
            draggable={
              false
            }
            className="pointer-events-none absolute inset-0 z-0 block h-full w-full select-none object-fill"
            onLoad={(
              event,
            ) =>
              handleAfterImageLoaded(
                event.currentTarget,
              )
            }
            onError={() =>
              failMedia(
                "The processed image could not be displayed.",
              )
            }
          />
        )}

        <div
          className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
          style={{
            clipPath:
              `inset(0 ${
                100 -
                position
              }% 0 0)`,

            WebkitClipPath:
              `inset(0 ${
                100 -
                position
              }% 0 0)`,
          }}
          aria-hidden="true"
        >
          {isVideo ? (
            <video
              ref={
                beforeVideoRef
              }
              src={
                beforeUrl
              }
              muted
              loop
              autoPlay
              playsInline
              preload="metadata"
              className="absolute inset-0 block h-full w-full object-fill"
              onLoadedMetadata={(
                event,
              ) =>
                handleBeforeVideoLoaded(
                  event.currentTarget,
                )
              }
              onCanPlay={(
                event,
              ) =>
                handleBeforeVideoLoaded(
                  event.currentTarget,
                )
              }
              onError={() =>
                failMedia(
                  "The original video could not be displayed.",
                )
              }
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={
                beforeImageRef
              }
              src={
                beforeUrl
              }
              alt=""
              draggable={
                false
              }
              className="absolute inset-0 block h-full w-full object-fill"
              onLoad={(
                event,
              ) =>
                handleBeforeImageLoaded(
                  event.currentTarget,
                )
              }
              onError={() =>
                failMedia(
                  "The original image could not be displayed.",
                )
              }
            />
          )}
        </div>

        <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-full border border-white/20 bg-gray-950/75 px-3 py-1.5 text-xs font-bold text-white shadow-lg backdrop-blur-sm">
          Original
        </div>

        <div className="pointer-events-none absolute right-3 top-3 z-20 rounded-full border border-white/20 bg-gray-950/75 px-3 py-1.5 text-xs font-bold text-white shadow-lg backdrop-blur-sm">
          {getModeLabel(
            mode,
          )}
        </div>

        <div
          className="pointer-events-none absolute bottom-0 top-0 z-30 w-0.5 bg-white shadow-[0_0_10px_rgba(0,0,0,0.45)]"
          style={{
            left:
              `${position}%`,

            transform:
              "translateX(-50%)",
          }}
        >
          <div className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-indigo-950/85 text-white shadow-xl backdrop-blur-sm">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m9 5-7 7 7 7" />

              <path d="m15 5 7 7-7 7" />
            </svg>
          </div>
        </div>

        {status ===
          "loading" && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-white/[0.92] p-5 text-center backdrop-blur-sm">
            <div className="spinner" />

            <p className="text-sm font-medium text-gray-600">
              Preparing
              comparison…
            </p>
          </div>
        )}

        {status ===
          "error" && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white p-5 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-lg font-bold text-rose-600">
              !
            </div>

            <p className="mt-3 max-w-sm text-sm leading-6 text-gray-600">
              {errorMessage ??
                "The comparison could not be displayed."}
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 flex justify-center">
        <p className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-xs font-semibold text-white shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />

          Drag the handle or use
          the arrow keys to compare
        </p>
      </div>
    </div>
  );
}