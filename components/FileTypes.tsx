"use client";

import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icons";
import {
  FILE_LIMIT_LABELS,
  FILE_TYPES_BY_MODE,
  PROCESSING_PRIVACY_NOTICE,
  TOOL_PAGE_COPY,
  type ToolMode,
} from "@/lib/constants";

type IconName = Parameters<typeof Icon>[0]["name"];

interface FileTypesProps {
  mode?: ToolMode;
}

interface TypeCardProps {
  ext: string;
  color: string;
}

type ModeStyle = {
  badge: string;
  icon: string;
  glow: string;
  accent: string;
};

const MODE_STYLES: Record<ToolMode, ModeStyle> = {
  watermark: {
    badge:
      "border-indigo-100 bg-indigo-50 text-indigo-600",
    icon:
      "border-indigo-100 bg-indigo-50 text-indigo-600",
    glow: "bg-indigo-200/25",
    accent:
      "from-indigo-500 via-purple-500 to-pink-500",
  },

  background: {
    badge:
      "border-emerald-100 bg-emerald-50 text-emerald-700",
    icon:
      "border-emerald-100 bg-emerald-50 text-emerald-600",
    glow: "bg-emerald-200/25",
    accent:
      "from-emerald-500 via-teal-500 to-cyan-500",
  },

  enhance: {
    badge:
      "border-amber-100 bg-amber-50 text-amber-700",
    icon:
      "border-amber-100 bg-amber-50 text-amber-600",
    glow: "bg-amber-200/25",
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
    return "Image formats";
  }

  if (mode === "enhance") {
    return "Image and video formats";
  }

  return "Supported media";
}

function getLimitLabel(
  groupLabel: string,
): string {
  return groupLabel.toLowerCase() ===
    "videos"
    ? FILE_LIMIT_LABELS.video
    : FILE_LIMIT_LABELS.image;
}

function getCompatibilityNote(
  mode: ToolMode,
): string {
  if (mode === "background") {
    return "Automatic background removal currently works with supported image files only. Transparent results are exported as PNG files.";
  }

  if (mode === "enhance") {
    return "Image formats are widely supported. Video processing also depends on whether your browser can decode and encode the selected video format.";
  }

  return "Image support is consistent across modern browsers. Video processing depends on the codecs available in your browser and operating system.";
}

function TypeCard({
  ext,
  color,
}: TypeCardProps) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-3 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-gray-300 hover:shadow-lg">
      <div
        className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100"
        style={{
          background: color,
        }}
        aria-hidden="true"
      />

      <div
        className="flex min-h-[74px] items-center justify-center rounded-xl border px-3 py-4 text-sm font-bold tracking-wide transition-transform duration-300 group-hover:scale-[1.03]"
        style={{
          backgroundColor:
            `${color}12`,
          borderColor:
            `${color}30`,
          color,
        }}
      >
        .{ext.toLowerCase()}
      </div>

      <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {ext} file
      </p>
    </article>
  );
}

export default function FileTypes({
  mode,
}: FileTypesProps) {
  const pathname = usePathname();

  const activeMode =
    mode ??
    getModeFromPathname(
      pathname,
    );

  const groups =
    FILE_TYPES_BY_MODE[
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

  return (
    <section
      className="section relative overflow-hidden bg-gray-50"
      id="file-types"
      aria-labelledby={`${activeMode}-file-types-title`}
    >
      <div
        className={`pointer-events-none absolute -left-32 top-8 h-80 w-80 rounded-full ${styles.glow} blur-3xl`}
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
              name="upload"
              size={14}
            />

            {getBadgeText(
              activeMode,
            )}
          </span>

          <h2
            id={`${activeMode}-file-types-title`}
            className="text-2xl font-bold tracking-tight text-gray-900 md:text-3xl"
          >
            {
              pageCopy.fileTypesTitle
            }
          </h2>

          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-gray-500 md:text-base">
            {
              pageCopy.fileTypesSubtitle
            }
          </p>
        </div>

        <div
          className={`mx-auto grid max-w-5xl gap-6 ${
            groups.length > 1
              ? "lg:grid-cols-2"
              : "max-w-3xl"
          }`}
        >
          {groups.map(
            (group) => (
              <article
                key={
                  group.label
                }
                className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white/90 p-5 shadow-sm backdrop-blur-sm sm:p-6"
              >
                <div
                  className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${styles.accent}`}
                  aria-hidden="true"
                />

                <div className="mb-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${styles.icon}`}
                    >
                      <Icon
                        name={
                          group.icon as IconName
                        }
                        size={20}
                      />
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-gray-900 sm:text-lg">
                        {
                          group.label
                        }
                      </h3>

                      <p className="mt-0.5 text-xs text-gray-400">
                        Maximum file
                        size:{" "}
                        <span className="font-semibold text-gray-600">
                          {getLimitLabel(
                            group.label,
                          )}
                        </span>
                      </p>
                    </div>
                  </div>

                  <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    {
                      group.types
                        .length
                    }{" "}
                    formats
                  </span>
                </div>

                <div
                  className={`grid gap-3 ${
                    group.types
                      .length <= 4
                      ? "grid-cols-2 sm:grid-cols-4"
                      : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
                  }`}
                >
                  {group.types.map(
                    (fileType) => (
                      <TypeCard
                        key={
                          fileType.ext
                        }
                        ext={
                          fileType.ext
                        }
                        color={
                          fileType.color
                        }
                      />
                    ),
                  )}
                </div>
              </article>
            ),
          )}
        </div>

        <div className="mx-auto mt-8 grid max-w-5xl gap-4 md:grid-cols-2">
          <article className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white/85 p-5 shadow-sm backdrop-blur-sm">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${styles.icon}`}
            >
              <Icon
                name="shield"
                size={18}
              />
            </div>

            <div>
              <h3 className="text-sm font-bold text-gray-900">
                Browser-side
                processing
              </h3>

              <p className="mt-1 text-xs leading-5 text-gray-500 sm:text-sm sm:leading-6">
                {
                  PROCESSING_PRIVACY_NOTICE
                }
              </p>
            </div>
          </article>

          <article className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white/85 p-5 shadow-sm backdrop-blur-sm">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${styles.icon}`}
            >
              <Icon
                name="check"
                size={18}
              />
            </div>

            <div>
              <h3 className="text-sm font-bold text-gray-900">
                Browser
                compatibility
              </h3>

              <p className="mt-1 text-xs leading-5 text-gray-500 sm:text-sm sm:leading-6">
                {getCompatibilityNote(
                  activeMode,
                )}
              </p>
            </div>
          </article>
        </div>

        <div className="mx-auto mt-6 max-w-3xl rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-center">
          <p className="text-xs leading-5 text-amber-800">
            Renaming a file
            extension does not
            convert its format.
            Upload a valid file
            produced in one of the
            formats shown above.
          </p>
        </div>
      </div>
    </section>
  );
}