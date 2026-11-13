/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep development output separate from production builds. This prevents a
  // concurrent `next build` from replacing chunks used by `next dev`.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
};

export default nextConfig;
