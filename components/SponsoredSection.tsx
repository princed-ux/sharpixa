import Image from "next/image";
import sponsoredLogo from "@/assets/sponsored-logo.png";

export default function SponsoredSection() {
  return (
    <section className="section">
      <div className="container-x">
        <div className="max-w-4xl mx-auto premium-card flex flex-col sm:flex-row items-center gap-6 sm:gap-8 p-6 md:p-8">
          <a
            href="https://shoplinkvi.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 block hover:opacity-90 transition-opacity"
          >
            <Image
              src={sponsoredLogo}
              alt="ShopLink.vi"
              className="h-14 md:h-20 w-auto"
            />
          </a>
          <div className="text-center sm:text-left">
            <h3 className="font-bold text-lg md:text-xl text-gray-800">
              Automate Your WhatsApp Storefront in 60 Seconds
            </h3>
            <p className="text-sm md:text-base text-gray-600 mt-2 leading-relaxed">
              ShopLink.vi turns messy chats into structured sales. Customers browse your digital catalog and check out seamlessly, automatically generating a clean, organized order receipt sent directly to your WhatsApp DM. No more manual calculations or chaotic messaging threads.
            </p>
            <a
              href="https://shoplinkvi.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-4 md:mt-5 font-semibold text-sm text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl px-6 py-2.5 hover:shadow-lg hover:shadow-indigo-500/25 hover:-translate-y-0.5 transition-all"
            >
              Sign Up Free →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
