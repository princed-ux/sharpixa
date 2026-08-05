"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import type { VideoMaskTimeRange } from "@/lib/videoWorkerTypes";

type Tool = "brush" | "precision" | "circle" | "erase" | "pan";
type Point = { x: number; y: number };
type Size = { w: number; h: number };
type Status = "loading" | "ready" | "error";
type Snapshot = { blob: Blob | null; hasContent: boolean };

type Props = {
  imageUrl: string;
  videoUrl?: string;
  onMaskChange: (mask: Blob | null) => void;
  onMaskTimeRangeChange?: (
    range: VideoMaskTimeRange | null,
  ) => void;
  initialMaskTimeRange?: VideoMaskTimeRange | null;
};

const MASK_RGB = "99, 102, 241";
const MAX_MASK_EDGE = 1600;
const MAX_HISTORY = 24;
const LOAD_TIMEOUT = 15_000;
const MIN_RANGE = 1 / 30;

const TOOLS: Array<{
  id: Tool;
  label: string;
  help: string;
}> = [
  {
    id: "brush",
    label: "Brush",
    help: "Paint a continuous selection.",
  },
  {
    id: "precision",
    label: "Precision",
    help: "Paint with a smaller hard-edged brush.",
  },
  {
    id: "circle",
    label: "Circle",
    help: "Drag an ellipse around a logo or object.",
  },
  {
    id: "erase",
    label: "Erase",
    help: "Remove pixels from the purple selection.",
  },
  {
    id: "pan",
    label: "Pan",
    help: "Drag the media while zoomed in.",
  },
];

const clamp = (
  value: number,
  min: number,
  max: number,
) => Math.min(max, Math.max(min, value));

function maskSize(
  width: number,
  height: number,
): Size {
  const scale = Math.min(
    1,
    MAX_MASK_EDGE /
      Math.max(width, height),
  );

  return {
    w: Math.max(
      1,
      Math.round(width * scale),
    ),

    h: Math.max(
      1,
      Math.round(height * scale),
    ),
  };
}

function canvasBlob(
  canvas: HTMLCanvasElement,
): Promise<Blob> {
  return new Promise(
    (
      resolve,
      reject,
    ) => {
      canvas.toBlob(
        (
          blob,
        ) => {
          if (blob?.size) {
            resolve(blob);
          } else {
            reject(
              new Error(
                "The selection could not be saved.",
              ),
            );
          }
        },
        "image/png",
      );
    },
  );
}

function timeLabel(
  seconds: number,
): string {
  const safe =
    Number.isFinite(seconds)
      ? Math.max(0, seconds)
      : 0;

  const minutes =
    Math.floor(
      safe / 60,
    );

  const remainder =
    safe -
    minutes * 60;

  return `${minutes}:${remainder
    .toFixed(2)
    .padStart(5, "0")}`;
}

function normalizedRange(
  range:
    | VideoMaskTimeRange
    | null
    | undefined,

  duration: number,
): VideoMaskTimeRange | null {
  if (
    !Number.isFinite(duration) ||
    duration <= 0
  ) {
    return null;
  }

  const start =
    clamp(
      range?.startTime ??
        0,

      0,
      duration,
    );

  const end =
    clamp(
      range?.endTime ??
        duration,

      0,
      duration,
    );

  if (
    end >
    start
  ) {
    return {
      startTime:
        start,

      endTime:
        end,
    };
  }

  const safeStart =
    Math.max(
      0,

      Math.min(
        start,

        duration -
          MIN_RANGE,
      ),
    );

  return {
    startTime:
      safeStart,

    endTime:
      Math.min(
        duration,

        safeStart +
          MIN_RANGE,
      ),
  };
}

function ToolIcon({
  tool,
}: {
  tool: Tool;
}) {
  const props = {
    width: 17,
    height: 17,
    viewBox:
      "0 0 24 24",
    fill:
      "none",
    stroke:
      "currentColor",
    strokeWidth: 2.2,
    strokeLinecap:
      "round" as const,
    strokeLinejoin:
      "round" as const,
    "aria-hidden": true,
  };

  if (
    tool ===
    "brush"
  ) {
    return (
      <svg {...props}>
        <path d="m14 4 6 6" />

        <path d="M13 5 5.5 12.5a3.5 3.5 0 0 0 5 5L18 10" />
      </svg>
    );
  }

  if (
    tool ===
    "precision"
  ) {
    return (
      <svg {...props}>
        <circle
          cx="12"
          cy="12"
          r="4"
        />

        <path d="M12 2v5M12 17v5M2 12h5M17 12h5" />
      </svg>
    );
  }

  if (
    tool ===
    "circle"
  ) {
    return (
      <svg {...props}>
        <ellipse
          cx="12"
          cy="12"
          rx="8"
          ry="6"
        />
      </svg>
    );
  }

  if (
    tool ===
    "erase"
  ) {
    return (
      <svg {...props}>
        <path d="m7 18-4-4 9-9 7 7-6 6H7Z" />

        <path d="M12 21h9" />
      </svg>
    );
  }

  return (
    <svg {...props}>
      <path d="M12 2v20M2 12h20" />

      <path d="m8 6 4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4" />
    </svg>
  );
}

function PlayIcon({
  playing,
}: {
  playing: boolean;
}) {
  return playing ? (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <rect
        x="6"
        y="4"
        width="4"
        height="16"
        rx="1"
      />

      <rect
        x="14"
        y="4"
        width="4"
        height="16"
        rx="1"
      />
    </svg>
  ) : (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="m8 5 11 7-11 7V5Z" />
    </svg>
  );
}

