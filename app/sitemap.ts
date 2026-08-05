import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const DEFAULT_SITE_URL =
  "https://sharpixa.com";

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

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl =
    resolveSiteUrl();

  const lastModified =
    new Date();

  return [
    {
      url:
        `${siteUrl}/`,

      lastModified,

      changeFrequency:
        "weekly",

      priority:
        1,
    },

    {
      url:
        `${siteUrl}/remove-watermark/`,

      lastModified,

      changeFrequency:
        "weekly",

      priority:
        0.9,
    },

    {
      url:
        `${siteUrl}/remove-background/`,

      lastModified,

      changeFrequency:
        "weekly",

      priority:
        0.9,
    },

    {
      url:
        `${siteUrl}/enhance-quality/`,

      lastModified,

      changeFrequency:
        "weekly",

      priority:
        0.9,
    },
  ];
}
