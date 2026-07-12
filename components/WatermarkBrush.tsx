"use client";

import { useRef, useState, useEffect, useCallback } from "react";

type BrushTool = "paint" | "pencil" | "circle";

interface Props {
 imageUrl: string;
 videoUrl?: string;
 onMaskChange: (maskDataUrl: string | null) => void;
}

const BRAND_COLOR = "rgba(99, 102, 241, 0.7)";
const MAX_HISTORY = 50;
const TOOLS: { id: BrushTool; label: string }[] = [
 { id: "paint", label: "Paint" },
 { id: "pencil", label: "Pencil" },
 { id: "circle", label: "Circle" },
];

export default function WatermarkBrush({ imageUrl, videoUrl, onMaskChange }: Props) {
 const containerRef = useRef<HTMLDivElement>(null);
 const imageRef = useRef<HTMLImageElement>(null);
 const videoRef = useRef<HTMLVideoElement>(null);
 const canvasRef = useRef<HTMLCanvasElement>(null);
 const lastPosRef = useRef<{ x: number; y: number } | null>(null);
 const isDrawingRef = useRef(false);
 const historyRef = useRef<ImageData[]>([]);
 const historyIdxRef = useRef(-1);
 const [brushSize, setBrushSize] = useState(30);
 const [brushTool, setBrushTool] = useState<BrushTool>("paint");
 const [hasDrawn, setHasDrawn] = useState(false);
 const [mediaLoaded, setMediaLoaded] = useState(false);
 const [canUndo, setCanUndo] = useState(false);
 const [canRedo, setCanRedo] = useState(false);
 const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
 const [videoPlaying, setVideoPlaying] = useState(false);
 const [videoProgress, setVideoProgress] = useState(0);
 const rafRef = useRef(0);

 const isVideo = !!videoUrl;

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
 if (isVideo && videoPlaying) return;
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
 }, [getPos, brushSize, brushTool, getCanvas, isVideo, videoPlaying]);

 const moveDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
 if (isVideo && videoPlaying) return;
 if (!isDrawingRef.current || brushTool === "circle") return;
 e.preventDefault();
 const pos = getPos(e);
 const last = lastPosRef.current;
 if (last) {
 drawStroke(last.x, last.y, pos.x, pos.y, brushSize * 2, brushTool);
 }
 lastPosRef.current = { x: pos.x, y: pos.y };
 }, [getPos, drawStroke, brushSize, brushTool, getCanvas, isVideo, videoPlaying]);

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

 const togglePlay = useCallback(() => {
 const v = videoRef.current;
 if (!v) return;
 if (v.paused) {
 void v.play();
 setVideoPlaying(true);
 } else {
 v.pause();
 setVideoPlaying(false);
 }
 }, []);

 useEffect(() => {
 if (!isVideo || !isDrawingRef.current) return;
 isDrawingRef.current = false;
 lastPosRef.current = null;
 }, [videoPlaying, isVideo]);

 const resize = useCallback((naturalW: number, naturalH: number) => {
 const container = containerRef.current;
 const canvas = canvasRef.current;
 const video = videoRef.current;
 if (!container || !canvas) return;
 const rect = container.getBoundingClientRect();
 const w = Math.min(rect.width, 700);
 const aspect = naturalW / naturalH;
 const ch = w / aspect;
 setCanvasSize({ w, h: ch });
 canvas.style.width = `${w}px`;
 canvas.style.height = `${ch}px`;
 canvas.width = Math.round(w * 2);
 canvas.height = Math.round(ch * 2);
 if (video) {
 video.style.width = `${w}px`;
 video.style.height = `${ch}px`;
 }
 }, []);

 useEffect(() => {
 const container = containerRef.current;
 const canvas = canvasRef.current;
 if (!canvas || !container) return;

 setMediaLoaded(false);
 setHasDrawn(false);
 historyRef.current = [];
 historyIdxRef.current = -1;
 setCanUndo(false);
 setCanRedo(false);

 if (isVideo) {
 const video = videoRef.current;
 if (!video) return;
 let cancelled = false;
 const handleMeta = () => {
 if (cancelled) return;
 const nw = video.videoWidth;
 const nh = video.videoHeight;
 if (!nw || !nh) return;
 setMediaLoaded(true);
 resize(nw, nh);
 const cvs = canvas;
 const ctx = cvs.getContext("2d");
 if (ctx) {
 cvs.width = Math.round(cvs.style.width ? parseInt(cvs.style.width) * 2 : 700 * 2);
 cvs.height = Math.round(cvs.style.height ? parseInt(cvs.style.height) * 2 : 400 * 2);
 const data = ctx.getImageData(0, 0, cvs.width, cvs.height);
 historyRef.current = [data];
 historyIdxRef.current = 0;
 }
 };
 video.addEventListener("loadedmetadata", handleMeta);
 if (video.readyState >= 1) handleMeta();
 const handleTime = () => {
 if (video.duration) setVideoProgress((video.currentTime / video.duration) * 100);
 };
 video.addEventListener("timeupdate", handleTime);
 const onResize = () => {
 if (video.videoWidth && video.videoHeight) resize(video.videoWidth, video.videoHeight);
 };
 window.addEventListener("resize", onResize);
 return () => {
 cancelled = true;
 video.removeEventListener("loadedmetadata", handleMeta);
 video.removeEventListener("timeupdate", handleTime);
 window.removeEventListener("resize", onResize);
 };
 }

 const img = imageRef.current;
 if (!img) return;
 let cancelled = false;
 const handleLoad = () => {
 if (cancelled) return;
 setMediaLoaded(true);
 resize(img.naturalWidth, img.naturalHeight);
 const result = getCanvas();
 if (result && result.ctx) {
 const data = result.ctx.getImageData(0, 0, canvas.width, canvas.height);
 historyRef.current = [data];
 historyIdxRef.current = 0;
 }
 };
 img.addEventListener("load", handleLoad);
 if (img.complete && img.naturalWidth > 0) handleLoad();
 const onResize = () => {
 if (img.naturalWidth && img.naturalHeight) resize(img.naturalWidth, img.naturalHeight);
 };
 window.addEventListener("resize", onResize);
 return () => {
 cancelled = true;
 img.removeEventListener("load", handleLoad);
 window.removeEventListener("resize", onResize);
 };
 }, [isVideo, imageUrl, videoUrl, getCanvas, resize]);

 const mediaH = canvasSize.h || 300;

 return (
 <div>
 {/* All controls */}
 <div className="flex items-center justify-center gap-2 flex-wrap mb-4">
 {/* Tool switcher */}
 <div className="flex gap-0.5 p-0.5 rounded-xl bg-gray-100">
 {TOOLS.map((t) => (
 <button
 key={t.id}
 className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
 brushTool === t.id
 ? "bg-white shadow-sm text-indigo-600"
  : "text-gray-500 hover:text-gray-700"
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
 <span className="w-px h-5 bg-gray-200" />

 {/* Undo arrow */}
 <button
 className={`flex items-center justify-center w-7 h-7 rounded-lg transition-all ${
 canUndo
 ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
 : "text-gray-300 cursor-not-allowed"
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
 ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
 : "text-gray-300 cursor-not-allowed"
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
  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-all"
 onClick={clearMask}
 >
 Clear
 </button>
 </div>

 <div
 ref={containerRef}
 className="relative rounded-xl overflow-hidden border border-gray-200 mx-auto"
 style={{ touchAction: "none", maxWidth: 700 }}
 >
 {isVideo ? (
 <>
 {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
 <video
 ref={videoRef}
 src={videoUrl}
 className="block mx-auto"
 muted
 playsInline
 draggable={false}
 style={{ display: mediaLoaded ? "block" : "none" }}
 />
 {/* Canvas overlay — hidden while video is playing so user can see the content */}
 <canvas
 ref={canvasRef}
 className="absolute top-0 left-1/2 cursor-crosshair"
 style={{
 transform: "translateX(-50%)",
 imageRendering: "pixelated",
 opacity: videoPlaying ? 0 : 1,
 pointerEvents: videoPlaying ? "none" : "auto",
 }}
 onMouseDown={startDraw}
 onMouseMove={moveDraw}
 onMouseUp={endDraw}
 onMouseLeave={endDraw}
 onTouchStart={startDraw}
 onTouchMove={moveDraw}
 onTouchEnd={endDraw}
 />
 {/* Play/Pause overlay */}
 {mediaLoaded && (
 <>
 <button
 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/60 text-white transition-all"
 onClick={togglePlay}
 aria-label={videoPlaying ? "Pause" : "Play"}
 >
 {videoPlaying ? (
 <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
 <rect x="6" y="4" width="4" height="16" />
 <rect x="14" y="4" width="4" height="16" />
 </svg>
 ) : (
 <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
 <path d="M8 5v14l11-7z" />
 </svg>
 )}
 </button>
 {/* Progress bar */}
 <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800/30">
 <div
 className="h-full bg-indigo-500 transition-[width] duration-200"
 style={{ width: `${videoProgress}%` }}
 />
 </div>
 </>
 )}
 </>
 ) : (
 <>
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
 </>
 )}
 {!mediaLoaded && (
 <div className="flex items-center justify-center" style={{ height: mediaH }}>
 <div className="spinner" />
 </div>
 )}
 </div>
 </div>
 );
}
