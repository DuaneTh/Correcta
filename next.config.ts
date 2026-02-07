import type { NextConfig } from "next";
import { getSecurityHeaders } from "./lib/securityHeaders";

const nextConfig: NextConfig = {
  // Required for @react-pdf/renderer and mathjax-full in API routes
  serverExternalPackages: ['@react-pdf/renderer', 'mathjax-full', '@sentry/nextjs', '@sentry/node'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Patch next-auth: req.nextUrl is undefined in Lambda/OpenNext environment.
      // Fallback to standard Web API URL constructor.
      config.module.rules.push({
        test: /node_modules[\\/]next-auth[\\/]next[\\/]index\.js$/,
        loader: 'string-replace-loader',
        options: {
          search: 'req.nextUrl.searchParams',
          replace: '(req.nextUrl || new URL(req.url)).searchParams',
        },
      });
    }
    return config;
  },
  async headers() {
    const isProduction = process.env.NODE_ENV === 'production'
    const enforceCsp = process.env.CSP_ENFORCE === 'true'
    const allowCamera = process.env.SECURITY_ALLOW_CAMERA === 'true'
    const allowMicrophone = process.env.SECURITY_ALLOW_MICROPHONE === 'true'

    const securityHeaders = getSecurityHeaders({
      isProduction,
      enforceCsp,
      allowCamera,
      allowMicrophone
    })

    return [
      {
        source: '/(.*)',
        headers: securityHeaders
      },
      {
        // Cache static assets from /public (images, fonts, brand)
        source: '/:path(brand|mathlive-fonts|favicon\\.ico|.*\\.svg)/:file*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }
        ]
      }
    ]
  }
};

// Note: withSentryConfig wrapper removed — it uses require('fs') which breaks
// OpenNext ESM bundling. Sentry still works at runtime via instrumentation.ts.
// Re-add withSentryConfig if source map uploads are needed in a non-OpenNext CI.
export default nextConfig;
