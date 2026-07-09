import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Watermark Remover — Remove Watermarks from Images & Videos Free Online",
  description:
    "Remove watermarks, logos, text, and objects from images and videos online free. AI-powered watermark removal, deblurring, upscaling to 4K/8K. No signup required.",
  keywords: [
    "watermark remover",
    "remove watermark from image",
    "remove watermark from video",
    "AI watermark removal",
    "image deblur",
    "video upscaler",
    "4K video enhancer",
    "photo enhancement",
    "blur removal",
    "logo remover",
    "text remover from image",
  ],
  authors: [{ name: "Watermark Remover" }],
  alternates: { canonical: "https://watermark-remover.app/" },
  openGraph: {
    type: "website",
    url: "https://watermark-remover.app/",
    title: "Watermark Remover — Remove Watermarks from Images & Videos Free Online",
    description:
      "Remove watermarks, logos, text, and objects from images and videos online free. AI-powered enhancement with no signup required.",
    siteName: "Watermark Remover",
  },
  twitter: {
    card: "summary_large_image",
    title: "Watermark Remover — Remove Watermarks from Images & Videos",
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
    name: "Watermark Remover",
    url: "https://watermark-remover.app",
    description:
      "Free online watermark removal tool for images and videos. Remove logos, text, and objects with AI-powered technology.",
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
        name: "Is Watermark Remover free?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes! Watermark Remover is completely free to use. No signup or account needed. Just upload your file and remove watermarks instantly.",
        },
      },
      {
        "@type": "Question",
        name: "How long does watermark removal take?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Most image watermark removals complete in under 10 seconds. Video processing time depends on file size and resolution, typically 30 seconds to a few minutes.",
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
        name: "Are uploaded files secure?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. All uploads are processed entirely in your browser. Nothing is sent to any server. Your files never leave your device.",
        },
      },
      {
        "@type": "Question",
        name: "Do files get deleted automatically?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Since everything runs in your browser, no files are ever uploaded to our servers. Your privacy is fully protected.",
        },
      },
    ],
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>W</text></svg>"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdWebApp) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches)`,
          }}
        />
      </head>
      <body className="min-h-dvh text-sm antialiased">
        {children}
      </body>
    </html>
  );
}
