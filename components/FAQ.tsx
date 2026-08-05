"use client";

import {
  useEffect,
  useId,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icons";
import {
  FAQS_BY_MODE,
  TOOL_PAGE_COPY,
  type ToolMode,
} from "@/lib/constants";

interface FAQProps {
  mode?: ToolMode;
}

type ModeStyle = {
  badge: string;
  icon: string;
  activeBorder: string;
  activeBackground: string;
  accentText: string;
  glow: string;
};

const MODE_STYLES: Record<
  ToolMode,
  ModeStyle
> = {
  watermark: {
    badge:
      "border-indigo-100 bg-indigo-50 text-indigo-600",

    icon:
      "border-indigo-100 bg-indigo-50 text-indigo-600",

    activeBorder:
      "border-indigo-200",

    activeBackground:
      "bg-indigo-50/35",

    accentText:
      "text-indigo-600",

    glow:
      "bg-indigo-200/25",
  },

  background: {
    badge:
      "border-emerald-100 bg-emerald-50 text-emerald-700",

    icon:
      "border-emerald-100 bg-emerald-50 text-emerald-600",

    activeBorder:
      "border-emerald-200",

    activeBackground:
      "bg-emerald-50/35",

    accentText:
      "text-emerald-600",

    glow:
      "bg-emerald-200/25",
  },

  enhance: {
    badge:
      "border-amber-100 bg-amber-50 text-amber-700",

    icon:
      "border-amber-100 bg-amber-50 text-amber-600",

    activeBorder:
      "border-amber-200",

    activeBackground:
      "bg-amber-50/35",

    accentText:
      "text-amber-600",

    glow:
      "bg-amber-200/25",
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
    return "Background removal help";
  }

  if (mode === "enhance") {
    return "Image improvement help";
  }

  return "Object removal help";
}

function getFooterCopy(
  mode: ToolMode,
): string {
  if (mode === "background") {
    return "For difficult hair, transparent objects, shadows, or low-contrast edges, try another source image or switch to manual selection.";
  }

  if (mode === "enhance") {
    return "Start with the Standard preset and make small adjustments. Excessive sharpening, contrast, or resizing can reduce natural image quality.";
  }

  return "Smaller selections surrounded by repeatable textures generally produce cleaner object-removal results.";
}

export default function FAQ({
  mode,
}: FAQProps) {
  const pathname = usePathname();

  const activeMode =
    mode ??
    getModeFromPathname(
      pathname,
    );

  const questions =
    FAQS_BY_MODE[
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

  const componentId =
    useId().replace(
      /:/g,
      "",
    );

  const [
    openIndex,
    setOpenIndex,
  ] = useState<
    number | null
  >(0);

  useEffect(() => {
    setOpenIndex(0);
  }, [activeMode]);

  const toggleQuestion = (
    index: number,
  ) => {
    setOpenIndex(
      (
        currentIndex,
      ) =>
        currentIndex === index
          ? null
          : index,
    );
  };

  return (
    <section
      className="section relative overflow-hidden bg-gray-50"
      id="faq"
      aria-labelledby={`${componentId}-${activeMode}-faq-title`}
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
              name="sparkles"
              size={14}
            />

            {getBadgeText(
              activeMode,
            )}
          </span>

          <h2
            id={`${componentId}-${activeMode}-faq-title`}
            className="text-2xl font-bold tracking-tight text-gray-900 md:text-3xl"
          >
            {
              pageCopy.faqTitle
            }
          </h2>

          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-gray-500 md:text-base">
            {
              pageCopy.faqSubtitle
            }
          </p>
        </div>

        <div className="mx-auto max-w-3xl space-y-3">
          {questions.map(
            (
              question,
              index,
            ) => {
              const isOpen =
                openIndex ===
                index;

              const questionId =
                `${componentId}-${activeMode}-question-${index}`;

              const answerId =
                `${componentId}-${activeMode}-answer-${index}`;

              return (
                <article
                  key={
                    question.q
                  }
                  className={`overflow-hidden rounded-2xl border bg-white/90 shadow-sm transition-all duration-300 ${
                    isOpen
                      ? `${styles.activeBorder} ${styles.activeBackground} shadow-md`
                      : "border-gray-200 hover:border-gray-300 hover:shadow-md"
                  }`}
                >
                  <h3>
                    <button
                      id={
                        questionId
                      }
                      type="button"
                      className="flex w-full items-center justify-between gap-5 px-5 py-5 text-left sm:px-6"
                      aria-expanded={
                        isOpen
                      }
                      aria-controls={
                        answerId
                      }
                      onClick={() =>
                        toggleQuestion(
                          index,
                        )
                      }
                    >
                      <span className="flex min-w-0 items-start gap-3">
                        <span
                          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-bold ${styles.icon}`}
                        >
                          {String(
                            index + 1,
                          ).padStart(
                            2,
                            "0",
                          )}
                        </span>

                        <span className="text-sm font-bold leading-6 text-gray-900 sm:text-base">
                          {
                            question.q
                          }
                        </span>
                      </span>

                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-white shadow-sm transition-all duration-300 ${
                          isOpen
                            ? `${styles.activeBorder} ${styles.accentText} rotate-180`
                            : "border-gray-200 text-gray-400"
                        }`}
                        aria-hidden="true"
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </span>
                    </button>
                  </h3>

                  <div
                    id={
                      answerId
                    }
                    role="region"
                    aria-labelledby={
                      questionId
                    }
                    aria-hidden={
                      !isOpen
                    }
                    className={`grid transition-all duration-300 ease-out ${
                      isOpen
                        ? "grid-rows-[1fr] opacity-100"
                        : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="px-5 pb-5 sm:px-6 sm:pb-6">
                        <div className="ml-11 border-l-2 border-gray-200 pl-4">
                          <p className="text-sm leading-7 text-gray-600">
                            {
                              question.a
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              );
            },
          )}
        </div>

        <div className="mx-auto mt-8 flex max-w-3xl items-start gap-3 rounded-2xl border border-gray-200 bg-white/85 p-5 shadow-sm backdrop-blur-sm">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${styles.icon}`}
          >
            <Icon
              name="shield"
              size={19}
            />
          </div>

          <div>
            <p className="text-sm font-bold text-gray-900">
              Important quality
              note
            </p>

            <p className="mt-1 text-xs leading-5 text-gray-500 sm:text-sm sm:leading-6">
              {getFooterCopy(
                activeMode,
              )}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}