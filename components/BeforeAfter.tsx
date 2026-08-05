"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icons";
import {
  TOOL_PAGE_COPY,
  type ToolMode,
} from "@/lib/constants";

type Example = {
  label: string;
  description: string;
  beforeImg: string;
  afterImg: string;
  beforeAlt: string;
  afterAlt: string;
  illustrative?: boolean;
};

interface BeforeAfterProps {
  mode?: ToolMode;
}

interface ComparisonSliderProps {
  example: Example;
  autoPlay?: boolean;
}

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    svg.trim(),
  )}`;
}

const transparentProductAfter = svgDataUrl(`
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
    <defs>
      <linearGradient id="bottle" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffffff"/>
        <stop offset="0.45" stop-color="#e0e7ff"/>
        <stop offset="1" stop-color="#c4b5fd"/>
      </linearGradient>
      <linearGradient id="label" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#6366f1"/>
        <stop offset="1" stop-color="#ec4899"/>
      </linearGradient>
      <filter id="shadow" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="24" stdDeviation="24" flood-color="#312e81" flood-opacity=".25"/>
      </filter>
    </defs>

    <g filter="url(#shadow)">
      <rect x="490" y="125" width="220" height="92" rx="30" fill="#312e81"/>
      <rect x="455" y="195" width="290" height="490" rx="95" fill="url(#bottle)" stroke="#a5b4fc" stroke-width="8"/>
      <rect x="490" y="345" width="220" height="190" rx="35" fill="url(#label)"/>
      <circle cx="600" cy="415" r="42" fill="#ffffff" fill-opacity=".92"/>
      <path d="M576 417l18 18 34-42" fill="none" stroke="#6366f1" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="600" y="495" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="#ffffff">SHARPIXA</text>
      <path d="M510 260c45-42 137-48 182-9" fill="none" stroke="#ffffff" stroke-width="17" stroke-linecap="round" opacity=".7"/>
    </g>
  </svg>
`);

const transparentProductBefore = svgDataUrl(`
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
    <defs>
      <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#dbeafe"/>
        <stop offset=".5" stop-color="#ede9fe"/>
        <stop offset="1" stop-color="#fce7f3"/>
      </linearGradient>
      <linearGradient id="bottle" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffffff"/>
        <stop offset=".45" stop-color="#e0e7ff"/>
        <stop offset="1" stop-color="#c4b5fd"/>
      </linearGradient>
      <linearGradient id="label" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#6366f1"/>
        <stop offset="1" stop-color="#ec4899"/>
      </linearGradient>
      <filter id="shadow" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="24" stdDeviation="24" flood-color="#312e81" flood-opacity=".25"/>
      </filter>
    </defs>

    <rect width="1200" height="800" fill="url(#background)"/>
    <circle cx="170" cy="150" r="105" fill="#ffffff" opacity=".35"/>
    <circle cx="1050" cy="670" r="170" fill="#ffffff" opacity=".3"/>
    <path d="M0 625c225-94 410 66 640-20 208-78 342-38 560 58v137H0z" fill="#ffffff" opacity=".45"/>

    <g filter="url(#shadow)">
      <rect x="490" y="125" width="220" height="92" rx="30" fill="#312e81"/>
      <rect x="455" y="195" width="290" height="490" rx="95" fill="url(#bottle)" stroke="#a5b4fc" stroke-width="8"/>
      <rect x="490" y="345" width="220" height="190" rx="35" fill="url(#label)"/>
      <circle cx="600" cy="415" r="42" fill="#ffffff" fill-opacity=".92"/>
      <path d="M576 417l18 18 34-42" fill="none" stroke="#6366f1" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="600" y="495" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="#ffffff">SHARPIXA</text>
      <path d="M510 260c45-42 137-48 182-9" fill="none" stroke="#ffffff" stroke-width="17" stroke-linecap="round" opacity=".7"/>
    </g>
  </svg>
