import { Icon } from "@/components/Icons";

export default function Footer() {
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <footer className="border-t border-gray-200 dark:border-gray-800 mt-12">
      <div className="container-x py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 font-bold text-lg mb-3">
              <Icon name="wand" size={20} />
              <span className="gradient-text">Watermark Remover</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
              Free online watermark removal tool. Remove logos, text, stamps, and objects from images and videos. No signup required.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-sm">Product</h4>
            <div className="flex flex-col gap-2">
              <a className="nav-link" onClick={() => scrollTo("how-it-works")}>How It Works</a>
              <a className="nav-link" onClick={() => scrollTo("features")}>Features</a>
              <a className="nav-link" onClick={() => scrollTo("faq")}>FAQ</a>
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-sm">Company</h4>
            <div className="flex flex-col gap-2">
              <a className="nav-link">Privacy Policy</a>
              <a className="nav-link">Terms of Service</a>
              <a className="nav-link">Contact</a>
            </div>
          </div>
        </div>
        <div className="ad-slot mb-6">Advertisement — Google AdSense (Footer 728×90)</div>
        <div className="border-t border-gray-200 dark:border-gray-800 pt-6 text-center text-sm text-gray-400">
          <p>&copy; 2026 Watermark Remover. All rights reserved.</p>
          <p className="mt-1 text-xs">Processing happens entirely in your browser. Nothing is uploaded to any server.</p>
        </div>
      </div>
    </footer>
  );
}
