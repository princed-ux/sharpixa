import type { ReactNode } from "react";
import { Icon } from "@/components/Icons";
import {
  TOOL_PAGE_COPY,
  type ToolMode,
} from "@/lib/constants";

type IconName = Parameters<
  typeof Icon
>[0]["name"];

interface HeroProps {
  children: ReactNode;
  mode?: ToolMode;
}

type HeroContent = {
  badge: string;
  badgeIcon: IconName;
  titleLead: string;
  titleAccent: string;
  description: string;
  supportText: string;
  resultText: string;
  processingText: string;
  noticeTitle: string;
  noticeDescription: string;
  noticeIcon: IconName;
  accent: string;
  badgeStyle: string;
  iconStyle: string;
  glowOne: string;
  glowTwo: string;
};

const HERO_CONTENT: Record<
  ToolMode,
  HeroContent
> = {
  watermark: {
    badge:
      "Object, text, and authorized watermark cleanup",

    badgeIcon:
      "eraser",

    titleLead:
      "Remove Unwanted Objects From",

    titleAccent:
      "Images and Videos",

    description:
      "Mark an unwanted object, text overlay, date stamp, logo, or authorized watermark and let Sharpixa rebuild the selected area using nearby visible pixels and textures.",

    supportText:
      "JPG, JPEG, PNG, WEBP and supported videos",

    resultText:
      "Image or compatible video export",

    processingText:
      "Manual precision selection",

    noticeTitle:
      "Best for focused selections",

    noticeDescription:
      "Smaller unwanted areas surrounded by repeatable colors or textures generally produce cleaner results than large selections covering unique details.",

    noticeIcon:
      "brush",

    accent:
      "from-indigo-500 via-purple-500 to-pink-500",

    badgeStyle:
      "border-indigo-100 bg-indigo-50 text-indigo-600",

    iconStyle:
      "border-indigo-100 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 text-indigo-600",

    glowOne:
      "bg-indigo-300/25",

    glowTwo:
      "bg-pink-300/25",
  },

  background: {
    badge:
      "Automatic and manual background removal",

    badgeIcon:
      "image",

    titleLead:
      "Create Transparent",

    titleAccent:
      "Image Backgrounds",

    description:
      "Automatically separate the main subject from an image or switch to manual selection when you need more control around hair, edges, shadows, or difficult objects.",

    supportText:
      "JPG, JPEG, PNG and WEBP images",

    resultText:
      "Transparent PNG output",

    processingText:
      "On-device subject detection",

    noticeTitle:
      "The first run may take longer",

    noticeDescription:
      "Automatic mode downloads a browser-side segmentation model the first time it is used. Supported browsers can cache those resources for later sessions.",

    noticeIcon:
      "zap",

    accent:
      "from-emerald-500 via-teal-500 to-cyan-500",

    badgeStyle:
      "border-emerald-100 bg-emerald-50 text-emerald-700",

    iconStyle:
      "border-emerald-100 bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 text-emerald-600",

    glowOne:
      "bg-emerald-300/25",

    glowTwo:
      "bg-cyan-300/25",
  },

  enhance: {
    badge:
      "Resize, denoise, sharpen, and adjust color",

    badgeIcon:
      "wand",

    titleLead:
      "Improve Image and Video",

    titleAccent:
      "Presentation Quality",

    description:
      "Apply practical browser-side resizing, noise reduction, controlled sharpening, brightness, contrast, and saturation adjustments without overstating what conventional processing can restore.",

    supportText:
      "Images and browser-compatible videos",

    resultText:
      "Original or resized output",

    processingText:
      "Preset and manual controls",

    noticeTitle:
      "Realistic enhancement",

    noticeDescription:
      "Resizing increases output dimensions and processing can improve presentation, but it cannot reliably recreate every detail missing from a blurred, compressed, or low-resolution source.",

    noticeIcon:
      "shield",

    accent:
      "from-amber-500 via-orange-500 to-rose-500",

    badgeStyle:
      "border-amber-100 bg-amber-50 text-amber-700",

    iconStyle:
      "border-amber-100 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 text-amber-600",

    glowOne:
      "bg-amber-300/25",

    glowTwo:
      "bg-rose-300/25",
  },
};

