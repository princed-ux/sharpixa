"use client";

import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import UploadZone from "@/components/UploadZone";
import HowItWorks from "@/components/HowItWorks";
import BeforeAfter from "@/components/BeforeAfter";
import FeaturesGrid from "@/components/FeaturesGrid";
import FileTypes from "@/components/FileTypes";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";

export default function EnhanceQuality() {
  return (
    <>
      <Navbar />
      <Hero mode="enhance">
        <UploadZone mode="enhance" />
      </Hero>
      <HowItWorks />
      <BeforeAfter />
      <FeaturesGrid />
      <FileTypes />

      <div className="container-x section">
        <div className="ad-slot">Advertisement — Google AdSense (728×90 leaderboard)</div>
      </div>

      <FAQ />

      <div className="container-x section">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Promoted</p>
            <h2 className="text-xl font-bold mt-1">Check Out Our Other Tools</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <a href="#" className="premium-card flex items-center gap-4 p-5 no-underline">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg shrink-0">
                A
              </div>
              <div>
                <h3 className="font-bold text-sm">App Name One</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Short description of the partner application.</p>
              </div>
            </a>
            <a href="#" className="premium-card flex items-center gap-4 p-5 no-underline">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center text-white font-bold text-lg shrink-0">
                B
              </div>
              <div>
                <h3 className="font-bold text-sm">App Name Two</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Short description of the partner application.</p>
              </div>
            </a>
          </div>
        </div>
      </div>

      <div className="container-x section pt-0">
        <div className="ad-slot">Advertisement — Google AdSense (728×90 bottom)</div>
      </div>

      <Footer />
    </>
  );
}
