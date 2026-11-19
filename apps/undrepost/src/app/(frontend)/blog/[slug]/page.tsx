import { RichText } from '@payloadcms/richtext-lexical/react'
import type { Metadata } from 'next'
import { headers as getHeaders } from 'next/headers.js'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'
import { readCounters } from '@/lib/counters'

import PostInteractions from './PostInteractions'

type PageArgs = {
  params: Promise<{
    slug: string
  }>
}

const siteUrl = process.env.SITE_URL || 'http://localhost:3000'

async function findPost(slug: string) {
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const result = await payload.find({
    collection: 'posts',
    depth: 2,
    limit: 1,
    where: {
      and: [
        {
          slug: {
            equals: slug,
          },
        },
        {
          status: {
            equals: 'published',
          },
        },
      ],
    },
  })
  return result.docs[0] ?? null
}

export async function generateMetadata({ params }: PageArgs): Promise<Metadata> {
  const { slug } = await params
  const post = await findPost(slug)
  if (!post) {
    return { title: 'Not found' }
  }

  const doc = post as unknown as {
    coverImage?: { alt?: string; url?: null | string }
    excerpt?: null | string
    meta?: { description?: null | string; image?: { alt?: string; url?: null | string } }
    title: string
  }

  const description = doc.meta?.description || doc.excerpt || undefined
  const ogImage = doc.meta?.image?.url || doc.coverImage?.url || undefined

  return {
    alternates: {
      // rel="canonical" — SEO-domain retention invariant (FM-03, review F3).
      canonical: `${siteUrl}/blog/${slug}`,
    },
    description,
    openGraph: {
      description,
      images: ogImage
        ? [{ alt: doc.meta?.image?.alt || doc.coverImage?.alt, url: ogImage }]
        : undefined,
      title: doc.meta?.title || doc.title,
      type: 'article',
    },
    title: doc.meta?.title || doc.title,
  }
}

export default async function PostPage({ params }: PageArgs) {
  const { slug } = await params
  const post = await findPost(slug)
  if (!post) {
    notFound()
  }

  const doc = post as unknown as {
    author?: { displayName?: null | string }
    content: unknown
    id: string
    publishedAt?: null | string
    tags?: null | { tag: string }[]
    title: string
  }

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers: await getHeaders() })

  // Interaction snapshot (T2.2/T2.4/T2.5) — live updates stream via SSE.
  const counterRows = await readCounters(payload, { post: String(doc.id) })
  const reactions: Record<string, number> = {}
  for (const row of counterRows) {
    reactions[row.key] = row.count
  }

  const commentsResult = await payload.find({
    collection: 'comments',
    depth: 1,
    limit: 50,
    sort: 'createdAt',
    where: {
      and: [{ deletedAt: { exists: false } }, { post: { equals: String(doc.id) } }],
    },
  })
  const initialComments = commentsResult.docs.map((c) => ({
    author: (c.author as { displayName?: string } | null)?.displayName ?? 'Member',
    body: c.body as string,
    id: String(c.id),
  }))

  let initialMyReactions: string[] = []
  if (user) {
    const mine = await payload.find({
      collection: 'reactions',
      limit: 20,
      overrideAccess: true,
      where: {
        and: [{ author: { equals: String(user.id) } }, { post: { equals: String(doc.id) } }],
      },
    })
    initialMyReactions = mine.docs.map((r) => r.emojiRef as string)
  }

  return (
    <article>
      <h1>{doc.title}</h1>
      <p className="post-meta">
        {doc.author?.displayName ? `${doc.author.displayName} · ` : ''}
        {doc.publishedAt
          ? new Date(doc.publishedAt).toLocaleDateString('en-US', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })
          : ''}
      </p>
      {doc.tags && doc.tags.length > 0 ? (
        <ul className="post-tags">
          {doc.tags.map((t, i) => (
            <li key={i}>{t.tag}</li>
          ))}
        </ul>
      ) : null}
      <div className="leaky-integrated">
        {/* @ts-expect-error — Lexical node shape is validated at runtime by the renderer */}
        <RichText data={doc.content} />
      </div>
      <PostInteractions
        canComment={Boolean(user)}
        initialComments={initialComments}
        initialMyReactions={initialMyReactions}
        initialReactions={reactions}
        postId={String(doc.id)}
      />
    </article>
  )
}
