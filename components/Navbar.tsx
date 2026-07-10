"use client";

import { useState, useCallback, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { Icon } from "@/components/Icons";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const handler = () => { if (mq.matches) setMobileOpen(false); };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileOpen(false);
  }, []);

  const isActive = (path: string) => pathname === path;

  const modeLinks = [
    { label: "Remove Watermark", path: "/remove-watermark", icon: "eraser" as const },
    { label: "Remove Background", path: "/remove-background", icon: "brush" as const },
    { label: "Enhance Quality", path: "/enhance-quality", icon: "wand" as const },
  ];

  const sectionLinks = [
    { label: "How It Works", id: "how-it-works" },
    { label: "Features", id: "features" },
    { label: "Examples", id: "before-after" },
    { label: "FAQ", id: "faq" },
  ];

  return (
    <nav className="sticky top-0 z-50 glass border-b border-gray-200/50 dark:border-gray-800/50">
      <div className="container-x flex items-center justify-between h-16">
        {/* Brand */}
        <a href="/remove-watermark" className="flex items-center gap-2 shrink-0">
          <Image src="/sharpify-logo.png" alt="Sharpify" width={28} height={28} className="w-7 h-7" />
          <span className="font-bold text-xl gradient-text">Sharpify</span>
        </a>

        {/* Desktop nav */}
        <div className="hidden lg:flex items-center gap-1">
          {modeLinks.map((link) => (
            <button
              key={link.path}
              onClick={() => router.push(link.path)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all relative ${
                isActive(link.path)
                  ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
              style={isActive(link.path) ? { boxShadow: "inset 0 -2px 0 #6366f1" } : undefined}
            >
              <Icon name={link.icon} size={14} />
              {link.label}
            </button>
          ))}
          <span className="w-px h-5 bg-gray-300 dark:bg-gray-700 mx-2" />
          {sectionLinks.map((link) => (
            <button
              key={link.id}
              className="nav-link px-2.5 py-2 text-sm"
              onClick={() => scrollTo(link.id)}
            >
              {link.label}
            </button>
          ))}
        </div>

        {/* Mobile toggle — animated hamburger to X */}
        <button className="lg:hidden p-2 relative w-9 h-9 flex items-center justify-center" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="overflow-visible">
            {/* Hamburger */}
            <g className="transition-all duration-300" style={{ opacity: mobileOpen ? 0 : 1 }}>
              <path d="M4 6h16" />
              <path d="M4 12h16" />
              <path d="M4 18h16" />
            </g>
            {/* X */}
            <g className="transition-all duration-300" style={{ opacity: mobileOpen ? 1 : 0 }}>
              <path d="M6 6l12 12" />
              <path d="M18 6l-12 12" />
            </g>
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-gray-200/50 dark:border-gray-800/50">
          <div className="container-x py-4 flex flex-col gap-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1">Tools</p>
            {modeLinks.map((link) => (
              <button
                key={link.path}
                onClick={() => {
                  router.push(link.path);
                  setMobileOpen(false);
                }}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isActive(link.path)
                    ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                <Icon name={link.icon} size={16} />
                {link.label}
              </button>
            ))}
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mt-3 mb-1">Pages</p>
            {sectionLinks.map((link) => (
              <button
                key={link.id}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
                onClick={() => scrollTo(link.id)}
              >
                {link.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
