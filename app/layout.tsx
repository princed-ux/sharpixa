import type {
  Metadata,
  Viewport,
} from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import InstallApp from "@/components/InstallApp";
import "./globals.css";

const DEFAULT_SITE_URL =
  "https://sharpixa.com";

const ADSENSE_CLIENT_ID =
  "ca-pub-3890435207453108";

function resolveSiteUrl(): string {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (!configuredUrl) {
    return DEFAULT_SITE_URL;
  }

  try {
    return new URL(
      configuredUrl,
    ).origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

const SITE_URL =
  resolveSiteUrl();

const SITE_NAME =
  "Sharpixa";

const SITE_DESCRIPTION =
  "Browser-based tools for removing unwanted objects and text, creating transparent image backgrounds, and improving image or video presentation.";

export const metadata: Metadata = {
  metadataBase:
    new URL(SITE_URL),

  applicationName:
    SITE_NAME,

  manifest:
    "/manifest.webmanifest",

  appleWebApp: {
    capable: true,
    statusBarStyle:
      "default",
    title:
      SITE_NAME,
  },

  title: {
    default:
      "Sharpixa | Browser-Based Image and Video Tools",

    template:
      "%s | Sharpixa",
  },

  description:
    SITE_DESCRIPTION,

  keywords: [
    "Sharpixa",
    "object remover",
    "text remover",
    "authorized watermark remover",
    "background remover",
    "transparent PNG maker",
    "image enhancer",
    "video enhancer",
    "image resizer",
    "image sharpening",
    "browser image editor",
  ],

  authors: [
    {
      name:
        SITE_NAME,

      url:
        SITE_URL,
    },
  ],

  creator:
    SITE_NAME,

  publisher:
    SITE_NAME,

  category:
    "Multimedia",

  referrer:
    "origin-when-cross-origin",

  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },

  alternates: {
    canonical: "/",
  },

  icons: {
    icon: [
      {
        url:
          "/sharpixa-logo.png",

        type:
          "image/png",
      },
    ],

    shortcut:
      "/sharpixa-logo.png",

    apple:
      "/sharpixa-logo.png",
  },

  openGraph: {
    type:
      "website",

    locale:
      "en_US",

    url:
      "/",

    siteName:
      SITE_NAME,

    title:
      "Sharpixa | Browser-Based Image and Video Tools",

    description:
      SITE_DESCRIPTION,

    images: [
      {
        url:
          "/sharpixa-logo.png",

        width:
          1156,

        height:
          1231,

        alt:
          "Sharpixa logo",
      },
    ],
  },

  twitter: {
    card:
      "summary_large_image",

    title:
      "Sharpixa | Browser-Based Image and Video Tools",

    description:
      SITE_DESCRIPTION,

    images: [
      "/sharpixa-logo.png",
    ],
  },

  robots: {
    index: true,
    follow: true,

    nocache: false,

    googleBot: {
      index: true,
      follow: true,

      "max-video-preview":
        -1,

      "max-image-preview":
        "large",

      "max-snippet":
        -1,
    },
  },

  other: {
    "google-adsense-account":
      ADSENSE_CLIENT_ID,
  },
};

export const viewport: Viewport = {
  width:
    "device-width",

  initialScale:
    1,

  maximumScale:
    5,

  viewportFit:
    "cover",

  themeColor:
    "#ffffff",

  colorScheme:
    "light",
};

const structuredData = {
  "@context":
    "https://schema.org",

  "@graph": [
    {
      "@type":
        "Organization",

      "@id":
        `${SITE_URL}/#organization`,

      name:
        SITE_NAME,

      url:
        SITE_URL,

      logo: {
        "@type":
          "ImageObject",

        url:
          `${SITE_URL}/sharpixa-logo.png`,

        width:
          1156,

        height:
          1231,
      },
    },

    {
      "@type":
        "WebSite",

      "@id":
        `${SITE_URL}/#website`,

      url:
        SITE_URL,

      name:
        SITE_NAME,

      description:
        SITE_DESCRIPTION,

      publisher: {
        "@id":
          `${SITE_URL}/#organization`,
      },

      inLanguage:
        "en",
    },

    {
      "@type":
        "WebApplication",

      "@id":
        `${SITE_URL}/#web-application`,

      name:
        SITE_NAME,

      url:
        SITE_URL,

      description:
        SITE_DESCRIPTION,

      applicationCategory:
        "MultimediaApplication",

      applicationSubCategory:
        "Image and video editing",

      operatingSystem:
        "Any",

      browserRequirements:
        "Requires JavaScript and a modern web browser.",

      isAccessibleForFree:
        true,

      provider: {
        "@id":
          `${SITE_URL}/#organization`,
      },

      offers: {
        "@type":
          "Offer",

        price:
          "0",

        priceCurrency:
          "USD",

        availability:
          "https://schema.org/OnlineOnly",
      },

      featureList: [
        "Manual unwanted-object and text selection",
        "Authorized watermark cleanup",
        "Automatic image background removal",
        "Manual background selection",
        "Transparent PNG export",
        "Image resizing and adjustment",
        "Compatible video processing",
        "Browser-based file-processing workflow",
      ],
    },
  ],
};

function serializeStructuredData(
  value: unknown,
): string {
  return JSON.stringify(
    value,
  ).replace(
    /</g,
    "\\u003c",
  );
}

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({
  children,
}: Readonly<RootLayoutProps>) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-white text-sm text-gray-900 antialiased">
        <Script
          id="sharpixa-structured-data"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html:
              serializeStructuredData(
                structuredData,
              ),
          }}
        />

        <Script
          id="sharpixa-adsense"
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />

        {children}

        <InstallApp />
      </body>
    </html>
  );
}