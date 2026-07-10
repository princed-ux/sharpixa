"use client";

import { useRef, useState, useEffect, useCallback } from "react";

type BrushTool = "paint" | "pencil" | "circle";

interface Props {
  imageUrl: string;
  onMaskChange: (maskDataUrl: string | null) => void;
}

const BRAND_COLOR = "rgba(99, 102, 241, 0.7)";
const MAX_HISTORY = 50;
const TOOLS: { id: BrushTool; label: string }[] = [
  { id: "paint", label: "Paint" },
  { id: "pencil", label: "Pencil" },
  { id: "circle", label: "Circle" },
];

export default function WatermarkBrush({ imageUrl, onMaskChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const isDrawingRef = useRef(false);
  const historyRef = useRef<ImageData[]>([]);
  const historyIdxRef = useRef(-1);
  const [brushSize, setBrushSize] = useState(30);
  const [brushTool, setBrushTool] = useState<BrushTool>("paint");
  const [hasDrawn, setHasDrawn] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });

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

  const saveSnapshot = useCallback(() => {
    const result = getCanvas();
    if (!result || !result.ctx) return;
    const { canvas, ctx } = result;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // Truncate any redo history beyond current index
    historyRef.current = historyRef.current.slice(0, historyIdxRef.current + 1);
    historyRef.current.push(data);
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift();
    }
    historyIdxRef.current = historyRef.current.length - 1;
    setCanUndo(historyIdxRef.current > 0);
    setCanRedo(false);
  }, [getCanvas]);

  const restoreSnapshot = useCallback((idx: number) => {
    const result = getCanvas();
    if (!result || !result.ctx) return;
    const { canvas, ctx } = result;
    const data = historyRef.current[idx];
    if (data) {
      ctx.putImageData(data, 0, 0);
      onMaskChange(canvas.toDataURL());
    }
    setHasDrawn(idx > 0);
    setCanUndo(idx > 0);
    setCanRedo(idx < historyRef.current.length - 1);
  }, [getCanvas, onMaskChange]);

  const drawStroke = useCallback((fromX: number, fromY: number, toX: number, toY: number, size: number, tool: BrushTool) => {
    const result = getCanvas();
    if (!result || !result.ctx) return;
    const { ctx } = result;
    const lineWidth = tool === "pencil" ? Math.max(size * 0.4, 3) : size;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = BRAND_COLOR;
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();
  }, [getCanvas]);

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isDrawingRef.current = true;
    setHasDrawn(true);
    const pos = getPos(e);
    const result = getCanvas();
    if (!result || !result.ctx) return;
    const { ctx } = result;

    if (brushTool === "circle") {
      ctx.fillStyle = BRAND_COLOR;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, brushSize, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = BRAND_COLOR;
      ctx.beginPath();
      const dotSize = brushTool === "pencil" ? Math.max(brushSize * 0.4, 3) : brushSize;
      ctx.arc(pos.x, pos.y, dotSize, 0, Math.PI * 2);
      ctx.fill();
    }
    lastPosRef.current = { x: pos.x, y: pos.y };
  }, [getPos, brushSize, brushTool, getCanvas]);

  const moveDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingRef.current || brushTool === "circle") return;
    e.preventDefault();
    const pos = getPos(e);
    const last = lastPosRef.current;
    if (last) {
      drawStroke(last.x, last.y, pos.x, pos.y, brushSize * 2, brushTool);
    }
    lastPosRef.current = { x: pos.x, y: pos.y };
  }, [getPos, drawStroke, brushSize, brushTool, getCanvas]);

  const endDraw = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    lastPosRef.current = null;
    saveSnapshot();
    const canvas = canvasRef.current;
    if (canvas) onMaskChange(canvas.toDataURL());
  }, [saveSnapshot, onMaskChange]);

  const undo = useCallback(() => {
    if (historyIdxRef.current > 0) {
      historyIdxRef.current--;
      restoreSnapshot(historyIdxRef.current);
    }
  }, [restoreSnapshot]);

  const redo = useCallback(() => {
    if (historyIdxRef.current < historyRef.current.length - 1) {
      historyIdxRef.current++;
      restoreSnapshot(historyIdxRef.current);
    }
  }, [restoreSnapshot]);

  const clearMask = useCallback(() => {
    const result = getCanvas();
    if (!result || !result.ctx) return;
    const { canvas, ctx } = result;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    historyRef.current = [];
    historyIdxRef.current = -1;
    setHasDrawn(false);
    setCanUndo(false);
    setCanRedo(false);
    onMaskChange(null);
  }, [getCanvas, onMaskChange]);

  useEffect(() => {
    const img = imageRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!img || !canvas || !container) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const w = Math.min(rect.width, 700);
      const aspect = img.naturalWidth / img.naturalHeight;
      const ch = w / aspect;
      setCanvasSize({ w, h: ch });
      canvas.style.width = `${w}px`;
      canvas.style.height = `${ch}px`;
      canvas.width = Math.round(w * 2);
      canvas.height = Math.round(ch * 2);
      img.style.width = `${w}px`;
      img.style.height = `${ch}px`;
    };

    setImgLoaded(false);
    setHasDrawn(false);
    historyRef.current = [];
    historyIdxRef.current = -1;
    setCanUndo(false);
    setCanRedo(false);

    let cancelled = false;
    const handleLoad = () => {
      if (cancelled) return;
      setImgLoaded(true);
      resize();
      // Save initial blank state
      const result = getCanvas();
      if (result && result.ctx) {
        const data = result.ctx.getImageData(0, 0, canvas.width, canvas.height);
        historyRef.current = [data];
        historyIdxRef.current = 0;
      }
    };
    img.addEventListener("load", handleLoad);
    if (img.complete && img.naturalWidth > 0) handleLoad();
    window.addEventListener("resize", resize);
    return () => {
      cancelled = true;
      img.removeEventListener("load", handleLoad);
      window.removeEventListener("resize", resize);
    };
  }, [imageUrl, getCanvas]);

  return (
    <div>
      {/* All controls in one row at the top */}
      <div className="flex items-center justify-center gap-2 flex-wrap mb-4">
        {/* Tool switcher */}
        <div className="flex gap-0.5 p-0.5 rounded-xl bg-gray-100 dark:bg-gray-800">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                brushTool === t.id
                  ? "bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-indigo-400"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
              onClick={() => setBrushTool(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Size slider */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-500 font-medium">Size</span>
          <input
            type="range"
            min={5}
            max={brushTool === "pencil" ? 40 : 80}
            value={brushSize}
            onChange={(e) => setBrushSize(parseInt(e.target.value))}
            className="w-20"
          />
          <span className="text-[11px] text-gray-400 font-mono w-7 text-right">{brushSize}px</span>
        </div>

        {/* Spacer */}
        <span className="w-px h-5 bg-gray-200 dark:bg-gray-700" />

        {/* Undo arrow */}
        <button
          className={`flex items-center justify-center w-7 h-7 rounded-lg transition-all ${
            canUndo
              ? "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              : "text-gray-300 dark:text-gray-600 cursor-not-allowed"
          }`}
          onClick={undo}
          disabled={!canUndo}
          title="Undo"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 7H4" /><path d="M4 7l4 4" /><path d="M4 7l4-4" />
          </svg>
        </button>

        {/* Redo arrow */}
        <button
          className={`flex items-center justify-center w-7 h-7 rounded-lg transition-all ${
            canRedo
              ? "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              : "text-gray-300 dark:text-gray-600 cursor-not-allowed"
          }`}
          onClick={redo}
          disabled={!canRedo}
          title="Redo"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 7h10" /><path d="M20 7l-4 4" /><path d="M20 7l-4-4" />
          </svg>
        </button>

        {/* Clear */}
        <button
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50 transition-all"
          onClick={clearMask}
        >
          Clear
        </button>
      </div>

      <div
        ref={containerRef}
        className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 mx-auto"
        style={{ touchAction: "none", maxWidth: 700 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imageRef}
          src={imageUrl}
          alt="Mark watermark area"
          className="block mx-auto"
          draggable={false}
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-1/2 cursor-crosshair"
          style={{ transform: "translateX(-50%)", imageRendering: "pixelated" }}
          onMouseDown={startDraw}
          onMouseMove={moveDraw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={moveDraw}
          onTouchEnd={endDraw}
        />
        {!imgLoaded && (
          <div className="flex items-center justify-center" style={{ height: canvasSize.h || 300 }}>
            <div className="spinner" />
          </div>
        )}
      </div>
    </div>
  );
}
