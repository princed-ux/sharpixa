"use client";

import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icons";
import {
  FEATURES_BY_MODE,
  TOOL_PAGE_COPY,
  type ToolMode,
} from "@/lib/constants";

type IconName = Parameters<
  typeof Icon
>[0]["name"];

interface FeaturesGridProps {
  mode?: ToolMode;
}

type ModeStyle = {
  badge: string;
  icon: string;
  glow: string;
  accent: string;
};

const MODE_STYLES: Record<
  ToolMode,
  ModeStyle
> = {
  watermark: {
    badge:
      "border-indigo-100 bg-indigo-50 text-indigo-600",
    icon:
      "border-indigo-100 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 text-indigo-600",
    glow:
      "bg-indigo-200/25",
    accent:
      "from-indigo-500 via-purple-500 to-pink-500",
  },

  background: {
    badge:
      "border-emerald-100 bg-emerald-50 text-emerald-700",
    icon:
      "border-emerald-100 bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 text-emerald-600",
    glow:
      "bg-emerald-200/25",
    accent:
      "from-emerald-500 via-teal-500 to-cyan-500",
  },

  enhance: {
    badge:
      "border-amber-100 bg-amber-50 text-amber-700",
    icon:
      "border-amber-100 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 text-amber-600",
    glow:
      "bg-amber-200/25",
    accent:
      "from-amber-500 via-orange-500 to-rose-500",
  },
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

function getBadgeText(
  mode: ToolMode,
): string {
  if (mode === "background") {
    return "Automatic and manual tools";
  }

  if (mode === "enhance") {
    return "Practical quality controls";
  }

  return "Precision cleanup tools";
}

function getFooterCopy(
  mode: ToolMode,
): {
  title: string;
  description: string;
  icon: IconName;
} {
  if (mode === "background") {
    return {
      title:
        "Automatic results with manual control",
      description:
        "Start with automatic subject detection, then use the manual mask editor when an image needs more precise background selection.",
      icon: "brush",
    };
  }

  if (mode === "enhance") {
    return {
      title:
        "Designed for realistic improvements",
      description:
        "Sharpixa adjusts and resizes existing pixels. It does not claim to recreate every detail lost through blur, compression, or low-resolution capture.",
      icon: "shield",
    };
  }

  return {
    title:
      "Best for small, carefully selected areas",
    description:
      "Object removal produces the cleanest results when the selected area is surrounded by repeatable colors and textures.",
    icon: "eraser",
  };
}

export default function FeaturesGrid({
  mode,
}: FeaturesGridProps) {
  const pathname = usePathname();

  const activeMode =
    mode ??
    getModeFromPathname(
      pathname,
    );

  const features =
    FEATURES_BY_MODE[
      activeMode
    ];

  const pageCopy =
    TOOL_PAGE_COPY[
      activeMode
    ];

  const styles =
    MODE_STYLES[
      activeMode
    ];

  const footer =
    getFooterCopy(
      activeMode,
    );

  return (
    <section
      className="section relative overflow-hidden"
      id="features"
      aria-labelledby={`${activeMode}-features-title`}
    >
      <div
        className={`pointer-events-none absolute -left-32 top-12 h-80 w-80 rounded-full ${styles.glow} blur-3xl`}
        aria-hidden="true"
      />

      <div
        className={`pointer-events-none absolute -right-32 bottom-0 h-80 w-80 rounded-full ${styles.glow} blur-3xl`}
        aria-hidden="true"
      />

      <div className="container-x relative">
        <div className="mx-auto mb-10 max-w-3xl text-center">
          <span
            className={`mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${styles.badge}`}
          >
            <Icon
              name="sparkles"
              size={14}
            />

            {getBadgeText(
              activeMode,
            )}
          </span>

          <h2
            id={`${activeMode}-features-title`}
            className="text-2xl font-bold tracking-tight text-gray-900 md:text-3xl"
          >
            {
              pageCopy.featuresTitle
            }
          </h2>

          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-gray-500 md:text-base">
            {
              pageCopy.featuresSubtitle
            }
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(
            (
              feature,
              index,
            ) => (
              <article
                key={`${activeMode}-${feature.title}`}
                className="group relative flex h-full min-h-[235px] flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white/90 p-6 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-gray-300 hover:shadow-xl hover:shadow-gray-200/60"
              >
                <div
                  className={`absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-gradient-to-r ${styles.accent} transition-transform duration-300 group-hover:scale-x-100`}
                  aria-hidden="true"
                />

                <div
                  className="absolute -right-12 -top-12 h-28 w-28 rounded-full bg-gray-100/70 transition-transform duration-500 group-hover:scale-150"
                  aria-hidden="true"
                />

                <div className="relative">
                  <div
                    className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl border shadow-sm transition-all duration-300 group-hover:scale-105 group-hover:shadow-md ${styles.icon}`}
                  >
                    <Icon
                      name={
                        feature.icon as IconName
                      }
                      size={22}
                    />
                  </div>

                  <span className="absolute right-0 top-0 font-mono text-[11px] font-semibold text-gray-300">
                    {String(
                      index + 1,
                    ).padStart(
                      2,
                      "0",
                    )}
                  </span>
                </div>

                <h3 className="relative mb-2 text-base font-bold leading-6 text-gray-900 md:text-lg">
                  {
                    feature.title
                  }
                </h3>

                <p className="relative text-sm leading-6 text-gray-500">
                  {
                    feature.desc
                  }
                </p>

                <div className="relative mt-auto pt-5">
                  <div className="h-px w-full bg-gradient-to-r from-gray-100 via-gray-200 to-transparent" />

                  <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 transition-colors duration-300 group-hover:text-gray-600">
                    <Icon
                      name="check"
                      size={13}
                    />

                    Included in Sharpixa
                  </div>
                </div>
              </article>
            ),
          )}
        </div>

        <div className="mx-auto mt-9 max-w-4xl overflow-hidden rounded-2xl border border-gray-200 bg-white/85 shadow-sm backdrop-blur-sm">
          <div
            className={`h-1 w-full bg-gradient-to-r ${styles.accent}`}
          />

          <div className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${styles.icon}`}
            >
              <Icon
                name={
                  footer.icon
                }
                size={22}
              />
            </div>

            <div className="flex-1">
              <h3 className="text-sm font-bold text-gray-900 sm:text-base">
                {
                  footer.title
                }
              </h3>

              <p className="mt-1 text-xs leading-5 text-gray-500 sm:text-sm sm:leading-6">
                {
                  footer.description
                }
              </p>
            </div>

            <a
              href="#tool"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-gray-700 shadow-sm transition-all hover:border-indigo-200 hover:text-indigo-600 hover:shadow-md"
            >
              Try the tool

              <Icon
                name="arrow"
                size={14}
              />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}