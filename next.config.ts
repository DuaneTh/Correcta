import type { NextConfig } from "next";
import { getSecurityHeaders } from "./lib/securityHeaders";

// Force restart
const nextConfig: NextConfig = {
  // Required for @react-pdf/renderer and mathjax-full in API routes
  serverExternalPackages: ['@react-pdf/renderer', 'mathjax-full'],
  async headers() {
    const isProduction = process.env.NODE_ENV === 'production'
    const enforceCsp = process.env.CSP_ENFORCE === 'true'
    const allowCamera = process.env.SECURITY_ALLOW_CAMERA === 'true'
    const allowMicrophone = process.env.SECURITY_ALLOW_MICROPHONE === 'true'

    return [
      {
        source: '/(.*)',
        headers: getSecurityHeaders({
          isProduction,
          enforceCsp,
          allowCamera,
          allowMicrophone
        })
      }
    ]
  }
};

export default nextConfig;
