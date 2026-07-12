import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sharpixa — Remove Watermarks, Backgrounds & Enhance Images & Videos Free Online",
  description:
    "Remove watermarks, logos, text, and objects from images and videos online free. Remove image backgrounds and enhance quality to 4K/8K. No signup required. 100% free.",
  keywords: [
    "watermark remover",
    "remove watermark from image",
    "remove watermark from video",
    "background remover",
    "image enhancer",
    "video enhancer",
    "image deblur",
    "video upscaler",
    "4K video enhancer",
    "photo enhancement",
    "blur removal",
    "logo remover",
    "text remover from image",
    "Sharpixa",
  ],
  authors: [{ name: "Sharpixa" }],
  alternates: { canonical: "https://sharpixa.com/" },
  openGraph: {
    type: "website",
    url: "https://sharpixa.com/",
    title: "Sharpixa — Remove Watermarks, Backgrounds & Enhance Images & Videos Free Online",
    description:
      "Remove watermarks, logos, text, and objects from images and videos online free. Background removal and enhancement with no signup required.",
    siteName: "Sharpixa",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sharpixa — Remove Watermarks, Backgrounds & Enhance Images & Videos",
    description:
      "Remove watermarks, logos, text, and objects from images and videos online free. No signup required.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const jsonLdWebApp = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Sharpixa",
    url: "https://sharpixa.com",
    description:
      "Free online watermark removal, background removal, and image/video enhancement tool. Remove logos, text, and objects with powerful in-browser processing.",
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      ratingCount: "12750",
    },
  };

  const jsonLdFaq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Is Sharpixa free?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes! Sharpixa is completely free to use. No signup or account needed. Just upload your file and remove watermarks, backgrounds, or enhance quality instantly.",
        },
      },
      {
        "@type": "Question",
        name: "How does watermark removal work?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Upload your file and use the brush tool to mark the watermark area. The tool processes the region and fills it naturally using the surrounding pixels, leaving the background intact.",
        },
      },
      {
        "@type": "Question",
        name: "What file formats are supported?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Images: JPG, JPEG, PNG, WEBP. Videos: MP4, MOV, AVI, WEBM, MKV.",
        },
      },
      {
        "@type": "Question",
        name: "Are my files private?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Absolutely. Everything runs in your browser using Canvas API and WebCodecs. No files are ever uploaded to any server. Your files never leave your device.",
        },
      },
      {
        "@type": "Question",
        name: "Can I remove watermarks from videos?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Upload a video, use the brush tool to mark the watermark area on the first frame, and the tool will process the entire video frame by frame while preserving audio and original duration.",
        },
      },
    ],
  };

  return (
    <html lang="en">
      <head>
        <meta name="google-adsense-account" content="ca-pub-3890435207453108" />
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3890435207453108"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
        <link rel="icon" href="/sharpixa-logo.png" />
        <link rel="apple-touch-icon" href="/sharpixa-logo.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdWebApp) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }}
        />
      </head>
      <body className="min-h-dvh text-sm antialiased">
        {children}
      </body>
    </html>
  );
}
