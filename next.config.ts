import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  cacheComponents: true,
  cacheLife: {
    clinicalLive: {
      stale: 30,
      revalidate: 30,
      expire: 300,
    },
    clinicalWarm: {
      stale: 60,
      revalidate: 60,
      expire: 600,
    },
  },
  reactCompiler: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
    proxyClientMaxBodySize: "50mb",
  },
};

export default withSerwist(nextConfig);
