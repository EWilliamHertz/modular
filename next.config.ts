import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "3000-cs-553118797525-default.cs-europe-west4-pear.cloudshell.dev", 
    "*.cloudshell.dev", 
    "localhost:3000"
  ],
};

export default nextConfig;
