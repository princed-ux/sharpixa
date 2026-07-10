"use client";

import { useState, useRef, useCallback } from "react";
import { Icon } from "@/components/Icons";
import WatermarkBrush from "@/components/WatermarkBrush";
import {
  IMAGE_FORMATS,
  VIDEO_FORMATS,
  FILE_LIMITS,
  PRESETS,
  DEFAULT_CONTROLS,
  type AdvancedControls,
} from "@/lib/constants";
import {
  enhanceImage,
  processVideo,
  canvasToBlob,
  formatBytes,
  generateSampleImage,
  removeBackgroundFromImage,
  autoRemoveBackgroundFromImage,
  removeWatermarkFromImage,
  captureVideoFrame,
} from "@/lib/enhance";

type Mode = "watermark" | "enhance" | "background";
type Tab = "image" | "video";
type Preset = "light" | "standard" | "maximum";
type Resolution = "original" | "2x" | "4x" | "8k";
type Phase = "upload" | "settings" | "brush" | "processing" | "result";

export default function UploadZone({ mode: initialMode }: { mode: Mode }) {
  const [mode] = useState<Mode>(initialMode);
  const [tab, setTab] = useState<Tab>("image");
  const [file, setFile] = useState<File | null>(null);
  const [fileURL, setFileURL] = useState<string | null>(null);
  const [posterURL, setPosterURL] = useState<string | null>(null);
  const [fileType, setFileType] = useState<Tab>("image");
  const [maskDataUrl, setMaskDataUrl] = useState<string | null>(null);
  const [preset, setPreset] = useState<Preset>("standard");
  const [resolution, setResolution] = useState<Resolution>("original");
  const [phase, setPhase] = useState<Phase>("upload");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [enhancedURL, setEnhancedURL] = useState<string | null>(null);
  const [enhancedBlob, setEnhancedBlob] = useState<Blob | null>(null);
  const [controls, setControls] = useState<AdvancedControls>(DEFAULT_CONTROLS);
  const [dragover, setDragover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const limits = FILE_LIMITS;

  const handleFile = useCallback((f: File) => {
    const ext = (f.name.split(".").pop() || "").toLowerCase();
    const isImage = IMAGE_FORMATS.includes(ext as any) || f.type.startsWith("image/");
    const isVideo = VIDEO_FORMATS.includes(ext as any) || f.type.startsWith("video/");

    if (!isImage && !isVideo) {
      setError("Unsupported file format. Please upload an image (JPG, PNG, WEBP) or video (MP4, MOV, AVI, WEBM, MKV).");
      return;
    }

    const type = isImage ? "image" : "video";
    if (mode === "background" && type === "video") {
      setError("Background removal works with images only. Please upload a JPG, PNG, or WEBP file.");
      return;
    }
    if (f.size > limits[type]) {
      const limitMB = Math.round(limits[type] / (1024 * 1024));
      setError(`File too large. Maximum size is ${limitMB}MB.`);
      return;
    }

    setError(null);
    setFile(f);
    setFileType(type);
    setTab(type);
    setMaskDataUrl(null);
    setPosterURL(null);
    if (fileURL) URL.revokeObjectURL(fileURL);
    const url = URL.createObjectURL(f);
    setFileURL(url);
    setEnhancedURL(null);
    setEnhancedBlob(null);
    setProgress(0);

    if (mode === "background" && type === "image") {
      // Auto remove background immediately — no brush needed.
      processBackgroundImage(f, url);
      return;
    }

    const needsBrush = mode === "watermark";
    setPhase(needsBrush ? "brush" : "settings");
    if (needsBrush && type === "video") {
      captureVideoFrame(url)
        .then(setPosterURL)
        .catch(() => setError("Could not read the first video frame. Try a different file."));
    }
  }, [fileURL, mode, limits]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragover(false);
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) handleFile(e.target.files[0]);
  };

  const loadSample = async () => {
    const sample = await generateSampleImage();
    handleFile(sample);
  };

  const reset = () => {
    if (fileURL) URL.revokeObjectURL(fileURL);
    if (enhancedURL && enhancedURL.startsWith("blob:")) URL.revokeObjectURL(enhancedURL);
    setFile(null);
    setFileURL(null);
    setPosterURL(null);
    setEnhancedURL(null);
    setEnhancedBlob(null);
    setMaskDataUrl(null);
    setProgress(0);
    setError(null);
    setPhase("upload");
  };

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const yieldToPaint = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

  const processBackgroundImage = async (f: File, url: string) => {
    setPhase("processing");
    setProgress(0);
    setError(null);
    try {
      const img = new Image();
      img.src = url;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load image"));
      });
      setProgress(20);
      await sleep(100);
      setProgress(40);

      const canvas = await autoRemoveBackgroundFromImage(img);
      setProgress(70);
      await sleep(150);
      const blob = await canvasToBlob(canvas, "image/png");
      setEnhancedBlob(blob);
      setEnhancedURL(URL.createObjectURL(blob));
      setProgress(100);
      await sleep(300);
      setPhase("result");
    } catch (err) {
      setError(`Background removal failed: ${(err as Error).message}. Try a different image.`);
      setPhase("upload");
    }
  };

  const processImage = async () => {
    if (!file || !fileURL) return;
    setPhase("processing");
    setProgress(0);
    setError(null);

    try {
      const img = new Image();
      img.src = fileURL;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load image"));
      });

      setProgress(15);
      await sleep(200);
      setProgress(35);
      // Yield to the browser so the processing UI fully paints before the
      // heavy synchronous inpainting work starts.
      await yieldToPaint();
      await sleep(150);

      const canvas = mode === "background"
        ? await removeBackgroundFromImage(img, maskDataUrl)
        : mode === "watermark"
          ? await removeWatermarkFromImage(img, maskDataUrl)
          : await enhanceImage(img, preset, resolution, controls, maskDataUrl);

      setProgress(70);
      await sleep(200);

      const fmt = mode === "background"
        ? "image/png"
        : file.type === "image/jpeg"
          ? "image/jpeg"
          : "image/png";
      const blob = await canvasToBlob(canvas, fmt);
      setEnhancedBlob(blob);
      setEnhancedURL(URL.createObjectURL(blob));

      setProgress(90);
      await sleep(150);
      setProgress(100);
      await sleep(300);

      setPhase("result");
    } catch (err) {
      setError(`Processing failed: ${(err as Error).message}. Please try again.`);
      setPhase(mode === "enhance" ? "settings" : "brush");
    }
  };

  const processVideoFile = async () => {
    if (!file || !fileURL) return;
    setPhase("processing");
    setProgress(0);
    setError(null);

    try {
      const blob = mode === "watermark"
        ? await processVideo(file, fileURL, "none", "original", undefined, (pct) => {
            setProgress(pct);
          }, maskDataUrl)
        : await processVideo(file, fileURL, preset, resolution, controls, (pct) => {
            setProgress(pct);
          }, maskDataUrl);
      setEnhancedBlob(blob);
      setEnhancedURL(URL.createObjectURL(blob));
      setProgress(100);
      await sleep(300);
      setPhase("result");
    } catch (err) {
      setError(`Video processing failed: ${(err as Error).message}. Please try again.`);
      setPhase(mode === "enhance" ? "settings" : "brush");
    }
  };

  const handleProcess = () => {
    if (fileType === "image") processImage();
    else processVideoFile();
  };

  const handleDownload = () => {
    if (!enhancedBlob || !file) return;
    const url = enhancedURL || URL.createObjectURL(enhancedBlob);
    const a = document.createElement("a");
    const baseName = file.name.replace(/\.[^/.]+$/, "");
    const ext = enhancedBlob.type.includes("mp4")
      ? "mp4"
      : enhancedBlob.type.startsWith("video/")
        ? "webm"
        : enhancedBlob.type === "image/jpeg"
          ? "jpg"
          : "png";
    a.href = url;
    a.download = `${baseName}_sharpified.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const acceptAttr = tab === "image" ? ".jpg,.jpeg,.png,.webp,image/*" : ".mp4,.mov,.avi,.webm,.mkv,video/*";

  const resOptions: Resolution[] = fileType === "video" ? ["original", "2x", "4x", "8k"] : ["original", "2x", "4x"];

  const resLabel: Record<Resolution, string> = {
    original: "Original",
    "2x": "2K Upscale",
    "4x": "4K Upscale",
    "8k": "8K Upscale",
  };

  // ---- PROCESSING VIEW ----
  if (phase === "processing") {
    const steps = [
      { label: "Loading file...", threshold: 15 },
      { label: "Analyzing content...", threshold: 35 },
      { label: fileType === "image" ? "Processing image..." : "Processing video frames...", threshold: 70 },
      { label: "Finalizing output...", threshold: 90 },
      { label: "Complete!", threshold: 100 },
    ];
    const currentStep = steps.find((s) => progress <= s.threshold) || steps[steps.length - 1];

    // Circular progress ring: circumference = 2 * PI * 52 = 326.73
    const R = 52;
    const C = 2 * Math.PI * R;
    const offset = C - (progress / 100) * C;

    return (
      <div className="max-w-2xl mx-auto animate-fade-in">
        <div className="glass rounded-2xl p-8 md:p-12 text-center relative overflow-hidden">
          {/* Ambient glow */}
          <div className="absolute -top-20 -left-20 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-pink-500/10 rounded-full blur-3xl" />

          <div className="relative flex flex-col items-center">
            {/* Circular progress ring + percentage */}
            <div className="relative mb-6">
              <svg width="140" height="140" viewBox="0 0 120 120" className="transform -rotate-90">
                <defs>
                  <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="50%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#ec4899" />
                  </linearGradient>
                </defs>
                {/* Background track */}
                <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(99,102,241,0.08)" strokeWidth="8" />
                {/* Progress arc */}
                <circle
                  cx="60" cy="60" r={R}
                  fill="none"
                  stroke="url(#ring-grad)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={C}
                  strokeDashoffset={offset}
                  className="transition-all duration-300"
                  style={{ filter: "drop-shadow(0 0 6px rgba(99,102,241,0.4))" }}
                />
                {/* Glowing dot at the leading edge */}
                {progress < 100 && (
                  <circle
                    cx="60" cy="60" r={R}
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray="8 320"
                    strokeDashoffset={offset - 4}
                    className="animate-pulse-soft"
                    opacity={0.8}
                  />
                )}
              </svg>
              {/* Percentage in center */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-bold bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                  {progress}%
                </span>
              </div>
            </div>

            <h3 className="text-xl font-bold mb-2">
              {mode === "watermark" ? "Removing watermark..." : mode === "background" ? "Removing background..." : "Enhancing your " + fileType + "..."}
            </h3>

            <div className="h-6 mb-2" key={currentStep.label}>
              <p className="text-gray-500 dark:text-gray-400 animate-step-in inline-flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block animate-pulse-soft" />
                {currentStep.label}
              </p>
            </div>

            {/* Subtle linear bar below as secondary indicator */}
            <div className="w-48 mx-auto mt-2">
              <div className="h-1 rounded-full overflow-hidden bg-gray-200/50 dark:bg-gray-800/50">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${progress}%`,
                    background: "linear-gradient(90deg, #6366f1, #a855f7, #ec4899)",
                    boxShadow: "0 0 8px rgba(99,102,241,0.3)",
                  }}
                />
              </div>
            </div>

            {/* Warning: don't refresh */}
            <p className="text-xs text-amber-500/80 dark:text-amber-400/80 mt-4 flex items-center justify-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 9v4" /><path d="M12 17h.01" /><circle cx="12" cy="12" r="10" />
              </svg>
              Please don&apos;t refresh or leave — your progress will be lost.
            </p>

            {fileType === "video" && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 flex items-center justify-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-pulse-soft">
                  <rect x="2" y="6" width="20" height="12" rx="2" /><path d="M12 6v12" />
                </svg>
                Processing frame by frame — keep this tab open.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---- RESULT VIEW ----
  if (phase === "result" && enhancedURL) {
    return (
      <div className="max-w-4xl mx-auto animate-fade-in">
        <div className="glass rounded-2xl p-6 md:p-8">
          <div className="text-center mb-6">
            <div className="success-checkmark mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <h3 className="text-xl font-bold">Your {fileType} is ready!</h3>
          </div>

          {fileType === "image" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-sm font-semibold mb-2 text-gray-500 dark:text-gray-400">Before</p>
                <div className="result-preview p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fileURL || ""} className="rounded-lg w-full" alt="Original" />
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold mb-2 text-indigo-500">After</p>
                <div className={`result-preview p-2 ${mode === "background" ? "bg-checkerboard" : ""}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={enhancedURL} className="rounded-lg w-full" alt="Enhanced" />
                </div>
              </div>
            </div>
          ) : (
            <div className="result-preview p-3 mb-6">
              <video src={enhancedURL} controls className="rounded-lg w-full" />
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button className="btn-primary text-base px-8 py-3" onClick={handleDownload}>
              <Icon name="download" size={18} /> Download {fileType === "image" ? "Image" : "Video"}
            </button>
            <button className="btn-secondary text-base px-6 py-3" onClick={reset}>Process Another File</button>
          </div>
        </div>
        <div className="ad-slot mt-6">Advertisement — Google AdSense (Results page native ad)</div>
      </div>
    );
  }

  // ---- BRUSH VIEW (watermark / background modes) ----
  if (phase === "brush" && fileURL && (mode === "watermark" || mode === "background")) {
    const isBg = mode === "background";
    const brushImageUrl = fileType === "video" ? posterURL : fileURL;
    return (
      <div className="max-w-4xl mx-auto animate-fade-in">
        <div className="glass rounded-2xl p-6 md:p-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">{isBg ? "Mark Background Area" : "Mark Watermark Area"}</h3>
            <button className="text-sm text-gray-500 hover:text-red-500 flex items-center gap-1" onClick={reset}>
              <Icon name="close" size={14} /> Remove
            </button>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 text-center">
            {isBg
              ? "Paint over the background area you want to remove. The marked area will become transparent."
              : "Paint over the watermark, logo, or text you want to remove. Use the tool switcher to choose your brush style."}
          </p>

          {brushImageUrl ? (
            <div className="flex justify-center">
              <WatermarkBrush
                imageUrl={brushImageUrl}
                onMaskChange={setMaskDataUrl}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 mb-6">
              <div className="spinner mb-4" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Reading first video frame...</p>
            </div>
          )}

          {fileType === "video" && (
            <p className="text-xs text-amber-500 mb-3 flex items-center gap-1 justify-center mt-3">
              <Icon name="wand" size={12} /> The marked area will be repaired across every frame. Original length and audio are preserved.
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-3 items-center justify-center mt-5">
            {!maskDataUrl && (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Brush over the area first to continue.
              </p>
            )}
            <button
              className={`btn-primary text-sm px-6 py-2.5 ${!maskDataUrl ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={handleProcess}
              disabled={!maskDataUrl}
            >
              <Icon name={isBg ? "brush" : "eraser"} size={14} /> {isBg ? "Remove Background" : "Remove Watermark"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- SETTINGS VIEW ----
  if (phase === "settings" && file) {
    // Build a CSS filter string for the live preview. Sharpness is excluded
    // because CSS has no sharpen filter — it's applied during the final pass.
    const p = (PRESETS[preset] ?? PRESETS.standard) as {
      brightness: number; contrast: number; saturation: number;
    };
    const b = 1 + (p.brightness + controls.brightness) / 100;
    const c = 1 + (p.contrast + controls.contrast) / 100;
    const s = 1 + (p.saturation + controls.saturation) / 100;
    const liveFilter = `brightness(${b.toFixed(2)}) contrast(${c.toFixed(2)}) saturate(${s.toFixed(2)})`;

    return (
      <div className="max-w-5xl mx-auto animate-fade-in">
        <div className="glass rounded-2xl p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold">Processing Settings</h3>
            <button className="text-sm text-gray-500 hover:text-red-500 flex items-center gap-1" onClick={reset}>
              <Icon name="close" size={14} /> Remove
            </button>
          </div>

          {fileType === "image" ? (
            /* ---- Image: two-column live preview ---- */
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Preview — takes 3/5 of the width */}
              <div className="lg:col-span-3">
                <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Live Preview</p>
                <div className="result-preview bg-checkerboard">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={fileURL || ""}
                    className="w-full rounded-lg"
                    alt="Live preview"
                    style={{ filter: liveFilter }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1.5 text-center">{file.name} ({formatBytes(file.size)})</p>
              </div>

              {/* Controls — takes 2/5 of the width */}
              <div className="lg:col-span-2 space-y-5">
                <div>
                  <label className="block text-xs font-semibold mb-2">Enhancement Preset</label>
                  <div className="grid grid-cols-1 gap-2">
                    {(["light", "standard", "maximum"] as Preset[]).map((p) => (
                      <button
                        key={p}
                        className={`preset-btn flex items-center gap-3 py-2.5 ${preset === p ? "active" : ""}`}
                        onClick={() => setPreset(p)}
                      >
                        <Icon name={p === "light" ? "sun" : p === "standard" ? "zap" : "wand"} size={16} />
                        <div className="text-left">
                          <div className="text-sm font-medium">{p === "light" ? "Light" : p === "standard" ? "Standard" : "Maximum"}</div>
                          <div className="text-xs text-gray-400">
                            {p === "light" ? "Mild enhancement" : p === "standard" ? "Balanced boost" : "Aggressive"}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-2">Output Resolution</label>
                  <div className="flex flex-wrap gap-2">
                    {resOptions.map((r) => (
                      <button
                        key={r}
                        className={`res-btn text-xs ${resolution === r ? "active" : ""}`}
                        onClick={() => setResolution(r)}
                      >
                        {resLabel[r]}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-2">Fine-Tune</label>
                  <div className="space-y-3">
                    {([
                      { label: "Brightness", key: "brightness" as const, min: -50, max: 50, icon: "sun" as const },
                      { label: "Contrast", key: "contrast" as const, min: -50, max: 50, icon: "contrast" as const },
                      { label: "Saturation", key: "saturation" as const, min: -50, max: 50, icon: "droplet" as const },
                      { label: "Sharpness *", key: "sharpness" as const, min: 0, max: 100, icon: "blur" as const },
                    ]).map((ctrl) => (
                      <div key={ctrl.key}>
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                            <Icon name={ctrl.icon} size={12} /> {ctrl.label}
                          </span>
                          <span className="text-gray-500 font-mono">{controls[ctrl.key] > 0 ? "+" : ""}{controls[ctrl.key]}</span>
                        </div>
                        <input
                          type="range"
                          min={ctrl.min}
                          max={ctrl.max}
                          value={controls[ctrl.key]}
                          onChange={(e) =>
                            setControls({ ...controls, [ctrl.key]: parseInt(e.target.value) })
                          }
                          className="w-full"
                        />
                      </div>
                    ))}
                    <p className="text-[10px] text-gray-400 italic">* Sharpness is applied during final processing</p>
                  </div>
                </div>

                <button className="btn-primary text-sm px-6 py-2.5 w-full justify-center" onClick={handleProcess}>
                  <Icon name="wand" size={16} /> Enhance Image
                </button>
              </div>
            </div>
          ) : (
            /* ---- Video: stacked layout (no live preview — too expensive) ---- */
            <div>
              <div className="mb-6 result-preview p-3">
                <video src={fileURL || ""} controls className="max-h-64 rounded-xl mx-auto w-full" />
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center">{file.name} ({formatBytes(file.size)})</p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold mb-3">Enhancement Preset</label>
                <div className="grid grid-cols-3 gap-3">
                  {(["light", "standard", "maximum"] as Preset[]).map((p) => (
                    <button
                      key={p}
                      className={`preset-btn ${preset === p ? "active" : ""}`}
                      onClick={() => setPreset(p)}
                    >
                      <div className="flex justify-center mb-1">
                        <Icon name={p === "light" ? "sun" : p === "standard" ? "zap" : "wand"} size={20} />
                      </div>
                      <div className="text-sm font-medium">{p === "light" ? "Light" : p === "standard" ? "Standard" : "Maximum"}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {p === "light" ? "Mild enhancement" : p === "standard" ? "Balanced boost" : "Aggressive"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold mb-3">Output Resolution</label>
                <div className="flex flex-wrap gap-2">
                  {resOptions.map((r) => (
                    <button
                      key={r}
                      className={`res-btn ${resolution === r ? "active" : ""}`}
                      onClick={() => setResolution(r)}
                    >
                      {resLabel[r]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold mb-3">Advanced Controls</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {([
                    { label: "Brightness", key: "brightness" as const, min: -50, max: 50, icon: "sun" as const },
                    { label: "Contrast", key: "contrast" as const, min: -50, max: 50, icon: "contrast" as const },
                    { label: "Saturation", key: "saturation" as const, min: -50, max: 50, icon: "droplet" as const },
                    { label: "Sharpness", key: "sharpness" as const, min: 0, max: 100, icon: "blur" as const },
                  ]).map((ctrl) => (
                    <div key={ctrl.key}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="flex items-center gap-1.5">
                          <Icon name={ctrl.icon} size={14} /> {ctrl.label}
                        </span>
                        <span className="text-gray-500">{controls[ctrl.key]}</span>
                      </div>
                      <input
                        type="range"
                        min={ctrl.min}
                        max={ctrl.max}
                        value={controls[ctrl.key]}
                        onChange={(e) =>
                          setControls({ ...controls, [ctrl.key]: parseInt(e.target.value) })
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
                <button className="btn-primary text-base px-8 py-3" onClick={handleProcess}>
                  <Icon name="wand" size={18} /> Enhance Video
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm text-center">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---- UPLOAD VIEW (default) ----
  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      {/* File type tabs */}
      <div className="flex gap-1 justify-center mb-6 p-1 rounded-xl bg-gray-100 dark:bg-gray-900 max-w-xs mx-auto">
        {mode === "background" ? (
          <button className="tab-btn active flex items-center gap-1.5 flex-1">
            <Icon name="image" size={16} /> Image
          </button>
        ) : (
          <>
            <button
              className={`tab-btn flex items-center gap-1.5 flex-1 ${tab === "image" ? "active" : ""}`}
              onClick={() => setTab("image")}
            >
              <Icon name="image" size={16} /> Image
            </button>
            <button
              className={`tab-btn flex items-center gap-1.5 flex-1 ${tab === "video" ? "active" : ""}`}
              onClick={() => setTab("video")}
            >
              <Icon name="video" size={16} /> Video
            </button>
          </>
        )}
      </div>

      <div
        className={`dropzone glass ${dragover ? "dragover" : ""}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
        onDragLeave={() => setDragover(false)}
        onDrop={onDrop}
      >
        <div className="flex justify-center mb-4">
          <div className="animate-float">
            <Icon name={tab === "image" ? "image" : "film"} size={48} className="text-indigo-400" />
          </div>
        </div>
        <p className="text-lg font-semibold mb-2">
          {mode === "watermark"
            ? "Drop your " + tab + " to remove watermarks"
            : mode === "background"
              ? "Drop your image to remove the background"
              : "Drop your " + tab + " to enhance"}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">or click to browse</p>
        <button className="btn-primary">
          <Icon name="upload" size={16} /> Upload File
        </button>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
          {tab === "image"
            ? "JPG \u00B7 JPEG \u00B7 PNG \u00B7 WEBP \u2014 Max 20MB"
            : "MP4 \u00B7 MOV \u00B7 AVI \u00B7 WEBM \u00B7 MKV \u2014 Max 100MB"}
        </p>
      </div>

      <div className="text-center mt-4">
        <button className="btn-secondary text-sm" onClick={loadSample}>Try Sample File</button>
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm text-center">
          {error}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={acceptAttr}
        onChange={onFileChange}
      />
    </div>
  );
}
