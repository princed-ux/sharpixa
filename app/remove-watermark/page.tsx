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

export default function RemoveWatermark() {
 return (
  <>
  <TopBanner />
  <Navbar />
  <Hero mode="watermark">
    <UploadZone mode="watermark" />
  </Hero>
  <SponsoredSection />
  <HowItWorks />
 <BeforeAfter />
 <FeaturesGrid />
  <FileTypes />

  <FAQ />

 <Footer />
 </>
 );
}
