import Link from 'next/link'
import React from 'react'
import type { Metadata } from 'next'

import './styles.css'

export const metadata: Metadata = {
  title: {
    default: 'Undrepost',
    template: '%s — Undrepost',
  },
  description: 'Sovereign headless blog + social distribution (undrepost).',
}

export default function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link className="site-brand" href="/">
            undrepost
          </Link>
          <nav>
            <Link href="/blog">Blog</Link>
            <Link href="/admin">Admin</Link>
          </nav>
        </header>
        <main className="site-main">{children}</main>
        <footer className="site-footer">
          <p>undrepost — payload fork, spec 001-init-from-payload</p>
        </footer>
      </body>
    </html>
  )
}