export default function Hero({
  children,
  mode = "watermark",
}: HeroProps) {
  const content =
    HERO_CONTENT[mode];

  const pageCopy =
    TOOL_PAGE_COPY[mode];

  return (
    <section
      className="mesh-bg relative overflow-hidden"
      aria-labelledby={`${mode}-hero-title`}
    >
      <div
        className={`pointer-events-none absolute -left-40 top-12 h-[430px] w-[430px] rounded-full ${content.glowOne} blur-3xl`}
        aria-hidden="true"
      />

      <div
        className={`pointer-events-none absolute -right-40 top-44 h-[430px] w-[430px] rounded-full ${content.glowTwo} blur-3xl`}
        aria-hidden="true"
      />

      <div
        className="pointer-events-none absolute left-1/2 top-[28%] h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-white/55 blur-3xl"
        aria-hidden="true"
      />

      <div className="container-x relative pb-14 pt-12 sm:pb-16 sm:pt-16 lg:pb-20 lg:pt-20">
        <div className="mx-auto max-w-4xl text-center">
          <span
            className={`mb-5 inline-flex animate-fade-in items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold shadow-sm backdrop-blur-sm ${content.badgeStyle}`}
            style={{
              animationDelay:
                "0.05s",
            }}
          >
            <Icon
              name={
                content.badgeIcon
              }
              size={14}
            />

            {content.badge}
          </span>

          <h1
            id={`${mode}-hero-title`}
            className="animate-fade-in text-4xl font-extrabold leading-[1.08] tracking-tight text-gray-950 sm:text-5xl lg:text-6xl"
            style={{
              animationDelay:
                "0.1s",
            }}
          >
            {content.titleLead}{" "}
            <span
              className={`bg-gradient-to-r ${content.accent} bg-clip-text text-transparent`}
            >
              {content.titleAccent}
            </span>
          </h1>

          <p
            className="mx-auto mt-5 max-w-3xl animate-fade-in text-base leading-7 text-gray-600 sm:text-lg sm:leading-8"
            style={{
              animationDelay:
                "0.15s",
            }}
          >
            {content.description}
          </p>

          <div
            className="mx-auto mt-7 flex max-w-4xl animate-fade-in flex-wrap items-center justify-center gap-x-6 gap-y-3"
            style={{
              animationDelay:
                "0.2s",
            }}
          >
            <span className="inline-flex items-center gap-2 text-xs font-medium text-gray-500 sm:text-sm">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full border ${content.iconStyle}`}
              >
                <Icon
                  name="upload"
                  size={13}
                />
              </span>

              {content.supportText}
            </span>

            <span className="inline-flex items-center gap-2 text-xs font-medium text-gray-500 sm:text-sm">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full border ${content.iconStyle}`}
              >
                <Icon
                  name="download"
                  size={13}
                />
              </span>

              {content.resultText}
            </span>

            <span className="inline-flex items-center gap-2 text-xs font-medium text-gray-500 sm:text-sm">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full border ${content.iconStyle}`}
              >
                <Icon
                  name="sliders"
                  size={13}
                />
              </span>

              {content.processingText}
            </span>
          </div>
        </div>

        <div
          id="tool"
          className="relative mx-auto mt-10 max-w-6xl scroll-mt-28 animate-fade-in sm:mt-12"
          style={{
            animationDelay:
              "0.25s",
          }}
        >
          <div
            className={`pointer-events-none absolute -inset-px rounded-[2rem] bg-gradient-to-r ${content.accent} opacity-25 blur-sm`}
            aria-hidden="true"
          />

          <div className="relative overflow-hidden rounded-[2rem] border border-white/90 bg-white/82 p-3 shadow-2xl shadow-gray-900/10 backdrop-blur-xl sm:p-5 lg:p-6">
            <div
              className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${content.accent}`}
              aria-hidden="true"
            />

            <div className="mb-5 flex flex-col gap-4 border-b border-gray-200/80 px-1 pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border shadow-sm ${content.iconStyle}`}
                >
                  <Icon
                    name={
                      content.badgeIcon
                    }
                    size={20}
                  />
                </div>

                <div>
                  <h2 className="text-base font-bold text-gray-950 sm:text-lg">
                    {pageCopy.heading}
                  </h2>

                  <p className="mt-0.5 text-xs text-gray-500 sm:text-sm">
                    Select a file and
                    follow the controls
                    below.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[10px] font-semibold text-emerald-700 sm:text-xs">
                  <Icon
                    name="check"
                    size={12}
                  />

                  No account required
                </span>

                <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-[10px] font-semibold text-gray-600 sm:text-xs">
                  <Icon
                    name="shield"
                    size={12}
                  />

                  Browser-based workflow
                </span>
              </div>
            </div>

            <div className="relative">
              {children}
            </div>
          </div>
        </div>

        <div className="mx-auto mt-6 flex max-w-4xl flex-col items-start gap-3 rounded-2xl border border-gray-200 bg-white/75 p-4 shadow-sm backdrop-blur-sm sm:flex-row sm:items-center sm:p-5">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${content.iconStyle}`}
          >
            <Icon
              name={
                content.noticeIcon
              }
              size={18}
            />
          </div>

          <div className="text-left">
            <h2 className="text-sm font-bold text-gray-900">
              {content.noticeTitle}
            </h2>

            <p className="mt-1 text-xs leading-5 text-gray-500 sm:text-sm sm:leading-6">
              {
                content.noticeDescription
              }
            </p>
          </div>
        </div>

        <p className="mx-auto mt-5 max-w-3xl text-center text-[11px] leading-5 text-gray-400 sm:text-xs">
          Only upload and edit files
          you own or have permission
          to modify. Do not remove
          copyright, ownership, or
          attribution marks from
          protected material without
          authorization.
        </p>
      </div>
    </section>
  );
}