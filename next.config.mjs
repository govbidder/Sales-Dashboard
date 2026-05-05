import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Silence "multiple lockfiles detected" warning by pinning the workspace
  // root to this project (the parent home dir also has a lockfile).
  turbopack: {
    root: __dirname,
  },
  // Hide the floating Next.js "N" dev indicator in the bottom-left corner.
  devIndicators: false,
}

export default nextConfig
