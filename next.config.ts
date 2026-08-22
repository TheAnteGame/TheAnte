import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // /rules reads the rulebook markdown from the repo at request time; without this
  // trace entry Vercel's serverless bundle omits the file and the page 500s in
  // production while working locally (D-036).
  outputFileTracingIncludes: {
    "/rules": ["./docs/build spec/ANTE-RULEBOOK.md"],
  },
};

export default nextConfig;
