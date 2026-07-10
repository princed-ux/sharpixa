type IconName =
  | "sparkles"
  | "brush"
  | "camera"
  | "film"
  | "sliders"
  | "shield"
  | "download"
  | "upload"
  | "refresh"
  | "close"
  | "image"
  | "video"
  | "check"
  | "play"
  | "blur"
  | "upscale"
  | "contrast"
  | "arrow"
  | "wand"
  | "eraser"
  | "sun"
  | "droplet"
  | "zap"
  | "menu";

export function Icon({
  name,
  className = "",
  size = 18,
}: {
  name: IconName;
  className?: string;
  size?: number;
}) {
  const s = {
    className,
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (name) {
    case "sparkles":
      return (
        <svg {...s}>
          <path d="M9 3l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Z" />
          <path d="M17 7l.5 1.5L19 9l-1.5.5L17 11l-.5-1.5L15 9l1.5-.5L17 7Z" />
          <path d="M5 17l.5 1.5L7 19l-1.5.5L5 21l-.5-1.5L3 19l1.5-.5L5 17Z" />
        </svg>
      );
    case "brush":
      return (
        <svg {...s}>
          <path d="M4 6l7 13" />
          <path d="M20 6l-7 13" />
          <circle cx="5.5" cy="5.5" r="2.5" />
          <circle cx="18.5" cy="5.5" r="2.5" />
        </svg>
      );
    case "camera":
      return (
        <svg {...s}>
          <rect x="3" y="7" width="18" height="13" rx="3" />
          <circle cx="12" cy="13" r="4" />
          <path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7" />
        </svg>
      );
    case "film":
      return (
        <svg {...s}>
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M8 4v16" />
          <path d="M16 4v16" />
          <path d="M2 9h6" />
          <path d="M16 9h6" />
          <path d="M2 15h6" />
          <path d="M16 15h6" />
        </svg>
      );
    case "sliders":
      return (
        <svg {...s}>
          <path d="M4 7h5" />
          <path d="M15 7h5" />
          <path d="M4 17h3" />
          <path d="M11 17h9" />
          <circle cx="11" cy="7" r="2" />
          <circle cx="8" cy="17" r="2" />
        </svg>
      );
    case "shield":
      return (
        <svg {...s}>
          <path d="M12 2 5 5v6c0 4.5 2.8 8 7 9.5 4.2-1.5 7-5 7-9.5V5l-7-3Z" />
        </svg>
      );
    case "download":
      return (
        <svg {...s}>
          <path d="M12 3v12" />
          <path d="m8 11 4 4 4-4" />
          <path d="M4 18h16" />
          <path d="M4 21h16" />
        </svg>
      );
    case "upload":
      return (
        <svg {...s}>
          <path d="M12 15V3" />
          <path d="m8 7 4-4 4 4" />
          <path d="M4 18h16" />
          <path d="M4 21h16" />
        </svg>
      );
    case "refresh":
      return (
        <svg {...s}>
          <path d="M21 12a9 9 0 1 1-3-6.7" />
          <path d="M21 3v5h-5" />
        </svg>
      );
    case "close":
      return (
        <svg {...s}>
          <path d="M6 6l12 12" />
          <path d="M18 6 6 18" />
        </svg>
      );
    case "image":
      return (
        <svg {...s}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="8.5" cy="9.5" r="2" />
          <path d="M3 16l4-4 3 3 3-3 4 4 4-2" />
        </svg>
      );
    case "video":
      return (
        <svg {...s}>
          <rect x="2" y="5" width="16" height="14" rx="2" />
          <path d="M18 10l4-2.5v10L18 15" />
        </svg>
      );
    case "check":
      return (
        <svg {...s}>
          <path d="m5 12 4 4 10-10" />
        </svg>
      );
    case "play":
      return (
        <svg {...s}>
          <path d="M7 4v16l13-8L7 4Z" />
        </svg>
      );
    case "blur":
      return (
        <svg {...s}>
          <circle cx="12" cy="12" r="7" />
          <path d="M12 5v14" />
          <path d="M7 12h10" />
          <path d="M8.5 8.5l7 7" />
          <path d="M15.5 8.5l-7 7" />
        </svg>
      );
    case "upscale":
      return (
        <svg {...s}>
          <rect x="4" y="4" width="7" height="7" rx="1.5" />
          <rect x="13" y="13" width="7" height="7" rx="1.5" />
          <path d="M11 4h9v9" />
          <path d="M4 11v9h9" />
        </svg>
      );
    case "contrast":
      return (
        <svg {...s}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3c-2 0-4 1.5-5.5 4S5 12 5 12s1 5.5 2.5 8S10 21 12 21V3Z" />
        </svg>
      );
    case "arrow":
      return (
        <svg {...s}>
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      );
    case "wand":
      return (
        <svg {...s}>
          <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2Z" />
          <path d="M18 16l.7 2.3L21 19l-2.3.7L18 22l-.7-2.3L15 19l2.3-.7L18 16Z" />
          <path d="M6 16l.5 1.5L8 18l-1.5.5L6 20l-.5-1.5L4 18l1.5-.5L6 16Z" />
        </svg>
      );
    case "eraser":
      return (
        <svg {...s}>
          <path d="M21 20H8l-5-5 9-9 9 9-4 4Z" />
          <path d="m6.5 13.5 5-5" />
          <path d="M3 20h18" />
        </svg>
      );
    case "sun":
      return (
        <svg {...s}>
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v3" />
          <path d="M12 20v3" />
          <path d="M4.22 4.22l2.12 2.12" />
          <path d="M17.66 17.66l2.12 2.12" />
          <path d="M1 12h3" />
          <path d="M20 12h3" />
          <path d="M6.34 17.66l-2.12 2.12" />
          <path d="M19.78 4.22l-2.12 2.12" />
        </svg>
      );
    case "droplet":
      return (
        <svg {...s}>
          <path d="M12 2C9 7 5 10.5 5 14a7 7 0 0 0 14 0c0-3.5-4-7-7-12Z" />
          <path d="M12 18a4 4 0 0 0 4-4" />
        </svg>
      );
    case "zap":
      return (
        <svg {...s}>
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case "menu":
      return (
        <svg {...s}>
          <path d="M4 6h16" />
          <path d="M4 12h16" />
          <path d="M4 18h16" />
        </svg>
      );
    default:
      return null;
  }
}
