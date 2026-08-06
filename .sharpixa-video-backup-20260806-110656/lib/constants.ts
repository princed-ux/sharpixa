export type ToolMode =
  | "watermark"
  | "background"
  | "enhance";

export const IMAGE_FORMATS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
] as const;

export const VIDEO_FORMATS = [
  "mp4",
  "mov",
  "avi",
  "webm",
  "mkv",
] as const;

export type ImageFormat =
  (typeof IMAGE_FORMATS)[number];

export type VideoFormat =
  (typeof VIDEO_FORMATS)[number];

export const FILE_LIMITS = {
  image: 20 * 1024 * 1024,
  video: 50 * 1024 * 1024,
} as const;

export const FILE_LIMIT_LABELS = {
  image: "20MB",
  video: "50MB",
} as const;

export interface Preset {
  brightness: number;
  contrast: number;
  saturation: number;
  sharpness: number;
  denoise: number;
}

export type PresetName =
  | "light"
  | "standard"
  | "maximum";

/**
 * These presets perform conventional browser-side image processing:
 * brightness, contrast, saturation, edge-aware denoising, and sharpening.
 *
 * They do not claim to reconstruct details that do not exist in the source.
 */
export const PRESETS: Record<
  PresetName,
  Preset
> = {
  light: {
    brightness: 1,
    contrast: 3,
    saturation: 2,
    sharpness: 0.12,
    denoise: 0.2,
  },

  standard: {
    brightness: 2,
    contrast: 6,
    saturation: 4,
    sharpness: 0.24,
    denoise: 0.42,
  },

  maximum: {
    brightness: 4,
    contrast: 10,
    saturation: 7,
    sharpness: 0.42,
    denoise: 0.68,
  },
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

export type VideoResolution =
  | "original"
  | "2x"
  | "4x"
  | "8k";

export interface ResolutionOption {
  label: string;
  scale: number;
  description: string;
}

export const IMAGE_RESOLUTIONS: Record<
  VideoResolution,
  ResolutionOption
> = {
  original: {
    label: "Original size",
    scale: 1,
    description:
      "Keep the original pixel dimensions.",
  },

  "2x": {
    label: "2× resize",
    scale: 2,
    description:
      "Double the image width and height.",
  },

  "4x": {
    label: "4× resize",
    scale: 4,
    description:
      "Increase the image dimensions four times.",
  },

  "8k": {
    label: "8× resize",
    scale: 8,
    description:
      "Create a very large output when browser memory allows.",
  },
};

/**
 * Retained for compatibility with existing imports.
 *
 * Video processing should normally expose only Original and 2×
 * because larger frame sizes can exhaust browser memory.
 */
export const VIDEO_RESOLUTIONS: Record<
  VideoResolution,
  ResolutionOption
> = {
  original: {
    label: "Original size",
    scale: 1,
    description:
      "Keep the original video dimensions.",
  },

  "2x": {
    label: "2× resize",
    scale: 2,
    description:
      "Double the frame dimensions when supported.",
  },

  "4x": {
    label: "4× resize",
    scale: 4,
    description:
      "Not recommended for browser video processing.",
  },

  "8k": {
    label: "8× resize",
    scale: 8,
    description:
      "Not recommended for browser video processing.",
  },
};

export interface Feature {
  icon: string;
  title: string;
  desc: string;
}

export const FEATURES_BY_MODE: Record<
  ToolMode,
  Feature[]
> = {
  watermark: [
    {
      icon: "eraser",
      title: "Object and Text Removal",
      desc:
        "Mark unwanted objects, text, date stamps, logos, or authorized watermarks with a precise brush.",
    },

    {
      icon: "brush",
      title: "Adjustable Selection Brush",
      desc:
        "Control brush size, hardness, zoom, mask opacity, and erasing for more accurate selections.",
    },

    {
      icon: "wand",
      title: "Texture-Aware Filling",
      desc:
        "Sharpixa samples nearby clean pixels and textures to rebuild the selected region.",
    },

    {
      icon: "image",
      title: "Image and Video Support",
      desc:
        "Clean images or remove stationary overlays from supported video clips.",
    },

    {
      icon: "sliders",
      title: "Manual Precision",
      desc:
        "Choose exactly which area should be processed rather than modifying the entire file.",
    },

    {
      icon: "shield",
      title: "Responsible Editing",
      desc:
        "Use the tool only on files you own or have permission to modify.",
    },

    {
      icon: "download",
      title: "Local Export",
      desc:
        "Preview the processed result and save it directly from your browser.",
    },

    {
      icon: "zap",
      title: "No Account Required",
      desc:
        "Start editing without creating an account or providing personal information.",
    },
  ],

  background: [
    {
      icon: "wand",
      title: "Automatic Subject Detection",
      desc:
        "A browser-side segmentation model separates the main subject from its background.",
    },

    {
      icon: "brush",
      title: "Manual Background Selection",
      desc:
        "Switch to manual mode and paint the exact area that should become transparent.",
    },

    {
      icon: "image",
      title: "Transparent PNG Output",
      desc:
        "Export the processed image as a PNG with a transparent background.",
    },

    {
      icon: "sliders",
      title: "Refinement Controls",
      desc:
        "Use zoom, brush hardness, mask opacity, undo, redo, and erasing to improve difficult selections.",
    },

    {
      icon: "shield",
      title: "Browser-Side Processing",
      desc:
        "Your selected image is processed in the browser rather than uploaded to a Sharpixa account.",
    },

    {
      icon: "zap",
      title: "Model Caching",
      desc:
        "The background model is downloaded on first use and can be cached by the browser for later sessions.",
    },

    {
      icon: "download",
      title: "Full-Resolution Export",
      desc:
        "Keep the original dimensions whenever the browser has enough available memory.",
    },

    {
      icon: "image",
      title: "Common Image Formats",
      desc:
        "Process JPG, JPEG, PNG, and WEBP images up to the displayed file limit.",
    },
  ],

  enhance: [
    {
      icon: "sun",
      title: "Brightness Adjustment",
      desc:
        "Correct images or video frames that appear slightly too dark or too bright.",
    },

    {
      icon: "contrast",
      title: "Contrast Control",
      desc:
        "Improve separation between darker and lighter areas without changing the original file.",
    },

    {
      icon: "droplet",
      title: "Saturation Control",
      desc:
        "Reduce washed-out color or soften images that appear overly saturated.",
    },

    {
      icon: "blur",
      title: "Controlled Sharpening",
      desc:
        "Strengthen visible edges while limiting excessive halos and crunchy artifacts.",
    },

    {
      icon: "wand",
      title: "Noise Reduction",
      desc:
        "Apply lightweight edge-aware smoothing to reduce small amounts of visible image noise.",
    },

    {
      icon: "upscale",
      title: "Image Resizing",
      desc:
        "Increase output dimensions using high-quality browser interpolation.",
    },

    {
      icon: "sliders",
      title: "Three Processing Presets",
      desc:
        "Choose Light, Standard, or Maximum processing, then fine-tune the result manually.",
    },

    {
      icon: "shield",
      title: "Honest Output",
      desc:
        "Sharpixa improves and resizes visible pixels but does not promise to recreate every missing detail.",
    },
  ],
};

/**
 * Retained temporarily for the current FeaturesGrid component.
 * The component will be updated next to use FEATURES_BY_MODE.
 */
export const FEATURES =
  FEATURES_BY_MODE.watermark;

export interface Faq {
  q: string;
  a: string;
}

export const FAQS_BY_MODE: Record<
  ToolMode,
  Faq[]
> = {
  watermark: [
    {
      q:
        "What can I remove with this tool?",

      a:
        "You can mark unwanted objects, text, logos, date stamps, distractions, or authorized watermarks. Results are strongest when the selected area is small and surrounded by repeatable textures.",
    },

    {
      q:
        "Why can a removed area sometimes look imperfect?",

      a:
        "The tool rebuilds the selected region from nearby visible pixels. If the removed object covers a face, hand, detailed building, unique text, or another one-of-a-kind structure, there may not be enough surrounding information to reconstruct it perfectly.",
    },

    {
      q:
        "How do I get a cleaner result?",

      a:
        "Use a smaller brush, zoom in, mark slightly beyond the unwanted object, avoid selecting unnecessary clean pixels, and process complex objects in smaller sections.",
    },

    {
      q:
        "Can Sharpixa remove objects from videos?",

      a:
        "Sharpixa can apply one selection mask across a video. It works best for stationary logos, timestamps, or overlays that remain in the same location throughout the clip.",
    },

    {
      q:
        "Which file formats are supported?",

      a:
        "Images support JPG, JPEG, PNG, and WEBP. Videos support MP4, MOV, AVI, WEBM, and MKV when the browser can decode and encode the selected format.",
    },

    {
      q:
        "May I remove any watermark I find online?",

      a:
        "No. Only edit files you own or have permission to modify. Do not remove copyright notices, ownership marks, or attribution from protected material without authorization.",
    },

    {
      q:
        "Does Sharpixa upload my file?",

      a:
        "The editing workflow runs inside your browser. Model or application resources may be downloaded, but Sharpixa does not require an account upload for the file-processing workflow.",
    },
  ],

  background: [
    {
      q:
        "How does automatic background removal work?",

      a:
        "Sharpixa loads a subject-segmentation model in your browser. The model estimates which pixels belong to the main subject and produces a transparent PNG.",
    },

    {
      q:
        "Why does the first background removal take longer?",

      a:
        "The browser may need to download the segmentation model and its runtime files on first use. Supported browsers can cache those resources for later sessions.",
    },

    {
      q:
        "What images produce the best cutouts?",

      a:
        "Use a clear image with a visible main subject, good lighting, reasonable contrast between the subject and background, and enough resolution around hair and edges.",
    },

    {
      q:
        "What should I do if part of the subject is removed?",

      a:
        "Try another image with clearer subject separation or switch to manual mode to control which pixels become transparent.",
    },

    {
      q:
        "Can Sharpixa remove video backgrounds?",

      a:
        "Not in the current version. Automatic background removal currently supports JPG, JPEG, PNG, and WEBP images.",
    },

    {
      q:
        "Why is the result exported as PNG?",

      a:
        "PNG supports transparent pixels. JPEG does not preserve transparency, so transparent results must be exported in a format such as PNG.",
    },

    {
      q:
        "Are my images stored by Sharpixa?",

      a:
        "The processing workflow runs in the browser and does not require an account. Sharpixa should still describe analytics, advertising cookies, and third-party resources clearly in its Privacy Policy.",
    },
  ],

  enhance: [
    {
      q:
        "What does the image improvement tool change?",

      a:
        "It can adjust brightness, contrast, saturation, sharpening, noise reduction, and output dimensions.",
    },

    {
      q:
        "Is this generative AI super-resolution?",

      a:
        "No. The current tool uses browser-side resizing and conventional image processing. It can improve presentation, but it cannot reliably recreate details that were never captured.",
    },

    {
      q:
        "What is the difference between Light, Standard, and Maximum?",

      a:
        "Light applies gentle correction, Standard applies balanced processing, and Maximum uses stronger contrast, color, denoising, and sharpening.",
    },

    {
      q:
        "Why can too much sharpening look bad?",

      a:
        "Excessive sharpening can create bright or dark halos around edges, exaggerate noise, and make skin or textures appear unnatural.",
    },

    {
      q:
        "Does resizing improve actual detail?",

      a:
        "Resizing increases pixel dimensions and can make an image more suitable for certain layouts. It does not automatically restore fine details lost through blur, compression, or low-resolution capture.",
    },

    {
      q:
        "Can I improve videos?",

      a:
        "Yes, when the browser supports the video format and available encoder. Original size or 2× resizing is recommended to reduce memory pressure.",
    },

    {
      q:
        "Which preset should I start with?",

      a:
        "Start with Standard. Use Light for already-clean images and Maximum only when the source needs stronger correction.",
    },
  ],
};

/**
 * Retained temporarily for the current FAQ component.
 * The component will be updated to accept a mode.
 */
export const FAQS =
  FAQS_BY_MODE.watermark;

export interface HowItWorksStep {
  num: string;
  icon: string;
  title: string;
  desc: string;
}

export const HOW_IT_WORKS_BY_MODE: Record<
  ToolMode,
  HowItWorksStep[]
> = {
  watermark: [
    {
      num: "1",
      icon: "upload",
      title: "Upload Your File",
      desc:
        "Choose a supported image or video that you own or have permission to edit.",
    },

    {
      num: "2",
      icon: "brush",
      title: "Mark the Unwanted Area",
      desc:
        "Zoom in and brush precisely over the object, text, logo, timestamp, or authorized watermark.",
    },

    {
      num: "3",
      icon: "wand",
      title: "Rebuild the Selection",
      desc:
        "Sharpixa samples nearby clean pixels and textures to fill the marked region.",
    },

    {
      num: "4",
      icon: "download",
      title: "Review and Download",
      desc:
        "Compare the result with the original and save the processed file.",
    },
  ],

  background: [
    {
      num: "1",
      icon: "upload",
      title: "Upload an Image",
      desc:
        "Choose a JPG, JPEG, PNG, or WEBP image containing a clear main subject.",
    },

    {
      num: "2",
      icon: "wand",
      title: "Detect the Subject",
      desc:
        "Automatic mode loads a browser-side segmentation model and identifies the foreground subject.",
    },

    {
      num: "3",
      icon: "brush",
      title: "Refine When Needed",
      desc:
        "Use manual mode and the mask editor when automatic separation needs more control.",
    },

    {
      num: "4",
      icon: "download",
      title: "Download the PNG",
      desc:
        "Preview the transparent result and export it as a PNG image.",
    },
  ],

  enhance: [
    {
      num: "1",
      icon: "upload",
      title: "Upload Your File",
      desc:
        "Select a supported image or video from your device.",
    },

    {
      num: "2",
      icon: "sliders",
      title: "Choose Your Settings",
      desc:
        "Select a preset, output size, and optional brightness, contrast, saturation, or sharpening adjustments.",
    },

    {
      num: "3",
      icon: "wand",
      title: "Process in Your Browser",
      desc:
        "Sharpixa resizes, denoises, adjusts color, and sharpens the selected file.",
    },

    {
      num: "4",
      icon: "download",
      title: "Compare and Export",
      desc:
        "Review the before-and-after result and download the improved file.",
    },
  ],
};

export interface ToolPageCopy {
  eyebrow: string;
  heading: string;
  description: string;
  howItWorksTitle: string;
  howItWorksSubtitle: string;
  featuresTitle: string;
  featuresSubtitle: string;
  faqTitle: string;
  faqSubtitle: string;
  fileTypesTitle: string;
  fileTypesSubtitle: string;
}

export const TOOL_PAGE_COPY: Record<
  ToolMode,
  ToolPageCopy
> = {
  watermark: {
    eyebrow:
      "Object, text, and authorized watermark cleanup",

    heading:
      "Remove Unwanted Objects From Images and Videos",

    description:
      "Mark the unwanted area and let Sharpixa rebuild it using nearby visible pixels and textures.",

    howItWorksTitle:
      "How Object Removal Works",

    howItWorksSubtitle:
      "Clean a selected area in four straightforward steps.",

    featuresTitle:
      "Precise Object-Removal Tools",

    featuresSubtitle:
      "Brush, refine, process, compare, and export without creating an account.",

    faqTitle:
      "Object-Removal Questions",

    faqSubtitle:
      "Important details about quality, supported files, privacy, and responsible use.",

    fileTypesTitle:
      "Supported Object-Removal Files",

    fileTypesSubtitle:
      "Images and compatible videos can use the manual selection workflow.",
  },

  background: {
    eyebrow:
      "Automatic and manual background removal",

    heading:
      "Create Transparent Image Backgrounds",

    description:
      "Separate the main subject automatically or manually mark the area that should become transparent.",

    howItWorksTitle:
      "How Background Removal Works",

    howItWorksSubtitle:
      "Create a transparent PNG in four steps.",

    featuresTitle:
      "Background-Removal Features",

    featuresSubtitle:
      "Automatic subject detection with a manual selection fallback.",

    faqTitle:
      "Background-Removal Questions",

    faqSubtitle:
      "Learn about model downloads, transparent output, difficult edges, and privacy.",

    fileTypesTitle:
      "Supported Background-Removal Files",

    fileTypesSubtitle:
      "Automatic background removal currently supports common image formats.",
  },

  enhance: {
    eyebrow:
      "Resize, denoise, sharpen, and adjust color",

    heading:
      "Improve Image and Video Presentation",

    description:
      "Apply practical browser-side adjustments without overstating what conventional resizing can restore.",

    howItWorksTitle:
      "How File Improvement Works",

    howItWorksSubtitle:
      "Adjust and process your file in four steps.",

    featuresTitle:
      "Image and Video Improvement Controls",

    featuresSubtitle:
      "Balanced presets and manual controls for practical cleanup.",

    faqTitle:
      "Image-Improvement Questions",

    faqSubtitle:
      "Understand resizing, sharpening, denoising, presets, and output limitations.",

    fileTypesTitle:
      "Supported Improvement Files",

    fileTypesSubtitle:
      "Use common image formats and browser-compatible video formats.",
  },
};

export interface SupportedFileType {
  ext: string;
  color: string;
}

export interface FileTypeGroup {
  label: string;
  icon: string;
  types: SupportedFileType[];
}

export const IMAGE_FILE_TYPES: SupportedFileType[] = [
  {
    ext: "JPG",
    color: "#f59e0b",
  },

  {
    ext: "JPEG",
    color: "#f59e0b",
  },

  {
    ext: "PNG",
    color: "#3b82f6",
  },

  {
    ext: "WEBP",
    color: "#8b5cf6",
  },
];

export const VIDEO_FILE_TYPES: SupportedFileType[] = [
  {
    ext: "MP4",
    color: "#ef4444",
  },

  {
    ext: "MOV",
    color: "#10b981",
  },

  {
    ext: "AVI",
    color: "#f97316",
  },

  {
    ext: "WEBM",
    color: "#8b5cf6",
  },

  {
    ext: "MKV",
    color: "#06b6d4",
  },
];

export const FILE_TYPES_BY_MODE: Record<
  ToolMode,
  FileTypeGroup[]
> = {
  watermark: [
    {
      label: "Images",
      icon: "image",
      types: IMAGE_FILE_TYPES,
    },

    {
      label: "Videos",
      icon: "film",
      types: VIDEO_FILE_TYPES,
    },
  ],

  background: [
    {
      label: "Images",
      icon: "image",
      types: IMAGE_FILE_TYPES,
    },
  ],

  enhance: [
    {
      label: "Images",
      icon: "image",
      types: IMAGE_FILE_TYPES,
    },

    {
      label: "Videos",
      icon: "film",
      types: VIDEO_FILE_TYPES,
    },
  ],
};

export const RESPONSIBLE_USE_NOTICE =
  "Only upload and edit files you own or have permission to modify. Do not remove copyright notices, ownership marks, or attribution from protected material without authorization.";

export const PROCESSING_PRIVACY_NOTICE =
  "Sharpixa processes selected files inside the browser. The application may download scripts, model files, advertising resources, and analytics resources according to its Privacy Policy.";
