import type { ReactNode } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import TopBanner from "@/components/TopBanner";
import Footer from "@/components/Footer";
import { Icon } from "@/components/Icons";

type IconName = Parameters<typeof Icon>[0]["name"];

export interface InfoPageSectionLink {
  id: string;
  title: string;
}

interface InfoPageProps {
  eyebrow: string;
  title: string;
  description: string;
  icon?: IconName;
  lastUpdated?: string;
  sections?: InfoPageSectionLink[];
  notice?: ReactNode;
  children: ReactNode;
}

export default function InfoPage({
  eyebrow,
  title,
  description,
  icon = "shield",
  lastUpdated,
  sections = [],
  notice,
  children,
}: InfoPageProps) {
  return (
    <>
      <TopBanner />

      <Navbar />

      <main className="bg-white">
        <section className="mesh-bg relative overflow-hidden border-b border-gray-200/80">
          <div
            className="pointer-events-none absolute -left-32 top-4 h-96 w-96 rounded-full bg-indigo-200/30 blur-3xl"
            aria-hidden="true"
          />

          <div
            className="pointer-events-none absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-pink-200/25 blur-3xl"
            aria-hidden="true"
          />

          <div className="container-x relative py-14 sm:py-16 lg:py-20">
            <nav
              aria-label="Breadcrumb"
              className="mb-8"
            >
              <ol className="flex flex-wrap items-center gap-2 text-xs font-medium text-gray-500">
                <li>
                  <Link
                    href="/"
                    className="transition-colors hover:text-indigo-600 focus:outline-none focus-visible:text-indigo-600"
                  >
                    Home
                  </Link>
                </li>

                <li
                  aria-hidden="true"
                  className="text-gray-300"
                >
                  /
                </li>

                <li
                  aria-current="page"
                  className="text-gray-700"
                >
                  {title}
                </li>
              </ol>
            </nav>

            <div className="max-w-4xl">
              <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-indigo-600 shadow-sm backdrop-blur-sm">
                <Icon
                  name={icon}
                  size={14}
                />

                {eyebrow}
              </span>

              <h1 className="max-w-4xl text-4xl font-extrabold leading-[1.1] tracking-tight text-gray-950 sm:text-5xl lg:text-6xl">
                {title}
              </h1>

              <p className="mt-5 max-w-3xl text-base leading-7 text-gray-600 sm:text-lg sm:leading-8">
                {description}
              </p>

              {lastUpdated && (
                <p className="mt-5 inline-flex items-center gap-2 text-xs font-medium text-gray-500 sm:text-sm">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm">
                    <Icon
                      name="refresh"
                      size={13}
                    />
                  </span>

                  Last updated: {lastUpdated}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden py-12 sm:py-16 lg:py-20">
          <div className="container-x">
            <div
              className={`mx-auto grid max-w-6xl gap-8 ${
                sections.length > 0
                  ? "lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-12"
                  : ""
              }`}
            >
              {sections.length > 0 && (
                <aside className="lg:sticky lg:top-24 lg:self-start">
                  <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 shadow-sm">
                    <p className="px-2 text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">
                      On this page
                    </p>

                    <nav
                      aria-label={`${title} sections`}
                      className="mt-3"
                    >
                      <ul className="space-y-1">
                        {sections.map(
                          (section) => (
                            <li
                              key={
                                section.id
                              }
                            >
                              <a
                                href={`#${section.id}`}
                                className="group flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 transition-all hover:bg-white hover:text-indigo-600 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                              >
                                <span>
                                  {
                                    section.title
                                  }
                                </span>

                                <Icon
                                  name="arrow"
                                  size={13}
                                  className="shrink-0 text-gray-300 transition-colors group-hover:text-indigo-400"
                                />
                              </a>
                            </li>
                          ),
                        )}
                      </ul>
                    </nav>
                  </div>
                </aside>
              )}

              <div className="min-w-0">
                {notice && (
                  <div className="mb-8 flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-indigo-100 bg-white text-indigo-600 shadow-sm">
                      <Icon
                        name="shield"
                        size={18}
                      />
                    </div>

                    <div className="min-w-0 text-sm leading-7 text-indigo-950/75">
                      {notice}
                    </div>
                  </div>
                )}

                <article
                  className="
                    rounded-3xl border border-gray-200 bg-white p-6 shadow-sm
                    sm:p-8 lg:p-10
                    [&>section+section]:mt-10
                    [&_h2]:scroll-mt-28
                    [&_h2]:text-2xl
                    [&_h2]:font-bold
                    [&_h2]:tracking-tight
                    [&_h2]:text-gray-950
                    [&_h3]:mt-7
                    [&_h3]:text-lg
                    [&_h3]:font-bold
                    [&_h3]:text-gray-900
                    [&_p]:mt-4
                    [&_p]:text-sm
                    [&_p]:leading-7
                    [&_p]:text-gray-600
                    sm:[&_p]:text-base
                    [&_ul]:mt-4
                    [&_ul]:space-y-3
                    [&_ol]:mt-4
                    [&_ol]:space-y-3
                    [&_li]:text-sm
                    [&_li]:leading-7
                    [&_li]:text-gray-600
                    sm:[&_li]:text-base
                    [&_a]:font-semibold
                    [&_a]:text-indigo-600
                    [&_a]:underline
                    [&_a]:decoration-indigo-200
                    [&_a]:underline-offset-4
                    hover:[&_a]:decoration-indigo-500
                    [&_strong]:font-bold
                    [&_strong]:text-gray-900
                  "
                >
                  {children}
                </article>

                <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-2xl border border-gray-200 bg-gray-50/80 p-5 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-sm font-bold text-gray-900">
                      Ready to use
                      Sharpixa?
                    </p>

                    <p className="mt-1 text-xs leading-5 text-gray-500 sm:text-sm">
                      Choose the editing
                      workflow that
                      matches your file
                      and task.
                    </p>
                  </div>

                  <Link
                    href="/#tools"
                    className="btn-primary shrink-0 px-5 py-2.5 text-sm"
                  >
                    Explore the tools

                    <Icon
                      name="arrow"
                      size={15}
                    />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}