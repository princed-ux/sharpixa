import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  // Keep Next's tracing and worker dependency graph inside this project when
  // another package-lock.json exists higher in the Windows user directory.
  outputFileTracingRoot: projectRoot,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
