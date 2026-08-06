"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";
import TopBanner from "@/components/TopBanner";
import Footer from "@/components/Footer";
import { Icon } from "@/components/Icons";

type IconName = Parameters<
  typeof Icon
>[0]["name"];

type ToolCard = {
  title: string;
  description: string;
  href: string;
  icon: IconName;
  label: string;
  features: string[];
  accent: string;
  iconStyle: string;
  buttonStyle: string;
};

const TOOLS: ToolCard[] = [
  {
    title:
      "Object & Text Remover",

    description:
      "Mark unwanted objects, text, date stamps, logos, or authorized watermarks and rebuild the selected area using nearby visible pixels.",

    href:
      "/remove-watermark",

    icon:
      "eraser",

    label:
      "Primary cleanup tool",

    features: [
      "Images and supported videos",
      "Adjustable precision brush",
      "Undo, redo, zoom, and erasing",
      "Texture-aware browser processing",
    ],

    accent:
      "from-indigo-500 via-purple-500 to-pink-500",

    iconStyle:
      "border-indigo-100 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 text-indigo-600",

    buttonStyle:
      "bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shadow-indigo-200",
  },

  {
    title:
      "Background Remover",

    description:
      "Automatically separate the main subject from an image or switch to manual selection for more control around difficult areas.",

    href:
      "/remove-background",

    icon:
      "image",

    label:
      "Automatic and manual",

    features: [
      "On-device subject detection",
      "Manual selection fallback",
      "Transparent PNG export",
      "JPG, JPEG, PNG, and WEBP",
    ],

    accent:
      "from-emerald-500 via-teal-500 to-cyan-500",

    iconStyle:
      "border-emerald-100 bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 text-emerald-600",

    buttonStyle:
      "bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white shadow-emerald-200",
  },

  {
    title:
      "Image & Video Improvement",

    description:
      "Resize, denoise, sharpen, and adjust brightness, contrast, and saturation using practical browser-side controls.",

    href:
      "/enhance-quality",

    icon:
      "wand",

    label:
      "Practical enhancement",

    features: [
      "Light, Standard, and Maximum presets",
      "Brightness and contrast controls",
      "Noise reduction and sharpening",
      "Original, 2×, and image resize options",
    ],

    accent:
      "from-amber-500 via-orange-500 to-rose-500",

    iconStyle:
      "border-amber-100 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 text-amber-600",

    buttonStyle:
      "bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white shadow-orange-200",
  },
];

const WORKFLOW = [
  {
    number:
      "01",

    icon:
      "upload" as IconName,

    title:
      "Choose a Tool",

    description:
      "Open the object remover, background remover, or quality-improvement workspace.",
  },

  {
    number:
      "02",

    icon:
      "image" as IconName,

    title:
      "Select Your File",

    description:
      "Upload a supported image or video that you own or have permission to edit.",
  },

  {
    number:
      "03",

    icon:
      "sliders" as IconName,

    title:
      "Adjust the Result",

    description:
      "Mark an area, refine a mask, select a preset, or adjust the available processing controls.",
  },

  {
    number:
      "04",

    icon:
      "download" as IconName,

    title:
      "Review and Export",

    description:
      "Preview the processed result and save the completed file directly from your browser.",
  },
];

const PRINCIPLES = [
  {
    icon:
      "shield" as IconName,

    title:
      "Browser-Based Processing",

    description:
      "The selected file-processing workflow runs inside your browser. Some tools may download application scripts, runtime files, or model resources.",
  },

  {
    icon:
      "check" as IconName,

    title:
      "No Account Required",

    description:
      "You can begin using the editing tools without creating an account or submitting personal profile information.",
  },

  {
    icon:
      "sliders" as IconName,

    title:
      "Manual Control",

    description:
      "Sharpixa provides brushes, masks, presets, and adjustment controls rather than hiding every decision behind one automatic button.",
  },

  {
    icon:
      "sparkles" as IconName,

    title:
      "Honest Capabilities",

    description:
      "Resizing and enhancement can improve presentation, but they cannot reliably reconstruct every detail missing from the original file.",
  },

  {
    icon:
      "eraser" as IconName,

    title:
      "Responsible Editing",

    description:
      "Only remove objects, text, marks, or watermarks from files you own or have clear permission to modify.",
  },

  {
    icon:
      "zap" as IconName,

    title:
      "Focused Workflows",

    description:
      "Each Sharpixa tool is designed around one clear task so users can move from upload to result without unnecessary setup.",
  },
];

