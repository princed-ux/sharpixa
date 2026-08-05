"use client";

import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icons";
import {
  HOW_IT_WORKS_BY_MODE,
  TOOL_PAGE_COPY,
  type ToolMode,
} from "@/lib/constants";

type IconName = Parameters<typeof Icon>[0]["name"];

interface HowItWorksProps {
  mode?: ToolMode;
}

function getModeFromPathname(pathname: string): ToolMode {
  if (pathname.includes("remove-background")) {
    return "background";
  }

  if (pathname.includes("enhance-quality")) {
    return "enhance";
  }

  return "watermark";
}

export default function HowItWorks({
  mode,
}: HowItWorksProps) {
  const pathname = usePathname();

  const activeMode =
    mode ?? getModeFromPathname(pathname);

  const steps =
    HOW_IT_WORKS_BY_MODE[activeMode];

  const pageCopy =
    TOOL_PAGE_COPY[activeMode];

  return (
    <section
      className="section relative overflow-hidden"
      id="how-it-works"
      aria-labelledby={`${activeMode}-how-it-works-title`}
    >
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-indigo-100/45 via-purple-100/35 to-pink-100/45 blur-3xl"
        aria-hidden="true"
      />

      <div className="container-x relative">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/80 px-3 py-1 text-xs font-semibold text-indigo-600">
            <Icon
              name="sparkles"
              size={14}
            />

            Four simple steps
          </span>

          <h2
            id={`${activeMode}-how-it-works-title`}
            className="text-2xl font-bold tracking-tight text-gray-900 md:text-3xl"
          >
            {pageCopy.howItWorksTitle}
          </h2>

          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-gray-500 md:text-base">
            {pageCopy.howItWorksSubtitle}
          </p>
        </div>

        <div className="relative">
          <div
            className="pointer-events-none absolute left-[12.5%] right-[12.5%] top-14 hidden h-px bg-gradient-to-r from-transparent via-indigo-200 to-transparent lg:block"
            aria-hidden="true"
          />

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <article
                key={step.num}
                className="group relative flex h-full flex-col rounded-2xl border border-gray-200/80 bg-white/90 p-6 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-100/60"
              >
                <div className="relative z-10 mx-auto mb-5">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 text-indigo-600 shadow-sm transition-transform duration-300 group-hover:scale-105">
                    <Icon
                      name={
                        step.icon as IconName
                      }
                      size={25}
                    />
                  </div>

                  <span className="absolute -right-3 -top-3 flex h-8 min-w-8 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 px-2 text-xs font-bold text-white shadow-md">
                    {step.num}
                  </span>
                </div>

                <h3 className="mb-2 text-base font-bold text-gray-900 md:text-lg">
                  {step.title}
                </h3>

                <p className="text-sm leading-6 text-gray-500">
                  {step.desc}
                </p>

                {index <
                  steps.length - 1 && (
                  <div
                    className="absolute -right-4 top-12 z-20 hidden h-8 w-8 items-center justify-center rounded-full border border-indigo-100 bg-white text-indigo-400 shadow-sm lg:flex"
                    aria-hidden="true"
                  >
                    <Icon
                      name="arrow"
                      size={14}
                    />
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-8 flex max-w-3xl flex-col items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white/70 px-5 py-4 text-center shadow-sm backdrop-blur-sm sm:flex-row sm:text-left">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <Icon
              name="shield"
              size={19}
            />
          </div>

          <p className="text-xs leading-5 text-gray-500 sm:text-sm">
            Processing is designed to run
            inside your browser. Only edit
            files you own or have
            permission to modify.
          </p>
        </div>
      </div>
    </section>
  );
}