export default function WatermarkBrush({
  imageUrl,
  videoUrl,
  onMaskChange,
  onMaskTimeRangeChange,
  initialMaskTimeRange,
}: Props) {
  const hostRef =
    useRef<HTMLDivElement>(
      null,
    );

  const viewportRef =
    useRef<HTMLDivElement>(
      null,
    );

  const imageRef =
    useRef<HTMLImageElement>(
      null,
    );

  const videoRef =
    useRef<HTMLVideoElement>(
      null,
    );

  const canvasRef =
    useRef<HTMLCanvasElement>(
      null,
    );

  const mountedRef =
    useRef(true);

  const readyRef =
    useRef(false);

  const attemptRef =
    useRef(0);

  const pointerRef =
    useRef<
      number | null
    >(null);

  const drawingRef =
    useRef(false);

  const lastRef =
    useRef<
      Point | null
    >(null);

  const circleStartRef =
    useRef<
      Point | null
    >(null);

  const circleBaseRef =
    useRef<
      ImageData | null
    >(null);

  const historyRef =
    useRef<Snapshot[]>(
      [],
    );

  const historyIndexRef =
    useRef(-1);

  const snapshotTokenRef =
    useRef(0);

  const panRef =
    useRef<null | {
      id: number;
      x: number;
      y: number;
      left: number;
      top: number;
    }>(null);

  const [
    tool,
    setTool,
  ] = useState<Tool>(
    "brush",
  );

  const [
    brushSize,
    setBrushSize,
  ] = useState(34);

  const [
    hardness,
    setHardness,
  ] = useState(100);

  const [
    overlayOpacity,
    setOverlayOpacity,
  ] = useState(48);

  const [
    zoom,
    setZoom,
  ] = useState(1);

  const [
    status,
    setStatus,
  ] =
    useState<Status>(
      "loading",
    );

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  const [
    reloadKey,
    setReloadKey,
  ] = useState(0);

  const [
    natural,
    setNatural,
  ] = useState<Size>({
    w: 0,
    h: 0,
  });

  const [
    display,
    setDisplay,
  ] = useState<Size>({
    w: 0,
    h: 0,
  });

  const [
    hasMask,
    setHasMask,
  ] = useState(false);

  const [
    canUndo,
    setCanUndo,
  ] = useState(false);

  const [
    canRedo,
    setCanRedo,
  ] = useState(false);

  const [
    panning,
    setPanning,
  ] = useState(false);

  const [
    playing,
    setPlaying,
  ] = useState(false);

  const [
    currentTime,
    setCurrentTime,
  ] = useState(0);

  const [
    duration,
    setDuration,
  ] = useState(0);

  const [
    rangeStart,
    setRangeStart,
  ] = useState(0);

  const [
    rangeEnd,
    setRangeEnd,
  ] = useState(0);

  const [
    cursor,
    setCursor,
  ] = useState({
    visible: false,
    x: 0,
    y: 0,
  });

  const isVideo =
    Boolean(
      videoUrl,
    );

  const ready =
    status ===
    "ready";

  const effectiveSize =
    tool ===
    "precision"
      ? Math.max(
          4,

          Math.round(
            brushSize *
              0.42,
          ),
        )
      : brushSize;

  const stage =
    useMemo(
      () => ({
        w: Math.max(
          1,

          Math.round(
            display.w *
              zoom,
          ),
        ),

        h: Math.max(
          1,

          Math.round(
            display.h *
              zoom,
          ),
        ),
      }),
      [
        display,
        zoom,
      ],
    );

  const range =
    useMemo(
      () =>
        normalizedRange(
          {
            startTime:
              rangeStart,

            endTime:
              rangeEnd,
          },

          duration,
        ),
      [
        duration,
        rangeEnd,
        rangeStart,
      ],
    );

  const context =
    useCallback(
      () => {
        const canvas =
          canvasRef.current;

        const ctx =
          canvas?.getContext(
            "2d",

            {
              willReadFrequently:
                true,
            },
          );

        return canvas &&
          ctx
          ? {
              canvas,
              ctx,
            }
          : null;
      },
      [],
    );

  const updateHistoryButtons =
    useCallback(
      () => {
        setCanUndo(
          historyIndexRef.current >
            0,
        );

        setCanRedo(
          historyIndexRef.current >=
            0 &&
            historyIndexRef.current <
              historyRef
                .current
                .length -
                1,
        );
      },
      [],
    );

  const clearToBlank =
    useCallback(
      () => {
        const item =
          context();

        if (!item) {
          return;
        }

        item.ctx.clearRect(
          0,
          0,
          item.canvas.width,
          item.canvas.height,
        );

        historyRef.current =
          [
            {
              blob: null,
              hasContent:
                false,
            },
          ];

        historyIndexRef.current =
          0;

        snapshotTokenRef.current +=
          1;

        setHasMask(
          false,
        );

        updateHistoryButtons();

        onMaskChange(
          null,
        );
      },
      [
        context,
        onMaskChange,
        updateHistoryButtons,
      ],
    );

  const maskExists =
    useCallback(
      () => {
        const canvas =
          canvasRef.current;

        if (!canvas) {
          return false;
        }

        const probe =
          document.createElement(
            "canvas",
          );

        probe.width = 64;
        probe.height = 64;

        const ctx =
          probe.getContext(
            "2d",

            {
              willReadFrequently:
                true,
            },
          );

        if (!ctx) {
          return hasMask;
        }

        ctx.drawImage(
          canvas,
          0,
          0,
          64,
          64,
        );

        const data =
          ctx.getImageData(
            0,
            0,
            64,
            64,
          ).data;

        for (
          let index = 3;
          index <
          data.length;
          index += 4
        ) {
          if (
            data[index] >
            8
          ) {
            return true;
          }
        }

        return false;
      },
      [
        hasMask,
      ],
    );

  const saveSnapshot =
    useCallback(
      async () => {
        const canvas =
          canvasRef.current;

        if (!canvas) {
          return;
        }

        const token =
          ++snapshotTokenRef.current;

        const exists =
          maskExists();

        try {
          const blob =
            exists
              ? await canvasBlob(
                  canvas,
                )
              : null;

          if (
            !mountedRef.current ||
            token !==
              snapshotTokenRef.current
          ) {
            return;
          }

          const history =
            historyRef.current.slice(
              0,

              historyIndexRef.current +
                1,
            );

          history.push({
            blob,
            hasContent:
              exists,
          });

          if (
            history.length >
            MAX_HISTORY
          ) {
            history.shift();
          }

          historyRef.current =
            history;

          historyIndexRef.current =
            history.length -
            1;

          setHasMask(
            exists,
          );

          updateHistoryButtons();

          onMaskChange(
            blob,
          );
        } catch (
          snapshotError
        ) {
          if (
            process.env
              .NODE_ENV !==
            "production"
          ) {
            console.error(
              snapshotError,
            );
          }
        }
      },
      [
        maskExists,
        onMaskChange,
        updateHistoryButtons,
      ],
    );

  const restore =
    useCallback(
      async (
        index: number,
      ) => {
        const item =
          context();

        const snapshot =
          historyRef.current[
            index
          ];

        if (
          !item ||
          !snapshot
        ) {
          return;
        }

        const token =
          ++snapshotTokenRef.current;

        const bitmap =
          snapshot.blob
            ? await createImageBitmap(
                snapshot.blob,
              )
            : null;

        if (
          !mountedRef.current ||
          token !==
            snapshotTokenRef.current
        ) {
          bitmap?.close();
          return;
        }

        item.ctx.clearRect(
          0,
          0,
          item.canvas.width,
          item.canvas.height,
        );

        if (bitmap) {
          item.ctx.drawImage(
            bitmap,
            0,
            0,
            item.canvas.width,
            item.canvas.height,
          );

          bitmap.close();
        }

        historyIndexRef.current =
          index;

        setHasMask(
          snapshot.hasContent,
        );

        updateHistoryButtons();

        onMaskChange(
          snapshot.hasContent
            ? snapshot.blob
            : null,
        );
      },
      [
        context,
        onMaskChange,
        updateHistoryButtons,
      ],
    );

  const undo =
    useCallback(
      () => {
        if (
          historyIndexRef.current >
          0
        ) {
          void restore(
            historyIndexRef.current -
              1,
          );
        }
      },
      [
        restore,
      ],
    );

  const redo =
    useCallback(
      () => {
        if (
          historyIndexRef.current <
          historyRef.current
            .length -
            1
        ) {
          void restore(
            historyIndexRef.current +
              1,
          );
        }
      },
      [
        restore,
      ],
    );

  const fitDisplay =
    useCallback(
      () => {
        const host =
          hostRef.current;

        if (
          !host ||
          !natural.w ||
          !natural.h
        ) {
          return;
        }

        const maxWidth =
          Math.min(
            900,

            Math.max(
              220,
              host.clientWidth,
            ),
          );

        const maxHeight =
          Math.max(
            260,

            Math.min(
              window.innerHeight *
                0.64,

              680,
            ),
          );

        const scale =
          Math.min(
            maxWidth /
              natural.w,

            maxHeight /
              natural.h,

            1,
          );

        setDisplay({
          w: Math.max(
            1,

            Math.round(
              natural.w *
                scale,
            ),
          ),

          h: Math.max(
            1,

            Math.round(
              natural.h *
                scale,
            ),
          ),
        });
      },
      [
        natural,
      ],
    );

  useEffect(() => {
    fitDisplay();

    const host =
      hostRef.current;

    if (
      !host ||
      typeof ResizeObserver ===
        "undefined"
    ) {
      return;
    }

    const observer =
      new ResizeObserver(
        fitDisplay,
      );

    observer.observe(
      host,
    );

    window.addEventListener(
      "resize",
      fitDisplay,
    );

    return () => {
      observer.disconnect();

      window.removeEventListener(
        "resize",
        fitDisplay,
      );
    };
  }, [
    fitDisplay,
  ]);

  const initialise =
    useCallback(
      (
        width: number,
        height: number,
        mediaDuration =
          0,
      ) => {
        if (
          readyRef.current ||
          width <= 0 ||
          height <= 0
        ) {
          return;
        }

        const canvas =
          canvasRef.current;

        if (!canvas) {
          setStatus(
            "error",
          );

          setError(
            "The editor canvas could not be created.",
          );

          return;
        }

        const size =
          maskSize(
            width,
            height,
          );

        canvas.width =
          size.w;

        canvas.height =
          size.h;

        readyRef.current =
          true;

        setNatural({
          w: width,
          h: height,
        });

        setStatus(
          "ready",
        );

        setError(
          null,
        );

        setZoom(
          1,
        );

        if (
          isVideo &&
          mediaDuration >
            0
        ) {
          const initial =
            normalizedRange(
              initialMaskTimeRange,

              mediaDuration,
            ) ?? {
              startTime:
                0,

              endTime:
                mediaDuration,
            };

          setDuration(
            mediaDuration,
          );

          setRangeStart(
            initial.startTime,
          );

          setRangeEnd(
            initial.endTime,
          );
        }

        clearToBlank();
      },
      [
        clearToBlank,
        initialMaskTimeRange,
        isVideo,
      ],
    );

  const inspectMedia =
    useCallback(
      () => {
        if (isVideo) {
          const video =
            videoRef.current;

          if (
            video &&
            video.readyState >=
              1 &&
            video.videoWidth &&
            video.videoHeight
          ) {
            initialise(
              video.videoWidth,
              video.videoHeight,

              Number.isFinite(
                video.duration,
              )
                ? video.duration
                : 0,
            );
          }

          return;
        }

        const image =
          imageRef.current;

        if (
          image?.complete &&
          image.naturalWidth &&
          image.naturalHeight
        ) {
          initialise(
            image.naturalWidth,
            image.naturalHeight,
          );
        }
      },
      [
        initialise,
        isVideo,
      ],
    );

  useEffect(() => {
    mountedRef.current =
      true;

    return () => {
      mountedRef.current =
        false;

      snapshotTokenRef.current +=
        1;
    };
  }, []);

  useEffect(() => {
    const attempt =
      ++attemptRef.current;

    readyRef.current =
      false;

    setStatus(
      "loading",
    );

    setError(
      null,
    );

    setNatural({
      w: 0,
      h: 0,
    });

    setDisplay({
      w: 0,
      h: 0,
    });

    setPlaying(
      false,
    );

    setCurrentTime(
      0,
    );

    setDuration(
      0,
    );

    setRangeStart(
      0,
    );

    setRangeEnd(
      0,
    );

    setTool(
      "brush",
    );

    setZoom(
      1,
    );

    historyRef.current =
      [];

    historyIndexRef.current =
      -1;

    setHasMask(
      false,
    );

    setCanUndo(
      false,
    );

    setCanRedo(
      false,
    );

    onMaskChange(
      null,
    );

    onMaskTimeRangeChange?.(
      null,
    );

    const frame =
      requestAnimationFrame(
        inspectMedia,
      );

    const retry =
      window.setTimeout(
        inspectMedia,
        250,
      );

    const timeout =
      window.setTimeout(
        () => {
          if (
            attempt ===
              attemptRef.current &&
            !readyRef.current
          ) {
            setStatus(
              "error",
            );

            setError(
              isVideo
                ? "The video editor could not read this file. Try MP4 or WEBM in Chrome or Edge."
                : "The image editor could not open this file. Try JPG, PNG, or WEBP.",
            );
          }
        },

        LOAD_TIMEOUT,
      );

    return () => {
      cancelAnimationFrame(
        frame,
      );

      clearTimeout(
        retry,
      );

      clearTimeout(
        timeout,
      );
    };
  }, [
    imageUrl,
    inspectMedia,
    isVideo,
    onMaskChange,
    onMaskTimeRangeChange,
    reloadKey,
    videoUrl,
  ]);

  useEffect(() => {
    if (
      isVideo &&
      range
    ) {
      onMaskTimeRangeChange?.(
        range,
      );
    }
  }, [
    isVideo,
    onMaskTimeRangeChange,
    range,
  ]);

  const pointFromEvent =
    useCallback(
      (
        clientX: number,
        clientY: number,
      ): Point | null => {
        const canvas =
          canvasRef.current;

        if (!canvas) {
          return null;
        }

        const rect =
          canvas.getBoundingClientRect();

        if (
          !rect.width ||
          !rect.height
        ) {
          return null;
        }

        return {
          x: clamp(
            (
              clientX -
              rect.left
            ) *
              canvas.width /
              rect.width,

            0,

            canvas.width -
              0.001,
          ),

          y: clamp(
            (
              clientY -
              rect.top
            ) *
              canvas.height /
              rect.height,

            0,

            canvas.height -
              0.001,
          ),
        };
      },
      [],
    );

  const internalBrushSize =
    useCallback(
      () => {
        const canvas =
          canvasRef.current;

        if (!canvas) {
          return effectiveSize;
        }

        const rect =
          canvas.getBoundingClientRect();

        if (
          !rect.width ||
          !rect.height
        ) {
          return effectiveSize;
        }

        return (
          effectiveSize *
          (
            canvas.width /
              rect.width +
            canvas.height /
              rect.height
          ) /
          2
        );
      },
      [
        effectiveSize,
      ],
    );

  const stamp =
    useCallback(
      (
        point: Point,
      ) => {
        const item =
          context();

        if (!item) {
          return;
        }

        const radius =
          internalBrushSize() /
          2;

        const erase =
          tool ===
          "erase";

        const edge =
          tool ===
          "precision"
            ? 1
            : clamp(
                hardness /
                  100,

                0.1,
                1,
              );

        item.ctx.save();

        item.ctx.globalCompositeOperation =
          erase
            ? "destination-out"
            : "source-over";

        if (
          edge >=
          0.995
        ) {
          item.ctx.fillStyle =
            erase
              ? "rgba(0,0,0,1)"
              : `rgba(${MASK_RGB},1)`;
        } else {
          const gradient =
            item.ctx.createRadialGradient(
              point.x,
              point.y,
              radius *
                edge,
              point.x,
              point.y,
              radius,
            );

          if (erase) {
            gradient.addColorStop(
              0,
              "rgba(0,0,0,1)",
            );

            gradient.addColorStop(
              edge,
              "rgba(0,0,0,1)",
            );

            gradient.addColorStop(
              1,
              "rgba(0,0,0,0)",
            );
          } else {
            gradient.addColorStop(
              0,
              `rgba(${MASK_RGB},1)`,
            );

            gradient.addColorStop(
              edge,
              `rgba(${MASK_RGB},1)`,
            );

            gradient.addColorStop(
              1,
              `rgba(${MASK_RGB},0)`,
            );
          }

          item.ctx.fillStyle =
            gradient;
        }

        item.ctx.beginPath();

        item.ctx.arc(
          point.x,
          point.y,
          radius,
          0,
          Math.PI * 2,
        );

        item.ctx.fill();

        item.ctx.restore();
      },
      [
        context,
        hardness,
        internalBrushSize,
        tool,
      ],
    );

  const segment =
    useCallback(
      (
        from: Point,
        to: Point,
      ) => {
        const size =
          internalBrushSize();

        const distance =
          Math.hypot(
            to.x -
              from.x,

            to.y -
              from.y,
          );

        const steps =
          Math.max(
            1,

            Math.ceil(
              distance /
                Math.max(
                  0.7,

                  size *
                    0.14,
                ),
            ),
          );

        for (
          let index = 1;
          index <= steps;
          index += 1
        ) {
          const ratio =
            index /
            steps;

          stamp({
            x:
              from.x +
              (
                to.x -
                from.x
              ) *
                ratio,

            y:
              from.y +
              (
                to.y -
                from.y
              ) *
                ratio,
          });
        }
      },
      [
        internalBrushSize,
        stamp,
      ],
    );

  const circlePreview =
    useCallback(
      (
        end: Point,
      ) => {
        const item =
          context();

        const start =
          circleStartRef.current;

        const base =
          circleBaseRef.current;

        if (
          !item ||
          !start ||
          !base
        ) {
          return;
        }

        item.ctx.putImageData(
          base,
          0,
          0,
        );

        const centerX =
          (
            start.x +
            end.x
          ) /
          2;

        const centerY =
          (
            start.y +
            end.y
          ) /
          2;

        item.ctx.save();

        item.ctx.globalCompositeOperation =
          "source-over";

        item.ctx.fillStyle =
          `rgba(${MASK_RGB},1)`;

        item.ctx.beginPath();

        item.ctx.ellipse(
          centerX,
          centerY,

          Math.max(
            1,

            Math.abs(
              end.x -
                start.x,
            ) /
              2,
          ),

          Math.max(
            1,

            Math.abs(
              end.y -
                start.y,
            ) /
              2,
          ),

          0,
          0,
          Math.PI * 2,
        );

        item.ctx.fill();

        item.ctx.restore();
      },
      [
        context,
      ],
    );

  const updateCursor =
    useCallback(
      (
        event:
          ReactPointerEvent<HTMLCanvasElement>,
      ) => {
        if (
          event.pointerType ===
            "touch" ||
          tool ===
            "pan"
        ) {
          setCursor(
            (
              current,
            ) => ({
              ...current,
              visible:
                false,
            }),
          );

          return;
        }

        const rect =
          event.currentTarget.getBoundingClientRect();

        setCursor({
          visible:
            true,

          x: clamp(
            event.clientX -
              rect.left,

            0,
            rect.width,
          ),

          y: clamp(
            event.clientY -
              rect.top,

            0,
            rect.height,
          ),
        });
      },
      [
        tool,
      ],
    );

  const beginStroke =
    useCallback(
      (
        event:
          ReactPointerEvent<HTMLCanvasElement>,
      ) => {
        updateCursor(
          event,
        );

        if (
          tool ===
            "pan" ||
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

        videoRef.current?.pause();

        const point =
          pointFromEvent(
            event.clientX,
            event.clientY,
          );

        if (!point) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        event.currentTarget.setPointerCapture(
          event.pointerId,
        );

        pointerRef.current =
          event.pointerId;

        drawingRef.current =
          true;

        lastRef.current =
          point;

        if (
          tool ===
          "circle"
        ) {
          const item =
            context();

          if (!item) {
            return;
          }

          circleStartRef.current =
            point;

          circleBaseRef.current =
            item.ctx.getImageData(
              0,
              0,
              item.canvas.width,
              item.canvas.height,
            );

          circlePreview(
            point,
          );
        } else {
          stamp(
            point,
          );
        }
      },
      [
        circlePreview,
        context,
        pointFromEvent,
        stamp,
        status,
        tool,
        updateCursor,
      ],
    );

  const moveStroke =
    useCallback(
      (
        event:
          ReactPointerEvent<HTMLCanvasElement>,
      ) => {
        updateCursor(
          event,
        );

        if (
          !drawingRef.current ||
          pointerRef.current !==
            event.pointerId ||
          tool ===
            "pan"
        ) {
          return;
        }

        event.preventDefault();

        const next =
          pointFromEvent(
            event.clientX,
            event.clientY,
          );

        if (!next) {
          return;
        }

        if (
          tool ===
          "circle"
        ) {
          circlePreview(
            next,
          );
        } else if (
          lastRef.current
        ) {
          segment(
            lastRef.current,
            next,
          );
        }

        lastRef.current =
          next;
      },
      [
        circlePreview,
        pointFromEvent,
        segment,
        tool,
        updateCursor,
      ],
    );

  const endStroke =
    useCallback(
      (
        event?:
          ReactPointerEvent<HTMLCanvasElement>,
      ) => {
        if (
          !drawingRef.current ||
          (
            event &&
            pointerRef.current !==
              event.pointerId
          )
        ) {
          return;
        }

        if (
          event?.currentTarget.hasPointerCapture(
            event.pointerId,
          )
        ) {
          event.currentTarget.releasePointerCapture(
            event.pointerId,
          );
        }

        pointerRef.current =
          null;

        drawingRef.current =
          false;

        lastRef.current =
          null;

        circleStartRef.current =
          null;

        circleBaseRef.current =
          null;

        void saveSnapshot();
      },
      [
        saveSnapshot,
      ],
    );

  const chooseTool =
    useCallback(
      (
        next: Tool,
      ) => {
        setTool(
          next,
        );

        if (
          next ===
            "pan" &&
          zoom <= 1
        ) {
          setZoom(
            1.5,
          );
        }
      },
      [
        zoom,
      ],
    );

  const adjustZoom =
    useCallback(
      (
        value: number,
      ) => {
        setZoom(
          clamp(
            Math.round(
              value *
                100,
            ) /
              100,

            1,
            4,
          ),
        );
      },
      [],
    );

  const wheel =
    useCallback(
      (
        event:
          ReactWheelEvent<HTMLDivElement>,
      ) => {
        if (
          !event.ctrlKey &&
          !event.metaKey
        ) {
          return;
        }

        event.preventDefault();

        adjustZoom(
          zoom +
            (
              event.deltaY <
              0
                ? 0.25
                : -0.25
            ),
        );
      },
      [
        adjustZoom,
        zoom,
      ],
    );

  const beginPan =
    useCallback(
      (
        event:
          ReactPointerEvent<HTMLDivElement>,
      ) => {
        if (
          tool !==
            "pan" ||
          event.button !==
            0
        ) {
          return;
        }

        const viewport =
          viewportRef.current;

        if (
          !viewport ||
          (
            event.target as HTMLElement
          ).closest(
            "button,input",
          )
        ) {
          return;
        }

        event.preventDefault();

        event.currentTarget.setPointerCapture(
          event.pointerId,
        );

        panRef.current = {
          id:
            event.pointerId,

          x:
            event.clientX,

          y:
            event.clientY,

          left:
            viewport.scrollLeft,

          top:
            viewport.scrollTop,
        };

        setPanning(
          true,
        );
      },
      [
        tool,
      ],
    );

  const movePan =
    useCallback(
      (
        event:
          ReactPointerEvent<HTMLDivElement>,
      ) => {
        const viewport =
          viewportRef.current;

        const pan =
          panRef.current;

        if (
          !viewport ||
          !pan ||
          pan.id !==
            event.pointerId
        ) {
          return;
        }

        event.preventDefault();

        viewport.scrollLeft =
          pan.left -
          (
            event.clientX -
            pan.x
          );

        viewport.scrollTop =
          pan.top -
          (
            event.clientY -
            pan.y
          );
      },
      [],
    );

  const endPan =
    useCallback(
      (
        event:
          ReactPointerEvent<HTMLDivElement>,
      ) => {
        if (
          !panRef.current ||
          panRef.current.id !==
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

        panRef.current =
          null;

        setPanning(
          false,
        );
      },
      [],
    );

  const togglePlay =
    useCallback(
      async () => {
        const video =
          videoRef.current;

        if (!video) {
          return;
        }

        if (
          video.paused
        ) {
          try {
            await video.play();
          } catch (
            playError
          ) {
            if (
              process.env
                .NODE_ENV !==
              "production"
            ) {
              console.error(
                playError,
              );
            }
          }
        } else {
          video.pause();
        }
      },
      [],
    );

  const seek =
    useCallback(
      (
        value: number,
      ) => {
        const video =
          videoRef.current;

        if (
          !video ||
          !Number.isFinite(
            video.duration,
          ) ||
          video.duration <=
            0
        ) {
          return;
        }

        const next =
          clamp(
            value,
            0,
            video.duration,
          );

        video.currentTime =
          next;

        setCurrentTime(
          next,
        );
      },
      [],
    );

  const setStartHere =
    useCallback(
      () => {
        setRangeStart(
          clamp(
            currentTime,
            0,

            Math.max(
              0,

              rangeEnd -
                MIN_RANGE,
            ),
          ),
        );
      },
      [
        currentTime,
        rangeEnd,
      ],
    );

  const setEndHere =
    useCallback(
      () => {
        setRangeEnd(
          clamp(
            currentTime,

            Math.min(
              duration,

              rangeStart +
                MIN_RANGE,
            ),

            duration,
          ),
        );
      },
      [
        currentTime,
        duration,
        rangeStart,
      ],
    );

  useEffect(() => {
    const listener =
      (
        event:
          KeyboardEvent,
      ) => {
        const target =
          event.target;

        if (
          target instanceof
            HTMLElement &&
          (
            target.matches(
              "input,textarea,select",
            ) ||
            target.isContentEditable
          )
        ) {
          return;
        }

        const key =
          event.key.toLowerCase();

        if (
          (
            event.ctrlKey ||
            event.metaKey
          ) &&
          key ===
            "z"
        ) {
          event.preventDefault();

          if (
            event.shiftKey
          ) {
            redo();
          } else {
            undo();
          }
        } else if (
          (
            event.ctrlKey ||
            event.metaKey
          ) &&
          key ===
            "y"
        ) {
          event.preventDefault();

          redo();
        } else if (
          key ===
          "b"
        ) {
          chooseTool(
            "brush",
          );
        } else if (
          key ===
          "p"
        ) {
          chooseTool(
            "precision",
          );
        } else if (
          key ===
          "c"
        ) {
          chooseTool(
            "circle",
          );
        } else if (
          key ===
          "e"
        ) {
          chooseTool(
            "erase",
          );
        } else if (
          key ===
          "h"
        ) {
          chooseTool(
            "pan",
          );
        } else if (
          event.key ===
          "["
        ) {
          setBrushSize(
            (
              value,
            ) =>
              clamp(
                value -
                  4,

                4,
                140,
              ),
          );
        } else if (
          event.key ===
          "]"
        ) {
          setBrushSize(
            (
              value,
            ) =>
              clamp(
                value +
                  4,

                4,
                140,
              ),
          );
        } else if (
          event.key ===
            "+" ||
          event.key ===
            "="
        ) {
          adjustZoom(
            zoom +
              0.25,
          );
        } else if (
          event.key ===
          "-"
        ) {
          adjustZoom(
            zoom -
              0.25,
          );
        } else if (
          event.key ===
          "0"
        ) {
          adjustZoom(
            1,
          );
        } else if (
          event.key ===
            " " &&
          isVideo
        ) {
          event.preventDefault();

          void togglePlay();
        }
      };

    window.addEventListener(
      "keydown",
      listener,
    );

    return () =>
      window.removeEventListener(
        "keydown",
        listener,
      );
  }, [
    adjustZoom,
    chooseTool,
    isVideo,
    redo,
    togglePlay,
    undo,
    zoom,
  ]);

  const help =
    TOOLS.find(
      (
        item,
      ) =>
        item.id ===
        tool,
    )?.help ??
    "";

  return (
    <div className="w-full">
      <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {TOOLS.map(
            (
              item,
            ) => (
              <button
                key={
                  item.id
                }
                type="button"
                aria-pressed={
                  tool ===
                  item.id
                }
                title={
                  item.help
                }
                onClick={() =>
                  chooseTool(
                    item.id,
                  )
                }
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${
                  tool ===
                  item.id
                    ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-indigo-200"
                }`}
              >
                <ToolIcon
                  tool={
                    item.id
                  }
                />

                {
                  item.label
                }
              </button>
            ),
          )}
        </div>

        <p className="mt-3 text-xs text-gray-500">
          {help}
        </p>

        <div className="mt-4 grid gap-4 border-t border-gray-100 pt-4 md:grid-cols-3">
          <label className="block">
            <span className="mb-2 flex justify-between text-sm font-medium text-gray-600">
              <span>
                Brush size
              </span>

              <b className="text-xs text-indigo-600">
                {
                  effectiveSize
                }
                px
              </b>
            </span>

            <input
              type="range"
              min={4}
              max={140}
              value={
                brushSize
              }
              disabled={
                tool ===
                  "circle" ||
                tool ===
                  "pan"
              }
              onChange={(
                event,
              ) =>
                setBrushSize(
                  Number(
                    event
                      .target
                      .value,
                  ),
                )
              }
              className="w-full disabled:opacity-40"
            />
          </label>

          <label className="block">
            <span className="mb-2 flex justify-between text-sm font-medium text-gray-600">
              <span>
                Selection edge
              </span>

              <b className="text-xs text-indigo-600">
                {tool ===
                  "precision" ||
                tool ===
                  "circle"
                  ? 100
                  : hardness}
                %
              </b>
            </span>

            <input
              type="range"
              min={20}
              max={100}
              value={
                hardness
              }
              disabled={
                tool ===
                  "precision" ||
                tool ===
                  "circle" ||
                tool ===
                  "pan"
              }
              onChange={(
                event,
              ) =>
                setHardness(
                  Number(
                    event
                      .target
                      .value,
                  ),
                )
              }
              className="w-full disabled:opacity-40"
            />
          </label>

          <label className="block">
            <span className="mb-2 flex justify-between text-sm font-medium text-gray-600">
              <span>
                Selection overlay visibility
              </span>

              <b className="text-xs text-indigo-600">
                {
                  overlayOpacity
                }
                %
              </b>
            </span>

            <input
              type="range"
              min={15}
              max={85}
              value={
                overlayOpacity
              }
              onChange={(
                event,
              ) =>
                setOverlayOpacity(
                  Number(
                    event
                      .target
                      .value,
                  ),
                )
              }
              className="w-full"
            />

            <small className="mt-1 block text-[11px] leading-4 text-gray-400">
              This changes only the purple editor overlay—not removal strength or output quality.
            </small>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={
                undo
              }
              disabled={
                !canUndo
              }
              className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
            >
              Undo
            </button>

            <button
              type="button"
              onClick={
                redo
              }
              disabled={
                !canRedo
              }
              className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
            >
              Redo
            </button>

            <button
              type="button"
              onClick={
                clearToBlank
              }
              disabled={
                !hasMask
              }
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600 disabled:opacity-40"
            >
              Clear
            </button>
          </div>

          <div className="flex items-center gap-1 rounded-xl bg-gray-100 p-1">
            <button
              type="button"
              onClick={() =>
                adjustZoom(
                  zoom -
                    0.25,
                )
              }
              disabled={
                zoom <=
                1
              }
              className="h-8 w-8 rounded-lg bg-white disabled:opacity-40"
            >
              −
            </button>

            <button
              type="button"
              onClick={() =>
                adjustZoom(
                  1,
                )
              }
              className="h-8 min-w-16 rounded-lg px-2 text-xs font-semibold"
            >
              {Math.round(
                zoom *
                  100,
              )}
              %
            </button>

            <button
              type="button"
              onClick={() =>
                adjustZoom(
                  zoom +
                    0.25,
                )
              }
              disabled={
                zoom >=
                4
              }
              className="h-8 w-8 rounded-lg bg-white disabled:opacity-40"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div
        ref={
          hostRef
        }
        className="mx-auto w-full max-w-[900px]"
      >
        {status ===
          "loading" && (
          <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-2xl border bg-white">
            <div className="spinner" />

            <p className="text-sm text-gray-600">
              Preparing the editor…
            </p>
          </div>
        )}

        {status ===
          "error" && (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-rose-200 bg-white p-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 font-bold text-rose-600">
              !
            </div>

            <h4 className="mt-4 font-bold">
              Editor could not open the file
            </h4>

            <p className="mt-2 max-w-md text-sm text-gray-500">
              {error}
            </p>

            <button
              type="button"
              onClick={() =>
                setReloadKey(
                  (
                    value,
                  ) =>
                    value +
                    1,
                )
              }
              className="mt-5 rounded-xl bg-gray-950 px-5 py-2.5 text-sm font-semibold text-white"
            >
              Try again
            </button>
          </div>
        )}

        <div
          ref={
            viewportRef
          }
          className={`relative overflow-auto bg-transparent ${
            tool ===
            "pan"
              ? panning
                ? "cursor-grabbing"
                : "cursor-grab"
              : ""
          }`}
          style={{
            display:
              ready
                ? "block"
                : "none",

            maxHeight:
              "70vh",

            overscrollBehavior:
              "contain",

            touchAction:
              tool ===
              "pan"
                ? "none"
                : "auto",
          }}
          onWheel={
            wheel
          }
          onPointerDown={
            beginPan
          }
          onPointerMove={
            movePan
          }
          onPointerUp={
            endPan
          }
          onPointerCancel={
            endPan
          }
        >
          <div
            className="flex items-start justify-center"
            style={{
              minWidth:
                "100%",

              width:
                "max-content",

              minHeight:
                stage.h,
            }}
          >
            <div
              className="relative isolate overflow-hidden rounded-xl shadow-lg ring-1 ring-black/10"
              style={{
                width:
                  stage.w,

                height:
                  stage.h,

                flex:
                  "0 0 auto",
              }}
            >
              {isVideo ? (
                <video
                  key={`video-${reloadKey}`}
                  ref={
                    videoRef
                  }
                  src={
                    videoUrl
                  }
                  muted
                  playsInline
                  preload="metadata"
                  draggable={
                    false
                  }
                  className="pointer-events-none absolute inset-0 block h-full w-full select-none object-fill"
                  onLoadedMetadata={(
                    event,
                  ) =>
                    initialise(
                      event
                        .currentTarget
                        .videoWidth,

                      event
                        .currentTarget
                        .videoHeight,

                      event
                        .currentTarget
                        .duration,
                    )
                  }
                  onCanPlay={
                    inspectMedia
                  }
                  onError={() => {
                    setStatus(
                      "error",
                    );

                    setError(
                      "The video could not be opened. Try MP4 or WEBM in Chrome or Edge.",
                    );
                  }}
                  onPlay={() =>
                    setPlaying(
                      true,
                    )
                  }
                  onPause={() =>
                    setPlaying(
                      false,
                    )
                  }
                  onEnded={() =>
                    setPlaying(
                      false,
                    )
                  }
                  onTimeUpdate={(
                    event,
                  ) =>
                    setCurrentTime(
                      event
                        .currentTarget
                        .currentTime,
                    )
                  }
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={`image-${reloadKey}`}
                  ref={
                    imageRef
                  }
                  src={
                    imageUrl
                  }
                  alt="Media being marked"
                  draggable={
                    false
                  }
                  className="pointer-events-none absolute inset-0 block h-full w-full select-none object-fill"
                  onLoad={(
                    event,
                  ) =>
                    initialise(
                      event
                        .currentTarget
                        .naturalWidth,

                      event
                        .currentTarget
                        .naturalHeight,
                    )
                  }
                  onError={() => {
                    setStatus(
                      "error",
                    );

                    setError(
                      "The image could not be opened. Try JPG, PNG, or WEBP.",
                    );
                  }}
                />
              )}

              <canvas
                ref={
                  canvasRef
                }
                className={`absolute inset-0 z-10 block h-full w-full select-none ${
                  tool ===
                  "pan"
                    ? "cursor-grab"
                    : "cursor-none"
                }`}
                style={{
                  opacity:
                    overlayOpacity /
                    100,

                  pointerEvents:
                    tool ===
                    "pan"
                      ? "none"
                      : "auto",

                  touchAction:
                    "none",
                }}
                onPointerDown={
                  beginStroke
                }
                onPointerMove={
                  moveStroke
                }
                onPointerUp={
                  endStroke
                }
                onPointerCancel={
                  endStroke
                }
                onPointerEnter={
                  updateCursor
                }
                onPointerLeave={() =>
                  setCursor(
                    (
                      current,
                    ) => ({
                      ...current,

                      visible:
                        false,
                    }),
                  )
                }
                onContextMenu={(
                  event,
                ) =>
                  event.preventDefault()
                }
              />

              {cursor.visible &&
                tool !==
                  "pan" &&
                tool !==
                  "circle" && (
                  <div
                    className="pointer-events-none absolute z-20 rounded-full border-2 border-white"
                    style={{
                      left:
                        cursor.x,

                      top:
                        cursor.y,

                      width:
                        effectiveSize,

                      height:
                        effectiveSize,

                      transform:
                        "translate(-50%, -50%)",

                      background:
                        tool ===
                        "erase"
                          ? "rgba(239,68,68,.16)"
                          : `rgba(${MASK_RGB},.20)`,

                      boxShadow:
                        tool ===
                        "erase"
                          ? "0 0 0 1px rgba(239,68,68,.98)"
                          : `0 0 0 1px rgba(${MASK_RGB},.98)`,
                    }}
                  />
                )}
            </div>
          </div>
        </div>

        {isVideo &&
          ready && (
          <div className="mt-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  void togglePlay()
                }
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-950 text-white"
                aria-label={
                  playing
                    ? "Pause video"
                    : "Play video"
                }
              >
                <PlayIcon
                  playing={
                    playing
                  }
                />
              </button>

              <span className="w-16 text-right text-xs font-semibold tabular-nums text-gray-500">
                {timeLabel(
                  currentTime,
                )}
              </span>

              <input
                type="range"
                min={0}
                max={Math.max(
                  duration,
                  0.01,
                )}
                step={0.01}
                value={Math.min(
                  currentTime,

                  Math.max(
                    duration,
                    0.01,
                  ),
                )}
                onChange={(
                  event,
                ) =>
                  seek(
                    Number(
                      event
                        .target
                        .value,
                    ),
                  )
                }
                className="min-w-0 flex-1"
                aria-label="Video position"
              />

              <span className="w-16 text-xs font-semibold tabular-nums text-gray-500">
                {timeLabel(
                  duration,
                )}
              </span>
            </div>

            <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    Apply this selection only during a time range
                  </p>

                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    Pause where the mark appears, set the start and end, then paint over it. The next worker update will leave every frame outside this interval untouched.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setRangeStart(
                      0,
                    );

                    setRangeEnd(
                      duration,
                    );
                  }}
                  className="shrink-0 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-700"
                >
                  Use whole video
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <small className="font-bold uppercase tracking-wide text-gray-400">
                        Start
                      </small>

                      <p className="font-bold tabular-nums">
                        {timeLabel(
                          rangeStart,
                        )}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={
                        setStartHere
                      }
                      className="rounded-lg bg-gray-950 px-3 py-2 text-xs font-semibold text-white"
                    >
                      Set start here
                    </button>
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={Math.max(
                      0,

                      rangeEnd -
                        MIN_RANGE,
                    )}
                    step={0.01}
                    value={Math.min(
                      rangeStart,

                      Math.max(
                        0,

                        rangeEnd -
                          MIN_RANGE,
                      ),
                    )}
                    onChange={(
                      event,
                    ) => {
                      const value =
                        Number(
                          event
                            .target
                            .value,
                        );

                      setRangeStart(
                        value,
                      );

                      seek(
                        value,
                      );
                    }}
                    className="mt-3 w-full"
                    aria-label="Mask start time"
                  />
                </div>

                <div className="rounded-xl border bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <small className="font-bold uppercase tracking-wide text-gray-400">
                        End
                      </small>

                      <p className="font-bold tabular-nums">
                        {timeLabel(
                          rangeEnd,
                        )}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={
                        setEndHere
                      }
                      className="rounded-lg bg-gray-950 px-3 py-2 text-xs font-semibold text-white"
                    >
                      Set end here
                    </button>
                  </div>

                  <input
                    type="range"
                    min={Math.min(
                      duration,

                      rangeStart +
                        MIN_RANGE,
                    )}
                    max={Math.max(
                      duration,
                      MIN_RANGE,
                    )}
                    step={0.01}
                    value={Math.max(
                      rangeEnd,

                      Math.min(
                        duration,

                        rangeStart +
                          MIN_RANGE,
                      ),
                    )}
                    onChange={(
                      event,
                    ) => {
                      const value =
                        Number(
                          event
                            .target
                            .value,
                        );

                      setRangeEnd(
                        value,
                      );

                      seek(
                        value,
                      );
                    }}
                    className="mt-3 w-full"
                    aria-label="Mask end time"
                  />
                </div>
              </div>

              <p className="mt-3 text-xs font-semibold text-indigo-800">
                Active interval:{" "}
                {timeLabel(
                  rangeStart,
                )}{" "}
                –{" "}
                {timeLabel(
                  rangeEnd,
                )}
              </p>
            </div>
          </div>
        )}

        {ready && (
          <div className="mt-3 flex flex-col gap-2 rounded-xl border bg-white px-4 py-3 text-sm text-gray-500 sm:flex-row sm:justify-between">
            <span>
              {tool ===
              "pan"
                ? "Pan automatically zooms to 150%. Drag the media to move around."
                : tool ===
                    "erase"
                  ? "Erase visibly removes purple selection pixels."
                  : tool ===
                      "circle"
                    ? "Drag from one corner to the opposite corner to create an ellipse."
                    : isVideo
                      ? "Clicking the video with a drawing tool pauses it automatically before painting."
                      : "Paint directly over only the unwanted logo, text, watermark, or object."}
            </span>

            <span className="shrink-0 text-xs text-gray-400">
              {natural.w.toLocaleString()}{" "}
              ×{" "}
              {natural.h.toLocaleString()}

              {isVideo &&
              duration
                ? ` · ${timeLabel(
                    duration,
                  )}`
                : ""}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}