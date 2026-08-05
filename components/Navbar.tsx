"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Image from "next/image";
import Link from "next/link";
import {
  usePathname,
  useRouter,
} from "next/navigation";
import { Icon } from "@/components/Icons";

type ToolLink = {
  label: string;
  shortLabel: string;
  description: string;
  path: string;
  icon:
    | "eraser"
    | "image"
    | "wand";
};

type SectionLink = {
  label: string;
  id: string;
};

const TOOL_LINKS: ToolLink[] = [
  {
    label:
      "Object & Text Remover",
    shortLabel:
      "Object Remover",
    description:
      "Remove objects, text, marks, and authorized watermarks.",
    path:
      "/remove-watermark",
    icon:
      "eraser",
  },
  {
    label:
      "Background Remover",
    shortLabel:
      "Background",
    description:
      "Create transparent PNG images automatically or manually.",
    path:
      "/remove-background",
    icon:
      "image",
  },
  {
    label:
      "Improve Quality",
    shortLabel:
      "Improve Quality",
    description:
      "Resize, denoise, sharpen, and adjust image or video color.",
    path:
      "/enhance-quality",
    icon:
      "wand",
  },
];

const SECTION_LINKS: SectionLink[] = [
  {
    label:
      "How It Works",
    id:
      "how-it-works",
  },
  {
    label:
      "Examples",
    id:
      "before-after",
  },
  {
    label:
      "Features",
    id:
      "features",
  },
  {
    label:
      "Formats",
    id:
      "file-types",
  },
  {
    label:
      "FAQ",
    id:
      "faq",
  },
];

function isToolRoute(
  pathname: string,
  path: string,
): boolean {
  return (
    pathname === path ||
    pathname === `${path}/` ||
    pathname.startsWith(
      `${path}/`,
    )
  );
}

