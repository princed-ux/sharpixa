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

const PAGE_PATH = "/remove-watermark/";

const PAGE_TITLE =
  "Remove Unwanted Objects and Text Online";

const PAGE_DESCRIPTION =
  "Remove unwanted objects, text, date stamps, logos, and authorized watermarks from images or supported videos using Sharpixa's browser-based selection tools.";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ||
  "https://sharpixa.com";

export const metadata: Metadata = {
  title: PAGE_TITLE,

  description: PAGE_DESCRIPTION,

  keywords: [
    "object remover",
    "text remover",
    "remove object from image",
    "remove text from image",
    "authorized watermark remover",
    "logo remover",
    "date stamp remover",
    "video watermark remover",
    "browser object remover",
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
        alt: "Sharpixa object and text remover",
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

  mainEntity: FAQS_BY_MODE.watermark.map((faq) => ({
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

export default function RemoveWatermarkPage() {
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
        <Hero mode="watermark">
          <UploadZone mode="watermark" />
        </Hero>

        <SponsoredSection />

        <HowItWorks mode="watermark" />

        <BeforeAfter mode="watermark" />

        <FeaturesGrid mode="watermark" />

        <FileTypes mode="watermark" />

        <FAQ mode="watermark" />
      </main>

      <Footer />
    </>
  );
}