import Image from "next/image";
import { Icon } from "@/components/Icons";

export default function Footer() {
 const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

 return (
 <footer className="border-t border-gray-200 mt-12">
 <div className="container-x py-12">
 <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
 <div className="md:col-span-2">
 <div className="flex items-center gap-2 font-bold text-lg mb-3">
 <Image src="/sharpixa-logo.png" alt="Sharpixa" width={24} height={24} className="w-6 h-6" />
 <span className="gradient-text">Sharpixa</span>
 </div>
 <p className="text-sm text-gray-500 max-w-sm">
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
  <div className="border-t border-gray-200 pt-6 text-center text-sm text-gray-400">
 <p>&copy; 2026 Sharpixa. All rights reserved.</p>
 <p className="mt-1 text-xs">Processing happens entirely in your browser. Nothing is uploaded to any server.</p>
 </div>
 </div>
 </footer>
 );
}