export default function Navbar() {
  const pathname =
    usePathname();

  const router =
    useRouter();

  const [
    mobileOpen,
    setMobileOpen,
  ] = useState(false);

  const [
    activeSection,
    setActiveSection,
  ] = useState<
    string | null
  >(null);

  const currentToolPath =
    useMemo(() => {
      const activeTool =
        TOOL_LINKS.find(
          (tool) =>
            isToolRoute(
              pathname,
              tool.path,
            ),
        );

      return (
        activeTool?.path ??
        "/remove-watermark"
      );
    }, [pathname]);

  const closeMobileMenu =
    useCallback(() => {
      setMobileOpen(false);
    }, []);

  const scrollToSection =
    useCallback(
      (sectionId: string) => {
        setMobileOpen(false);

        const section =
          document.getElementById(
            sectionId,
          );

        if (section) {
          const nextUrl =
            `${window.location.pathname}` +
            `${window.location.search}` +
            `#${sectionId}`;

          window.history.replaceState(
            null,
            "",
            nextUrl,
          );

          section.scrollIntoView({
            behavior:
              "smooth",
            block:
              "start",
          });

          setActiveSection(
            sectionId,
          );

          return;
        }

        router.push(
          `${currentToolPath}#${sectionId}`,
        );
      },
      [
        currentToolPath,
        router,
      ],
    );

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    const originalOverflow =
      document.body.style
        .overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        originalOverflow;
    };
  }, [mobileOpen]);

  useEffect(() => {
    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (
        event.key ===
        "Escape"
      ) {
        setMobileOpen(false);
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, []);

  useEffect(() => {
    const mediaQuery =
      window.matchMedia(
        "(min-width: 1280px)",
      );

    const handleChange = () => {
      if (
        mediaQuery.matches
      ) {
        setMobileOpen(false);
      }
    };

    handleChange();

    mediaQuery.addEventListener(
      "change",
      handleChange,
    );

    return () => {
      mediaQuery.removeEventListener(
        "change",
        handleChange,
      );
    };
  }, []);

  useEffect(() => {
    const hash =
      window.location.hash.replace(
        "#",
        "",
      );

    if (!hash) {
      return;
    }

    let cancelled = false;

    const scrollToHash = () => {
      if (cancelled) {
        return;
      }

      const section =
        document.getElementById(
          hash,
        );

      if (!section) {
        return;
      }

      section.scrollIntoView({
        behavior:
          "smooth",
        block:
          "start",
      });

      setActiveSection(hash);
    };

    const firstFrame =
      window.requestAnimationFrame(
        () => {
          window.requestAnimationFrame(
            scrollToHash,
          );
        },
      );

    return () => {
      cancelled = true;

      window.cancelAnimationFrame(
        firstFrame,
      );
    };
  }, [pathname]);

  useEffect(() => {
    const sections =
      SECTION_LINKS.map(
        (link) =>
          document.getElementById(
            link.id,
          ),
      ).filter(
        (
          section,
        ): section is HTMLElement =>
          Boolean(section),
      );

    if (!sections.length) {
      setActiveSection(null);
      return;
    }

    const observer =
      new IntersectionObserver(
        (entries) => {
          const visibleEntries =
            entries
              .filter(
                (entry) =>
                  entry.isIntersecting,
              )
              .sort(
                (
                  first,
                  second,
                ) =>
                  second
                    .intersectionRatio -
                  first
                    .intersectionRatio,
              );

          const mostVisible =
            visibleEntries[0];

          if (
            mostVisible?.target
              .id
          ) {
            setActiveSection(
              mostVisible
                .target.id,
            );
          }
        },
        {
          rootMargin:
            "-20% 0px -65% 0px",

          threshold: [
            0,
            0.1,
            0.25,
            0.5,
          ],
        },
      );

    sections.forEach(
      (section) => {
        observer.observe(
          section,
        );
      },
    );

    return () => {
      observer.disconnect();
    };
  }, [pathname]);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/90 shadow-sm shadow-gray-900/[0.03] backdrop-blur-xl">
        <nav
          className="container-x"
          aria-label="Primary navigation"
        >
          <div className="flex h-16 items-center justify-between gap-4">
            <Link
              href="/"
              className="group flex shrink-0 items-center gap-2.5 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              aria-label="Sharpixa home"
              onClick={
                closeMobileMenu
              }
            >
              <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 shadow-sm transition-transform duration-300 group-hover:scale-105">
                <Image
                  src="/sharpixa-logo.png"
                  alt=""
                  width={32}
                  height={32}
                  priority
                  className="h-8 w-8 object-contain"
                />
              </span>

              <span className="flex flex-col">
                <span className="gradient-text text-lg font-extrabold leading-none tracking-tight sm:text-xl">
                  Sharpixa
                </span>

                <span className="mt-1 hidden text-[9px] font-semibold uppercase tracking-[0.16em] text-gray-400 sm:block">
                  Browser media tools
                </span>
              </span>
            </Link>

            <div className="hidden min-w-0 flex-1 items-center justify-center xl:flex">
              <div className="flex items-center gap-1 rounded-2xl border border-gray-200/80 bg-gray-50/80 p-1">
                {TOOL_LINKS.map(
                  (tool) => {
                    const active =
                      isToolRoute(
                        pathname,
                        tool.path,
                      );

                    return (
                      <Link
                        key={
                          tool.path
                        }
                        href={
                          tool.path
                        }
                        title={
                          tool.description
                        }
                        aria-current={
                          active
                            ? "page"
                            : undefined
                        }
                        className={`relative flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                          active
                            ? "bg-white text-indigo-600 shadow-sm ring-1 ring-gray-200/80"
                            : "text-gray-600 hover:bg-white/80 hover:text-gray-900"
                        }`}
                      >
                        <Icon
                          name={
                            tool.icon
                          }
                          size={15}
                        />

                        <span>
                          {
                            tool.shortLabel
                          }
                        </span>

                        {active && (
                          <span
                            className="absolute inset-x-3 -bottom-1 h-0.5 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
                            aria-hidden="true"
                          />
                        )}
                      </Link>
                    );
                  },
                )}
              </div>
            </div>

            <div className="hidden shrink-0 items-center gap-1 xl:flex">
              {SECTION_LINKS.map(
                (section) => {
                  const active =
                    activeSection ===
                    section.id;

                  return (
                    <button
                      key={
                        section.id
                      }
                      type="button"
                      onClick={() =>
                        scrollToSection(
                          section.id,
                        )
                      }
                      className={`rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                        active
                          ? "bg-indigo-50 text-indigo-600"
                          : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                      }`}
                    >
                      {
                        section.label
                      }
                    </button>
                  );
                },
              )}
            </div>

            <button
              type="button"
              className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 shadow-sm transition-all hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 xl:hidden"
              onClick={() =>
                setMobileOpen(
                  (
                    current,
                  ) =>
                    !current,
                )
              }
              aria-expanded={
                mobileOpen
              }
              aria-controls="sharpixa-mobile-navigation"
              aria-label={
                mobileOpen
                  ? "Close navigation menu"
                  : "Open navigation menu"
              }
            >
              <span className="sr-only">
                {mobileOpen
                  ? "Close menu"
                  : "Open menu"}
              </span>

              <span
                className={`absolute h-0.5 w-5 rounded-full bg-current transition-all duration-300 ${
                  mobileOpen
                    ? "translate-y-0 rotate-45"
                    : "-translate-y-1.5 rotate-0"
                }`}
              />

              <span
                className={`absolute h-0.5 w-5 rounded-full bg-current transition-all duration-300 ${
                  mobileOpen
                    ? "scale-x-0 opacity-0"
                    : "scale-x-100 opacity-100"
                }`}
              />

              <span
                className={`absolute h-0.5 w-5 rounded-full bg-current transition-all duration-300 ${
                  mobileOpen
                    ? "translate-y-0 -rotate-45"
                    : "translate-y-1.5 rotate-0"
                }`}
              />
            </button>
          </div>
        </nav>
      </header>

      {mobileOpen && (
        <div
          className="fixed inset-0 top-16 z-40 bg-gray-950/30 backdrop-blur-sm xl:hidden"
          onMouseDown={(
            event,
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setMobileOpen(
                false,
              );
            }
          }}
          role="presentation"
        >
          <div
            id="sharpixa-mobile-navigation"
            className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-gray-200 bg-white shadow-2xl"
          >
            <div className="container-x py-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">
                  Sharpixa tools
                </p>

                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />

                  No account required
                </span>
              </div>

              <div className="grid gap-2 md:grid-cols-3">
                {TOOL_LINKS.map(
                  (tool) => {
                    const active =
                      isToolRoute(
                        pathname,
                        tool.path,
                      );

                    return (
                      <Link
                        key={
                          tool.path
                        }
                        href={
                          tool.path
                        }
                        onClick={
                          closeMobileMenu
                        }
                        aria-current={
                          active
                            ? "page"
                            : undefined
                        }
                        className={`group flex items-start gap-3 rounded-2xl border p-4 transition-all ${
                          active
                            ? "border-indigo-200 bg-indigo-50/70 shadow-sm"
                            : "border-gray-200 bg-white hover:border-indigo-200 hover:bg-gray-50"
                        }`}
                      >
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                            active
                              ? "border-indigo-200 bg-white text-indigo-600"
                              : "border-gray-200 bg-gray-50 text-gray-600 group-hover:text-indigo-600"
                          }`}
                        >
                          <Icon
                            name={
                              tool.icon
                            }
                            size={18}
                          />
                        </span>

                        <span className="min-w-0">
                          <span
                            className={`block text-sm font-bold ${
                              active
                                ? "text-indigo-700"
                                : "text-gray-900"
                            }`}
                          >
                            {
                              tool.label
                            }
                          </span>

                          <span className="mt-1 block text-xs leading-5 text-gray-500">
                            {
                              tool.description
                            }
                          </span>
                        </span>

                        <Icon
                          name="arrow"
                          size={15}
                          className={`ml-auto mt-1 shrink-0 ${
                            active
                              ? "text-indigo-500"
                              : "text-gray-300"
                          }`}
                        />
                      </Link>
                    );
                  },
                )}
              </div>

              <div className="my-5 h-px bg-gray-200" />

              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">
                On this page
              </p>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {SECTION_LINKS.map(
                  (section) => {
                    const active =
                      activeSection ===
                      section.id;

                    return (
                      <button
                        key={
                          section.id
                        }
                        type="button"
                        onClick={() =>
                          scrollToSection(
                            section.id,
                          )
                        }
                        className={`flex items-center justify-between rounded-xl border px-3 py-3 text-left text-sm font-semibold transition-all ${
                          active
                            ? "border-indigo-200 bg-indigo-50 text-indigo-600"
                            : "border-gray-200 bg-white text-gray-600 hover:border-indigo-200 hover:text-indigo-600"
                        }`}
                      >
                        {
                          section.label
                        }

                        <Icon
                          name="arrow"
                          size={13}
                          className={
                            active
                              ? "text-indigo-500"
                              : "text-gray-300"
                          }
                        />
                      </button>
                    );
                  },
                )}
              </div>

              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-600">
                  <Icon
                    name="shield"
                    size={17}
                  />
                </div>

                <p className="text-xs leading-5 text-gray-500">
                  Only upload files
                  you own or have
                  permission to edit.
                  Sharpixa’s editing
                  workflow is designed
                  to process selected
                  files inside your
                  browser.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}