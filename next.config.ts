import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // /rules reads the rulebook markdown from the repo at request time; without this
  // trace entry Vercel's serverless bundle omits the file and the page 500s in
  // production while working locally (D-036).
  outputFileTracingIncludes: {
    "/rules": ["./docs/build spec/ANTE-RULEBOOK.md"],
  },
  // The service worker must never be served stale, or a fix to it waits on a
  // browser cache nobody can clear from here (D-120).
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