`);

const transparentPortraitAfter = svgDataUrl(`
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
    <defs>
      <linearGradient id="shirt" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#6366f1"/>
        <stop offset="1" stop-color="#9333ea"/>
      </linearGradient>
      <filter id="shadow" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="25" stdDeviation="25" flood-color="#111827" flood-opacity=".22"/>
      </filter>
    </defs>

    <g filter="url(#shadow)">
      <path d="M340 800c18-245 115-350 260-350s242 105 260 350z" fill="url(#shirt)"/>
      <ellipse cx="600" cy="335" rx="145" ry="180" fill="#9a5f3e"/>
      <path d="M448 325c5-167 70-245 165-245 105 0 166 86 151 255-35-62-84-99-163-105-67 0-115 30-153 95z" fill="#24170f"/>
      <path d="M475 300c24-123 83-183 167-183 62 0 111 31 145 94-64-34-134-45-205-22-49 16-84 53-107 111z" fill="#392318"/>
      <ellipse cx="548" cy="340" rx="13" ry="9" fill="#25160f"/>
      <ellipse cx="652" cy="340" rx="13" ry="9" fill="#25160f"/>
      <path d="M552 421c30 23 66 23 96 0" fill="none" stroke="#5b2c23" stroke-width="10" stroke-linecap="round"/>
      <path d="M587 348c-7 31-11 51-4 61 10 8 24 8 35 1" fill="none" stroke="#74432f" stroke-width="7" stroke-linecap="round"/>
      <path d="M485 309c29-20 61-24 92-8M625 301c32-13 64-8 89 13" fill="none" stroke="#2d1b12" stroke-width="11" stroke-linecap="round"/>
    </g>
  </svg>
`);

const transparentPortraitBefore = svgDataUrl(`
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
    <defs>
      <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#0f172a"/>
        <stop offset=".5" stop-color="#312e81"/>
        <stop offset="1" stop-color="#831843"/>
      </linearGradient>
      <linearGradient id="shirt" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#6366f1"/>
        <stop offset="1" stop-color="#9333ea"/>
      </linearGradient>
      <filter id="shadow" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="25" stdDeviation="25" flood-color="#000000" flood-opacity=".35"/>
      </filter>
    </defs>

    <rect width="1200" height="800" fill="url(#background)"/>
    <circle cx="220" cy="170" r="120" fill="#ec4899" opacity=".2"/>
    <circle cx="970" cy="200" r="185" fill="#6366f1" opacity=".25"/>
    <path d="M0 650c260-100 462 65 701-28 215-84 348-26 499 42v136H0z" fill="#ffffff" opacity=".08"/>

    <g filter="url(#shadow)">
      <path d="M340 800c18-245 115-350 260-350s242 105 260 350z" fill="url(#shirt)"/>
      <ellipse cx="600" cy="335" rx="145" ry="180" fill="#9a5f3e"/>
      <path d="M448 325c5-167 70-245 165-245 105 0 166 86 151 255-35-62-84-99-163-105-67 0-115 30-153 95z" fill="#24170f"/>
      <path d="M475 300c24-123 83-183 167-183 62 0 111 31 145 94-64-34-134-45-205-22-49 16-84 53-107 111z" fill="#392318"/>
      <ellipse cx="548" cy="340" rx="13" ry="9" fill="#25160f"/>
      <ellipse cx="652" cy="340" rx="13" ry="9" fill="#25160f"/>
      <path d="M552 421c30 23 66 23 96 0" fill="none" stroke="#5b2c23" stroke-width="10" stroke-linecap="round"/>
      <path d="M587 348c-7 31-11 51-4 61 10 8 24 8 35 1" fill="none" stroke="#74432f" stroke-width="7" stroke-linecap="round"/>
      <path d="M485 309c29-20 61-24 92-8M625 301c32-13 64-8 89 13" fill="none" stroke="#2d1b12" stroke-width="11" stroke-linecap="round"/>
    </g>
  </svg>
