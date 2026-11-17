import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_SUPABASE_URL: process.env.NEXT_SUPABASE_URL,
    NEXT_SUPABASE_ANON_KEY: process.env.NEXT_SUPABASE_ANON_KEY,
  },
  // Short links for the SMS digests (lib/digests.ts SMS_LINK_*): an SMS has 70 characters, so the texts point
  // at mashpian.online/c and mashpian.online/b. Keep these — old messages keep linking here.
  async redirects() {
    return [
      { source: "/c", destination: "/connections", permanent: false },
      { source: "/b", destination: "/brand/connections", permanent: false },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
