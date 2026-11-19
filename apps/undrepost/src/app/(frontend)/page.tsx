import Link from 'next/link'
import React from 'react'

export default function HomePage() {
  return (
    <div>
      <h1>undrepost</h1>
      <p>Sovereign headless blog + social distribution. Content engine: Payload (fork).</p>
      <div className="landing-links">
        <Link href="/blog">Go to blog</Link>
        <Link href="/admin">Go to admin panel</Link>
      </div>
    </div>
  )
}
