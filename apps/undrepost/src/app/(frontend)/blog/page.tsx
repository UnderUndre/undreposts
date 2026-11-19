import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'

export const metadata = {
  alternates: {
    // Canonical self-link for the listing (business-plan §2.9 / review F3).
    canonical: `${process.env.SITE_URL || 'http://localhost:3000'}/blog`,
  },
  title: 'Blog',
}

type PostRow = {
  excerpt?: null | string
  meta?: { description?: null | string }
  publishedAt?: null | string
  slug: string
  tags?: null | { tag: string }[]
  title: string
}

export default async function BlogListPage() {
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const posts = await payload.find({
    collection: 'posts',
    depth: 1,
    limit: 20,
    sort: '-publishedAt',
    where: {
      status: {
        equals: 'published',
      },
    },
  })

  return (
    <div>
      <h1>Blog</h1>
      {posts.docs.length === 0 ? (
        <p>No published posts yet.</p>
      ) : (
        <ul className="post-list">
          {posts.docs.map((post) => {
            const row = post as unknown as PostRow
            const author = (post as unknown as { author?: { displayName?: string } }).author
            return (
              <li key={post.id}>
                <Link href={`/blog/${row.slug}`}>{row.title}</Link>
                <p className="post-meta">
                  {author?.displayName ? `${author.displayName} · ` : ''}
                  {row.publishedAt
                    ? new Date(row.publishedAt).toLocaleDateString('en-US', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })
                    : ''}
                </p>
                {row.excerpt ? <p className="post-excerpt">{row.excerpt}</p> : null}
                {row.tags && row.tags.length > 0 ? (
                  <ul className="post-tags">
                    {row.tags.map((t, i) => (
                      <li key={i}>{t.tag}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
