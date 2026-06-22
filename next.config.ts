import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The solo/master tournament was renamed to the Bracketeer Knockout Challenge
  // and moved to /challenge; keep old links (and any bookmarks) working.
  async redirects() {
    return [{ source: "/master", destination: "/challenge", permanent: true }];
  },
};

export default nextConfig;
