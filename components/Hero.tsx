import { Icon } from "@/components/Icons";

export default function Hero({ children }: { children: React.ReactNode }) {
  return (
    <section className="mesh-bg">
      <div className="container-x section pt-12 md:pt-20">
        <div className="text-center max-w-3xl mx-auto mb-8 md:mb-12">
          <div className="badge mb-4">
            <Icon name="wand" size={12} /> Free Online Watermark Removal Tool
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-4">
            Remove Watermarks from Images and Videos{" "}
            <span className="gradient-text">Instantly for Free</span>
          </h1>
          <p className="text-base md:text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
            Upload your file and remove logos, text, stamps, and objects automatically. No signup needed. 100% free.
          </p>
        </div>
        {children}
      </div>
    </section>
  );
}
