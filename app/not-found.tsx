import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-dvh flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="text-7xl font-bold gradient-text mb-4">404</div>
        <h1 className="text-2xl font-bold mb-3">Page Not Found</h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          href="/remove-watermark"
          className="inline-flex items-center gap-2 font-semibold rounded-xl px-7 py-3 text-white transition-all duration-300"
          style={{
            background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
            boxShadow: "0 4px 14px rgba(99, 102, 241, 0.35)",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
          Back to Home
        </Link>
      </div>
    </div>
  );
}
