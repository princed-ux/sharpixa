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
  | "menu"
  | "logo";

export function Icon({
  name,
  className = "",
  size = 18,
}: {
  name: IconName;
  className?: string;
  size?: number;
}) {
  const common = {
    className,
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (name) {
    case "sparkles":
      return (
        <svg {...common}>
          <path d="M12 3l1.4 4.1L17.5 9l-4.1 1.9L12 15l-1.4-4.1L6.5 9l4.1-1.9L12 3Z" />
          <path d="M19 14l.7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7L19 14Z" />
        </svg>
      );
    case "brush":
      return (
        <svg {...common}>
          <path d="M5 14.5c0-3.2 2.2-5.3 4.9-5.3 1.8 0 2.8 1 3.7 2.4.8 1.3 2.4 1.8 3.8 1.2.6-.3 1.1-.8 1.3-1.5" />
          <path d="M5 14.5c0 2.5 2 4.5 4.5 4.5h2.5" />
          <path d="M9.5 18.5v2.5" />
        </svg>
      );
    case "camera":
      return (
        <svg {...common}>
          <rect x="3" y="7" width="18" height="12" rx="3" />
          <circle cx="12" cy="13" r="4" />
          <path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7" />
        </svg>
      );
    case "film":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="3" />
          <path d="M7 5v14" />
          <path d="M17 5v14" />
          <path d="M3 10h18" />
          <path d="M3 14h18" />
        </svg>
      );
    case "sliders":
      return (
        <svg {...common}>
          <path d="M4 7h7" />
          <path d="M13 7h7" />
          <path d="M4 17h4" />
          <path d="M10 17h10" />
          <circle cx="10" cy="7" r="2" />
          <circle cx="10" cy="17" r="2" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 3 5 6v6c0 4.4 2.8 7.8 7 9 4.2-1.2 7-4.6 7-9V6l-7-3Z" />
        </svg>
      );
    case "download":
      return (
        <svg {...common}>
          <path d="M12 4v10" />
          <path d="m8 10 4 4 4-4" />
          <path d="M5 18h14" />
        </svg>
      );
    case "upload":
      return (
        <svg {...common}>
          <path d="M12 4v10" />
          <path d="m8 8 4-4 4 4" />
          <path d="M5 18h14" />
        </svg>
      );
    case "refresh":
      return (
        <svg {...common}>
          <path d="M21 12a9 9 0 1 1-2.3-6.1" />
          <path d="M21 3v6h-6" />
        </svg>
      );
    case "close":
      return (
        <svg {...common}>
          <path d="M6 6l12 12" />
          <path d="M18 6 6 18" />
        </svg>
      );
    case "image":
      return (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="14" rx="2" />
          <circle cx="9" cy="10" r="1.5" />
          <path d="m8 15 3-3 3 3 2-2 2 2" />
        </svg>
      );
    case "video":
      return (
        <svg {...common}>
          <rect x="3" y="6" width="14" height="12" rx="2" />
          <path d="m17 10 4-2v8l-4-2" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path d="m5 12 4 4 10-10" />
        </svg>
      );
    case "play":
      return (
        <svg {...common}>
          <path d="M8 6v12l9-6-9-6Z" />
        </svg>
      );
    case "blur":
      return (
        <svg {...common}>
          <path d="M4 11c0-4.2 3.4-7.5 7.5-7.5S19 6.8 19 11c0 3.1-1.8 5.8-4.5 6.9l-.8.3H9.3l-.8-.3C5.8 16.8 4 14.1 4 11Z" />
        </svg>
      );
    case "upscale":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="8" height="8" rx="1.5" />
          <rect x="12" y="12" width="8" height="8" rx="1.5" />
          <path d="M12 4h8v8" />
          <path d="M4 12v8h8" />
        </svg>
      );
    case "contrast":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 4c2.6 0 5 1.2 6.5 3.2A8 8 0 1 1 5.5 7.2 8 8 0 0 1 12 4Z" />
        </svg>
      );
    case "arrow":
      return (
        <svg {...common}>
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      );
    case "wand":
      return (
        <svg {...common}>
          <path d="M14.5 3.5 20 9l-9 9-5.5-5.5 9-9Z" />
          <path d="m14 5 5 5" />
          <path d="M3 20c2 .5 4.5 0 6-2" />
          <path d="M3 20c.5 2 0 4.5-2 6" />
          <path d="M3 20c1.5.5 3 1 5 0" />
        </svg>
      );
    case "eraser":
      return (
        <svg {...common}>
          <path d="M20 20H7l-4-4 9-9 8 8-4 4Z" />
          <path d="m6.5 13.5 5-5" />
        </svg>
      );
    case "sun":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="M4.93 4.93 6.34 6.34" />
          <path d="M17.66 17.66 19.07 19.07" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="M6.34 17.66 4.93 19.07" />
          <path d="M19.07 4.93 17.66 6.34" />
        </svg>
      );
    case "droplet":
      return (
        <svg {...common}>
          <path d="M12 2C9.5 7 6 10.5 6 14a6 6 0 0 0 12 0c0-3.5-3.5-7-6-12Z" />
        </svg>
      );
    case "zap":
      return (
        <svg {...common}>
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case "menu":
      return (
        <svg {...common}>
          <path d="M4 6h16" />
          <path d="M4 12h16" />
          <path d="M4 18h16" />
        </svg>
      );
    case "logo":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 3c-2 4-6 7-6 11a6 6 0 0 0 12 0c0-4-4-7-6-11Z" />
          <path d="M9 12h6" />
          <path d="M12 9v6" />
        </svg>
      );
    default:
      return null;
  }
}
