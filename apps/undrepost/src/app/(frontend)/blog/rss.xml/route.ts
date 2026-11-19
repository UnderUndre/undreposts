import { getPayload } from 'payload'

import config from '@/payload.config'

const siteUrl = process.env.SITE_URL || 'http://localhost:3000'

const escapeXml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')

/**
 * /blog/rss.xml — «Забор Честертона» SEO retention invariant (business-plan
 * §2.9 / review F3): canonical feed for the sovereign blog.
 */
export async function GET(): Promise<Response> {
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const posts = await payload.find({
    collection: 'posts',
    depth: 1,
    limit: 50,
    sort: '-publishedAt',
    where: {
      status: {
        equals: 'published',
      },
    },
  })

  const items = posts.docs
    .map((post) => {
      const doc = post as unknown as {
        excerpt?: null | string
        publishedAt?: null | string
        slug: string
        title: string
      }
      const link = `${siteUrl}/blog/${doc.slug}`
      const pubDate = doc.publishedAt ? new Date(doc.publishedAt).toUTCString() : ''
      const description = doc.excerpt ? escapeXml(doc.excerpt) : ''
      return `    <item>
      <title>${escapeXml(doc.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid>${escapeXml(link)}</guid>
      ${pubDate ? `<pubDate>${pubDate}</pubDate>` : ''}
      ${description ? `<description>${description}</description>` : ''}
    </item>`
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Undrepost</title>
    <link>${escapeXml(`${siteUrl}/blog`)}</link>
    <description>Sovereign headless blog + social distribution</description>
    <language>en</language>
${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  })
}