`);

const enhanceLandscapeBefore = svgDataUrl(`
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
    <defs>
      <filter id="soft">
        <feGaussianBlur stdDeviation="7"/>
      </filter>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#94a3b8"/>
        <stop offset="1" stop-color="#d1d5db"/>
      </linearGradient>
    </defs>

    <g filter="url(#soft)" opacity=".82">
      <rect width="1200" height="800" fill="url(#sky)"/>
      <circle cx="925" cy="170" r="85" fill="#f3e4b6"/>
      <path d="M0 545L220 315l160 155 190-250 215 272 155-190 260 245v253H0z" fill="#64748b"/>
      <path d="M0 590c220-70 388 44 575-12 245-72 408-22 625 76v146H0z" fill="#658170"/>
      <path d="M0 660c185-38 360 28 560-20 249-60 430-18 640 46v114H0z" fill="#829a88"/>
    </g>
  </svg>
`);

const enhanceLandscapeAfter = svgDataUrl(`
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#4f83c2"/>
        <stop offset=".58" stop-color="#a9d8f5"/>
        <stop offset="1" stop-color="#f8d6aa"/>
      </linearGradient>
      <linearGradient id="mountain" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#243b53"/>
        <stop offset="1" stop-color="#486581"/>
      </linearGradient>
    </defs>

    <rect width="1200" height="800" fill="url(#sky)"/>
    <circle cx="925" cy="170" r="85" fill="#ffd56a"/>
    <circle cx="925" cy="170" r="115" fill="#ffd56a" opacity=".18"/>

    <path d="M0 545L220 315l160 155 190-250 215 272 155-190 260 245v253H0z" fill="url(#mountain)"/>
    <path d="M178 360l42-45 55 53-48-20zM527 277l43-57 57 72-52-23zM896 355l44-53 55 52-54-18z" fill="#f8fafc" opacity=".88"/>

    <path d="M0 590c220-70 388 44 575-12 245-72 408-22 625 76v146H0z" fill="#2f6b4f"/>
    <path d="M0 660c185-38 360 28 560-20 249-60 430-18 640 46v114H0z" fill="#4f8a62"/>

    <path d="M85 704l52-128 44 128M1015 705l57-143 48 143M310 700l39-100 35 100" fill="#174c32"/>
  </svg>
`);

const enhancePortraitBefore = svgDataUrl(`
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
    <defs>
      <filter id="soft">
        <feGaussianBlur stdDeviation="5"/>
      </filter>
    </defs>

    <rect width="1200" height="800" fill="#d5d7dd"/>

    <g filter="url(#soft)" opacity=".78">
      <circle cx="600" cy="330" r="185" fill="#b58a72"/>
      <path d="M385 800c25-257 116-360 215-360 106 0 196 103 220 360z" fill="#6b7280"/>
      <path d="M420 320c0-190 79-280 190-280 107 0 180 92 170 268-54-71-113-105-185-104-69 2-127 40-175 116z" fill="#4b3a35"/>
      <ellipse cx="535" cy="335" rx="14" ry="10" fill="#4b3a35"/>
      <ellipse cx="662" cy="335" rx="14" ry="10" fill="#4b3a35"/>
      <path d="M550 426c32 20 69 20 101 0" fill="none" stroke="#885d54" stroke-width="10" stroke-linecap="round"/>
    </g>
  </svg>
`);

const enhancePortraitAfter = svgDataUrl(`
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
    <defs>
      <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#dbeafe"/>
        <stop offset="1" stop-color="#fce7f3"/>
      </linearGradient>
      <linearGradient id="shirt" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#4f46e5"/>
        <stop offset="1" stop-color="#9333ea"/>
      </linearGradient>
    </defs>

    <rect width="1200" height="800" fill="url(#background)"/>
    <circle cx="600" cy="330" r="185" fill="#b87855"/>
    <path d="M385 800c25-257 116-360 215-360 106 0 196 103 220 360z" fill="url(#shirt)"/>
    <path d="M420 320c0-190 79-280 190-280 107 0 180 92 170 268-54-71-113-105-185-104-69 2-127 40-175 116z" fill="#30201b"/>
    <ellipse cx="535" cy="335" rx="14" ry="10" fill="#2b1a16"/>
    <ellipse cx="662" cy="335" rx="14" ry="10" fill="#2b1a16"/>
    <path d="M550 426c32 20 69 20 101 0" fill="none" stroke="#743a36" stroke-width="10" stroke-linecap="round"/>
    <path d="M576 350c-7 34-9 54-1 65 10 8 25 8 37 1" fill="none" stroke="#8c513f" stroke-width="7" stroke-linecap="round"/>
    <path d="M483 300c33-18 66-20 98-7M625 294c35-11 70-5 98 16" fill="none" stroke="#38231d" stroke-width="11" stroke-linecap="round"/>
    <circle cx="540" cy="330" r="4" fill="#ffffff" opacity=".75"/>
    <circle cx="667" cy="330" r="4" fill="#ffffff" opacity=".75"/>
  </svg>
