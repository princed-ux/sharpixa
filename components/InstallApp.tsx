"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  platforms: string[];
}

function isIOS(): boolean {
  return (
    typeof navigator !== "undefined" &&
    /iphone|ipad|ipod/i.test(navigator.userAgent)
  );
}

export default function InstallApp() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [iosGuidance, setIosGuidance] = useState(false);
  const [iOSDevice, setIOSDevice] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      if ("serviceWorker" in navigator && window.isSecureContext) {
        navigator.serviceWorker
          .register("/sw.js")
          .catch(() => {
            // Registration is optional; the site works without it.
          });
      }
    }
  }, []);

  useEffect(() => {
    if (isIOS()) {
      setIOSDevice(true);
    }

    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as { standalone?: boolean }).standalone === true
    ) {
      setInstalled(true);
    }

    const confirmInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };

    const beforeInstallHandler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", beforeInstallHandler);
    window.addEventListener("appinstalled", confirmInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstallHandler);
      window.removeEventListener("appinstalled", confirmInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) {
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    if (choice.outcome === "accepted") {
      setInstalled(true);
    }
  };

  if (typeof window === "undefined" || installed) {
    return null;
  }

  return (
    <>
      {installPrompt && (
        <button
          type="button"
          onClick={handleInstallClick}
          className="btn-primary fixed bottom-5 right-5 z-50 px-5 py-3 text-sm shadow-lg"
          aria-label="Install the Sharpixa app"
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Install App
        </button>
      )}

      {!installPrompt && iOSDevice && (
        <button
          type="button"
          onClick={() => setIosGuidance((value) => !value)}
          className="btn-primary fixed bottom-5 right-5 z-50 px-5 py-3 text-sm shadow-lg"
          aria-label="Add Sharpixa to your home screen"
        >
          Add to Home Screen
        </button>
      )}

      {iosGuidance && (
        <div className="glass fixed bottom-20 right-5 z-50 max-w-xs rounded-2xl p-5 text-sm leading-relaxed text-gray-800 shadow-xl">
          <p className="font-semibold">
            Install Sharpixa on iPhone or iPad
          </p>
          <p className="mt-2">
            Tap the Share button <span aria-hidden="true">&#8599;</span> in
            Safari, then choose{" "}
            <span className="font-semibold">
              &ldquo;Add to Home Screen&rdquo;
            </span>
            .
          </p>
          <button
            type="button"
            onClick={() => setIosGuidance(false)}
            className="mt-3 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
          >
            Dismiss
          </button>
        </div>
      )}
    </>
  );
}