# Sharpify AI

AI-powered media enhancement platform built with Next.js 15, React 19, and Tailwind CSS.

## Features

- **AI Image Enhancement**: Upscaling (up to 4x), blur removal, noise reduction, sharpening, brightness/contrast/saturation correction
- **AI Video Enhancement**: Upscaling, sharpening, denoising, color correction, stabilization (demo mode)
- **3 Enhancement Presets**: Light, Standard, Maximum
- **Before/After Comparison**: Interactive draggable sliders
- **Auth System**: Email login/signup + Google login (simulated)
- **Admin Dashboard**: Analytics, visitor stats, device breakdown, top countries
- **SEO Optimized**: Meta tags, Open Graph, JSON-LD structured data, sitemap, robots.txt
- **Ad Ready**: Pre-placed Google AdSense slots (homepage, results, footer, dashboard)
- **Dark Mode**: Full dark mode support with auto-detection
- **Mobile-First**: Fully responsive design

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **UI**: React 19 + Tailwind CSS 3
- **Language**: TypeScript
- **Image Processing**: Canvas API (client-side, ready to swap for Real-ESRGAN/GFPGAN on server)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
sharpify-ai-nextjs/
├── app/
│   ├── layout.tsx          # Root layout with SEO metadata + JSON-LD
│   ├── page.tsx            # Landing page
│   ├── globals.css         # Tailwind + custom styles
│   ├── dashboard/
│   │   └── page.tsx        # Admin dashboard
│   └── api/
│       └── enhance/
│           └── route.ts    # Enhancement API endpoint
├── components/
│   ├── Navbar.tsx          # Sticky nav with mobile menu
│   ├── Hero.tsx            # Hero section
│   ├── UploadZone.tsx      # Upload + settings + processing + result
│   ├── HowItWorks.tsx      # 4-step guide
│   ├── BeforeAfter.tsx     # Interactive comparison sliders
│   ├── FeaturesGrid.tsx    # 8 feature cards
│   ├── FileTypes.tsx       # Supported formats display
│   ├── FAQ.tsx             # Accordion FAQ
│   ├── Footer.tsx          # Footer with links + ad slot
│   └── AuthModal.tsx       # Login/signup modal
├── context/
│   └── AuthContext.tsx     # Auth state provider
├── lib/
│   ├── constants.ts        # Presets, formats, features, FAQs
│   └── enhance.ts          # Image enhancement engine (Canvas API)
├── public/
│   ├── robots.txt
│   └── sitemap.xml
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
└── next.config.mjs
```

## Production Deployment

1. Replace the client-side Canvas enhancement with server-side AI models (Real-ESRGAN, GFPGAN, CodeFormer)
2. Connect Supabase Auth for real authentication
3. Set up Supabase Storage or Cloudflare R2 for file storage
4. Add Google AdSense ad units to the pre-placed ad slots
5. Add Google Analytics and Microsoft Clarity tracking
6. Deploy to Vercel
