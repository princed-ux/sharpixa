"use client";

import { useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/Icons";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

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
        <a href="/remove-watermark" className="flex items-center gap-2 font-bold text-xl shrink-0">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#sharpify-grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <defs>
              <linearGradient id="sharpify-grad" x1="0" y1="0" x2="24" y2="24">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="50%" stopColor="#a855f7" />
                <stop offset="100%" stopColor="#ec4899" />
              </linearGradient>
            </defs>
            <path d="M12 3c-2 4-6 7-6 11a6 6 0 0 0 12 0c0-4-4-7-6-11Z" />
            <path d="M9 12h6" />
            <path d="M12 9v6" />
          </svg>
          <span className="gradient-text">Sharpify</span>
        </a>

        {/* Desktop nav */}
        <div className="hidden lg:flex items-center gap-1">
          {modeLinks.map((link) => (
            <button
              key={link.path}
              onClick={() => router.push(link.path)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${
                isActive(link.path)
                  ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
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

        {/* Mobile toggle */}
        <button className="lg:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
          <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M4 6h16M4 12h16M4 18h16" />
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
