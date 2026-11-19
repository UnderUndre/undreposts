import type { Payload } from 'payload'

import type { SocialAdapter, SyndicationChannel } from './types'

import { telegramAdapter } from './telegram'

const adapters: SocialAdapter[] = [telegramAdapter]

function findAdapter(channel: SyndicationChannel): SocialAdapter | undefined {
  return adapters.find((a) => a.channel === channel)
}

/**
 * Fan-out syndication for a freshly published post (T2.17). Retry-safe dedup:
 * exactly one `sent` per (post, channel) — existing `sent` entries short-
 * circuit, `failed` entries are retried on the next publish event. External
 * failures are logged to SyndicationLog and swallowed (FM-02).
 */
export async function runSyndication(
  payload: Payload,
  post: { excerpt?: null | string; id: number | string; slug?: null | string; title: string },
): Promise<void> {
  const baseUrl = process.env.SITE_URL || 'http://localhost:3000'
  const canonicalUrl = `${baseUrl}/blog/${post.slug ?? String(post.id)}`

  const channels: SyndicationChannel[] = ['telegram']

  for (const channel of channels) {
    const adapter = findAdapter(channel)
    if (!adapter) {
      continue
    }

    const dedup = await payload.find({
      collection: 'syndication-log',
      limit: 1,
      overrideAccess: true,
      where: {
        and: [
          { channel: { equals: channel } },
          { post: { equals: post.id } },
          { status: { equals: 'sent' } },
        ],
      },
    })
    if (dedup.docs[0]) {
      continue
    }

    const log = await payload.create({
      collection: 'syndication-log',
      data: {
        channel,
        post: post.id,
        status: 'pending',
      },
      overrideAccess: true,
    })

    try {
      const result = await adapter.send({
        canonicalUrl,
        payload,
        post: { id: post.id, excerpt: post.excerpt, title: post.title },
      })

      if (result.skipped) {
        await payload.update({
          id: log.id as string,
          collection: 'syndication-log',
          data: { error: result.skipReason ?? 'skipped', status: 'failed' },
          overrideAccess: true,
        })
        payload.logger.warn({ channel, msg: 'syndication-skipped', reason: result.skipReason })
      } else {
        await payload.update({
          id: log.id as string,
          collection: 'syndication-log',
          data: { externalRef: result.externalRef ?? null, status: 'sent' },
          overrideAccess: true,
        })
        payload.logger.info({ channel, msg: 'syndication-sent' })
      }
    } catch (err) {
      // FM-02: publication NEVER fails because of an external API.
      await payload.update({
        id: log.id as string,
        collection: 'syndication-log',
        data: { error: String((err as Error).message ?? err).slice(0, 500), status: 'failed' },
        overrideAccess: true,
      })
      payload.logger.warn({ channel, err, msg: 'syndication-failed' })
    }
  }
}
