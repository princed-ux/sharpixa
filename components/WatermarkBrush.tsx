"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Icon } from "@/components/Icons";

interface Props {
  imageUrl: string;
  onMaskChange: (maskDataUrl: string | null) => void;
}

export default function WatermarkBrush({ imageUrl, onMaskChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  // Ref, not state: mousemove events can arrive before React re-renders,
  // and a stale closure would drop the stroke mid-gesture.
  const isDrawingRef = useRef(false);
  const [brushSize, setBrushSize] = useState(30);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [applied, setApplied] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const getCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    return { canvas, ctx };
  }, []);

  const getPos = useCallback((e: React.MouseEvent | MouseEvent | React.TouchEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ("touches" in e) {
      const touch = e.touches[0] || (e as TouchEvent).changedTouches[0];
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      clientX = (e as MouseEvent).clientX;
      clientY = (e as MouseEvent).clientY;
    }
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  }, []);

  const drawStroke = useCallback((fromX: number, fromY: number, toX: number, toY: number, size: number) => {
    const result = getCanvas();
    if (!result || !result.ctx) return;
    const { ctx } = result;
    ctx.lineWidth = size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(239, 68, 68, 0.75)";
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();
  }, [getCanvas]);

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isDrawingRef.current = true;
    setHasDrawn(true);
    setApplied(false);
    const pos = getPos(e);
    const result = getCanvas();
    if (!result || !result.ctx) return;
    const { ctx } = result;
    ctx.fillStyle = "rgba(239, 68, 68, 0.75)";
    ctx.beginPath();
    // Backing store is 2x the display size, so scale brush geometry to match.
    ctx.arc(pos.x, pos.y, brushSize, 0, Math.PI * 2);
    ctx.fill();
    lastPosRef.current = { x: pos.x, y: pos.y };
  }, [getPos, brushSize, getCanvas]);

  const moveDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    const pos = getPos(e);
    const result = getCanvas();
    if (!result || !result.ctx) return;
    const last = lastPosRef.current;
    if (last) {
      drawStroke(last.x, last.y, pos.x, pos.y, brushSize * 2);
    }
    lastPosRef.current = { x: pos.x, y: pos.y };
  }, [getPos, drawStroke, brushSize, getCanvas]);

  const endDraw = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    lastPosRef.current = null;
    // Keep the mask in sync after every stroke so the user can't lose
    // their work by proceeding without pressing "Apply Mask".
    const canvas = canvasRef.current;
    if (canvas) onMaskChange(canvas.toDataURL());
  }, [onMaskChange]);

  const clearMask = useCallback(() => {
    const result = getCanvas();
    if (!result || !result.ctx) return;
    const { canvas, ctx } = result;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    setApplied(false);
    onMaskChange(null);
  }, [getCanvas, onMaskChange]);

  const confirmMask = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onMaskChange(canvas.toDataURL());
    setApplied(true);
  }, [onMaskChange]);

  useEffect(() => {
    const img = imageRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!img || !canvas || !container) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const w = rect.width;
      const maxH = 400;
      const aspect = img.naturalWidth / img.naturalHeight;
      let cw = w;
      let ch = w / aspect;
      if (ch > maxH) {
        ch = maxH;
        cw = maxH * aspect;
      }
      canvas.style.width = `${cw}px`;
      canvas.style.height = `${ch}px`;
      canvas.width = Math.round(cw * 2);
      canvas.height = Math.round(ch * 2);
      img.style.width = `${cw}px`;
      img.style.height = `${ch}px`;
    };

    setImgLoaded(false);
    setHasDrawn(false);
    setApplied(false);

    let cancelled = false;
    const handleLoad = () => {
      if (cancelled) return;
      setImgLoaded(true);
      resize();
    };
    img.addEventListener("load", handleLoad);
    if (img.complete && img.naturalWidth > 0) handleLoad();
    window.addEventListener("resize", resize);
    return () => {
      cancelled = true;
      img.removeEventListener("load", handleLoad);
      window.removeEventListener("resize", resize);
    };
  }, [imageUrl]);

  return (
    <div className="mb-6">
      <label className="block text-sm font-semibold mb-3 flex items-center gap-1.5">
        <Icon name="brush" size={16} /> Brush Over the Watermark Area
      </label>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Paint over the watermark, logo, or text you want to remove. Use the slider to adjust brush size.
      </p>

      <div
        ref={containerRef}
        className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700"
        style={{ touchAction: "none" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imageRef}
          src={imageUrl}
          alt="Mark watermark area"
          className="block w-full"
          draggable={false}
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 cursor-crosshair"
          style={{ imageRendering: "pixelated" }}
          onMouseDown={startDraw}
          onMouseMove={moveDraw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={moveDraw}
          onTouchEnd={endDraw}
        />
        {/* Subtle guide: watermark common position (bottom-right corner) */}
        {!hasDrawn && imgLoaded && (
          <div className="absolute bottom-3 right-3 pointer-events-none opacity-30">
            <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="4" y="4" width="52" height="52" rx="4" stroke="white" strokeWidth="2" strokeDasharray="6 4" />
              <text x="30" y="48" textAnchor="middle" fill="white" fontSize="11" fontFamily="sans-serif" fontWeight="bold">WM</text>
            </svg>
          </div>
        )}
        {!imgLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
            <div className="spinner" />
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 mt-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Brush:</span>
          <input
            type="range"
            min={5}
            max={80}
            value={brushSize}
            onChange={(e) => setBrushSize(parseInt(e.target.value))}
            className="w-24"
          />
          <span className="text-xs text-gray-400 w-6">{brushSize}px</span>
        </div>
        <button className="btn-secondary text-xs px-3 py-1.5" onClick={clearMask}>
          <Icon name="refresh" size={12} /> Clear
        </button>
        {hasDrawn && !applied && (
          <button className="btn-primary text-xs px-4 py-1.5 ml-auto" onClick={confirmMask}>
            <Icon name="check" size={12} /> Apply Mask
          </button>
        )}
        {hasDrawn && applied && (
          <span className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-green-600 dark:text-green-400">
            <Icon name="check" size={14} /> Mask Applied
          </span>
        )}
      </div>
    </div>
  );
}
