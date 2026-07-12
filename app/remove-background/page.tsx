"use client";

import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import UploadZone from "@/components/UploadZone";
import TopBanner from "@/components/TopBanner";
import SponsoredSection from "@/components/SponsoredSection";
import HowItWorks from "@/components/HowItWorks";
import BeforeAfter from "@/components/BeforeAfter";
import FeaturesGrid from "@/components/FeaturesGrid";
import FileTypes from "@/components/FileTypes";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";

export default function RemoveBackground() {
 return (
  <>
  <TopBanner />
  <Navbar />
  <Hero mode="background">
    <UploadZone mode="background" />
  </Hero>
  <SponsoredSection />
  <HowItWorks />
 <BeforeAfter />
 <FeaturesGrid />
 <FileTypes />

 <div className="container-x section">
 <div className="ad-slot">Advertisement — Google AdSense (728×90 leaderboard)</div>
 </div>

 <FAQ />

  <div className="container-x section pt-0">
 <div className="ad-slot">Advertisement — Google AdSense (728×90 bottom)</div>
 </div>

 <Footer />
 </>
 );
}
