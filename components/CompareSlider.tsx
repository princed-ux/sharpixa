"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export default function CompareSlider({
  beforeUrl,
  afterUrl,
  isVideo = false,
  mode,
}: {
  beforeUrl: string;
  afterUrl: string;
  isVideo?: boolean;
  mode?: "watermark" | "background" | "enhance";
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(50);
  const draggingRef = useRef(false);
  const autoAnimRef = useRef(0);
  const autoActiveRef = useRef(true);

  const updatePos = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setPos((x / rect.width) * 100);
  }, []);

  // Auto-animation: sweeps 0→100→0 repeatedly
  useEffect(() => {
    const duration = 4000;
    let start = performance.now();

    const tick = (now: number) => {
      if (!autoActiveRef.current) {
        autoAnimRef.current = requestAnimationFrame(tick);
        return;
      }
      const elapsed = now - start;
      // Triangle wave: 0→1→0 over each full cycle
      const cycle = (elapsed % duration) / duration;
      const t = cycle < 0.5 ? cycle * 2 : 2 - cycle * 2;
      // Ease in-out
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      if (!draggingRef.current) {
        setPos(eased * 100);
      }
      autoAnimRef.current = requestAnimationFrame(tick);
    };
    autoAnimRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(autoAnimRef.current);
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    autoActiveRef.current = false;
    draggingRef.current = true;
    updatePos(e.clientX);
  }, [updatePos]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    autoActiveRef.current = false;
    draggingRef.current = true;
    updatePos(e.touches[0].clientX);
  }, [updatePos]);

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!draggingRef.current) return;
      const cx = "touches" in e ? e.touches[0].clientX : e.clientX;
      updatePos(cx);
    };
    const onUp = () => { draggingRef.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [updatePos]);

  const modeLabel = mode === "watermark" ? "Remove Watermark"
    : mode === "background" ? "Remove Background"
    : "Enhance Quality";

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs font-semibold mb-2 px-1">
        <span className="text-gray-500">Original</span>
        <span className="text-indigo-500">{modeLabel}</span>
      </div>
      <div
        ref={containerRef}
        className="relative select-none overflow-hidden rounded-xl cursor-ew-resize"
        style={{ userSelect: "none", WebkitUserSelect: "none" }}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
      >
        {isVideo ? (
          <video src={afterUrl} muted loop playsInline className="block w-full" />
        ) : (
          <img src={afterUrl} alt="After" className="block w-full" draggable={false} />
        )}

        <div
          className="absolute inset-0"
          style={{
            clipPath: `inset(0 ${100 - pos}% 0 0)`,
            WebkitClipPath: `inset(0 ${100 - pos}% 0 0)`,
          }}
        >
          {isVideo ? (
            <video src={beforeUrl} muted loop playsInline className="block w-full h-full" style={{ objectFit: "cover" }} />
          ) : (
            <img src={beforeUrl} alt="Original" className="block w-full h-full" draggable={false} style={{ objectFit: "cover" }} />
          )}
        </div>

        {/* Divider line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg pointer-events-none"
          style={{ left: `${pos}%`, transform: "translateX(-50%)" }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center pointer-events-auto">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round">
              <path d="M9 5l-7 7 7 7" />
              <path d="M15 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-2 text-center">
        Drag the slider left or right to compare
      </p>
    </div>
  );
}
