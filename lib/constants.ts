export const IMAGE_FORMATS = ["jpg", "jpeg", "png", "webp"] as const;
export const VIDEO_FORMATS = ["mp4", "mov", "avi", "webm", "mkv"] as const;

export const FILE_LIMITS = {
  image: 20 * 1024 * 1024,
  video: 100 * 1024 * 1024,
};

export interface Preset {
  brightness: number;
  contrast: number;
  saturation: number;
  sharpness: number;
  denoise: number;
}

// Tuned for a clean, natural result: denoise leads, sharpening stays subtle
// so nothing looks crunchy or halo-ridden.
export const PRESETS: Record<string, Preset> = {
  light: {
    brightness: 2,
    contrast: 4,
    saturation: 3,
    sharpness: 0.15,
    denoise: 0.35,
  },
  standard: {
    brightness: 4,
    contrast: 8,
    saturation: 6,
    sharpness: 0.3,
    denoise: 0.55,
  },
  maximum: {
    brightness: 7,
    contrast: 13,
    saturation: 9,
    sharpness: 0.5,
    denoise: 0.8,
  },
};

export interface Feature {
  icon: string;
  title: string;
  desc: string;
}

export const FEATURES: Feature[] = [
  {
    icon: "eraser",
    title: "Watermark Removal",
    desc: "Remove logos, text, stamps, and objects from images and videos naturally.",
  },
  {
    icon: "blur",
    title: "Deblur & Sharpen",
    desc: "Fix blurry photos and video frames. Recover crisp detail and clarity.",
  },
  {
    icon: "upscale",
    title: "4K & 8K Upscaling",
    desc: "Upscale images and videos to ultra-high resolutions with smart detail reconstruction.",
  },
  {
    icon: "sun",
    title: "Light & Color Controls",
    desc: "Fine-tune brightness, contrast, saturation, and sharpness for the perfect result.",
  },
  {
    icon: "wand",
    title: "Smart Cleanup",
    desc: "Remove distracting overlays while preserving texture, skin, and background quality.",
  },
  {
    icon: "shield",
    title: "100% Private",
    desc: "Everything runs in your browser. Nothing is uploaded to any server. Your files stay yours.",
  },
  {
    icon: "image",
    title: "Photo & Video",
    desc: "Use the same workflow for portraits, product shots, screenshots, and video clips.",
  },
  {
    icon: "download",
    title: "Instant Export",
    desc: "Preview and download the cleaned result in seconds with no extra steps.",
  },
];

export interface Faq {
  q: string;
  a: string;
}

export const FAQS: Faq[] = [
  {
    q: "Is Watermark Remover free?",
    a: "Yes. It is completely free to use. No signup, no credit card, no limits. Upload and clean your files instantly.",
  },
  {
    q: "How does watermark removal work?",
    a: "Upload your file and use the brush tool to mark the watermark area. The tool processes the region and fills it naturally using the surrounding pixels.",
  },
  {
    q: "What file formats are supported?",
    a: "Images: JPG, JPEG, PNG, WEBP. Videos: MP4, MOV, AVI, WEBM, MKV. The same workflow works for photos and clips.",
  },
  {
    q: "Can I remove watermarks from videos?",
    a: "Yes. Upload a video, use the brush tool to mark the watermark area, and the tool will process the entire video frame by frame.",
  },
  {
    q: "Are my files private?",
    a: "Absolutely. Everything runs in your browser using Canvas API. No files are ever uploaded to any server.",
  },
];

export type VideoResolution = "original" | "2x" | "4x" | "8k";

export const VIDEO_RESOLUTIONS: Record<VideoResolution, { label: string; scale: number }> = {
  original: { label: "Original", scale: 1 },
  "2x": { label: "2K Upscale", scale: 2 },
  "4x": { label: "4K Upscale", scale: 4 },
  "8k": { label: "8K Upscale", scale: 8 },
};

export interface AdvancedControls {
  brightness: number;
  contrast: number;
  saturation: number;
  sharpness: number;
}

export const DEFAULT_CONTROLS: AdvancedControls = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  sharpness: 0,
};
