"use client";

import { useState } from "react";
import { Icon } from "@/components/Icons";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileOpen(false);
  };

  const navLinks = [
    { label: "How It Works", id: "how-it-works" },
    { label: "Features", id: "features" },
    { label: "Examples", id: "before-after" },
    { label: "FAQ", id: "faq" },
  ];

  return (
    <nav className="sticky top-0 z-50 glass border-b border-gray-200/50 dark:border-gray-800/50">
      <div className="container-x flex items-center justify-between h-16">
        <a href="#" className="flex items-center gap-2 font-bold text-lg">
          <Icon name="sparkles" size={22} />
          <span className="gradient-text">Watermark Remover</span>
        </a>

        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <a key={link.id} className="nav-link" onClick={() => scrollTo(link.id)}>
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3" />

        <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden">
          <div className="container-x py-4 flex flex-col gap-3">
            {navLinks.map((link) => (
              <a key={link.id} className="nav-link" onClick={() => scrollTo(link.id)}>
                {link.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
