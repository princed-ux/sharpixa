"use client";

import { useRef, useCallback, useEffect } from "react";
import { Icon } from "@/components/Icons";

// Each pair is a real photo: the "before" file has the watermark baked into
// its pixels, the "after" file is the actual output of the removal engine.
const examples: { label: string; beforeImg: string; afterImg: string }[] = [
  { label: "Watermark Removal", beforeImg: "/demo/before-nature.jpg", afterImg: "/demo/after-nature.jpg" },
  { label: "Text Overlay Removal", beforeImg: "/demo/before-city.jpg", afterImg: "/demo/after-city.jpg" },
  { label: "Logo Removal", beforeImg: "/demo/before-portrait.jpg", afterImg: "/demo/after-portrait.jpg" },
  { label: "Timestamp Cleanup", beforeImg: "/demo/before-coffee.jpg", afterImg: "/demo/after-coffee.jpg" },
];

function ComparisonSlider({ beforeImg, afterImg, label }: { beforeImg: string; afterImg: string; label: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const updateSlider = useCallback((clientX: number) => {
    const container = containerRef.current;
    const reveal = revealRef.current;
    const handle = handleRef.current;
    if (!container || !reveal || !handle) return;
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    reveal.style.width = `${pct}%`;
    handle.style.left = `${pct}%`;
  }, []);

  // The reveal pane is clipped by width, so the image inside sits in a
  // wrapper pinned to the container's pixel width — otherwise the photo
  // would rescale as the slider moves instead of being uncovered.
  useEffect(() => {
    const container = containerRef.current;
    const inner = innerRef.current;
    if (!container || !inner) return;
    const sync = () => {
      inner.style.width = `${container.clientWidth}px`;
    };
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    draggingRef.current = true;
    updateSlider(e.clientX);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    draggingRef.current = true;
    updateSlider(e.touches[0].clientX);
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => { if (draggingRef.current) updateSlider(e.clientX); };
    const onTouchMove = (e: TouchEvent) => { if (draggingRef.current) updateSlider(e.touches[0].clientX); };
    const onEnd = () => { draggingRef.current = false; };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("touchmove", onTouchMove);
    document.addEventListener("mouseup", onEnd);
    document.addEventListener("touchend", onEnd);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("mouseup", onEnd);
      document.removeEventListener("touchend", onEnd);
    };
  }, [updateSlider]);

  return (
    <div>
      <div
        ref={containerRef}
        className="ba-container"
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
      >
        {/* Base layer: the clean result produced by the removal engine */}
        <div className="ba-before">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={afterImg} alt={`After ${label} — cleaned photo`} />
        </div>
        {/* Left reveal pane: the original with the watermark baked in */}
        <div ref={revealRef} className="ba-after">
          <div ref={innerRef} style={{ position: "relative", height: "100%" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={beforeImg}
              alt={`Before ${label} — photo with watermark`}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </div>
        </div>
        <div ref={handleRef} className="ba-handle">
          <div className="ba-handle-btn">
            <Icon name="arrow" size={16} />
          </div>
        </div>
        <span className="ba-label ba-label-before">Before</span>
        <span className="ba-label ba-label-after">After</span>
      </div>
      <p className="text-center text-sm font-semibold mt-3">{label}</p>
    </div>
  );
}

export default function BeforeAfter() {
  return (
    <section className="section bg-gray-50 dark:bg-gray-900/50" id="before-after">
      <div className="container-x">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">Before &amp; After Comparison</h2>
        <p className="text-center text-gray-500 dark:text-gray-400 mb-10">
          Drag the slider — every result below was produced by this tool&apos;s own removal engine
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {examples.map((ex) => (
            <ComparisonSlider key={ex.label} beforeImg={ex.beforeImg} afterImg={ex.afterImg} label={ex.label} />
          ))}
        </div>
      </div>
    </section>
  );
}
