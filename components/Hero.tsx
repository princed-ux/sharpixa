import { Icon } from "@/components/Icons";

type Mode = "watermark" | "enhance" | "background";

const heroContent: Record<Mode, {
  badge: string;
  badgeIcon: string;
  title: React.ReactNode;
  description: string;
}> = {
  watermark: {
    badge: "Free Online Watermark Removal Tool",
    badgeIcon: "eraser",
    title: (
      <>
        Remove Watermarks from Images & Videos{" "}
        <span className="gradient-text">Instantly for Free</span>
      </>
    ),
    description:
      "Upload your file and remove logos, text, stamps, and objects automatically. No signup needed. 100% free.",
  },
  background: {
    badge: "Free Online Background Remover",
    badgeIcon: "brush",
    title: (
      <>
        Remove Background from Images{" "}
        <span className="gradient-text">in Seconds</span>
      </>
    ),
    description:
      "Upload your image and remove the background with a single brush. Perfect for product photos, portraits, and more.",
  },
  enhance: {
    badge: "Free AI Image & Video Enhancer",
    badgeIcon: "wand",
    title: (
      <>
        Enhance Image & Video Quality{" "}
        <span className="gradient-text">to 4K/8K</span>
      </>
    ),
    description:
      "Upscale, sharpen, and enhance your photos and videos. Improve brightness, contrast, and detail with AI-powered processing.",
  },
};

export default function Hero({ children, mode = "watermark" }: { children: React.ReactNode; mode?: Mode }) {
  const content = heroContent[mode];

  return (
    <section className="mesh-bg">
      <div className="container-x section pt-12 md:pt-20">
        <div className="text-center max-w-3xl mx-auto mb-8 md:mb-12">
          <div className="badge mb-4 animate-fade-in" style={{ animationDelay: "0.05s" }}>
            <Icon name={content.badgeIcon as any} size={12} /> {content.badge}
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-4 animate-fade-in" style={{ animationDelay: "0.1s" }}>
            {content.title}
          </h1>
          <p className="text-base md:text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: "0.15s" }}>
            {content.description}
          </p>
        </div>
        {children}
      </div>
    </section>
  );
}
