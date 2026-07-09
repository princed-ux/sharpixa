import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sharpify — Remove Watermarks, Backgrounds & Enhance Images & Videos Free Online",
  description:
    "Remove watermarks, logos, text, and objects from images and videos online free. Remove image backgrounds and enhance quality to 4K/8K. No signup required. 100% free.",
  keywords: [
    "watermark remover",
    "remove watermark from image",
    "remove watermark from video",
    "background remover",
    "image enhancer",
    "video enhancer",
    "AI watermark removal",
    "image deblur",
    "video upscaler",
    "4K video enhancer",
    "photo enhancement",
    "blur removal",
    "logo remover",
    "text remover from image",
    "Sharpify",
  ],
  authors: [{ name: "Sharpify" }],
  alternates: { canonical: "https://sharpify.app/" },
  openGraph: {
    type: "website",
    url: "https://sharpify.app/",
    title: "Sharpify — Remove Watermarks, Backgrounds & Enhance Images & Videos Free Online",
    description:
      "Remove watermarks, logos, text, and objects from images and videos online free. AI-powered background removal and enhancement with no signup required.",
    siteName: "Sharpify",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sharpify — Remove Watermarks, Backgrounds & Enhance Images & Videos",
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
    name: "Sharpify",
    url: "https://sharpify.app",
    description:
      "Free online watermark removal, background removal, and image/video enhancement tool. Remove logos, text, and objects with AI-powered technology.",
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
        name: "Is Sharpify free?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes! Sharpify is completely free to use. No signup or account needed. Just upload your file and remove watermarks, backgrounds, or enhance quality instantly.",
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='g' x1='0' y1='0' x2='100' y2='100'><stop offset='0%' stopColor='%236366f1'/><stop offset='50%' stopColor='%23a855f7'/><stop offset='100%' stopColor='%23ec4899'/></linearGradient></defs><circle cx='50' cy='50' r='40' fill='url(%23g)'/><path d='M35 50h30M50 35v30' stroke='white' strokeWidth='6' strokeLinecap='round'/></svg>"
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
