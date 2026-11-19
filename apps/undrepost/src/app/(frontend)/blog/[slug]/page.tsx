import { RichText } from '@payloadcms/richtext-lexical/react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'

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
    publishedAt?: null | string
    tags?: null | { tag: string }[]
    title: string
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
    </article>
  )
}
