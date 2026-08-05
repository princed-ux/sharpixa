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

export default function robots(): MetadataRoute.Robots {
  const siteUrl =
    resolveSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
      },
    ],

    sitemap:
      `${siteUrl}/sitemap.xml`,

    host:
      siteUrl,
  };
}