`);

const EXAMPLES_BY_MODE: Record<
  ToolMode,
  Example[]
> = {
  watermark: [
    {
      label: "Small Text Removal",
      description:
        "A compact text overlay removed from a repeatable natural background.",
      beforeImg:
        "/demo/before-nature.jpg",
      afterImg:
        "/demo/after-nature.jpg",
      beforeAlt:
        "Nature photograph before text removal",
      afterAlt:
        "Nature photograph after text removal",
    },
    {
      label: "City Overlay Cleanup",
      description:
        "Text removed from an urban image using nearby visible textures.",
      beforeImg:
        "/demo/before-city.jpg",
      afterImg:
        "/demo/after-city.jpg",
      beforeAlt:
        "City photograph before overlay removal",
      afterAlt:
        "City photograph after overlay removal",
    },
    {
      label: "Portrait Mark Removal",
      description:
        "A marked portrait area cleaned while retaining the surrounding image.",
      beforeImg:
        "/demo/before-portrait.jpg",
      afterImg:
        "/demo/after-portrait.jpg",
      beforeAlt:
        "Portrait before mark removal",
      afterAlt:
        "Portrait after mark removal",
    },
    {
      label: "Timestamp Cleanup",
      description:
        "A small timestamp removed from a relatively simple image area.",
      beforeImg:
        "/demo/before-coffee.jpg",
      afterImg:
        "/demo/after-coffee.jpg",
      beforeAlt:
        "Coffee photograph before timestamp removal",
      afterAlt:
        "Coffee photograph after timestamp removal",
    },
  ],

  background: [
    {
      label: "Product Cutout",
      description:
        "An illustrative product example showing the intended transparent-output workflow.",
      beforeImg:
        transparentProductBefore,
      afterImg:
        transparentProductAfter,
      beforeAlt:
        "Illustrative product on a colored background",
      afterAlt:
        "Illustrative product isolated on transparency",
      illustrative: true,
    },
    {
      label: "Portrait Cutout",
      description:
        "An illustrative portrait showing foreground isolation and transparent export.",
      beforeImg:
        transparentPortraitBefore,
      afterImg:
        transparentPortraitAfter,
      beforeAlt:
        "Illustrative portrait on a colored background",
      afterAlt:
        "Illustrative portrait isolated on transparency",
      illustrative: true,
    },
  ],

  enhance: [
    {
      label: "Landscape Cleanup",
      description:
        "An illustrative comparison of softer, flatter input and a clearer adjusted presentation.",
      beforeImg:
        enhanceLandscapeBefore,
      afterImg:
        enhanceLandscapeAfter,
      beforeAlt:
        "Illustrative soft and low-contrast landscape",
      afterAlt:
        "Illustrative clearer landscape with adjusted contrast and color",
      illustrative: true,
    },
    {
      label: "Portrait Adjustment",
      description:
        "An illustrative comparison of light sharpening, color correction, and contrast adjustment.",
      beforeImg:
        enhancePortraitBefore,
      afterImg:
        enhancePortraitAfter,
      beforeAlt:
        "Illustrative soft and muted portrait",
      afterAlt:
        "Illustrative portrait with clearer color and edges",
      illustrative: true,
    },
  ],
};

function getModeFromPathname(
  pathname: string,
): ToolMode {
  if (
    pathname.includes(
      "remove-background",
    )
  ) {
    return "background";
  }

  if (
    pathname.includes(
      "enhance-quality",
    )
  ) {
    return "enhance";
  }

  return "watermark";
}

function ComparisonSlider({
  example,
  autoPlay = true,
}: ComparisonSliderProps) {
  const containerRef =
    useRef<HTMLDivElement>(null);

  const revealRef =
    useRef<HTMLDivElement>(null);

  const revealInnerRef =
    useRef<HTMLDivElement>(null);

  const handleRef =
    useRef<HTMLDivElement>(null);

  const activePointerRef =
    useRef<number | null>(null);

  const hasInteractedRef =
    useRef(false);

  const animationFrameRef =
    useRef<number | null>(null);

  const [position, setPosition] =
    useState(50);

  const [beforeLoaded, setBeforeLoaded] =
    useState(false);

  const [afterLoaded, setAfterLoaded] =
    useState(false);

  const [imageError, setImageError] =
    useState(false);

  const setSliderPosition =
    useCallback(
      (nextPosition: number) => {
        const safePosition =
          Math.min(
            100,
            Math.max(0, nextPosition),
          );

        setPosition(safePosition);

        if (revealRef.current) {
          revealRef.current.style.width =
            `${safePosition}%`;
        }

        if (handleRef.current) {
          handleRef.current.style.left =
            `${safePosition}%`;
        }
      },
      [],
    );

  const updateFromClientX =
    useCallback(
      (clientX: number) => {
        const container =
          containerRef.current;

        if (!container) {
          return;
        }

        const rect =
          container.getBoundingClientRect();

        if (!rect.width) {
          return;
        }

        const percentage =
          ((clientX - rect.left) /
            rect.width) *
          100;

        setSliderPosition(
          percentage,
        );
      },
      [setSliderPosition],
    );

  useEffect(() => {
    const container =
      containerRef.current;

    const inner =
      revealInnerRef.current;

    if (!container || !inner) {
      return;
    }

    const syncWidth = () => {
      inner.style.width =
        `${container.clientWidth}px`;
    };

    syncWidth();

    const observer =
      new ResizeObserver(syncWidth);

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!autoPlay) {
      return;
    }

    const reducedMotion =
      window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

    if (reducedMotion) {
      return;
    }

    const container =
      containerRef.current;

    if (!container) {
      return;
    }

    let isVisible = false;
    let startedAt =
      performance.now();

    const observer =
      new IntersectionObserver(
        ([entry]) => {
          isVisible =
            entry.isIntersecting;

          if (isVisible) {
            startedAt =
              performance.now();
          }
        },
        {
          threshold: 0.25,
        },
      );

    observer.observe(container);

    const animate = (
      currentTime: number,
    ) => {
      if (
        isVisible &&
        !hasInteractedRef.current &&
        activePointerRef.current ===
          null
      ) {
        const duration = 3600;

        const cycle =
          ((currentTime -
            startedAt) %
            duration) /
          duration;

        const wave =
          0.5 -
          Math.cos(
            cycle *
              Math.PI *
              2,
          ) /
            2;

        const animatedPosition =
          18 + wave * 64;

        setSliderPosition(
          animatedPosition,
        );
      }

      animationFrameRef.current =
        requestAnimationFrame(
          animate,
        );
    };

    animationFrameRef.current =
      requestAnimationFrame(
        animate,
      );

    return () => {
      observer.disconnect();

      if (
        animationFrameRef.current !==
        null
      ) {
        cancelAnimationFrame(
          animationFrameRef.current,
        );
      }
    };
  }, [
    autoPlay,
    setSliderPosition,
  ]);

  const handlePointerDown =
    useCallback(
      (
        event: PointerEvent<HTMLDivElement>,
      ) => {
        event.preventDefault();

        hasInteractedRef.current =
          true;

        activePointerRef.current =
          event.pointerId;

        event.currentTarget.setPointerCapture(
          event.pointerId,
        );

        updateFromClientX(
          event.clientX,
        );
      },
      [updateFromClientX],
    );

  const handlePointerMove =
    useCallback(
      (
        event: PointerEvent<HTMLDivElement>,
      ) => {
        if (
          activePointerRef.current !==
          event.pointerId
        ) {
          return;
        }

        event.preventDefault();

        updateFromClientX(
          event.clientX,
        );
      },
      [updateFromClientX],
    );

  const handlePointerEnd =
    useCallback(
      (
        event: PointerEvent<HTMLDivElement>,
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
        event: KeyboardEvent<HTMLDivElement>,
      ) => {
        const key =
          event.key;

        if (
          key !== "ArrowLeft" &&
          key !== "ArrowRight" &&
          key !== "Home" &&
          key !== "End"
        ) {
          return;
        }

        event.preventDefault();

        hasInteractedRef.current =
          true;

        if (key === "Home") {
          setSliderPosition(0);
          return;
        }

        if (key === "End") {
          setSliderPosition(100);
          return;
        }

        const change =
          event.shiftKey
            ? 10
            : 3;

        setSliderPosition(
          position +
            (key ===
            "ArrowRight"
              ? change
              : -change),
        );
      },
      [
        position,
        setSliderPosition,
      ],
    );

  const imagesLoaded =
    beforeLoaded &&
    afterLoaded;

  return (
    <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-100/50">
      <div
        ref={containerRef}
        className="relative aspect-[3/2] w-full cursor-col-resize select-none overflow-hidden bg-gray-100"
        style={{
          touchAction: "none",
        }}
        role="slider"
        tabIndex={0}
        aria-label={`${example.label} before and after comparison`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(
          position,
        )}
        aria-valuetext={`${Math.round(
          position,
        )}% of the before image visible`}
        onKeyDown={
          handleKeyboard
        }
        onPointerDown={
          handlePointerDown
        }
        onPointerMove={
          handlePointerMove
        }
        onPointerUp={
          handlePointerEnd
        }
        onPointerCancel={
          handlePointerEnd
        }
      >
        <div
          className={
            example.afterImg.startsWith(
              "data:image/svg",
            )
              ? "absolute inset-0 bg-[linear-gradient(45deg,#e5e7eb_25%,transparent_25%),linear-gradient(-45deg,#e5e7eb_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e5e7eb_75%),linear-gradient(-45deg,transparent_75%,#e5e7eb_75%)] bg-[length:24px_24px] bg-[position:0_0,0_12px,12px_-12px,-12px_0px]"
              : "absolute inset-0 bg-gray-100"
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              example.afterImg
            }
            alt={
              example.afterAlt
            }
            className="block h-full w-full object-cover"
            draggable={false}
            onLoad={() =>
              setAfterLoaded(true)
            }
            onError={() =>
              setImageError(true)
            }
          />
        </div>

        <div
          ref={revealRef}
          className="absolute inset-y-0 left-0 overflow-hidden"
          style={{
            width: "50%",
          }}
        >
          <div
            ref={revealInnerRef}
            className="relative h-full"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={
                example.beforeImg
              }
              alt={
                example.beforeAlt
              }
              className="block h-full w-full object-cover"
              draggable={false}
              onLoad={() =>
                setBeforeLoaded(true)
              }
              onError={() =>
                setImageError(true)
              }
            />
          </div>
        </div>

        <div
          ref={handleRef}
          className="pointer-events-none absolute inset-y-0 z-20 w-0"
          style={{
            left: "50%",
          }}
        >
          <div className="absolute inset-y-0 -translate-x-1/2 border-l-2 border-white shadow-[0_0_0_1px_rgba(15,23,42,0.18)]" />

          <div className="absolute left-0 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white shadow-xl">
            <div className="flex items-center">
              <Icon
                name="arrow"
                size={14}
                className="rotate-180"
              />

              <Icon
                name="arrow"
                size={14}
              />
            </div>
          </div>
        </div>

        <span className="pointer-events-none absolute left-3 top-3 z-30 rounded-full bg-gray-950/70 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
          Before
        </span>

        <span className="pointer-events-none absolute right-3 top-3 z-30 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-indigo-600 shadow-sm backdrop-blur-sm">
          After
        </span>

        {!imagesLoaded &&
          !imageError && (
            <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-gray-100">
              <div className="spinner" />

              <p className="text-xs text-gray-400">
                Loading comparison...
              </p>
            </div>
          )}

        {imageError && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-gray-100 px-6 text-center">
            <Icon
              name="image"
              size={28}
              className="text-gray-400"
            />

            <p className="text-sm font-semibold text-gray-600">
              This comparison
              image could not be
              loaded.
            </p>
          </div>
        )}
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-gray-900">
              {example.label}
            </h3>

            <p className="mt-1 text-sm leading-6 text-gray-500">
              {
                example.description
              }
            </p>
          </div>

          {example.illustrative && (
            <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
              Illustration
            </span>
          )}
        </div>

        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-gray-400">
          <Icon
            name="sliders"
            size={13}
          />

          Drag the handle or
          use the arrow keys.
        </p>
      </div>
    </article>
  );
}

export default function BeforeAfter({
  mode,
}: BeforeAfterProps) {
  const pathname =
    usePathname();

  const activeMode =
    mode ??
    getModeFromPathname(
      pathname,
    );

  const examples =
    EXAMPLES_BY_MODE[
      activeMode
    ];

  const pageCopy =
    TOOL_PAGE_COPY[
      activeMode
    ];

  const sectionCopy =
    useMemo(() => {
      if (
        activeMode ===
        "background"
      ) {
        return {
          title:
            "Background Removal Preview",

          subtitle:
            "Drag each slider to see the intended transparent-output workflow. These visual examples are clearly marked as illustrations rather than measured model benchmarks.",
        };
      }

      if (
        activeMode ===
        "enhance"
      ) {
        return {
          title:
            "Image Improvement Preview",

          subtitle:
            "Compare illustrative examples of resizing, color adjustment, denoising, contrast correction, and controlled sharpening.",
        };
      }

      return {
        title:
          "Object Removal Examples",

        subtitle:
          "Drag each slider to compare the original sample with its cleaned version. Results vary according to the size, position, and complexity of the selected area.",
      };
    }, [activeMode]);

  return (
    <section
      className="section relative overflow-hidden bg-gray-50"
      id="before-after"
      aria-labelledby={`${activeMode}-comparison-title`}
    >
      <div
        className="pointer-events-none absolute -left-24 top-12 h-72 w-72 rounded-full bg-indigo-200/30 blur-3xl"
        aria-hidden="true"
      />

      <div
        className="pointer-events-none absolute -right-24 bottom-4 h-72 w-72 rounded-full bg-pink-200/30 blur-3xl"
        aria-hidden="true"
      />

      <div className="container-x relative">
        <div className="mx-auto mb-10 max-w-3xl text-center">
          <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/80 px-3 py-1 text-xs font-semibold text-indigo-600 shadow-sm backdrop-blur-sm">
            <Icon
              name="sliders"
              size={14}
            />

            Interactive comparison
          </span>

          <h2
            id={`${activeMode}-comparison-title`}
            className="text-2xl font-bold tracking-tight text-gray-900 md:text-3xl"
          >
            {
              sectionCopy.title
            }
          </h2>

          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-gray-500 md:text-base">
            {
              sectionCopy.subtitle
            }
          </p>
        </div>

        <div
          className={`mx-auto grid max-w-5xl grid-cols-1 gap-6 ${
            examples.length >
            2
              ? "md:grid-cols-2"
              : "lg:grid-cols-2"
          }`}
        >
          {examples.map(
            (
              example,
              index,
            ) => (
              <ComparisonSlider
                key={
                  example.label
                }
                example={
                  example
                }
                autoPlay={
                  index === 0
                }
              />
            ),
          )}
        </div>

        <div className="mx-auto mt-9 flex max-w-3xl items-start gap-3 rounded-2xl border border-gray-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Icon
              name="shield"
              size={19}
            />
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-800">
              Results depend on
              the source file
            </p>

            <p className="mt-1 text-xs leading-5 text-gray-500 sm:text-sm">
              {
                pageCopy.description
              }{" "}
              Complex edges, large
              missing areas,
              compression, motion,
              and low-resolution
              input can affect the
              final quality.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}