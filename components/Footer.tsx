import { Icon } from "@/components/Icons";

export default function Footer() {
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <footer className="border-t border-gray-200 dark:border-gray-800 mt-12">
      <div className="container-x py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 font-bold text-lg mb-3">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="url(#sharpify-grad-foot)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <defs>
                  <linearGradient id="sharpify-grad-foot" x1="0" y1="0" x2="24" y2="24">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="50%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#ec4899" />
                  </linearGradient>
                </defs>
                <path d="M12 3c-2 4-6 7-6 11a6 6 0 0 0 12 0c0-4-4-7-6-11Z" />
                <path d="M9 12h6" />
                <path d="M12 9v6" />
              </svg>
              <span className="gradient-text">Sharpify</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
              Free online watermark removal, background removal, and image/video enhancement. No signup required. Everything runs in your browser.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-sm">Tools</h4>
            <div className="flex flex-col gap-2">
              <a href="/remove-watermark" className="nav-link">Remove Watermark</a>
              <a href="/remove-background" className="nav-link">Remove Background</a>
              <a href="/enhance-quality" className="nav-link">Enhance Quality</a>
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-sm">Product</h4>
            <div className="flex flex-col gap-2">
              <a className="nav-link" onClick={() => scrollTo("how-it-works")}>How It Works</a>
              <a className="nav-link" onClick={() => scrollTo("features")}>Features</a>
              <a className="nav-link" onClick={() => scrollTo("faq")}>FAQ</a>
            </div>
          </div>
        </div>
        <div className="ad-slot mb-6">Advertisement — Google AdSense (Footer 728×90)</div>
        <div className="border-t border-gray-200 dark:border-gray-800 pt-6 text-center text-sm text-gray-400">
          <p>&copy; 2026 Sharpify. All rights reserved.</p>
          <p className="mt-1 text-xs">Processing happens entirely in your browser. Nothing is uploaded to any server.</p>
        </div>
      </div>
    </footer>
  );
}
