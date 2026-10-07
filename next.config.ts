import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This project lives inside a larger home directory; pin the workspace root
  // so Turbopack does not walk up and pick up an unrelated lockfile.
  turbopack: {
    root: path.resolve(process.cwd()),
  },

  // Product images are supplied as URLs. Anything remote is proxied through
  // next/image with an explicit allowlist rather than being trusted blindly.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
    formats: ["image/webp"],
  },

  experimental: {
    // Only pull the icons actually used, rather than the whole set.
    optimizePackageImports: ["lucide-react", "recharts", "date-fns"],
  },

  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
