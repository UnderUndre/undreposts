import type { Endpoint, Payload } from 'payload'

import { bumpCounter, readCounters } from '../lib/counters'

const MAX_EMOJI_REF_LENGTH = 64

/**
 * POST /api/posts/:id/reactions { emojiRef } (T2.2 / FR-020)
 * Toggle semantics: creates the (post, author, emojiRef) reaction or removes
 * the existing one. Author is ALWAYS the authenticated member — the request
 * body cannot spoof authorship. Unique constraint FR-020 lives at the DB level
 * (Reactions compound index).
 */
export const toggleReactionEndpoint: Endpoint = {
  handler: async (req) => {
    if (!req.user) {
      return Response.json({ error: 'authentication_required' }, { status: 401 })
    }

    const postId = String(req.routeParams?.id ?? '')
    let body: { author?: string; emojiRef?: string }
    try {
      body = (await req.json()) as { author?: string; emojiRef?: string }
    } catch {
      return Response.json({ error: 'invalid_json' }, { status: 400 })
    }

    const emojiRef = body.emojiRef?.trim()
    if (!postId || !emojiRef || emojiRef.length > MAX_EMOJI_REF_LENGTH) {
      return Response.json({ error: 'invalid_input' }, { status: 400 })
    }

    const posts = await req.payload.find({
      collection: 'posts',
      limit: 1,
      overrideAccess: true,
      where: { and: [{ id: { equals: postId } }, { status: { equals: 'published' } }] },
    })
    const post = posts.docs[0]
    if (!post) {
      return Response.json({ error: 'post_not_found' }, { status: 404 })
    }

    const existing = await req.payload.find({
      collection: 'reactions',
      limit: 1,
      overrideAccess: true,
      where: {
        and: [
          { author: { equals: req.user.id } },
          { emojiRef: { equals: emojiRef } },
          { post: { equals: post.id } },
        ],
      },
    })

    let action: 'added' | 'removed'
    if (existing.docs[0]) {
      await req.payload.delete({
        id: existing.docs[0].id,
        collection: 'reactions',
        overrideAccess: true,
      })
      action = 'removed'
    } else {
      try {
        await req.payload.create({
          collection: 'reactions',
          data: {
            author: req.user.id,
            emojiRef,
            post: post.id,
          },
          overrideAccess: true,
        })
        action = 'added'
      } catch (err) {
        // FR-020 race: another tab already inserted the same reaction.
        if ((err as { code?: string }).code === '23505') {
          return Response.json({ error: 'already_reacted' }, { status: 409 })
        }
        throw err
      }
    }

    // Counter maintenance + SSE event emission live in the reactions
    // collection hooks (afterChange/afterDelete) — single source of truth.
    const counters = await readCounters(req.payload, { post: post.id })
    const counts: Record<string, number> = {}
    for (const row of counters) {
      counts[row.key] = row.count
    }

    return Response.json({ action, counts })
  },
  method: 'post',
  path: '/posts/:id/reactions',
}

/**
 * Server-side reaction counter maintenance — wired as afterChange/afterDelete
 * hooks on the reactions collection (T2.4).
 */
export async function bumpReactionCounter(
  payload: Payload,
  postId: number | string,
  emojiRef: string,
  delta: number,
): Promise<void> {
  await bumpCounter(payload, { key: emojiRef, post: postId }, delta)
}
