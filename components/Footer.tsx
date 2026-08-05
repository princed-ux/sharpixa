import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/Icons";

const TOOL_LINKS = [
  {
    label: "Object & Text Remover",
    href: "/remove-watermark/",
    icon: "eraser" as const,
  },
  {
    label: "Background Remover",
    href: "/remove-background/",
    icon: "image" as const,
  },
  {
    label: "Improve Quality",
    href: "/enhance-quality/",
    icon: "wand" as const,
  },
];

const RESOURCE_LINKS = [
  {
    label: "How It Works",
    href: "/remove-watermark/#how-it-works",
  },
  {
    label: "Examples",
    href: "/remove-watermark/#before-after",
  },
  {
    label: "Features",
    href: "/remove-watermark/#features",
  },
  {
    label: "Supported Formats",
    href: "/remove-watermark/#file-types",
  },
  {
    label: "Frequently Asked Questions",
    href: "/remove-watermark/#faq",
  },
];

const COMPANY_LINKS = [
  {
    label: "About Sharpixa",
    href: "/about/",
  },
  {
    label: "Contact",
    href: "/contact/",
  },
  {
    label: "Responsible Use",
    href: "/responsible-use/",
  },
];

const LEGAL_LINKS = [
  {
    label: "Privacy Policy",
    href: "/privacy/",
  },
  {
    label: "Terms of Use",
    href: "/terms/",
  },
  {
    label: "Responsible Use",
    href: "/responsible-use/",
  },
];

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden border-t border-gray-200 bg-gray-950 text-gray-300">
      <div
        className="pointer-events-none absolute -left-40 top-0 h-96 w-96 rounded-full bg-indigo-600/10 blur-3xl"
        aria-hidden="true"
      />

      <div
        className="pointer-events-none absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-pink-600/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="container-x relative">
        <div className="grid gap-10 py-12 sm:py-14 lg:grid-cols-[1.35fr_0.9fr_0.9fr_0.9fr] lg:gap-8">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-3 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950"
              aria-label="Sharpixa homepage"
            >
              <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white shadow-sm">
                <Image
                  src="/sharpixa-logo.png"
                  alt=""
                  width={38}
                  height={38}
                  className="h-9 w-9 object-contain"
                />
              </span>

              <span>
                <span className="block text-xl font-extrabold tracking-tight text-white">
                  Sharpixa
                </span>

                <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">
                  Browser media tools
                </span>
              </span>
            </Link>

            <p className="mt-5 max-w-md text-sm leading-7 text-gray-400">
              Browser-based tools for removing unwanted objects and text,
              creating transparent image backgrounds, and improving image or
              video presentation.
            </p>

            <div className="mt-6 grid max-w-md gap-3 sm:grid-cols-2">
              <div className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Icon
                    name="check"
                    size={14}
                  />
                </span>

                <div>
                  <p className="text-xs font-bold text-gray-200">
                    No account required
                  </p>

                  <p className="mt-1 text-[11px] leading-5 text-gray-500">
                    Open a tool and begin without creating a profile.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                  <Icon
                    name="shield"
                    size={14}
                  />
                </span>

                <div>
                  <p className="text-xs font-bold text-gray-200">
                    Responsible editing
                  </p>

                  <p className="mt-1 text-[11px] leading-5 text-gray-500">
                    Only edit files you own or have permission to modify.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <nav aria-labelledby="footer-tools-title">
            <h2
              id="footer-tools-title"
              className="text-xs font-bold uppercase tracking-[0.16em] text-white"
            >
              Tools
            </h2>

            <ul className="mt-5 space-y-3">
              {TOOL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="group inline-flex items-center gap-2.5 text-sm text-gray-400 transition-colors hover:text-white focus:outline-none focus-visible:text-white"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-gray-500 transition-colors group-hover:border-indigo-400/30 group-hover:text-indigo-300">
                      <Icon
                        name={link.icon}
                        size={13}
                      />
                    </span>

                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-resources-title">
            <h2
              id="footer-resources-title"
              className="text-xs font-bold uppercase tracking-[0.16em] text-white"
            >
              Resources
            </h2>

            <ul className="mt-5 space-y-3">
              {RESOURCE_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white focus:outline-none focus-visible:text-white"
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-gray-700"
                      aria-hidden="true"
                    />

                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-company-title">
            <h2
              id="footer-company-title"
              className="text-xs font-bold uppercase tracking-[0.16em] text-white"
            >
              Company
            </h2>

            <ul className="mt-5 space-y-3">
              {COMPANY_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white focus:outline-none focus-visible:text-white"
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-gray-700"
                      aria-hidden="true"
                    />

                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="border-t border-white/10 py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-start gap-2.5">
                <Icon
                  name="shield"
                  size={15}
                  className="mt-0.5 shrink-0 text-indigo-400"
                />

                <p className="text-xs leading-5 text-gray-500">
                  Sharpixa’s selected file-processing workflow is designed to
                  run inside your browser. Application scripts, advertising
                  resources, analytics resources, and model files may still be
                  downloaded according to the Privacy Policy.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {LEGAL_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-xs font-medium text-gray-500 transition-colors hover:text-gray-200 focus:outline-none focus-visible:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2 border-t border-white/[0.07] pt-5 text-xs text-gray-600 sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {currentYear} Sharpixa. All rights reserved.
            </p>

            <p>
              Results vary according to source quality, browser support, and
              processing complexity.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}