const SUPPORTED_FORMATS = [
  {
    label:
      "Images",

    description:
      "JPG, JPEG, PNG, and WEBP",

    limit:
      "Up to 20MB",

    icon:
      "image" as IconName,

    style:
      "border-indigo-100 bg-indigo-50 text-indigo-600",
  },

  {
    label:
      "Videos",

    description:
      "MP4, MOV, AVI, WEBM, and MKV",

    limit:
      "Up to 30 seconds / 50MB",

    icon:
      "film" as IconName,

    style:
      "border-purple-100 bg-purple-50 text-purple-600",
  },

  {
    label:
      "Transparent Output",

    description:
      "PNG background-removal export",

    limit:
      "Original dimensions when supported",

    icon:
      "download" as IconName,

    style:
      "border-emerald-100 bg-emerald-50 text-emerald-600",
  },
];

export default function Home() {
  return (
    <>
      <TopBanner />

      <Navbar />

      <main>
        <section className="mesh-bg relative overflow-hidden">
          <div
            className="pointer-events-none absolute -left-32 top-10 h-96 w-96 rounded-full bg-indigo-200/30 blur-3xl"
            aria-hidden="true"
          />

          <div
            className="pointer-events-none absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-pink-200/30 blur-3xl"
            aria-hidden="true"
          />

          <div className="container-x relative py-16 sm:py-20 lg:py-24">
            <div className="mx-auto max-w-4xl text-center">
              <span className="badge mb-5 animate-fade-in">
                <Icon
                  name="sparkles"
                  size={13}
                />

                Free browser-based media
                tools
              </span>

              <h1 className="animate-fade-in text-4xl font-extrabold leading-[1.08] tracking-tight text-gray-950 sm:text-5xl lg:text-7xl">
                Clean, Remove, and
                Improve Your Media With{" "}
                <span className="gradient-text">
                  Sharpixa
                </span>
              </h1>

              <p className="mx-auto mt-6 max-w-3xl animate-fade-in text-base leading-7 text-gray-600 sm:text-lg sm:leading-8">
                Remove unwanted
                objects and text,
                create transparent
                image backgrounds, or
                improve image and
                video presentation
                without creating an
                account.
              </p>

              <div className="mt-8 flex animate-fade-in flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/remove-watermark"
                  className="btn-primary min-w-52 justify-center px-6 py-3.5 text-sm sm:text-base"
                >
                  <Icon
                    name="eraser"
                    size={18}
                  />

                  Open Object Remover
                </Link>

                <a
                  href="#tools"
                  className="btn-secondary min-w-44 justify-center px-6 py-3.5 text-sm sm:text-base"
                >
                  Explore All Tools

                  <Icon
                    name="arrow"
                    size={17}
                  />
                </a>
              </div>

              <div className="mx-auto mt-9 flex max-w-3xl flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs font-medium text-gray-500 sm:text-sm">
                <span className="inline-flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    <Icon
                      name="check"
                      size={13}
                    />
                  </span>

                  No account required
                </span>

                <span className="inline-flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                    <Icon
                      name="shield"
                      size={13}
                    />
                  </span>

                  Browser-based workflow
                </span>

                <span className="inline-flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-50 text-purple-600">
                    <Icon
                      name="sliders"
                      size={13}
                    />
                  </span>

                  Manual refinement
                  controls
                </span>
              </div>
            </div>

            <div className="mx-auto mt-14 max-w-6xl">
              <div className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/70 p-3 shadow-2xl shadow-indigo-200/40 backdrop-blur-xl sm:p-5">
                <div className="grid gap-3 lg:grid-cols-3">
                  {TOOLS.map(
                    (
                      tool,
                      index,
                    ) => (
                      <Link
                        key={
                          tool.href
                        }
                        href={
                          tool.href
                        }
                        className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-xl sm:p-6"
                      >
                        <div
                          className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${tool.accent}`}
                          aria-hidden="true"
                        />

                        <div className="flex items-start justify-between gap-4">
                          <div
                            className={`flex h-12 w-12 items-center justify-center rounded-xl border ${tool.iconStyle}`}
                          >
                            <Icon
                              name={
                                tool.icon
                              }
                              size={22}
                            />
                          </div>

                          <span className="font-mono text-xs font-bold text-gray-300">
                            0
                            {index + 1}
                          </span>
                        </div>

                        <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400">
                          {
                            tool.label
                          }
                        </p>

                        <h2 className="mt-2 text-xl font-bold text-gray-950">
                          {
                            tool.title
                          }
                        </h2>

                        <p className="mt-2 text-sm leading-6 text-gray-500">
                          {
                            tool.description
                          }
                        </p>

                        <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-indigo-600">
                          Open tool

                          <Icon
                            name="arrow"
                            size={15}
                            className="transition-transform duration-300 group-hover:translate-x-1"
                          />
                        </span>
                      </Link>
                    ),
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          className="section relative overflow-hidden"
          id="tools"
          aria-labelledby="sharpixa-tools-title"
        >
          <div className="container-x">
            <div className="mx-auto mb-10 max-w-3xl text-center">
              <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600">
                <Icon
                  name="wand"
                  size={14}
                />

                Choose your workflow
              </span>

              <h2
                id="sharpixa-tools-title"
                className="text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl"
              >
                Three Focused Media
                Tools
              </h2>

              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-gray-500 sm:text-base">
                Each workspace is
                designed around a
                specific editing task
                with clear controls,
                supported formats, and
                realistic output
                expectations.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {TOOLS.map(
                (tool) => (
                  <article
                    key={
                      tool.href
                    }
                    className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-gray-300 hover:shadow-2xl hover:shadow-gray-200/70"
                  >
                    <div
                      className={`h-1.5 w-full bg-gradient-to-r ${tool.accent}`}
                    />

                    <div className="flex flex-1 flex-col p-6 sm:p-7">
                      <div className="flex items-center justify-between gap-3">
                        <div
                          className={`flex h-14 w-14 items-center justify-center rounded-2xl border shadow-sm ${tool.iconStyle}`}
                        >
                          <Icon
                            name={
                              tool.icon
                            }
                            size={25}
                          />
                        </div>

                        <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                          {
                            tool.label
                          }
                        </span>
                      </div>

                      <h3 className="mt-6 text-2xl font-bold tracking-tight text-gray-950">
                        {
                          tool.title
                        }
                      </h3>

                      <p className="mt-3 text-sm leading-7 text-gray-500">
                        {
                          tool.description
                        }
                      </p>

                      <ul className="mt-6 space-y-3">
                        {tool.features.map(
                          (
                            feature,
                          ) => (
                            <li
                              key={
                                feature
                              }
                              className="flex items-start gap-2.5 text-sm text-gray-600"
                            >
                              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                                <Icon
                                  name="check"
                                  size={12}
                                />
                              </span>

                              <span>
                                {
                                  feature
                                }
                              </span>
                            </li>
                          ),
                        )}
                      </ul>

                      <Link
                        href={
                          tool.href
                        }
                        className={`mt-7 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl ${tool.buttonStyle}`}
                      >
                        Open{" "}
                        {
                          tool.title
                        }

                        <Icon
                          name="arrow"
                          size={16}
                        />
                      </Link>
                    </div>
                  </article>
                ),
              )}
            </div>
          </div>
        </section>

        <section className="section relative overflow-hidden bg-gray-50">
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-indigo-100/50 via-purple-100/40 to-pink-100/50 blur-3xl"
            aria-hidden="true"
          />

          <div className="container-x relative">
            <div className="mx-auto mb-10 max-w-3xl text-center">
              <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-600 shadow-sm">
                <Icon
                  name="sliders"
                  size={14}
                />

                Simple processing flow
              </span>

              <h2 className="text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
                From File to Result in
                Four Steps
              </h2>

              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-gray-500 sm:text-base">
                The specific controls
                change by tool, but the
                overall Sharpixa
                workflow remains clear
                and predictable.
              </p>
            </div>

            <div className="relative grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <div
                className="pointer-events-none absolute left-[12%] right-[12%] top-8 hidden h-px bg-gradient-to-r from-transparent via-indigo-200 to-transparent lg:block"
                aria-hidden="true"
              />

              {WORKFLOW.map(
                (
                  step,
                  index,
                ) => (
                  <article
                    key={
                      step.number
                    }
                    className="relative rounded-2xl border border-gray-200 bg-white/90 p-6 text-center shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-xl"
                  >
                    <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 text-indigo-600 shadow-sm">
                      <Icon
                        name={
                          step.icon
                        }
                        size={24}
                      />

                      <span className="absolute -right-3 -top-3 flex h-8 min-w-8 items-center justify-center rounded-full border-4 border-white bg-gray-950 px-2 text-[10px] font-bold text-white">
                        {
                          step.number
                        }
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-gray-950">
                      {
                        step.title
                      }
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-gray-500">
                      {
                        step.description
                      }
                    </p>

                    {index <
                      WORKFLOW.length -
                        1 && (
                      <span
                        className="absolute -right-4 top-7 z-20 hidden h-8 w-8 items-center justify-center rounded-full border border-indigo-100 bg-white text-indigo-400 shadow-sm lg:flex"
                        aria-hidden="true"
                      >
                        <Icon
                          name="arrow"
                          size={14}
                        />
                      </span>
                    )}
                  </article>
                ),
              )}
            </div>
          </div>
        </section>

        <section className="section relative overflow-hidden">
          <div className="container-x">
            <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  <Icon
                    name="shield"
                    size={14}
                  />

                  Clear and responsible
                </span>

                <h2 className="text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
                  Media Tools Built
                  Around Practical
                  Controls
                </h2>

                <p className="mt-4 text-sm leading-7 text-gray-600 sm:text-base">
                  Sharpixa focuses on
                  transparent workflows:
                  choose the correct
                  tool, understand what
                  it changes, refine the
                  selection, and review
                  the result before
                  downloading.
                </p>

                <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-white text-amber-600">
                      <Icon
                        name="shield"
                        size={18}
                      />
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-amber-950">
                        Edit responsibly
                      </h3>

                      <p className="mt-1 text-xs leading-5 text-amber-800 sm:text-sm">
                        Only upload files
                        you own or have
                        permission to
                        modify. Do not
                        remove copyright,
                        ownership, or
                        attribution marks
                        from protected
                        material without
                        authorization.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {PRINCIPLES.map(
                  (
                    principle,
                  ) => (
                    <article
                      key={
                        principle.title
                      }
                      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-lg"
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-600">
                        <Icon
                          name={
                            principle.icon
                          }
                          size={20}
                        />
                      </div>

                      <h3 className="mt-4 text-base font-bold text-gray-950">
                        {
                          principle.title
                        }
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-gray-500">
                        {
                          principle.description
                        }
                      </p>
                    </article>
                  ),
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="section bg-gray-50">
          <div className="container-x">
            <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl shadow-gray-200/50">
              <div className="grid lg:grid-cols-[0.8fr_1.2fr]">
                <div className="bg-gray-950 p-7 text-white sm:p-9">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
                    <Icon
                      name="upload"
                      size={14}
                    />

                    File support
                  </span>

                  <h2 className="mt-5 text-3xl font-bold tracking-tight">
                    Common Image and
                    Video Formats
                  </h2>

                  <p className="mt-3 text-sm leading-7 text-gray-300">
                    Available formats
                    vary by workflow.
                    Video processing also
                    depends on the codecs
                    supported by the
                    browser and operating
                    system.
                  </p>

                  <Link
                    href="/remove-watermark#file-types"
                    className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-indigo-300 transition-colors hover:text-white"
                  >
                    View detailed format
                    support

                    <Icon
                      name="arrow"
                      size={15}
                    />
                  </Link>
                </div>

                <div className="grid gap-4 p-6 sm:grid-cols-3 sm:p-8">
                  {SUPPORTED_FORMATS.map(
                    (
                      format,
                    ) => (
                      <article
                        key={
                          format.label
                        }
                        className="rounded-2xl border border-gray-200 bg-gray-50/70 p-5"
                      >
                        <div
                          className={`flex h-11 w-11 items-center justify-center rounded-xl border ${format.style}`}
                        >
                          <Icon
                            name={
                              format.icon
                            }
                            size={20}
                          />
                        </div>

                        <h3 className="mt-4 text-sm font-bold text-gray-950">
                          {
                            format.label
                          }
                        </h3>

                        <p className="mt-2 text-xs leading-5 text-gray-500">
                          {
                            format.description
                          }
                        </p>

                        <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                          {
                            format.limit
                          }
                        </p>
                      </article>
                    ),
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-pink-50"
            aria-hidden="true"
          />

          <div className="container-x relative">
            <div className="mx-auto max-w-4xl overflow-hidden rounded-[2rem] border border-indigo-100 bg-white/85 p-8 text-center shadow-2xl shadow-indigo-100/60 backdrop-blur-xl sm:p-12">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white shadow-xl shadow-indigo-200">
                <Icon
                  name="sparkles"
                  size={28}
                />
              </div>

              <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
                Choose a File and Start
                Editing
              </h2>

              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-gray-600 sm:text-base">
                Open the tool that
                matches your task,
                review its supported
                formats, and process a
                file without creating an
                account.
              </p>

              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  href="/remove-watermark"
                  className="btn-primary justify-center px-6 py-3.5"
                >
                  <Icon
                    name="eraser"
                    size={17}
                  />

                  Remove an Object
                </Link>

                <Link
                  href="/remove-background"
                  className="btn-secondary justify-center px-6 py-3.5"
                >
                  <Icon
                    name="image"
                    size={17}
                  />

                  Remove a Background
                </Link>

                <Link
                  href="/enhance-quality"
                  className="btn-secondary justify-center px-6 py-3.5"
                >
                  <Icon
                    name="wand"
                    size={17}
                  />

                  Improve a File
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
