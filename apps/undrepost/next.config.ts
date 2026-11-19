import type { NextConfig } from 'next'

import { withPayload } from '@payloadcms/next/withPayload'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

const nextConfig: NextConfig = {
  images: {
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
  },
  turbopack: {
    // pnpm isolated linker: app deps resolve through the root .pnpm store,
    // which lives OUTSIDE the app dir — Turbopack refuses junctions leaving
    // its root ("files outside of the workspace root are not compiled").
    // Root must therefore cover the whole fork. The repo-root
    // instrumentation.ts (upstream Sentry wiring) is shadowed by this app's
    // own no-op instrumentation file.
    root: path.resolve(dirname, '../..'),
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
}

// pnpm resolves two `next@16.4.6` instances in this monorepo (different
// @babel/core peer hashes), so the app-side NextConfig type and the
// @payloadcms/next-side one are nominally incompatible. Cast to the exact
// parameter type `withPayload` expects to bridge the duplicate instance.
export default withPayload(nextConfig as Parameters<typeof withPayload>[0], {
  devBundleServerPackages: false,
})
