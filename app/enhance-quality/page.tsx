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

const PAGE_PATH = "/enhance-quality/";

const PAGE_TITLE =
  "Improve Image and Video Quality Online";

const PAGE_DESCRIPTION =
  "Resize, denoise, sharpen, and adjust the brightness, contrast, and saturation of images or compatible videos using practical browser-based controls.";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ||
  "https://sharpixa.com";

export const metadata: Metadata = {
  title: PAGE_TITLE,

  description: PAGE_DESCRIPTION,

  keywords: [
    "image enhancer",
    "video enhancer",
    "improve image quality",
    "improve video quality",
    "image sharpener",
    "image denoiser",
    "image resizer",
    "increase image resolution",
    "browser image editor",
    "brightness contrast saturation editor",
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
        alt: "Sharpixa image and video quality improvement tool",
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

  mainEntity: FAQS_BY_MODE.enhance.map((faq) => ({
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

export default function EnhanceQualityPage() {
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
        <Hero mode="enhance">
          <UploadZone mode="enhance" />
        </Hero>

        <SponsoredSection />

        <HowItWorks mode="enhance" />

        <BeforeAfter mode="enhance" />

        <FeaturesGrid mode="enhance" />

        <FileTypes mode="enhance" />

        <FAQ mode="enhance" />
      </main>

      <Footer />
    </>
  );
}