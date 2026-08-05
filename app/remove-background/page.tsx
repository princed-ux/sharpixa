import type { Metadata } from "next";
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
import { FAQS_BY_MODE } from "@/lib/constants";

const PAGE_PATH = "/remove-background/";

const PAGE_TITLE =
  "Remove Image Backgrounds and Create Transparent PNGs";

const PAGE_DESCRIPTION =
  "Remove image backgrounds automatically in your browser or use manual selection for more control. Export JPG, PNG, or WEBP images as transparent PNG files.";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ||
  "https://sharpixa.com";

export const metadata: Metadata = {
  title: PAGE_TITLE,

  description: PAGE_DESCRIPTION,

  keywords: [
    "background remover",
    "remove image background",
    "transparent background",
    "transparent PNG maker",
    "automatic background remover",
    "manual background remover",
    "remove background online",
    "browser background remover",
    "product background remover",
  ],

  alternates: {
    canonical: PAGE_PATH,
  },

  openGraph: {
    type: "website",
    url: PAGE_PATH,
    title: `${PAGE_TITLE} | Sharpixa`,
    description: PAGE_DESCRIPTION,
    siteName: "Sharpixa",

    images: [
      {
        url: "/sharpixa-logo.png",
        alt: "Sharpixa image background remover",
      },
    ],
  },

  twitter: {
    card: "summary",
    title: `${PAGE_TITLE} | Sharpixa`,
    description: PAGE_DESCRIPTION,
    images: ["/sharpixa-logo.png"],
  },
};

const faqStructuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": `${SITE_URL}${PAGE_PATH}#faq`,
  url: `${SITE_URL}${PAGE_PATH}`,
  name: PAGE_TITLE,
  description: PAGE_DESCRIPTION,

  isPartOf: {
    "@id": `${SITE_URL}/#website`,
  },

  mainEntity: FAQS_BY_MODE.background.map((faq) => ({
    "@type": "Question",
    name: faq.q,

    acceptedAnswer: {
      "@type": "Answer",
      text: faq.a,
    },
  })),
};

function serializeStructuredData(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export default function RemoveBackgroundPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeStructuredData(faqStructuredData),
        }}
      />

      <TopBanner />

      <Navbar />

      <main>
        <Hero mode="background">
          <UploadZone mode="background" />
        </Hero>

        <SponsoredSection />

        <HowItWorks mode="background" />

        <BeforeAfter mode="background" />

        <FeaturesGrid mode="background" />

        <FileTypes mode="background" />

        <FAQ mode="background" />
      </main>

      <Footer />
    </>
  );
}