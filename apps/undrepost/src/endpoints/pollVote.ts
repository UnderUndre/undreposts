import type { Endpoint } from 'payload'

import { readCounters } from '../lib/counters'

/**
 * POST /api/polls/:id/vote { optionId } (T2.5 / FR-022)
 * One vote per member per poll (DB-level UNIQUE(poll, member)). Option is
 * validated server-side against the poll definition; results are derived from
 * PollVote via materialized counters (T2.4).
 */
export const pollVoteEndpoint: Endpoint = {
  handler: async (req) => {
    if (!req.user) {
      return Response.json({ error: 'authentication_required' }, { status: 401 })
    }

    const pollId = String(req.routeParams?.id ?? '')
    let body: { optionId?: string }
    try {
      body = (await req.json()) as { optionId?: string }
    } catch {
      return Response.json({ error: 'invalid_json' }, { status: 400 })
    }

    const optionId = body.optionId?.trim()
    if (!pollId || !optionId) {
      return Response.json({ error: 'invalid_input' }, { status: 400 })
    }

    const poll = await req.payload.findByID({
      id: pollId,
      collection: 'polls',
      overrideAccess: true,
    })

    if (!poll || poll.status !== 'active') {
      return Response.json({ error: 'poll_not_active' }, { status: 404 })
    }
    if (poll.expiresAt && new Date(poll.expiresAt as string).getTime() < Date.now()) {
      return Response.json({ error: 'poll_expired' }, { status: 410 })
    }
    const validOption =
      Array.isArray(poll.options) && poll.options.some((o) => o?.optionId === optionId)
    if (!validOption) {
      return Response.json({ error: 'invalid_option' }, { status: 400 })
    }

    try {
      await req.payload.create({
        collection: 'poll-votes',
        data: {
          member: req.user.id,
          optionId,
          poll: poll.id,
        },
        overrideAccess: true,
      })
    } catch (err) {
      // FR-022: UNIQUE(poll, member) — Drizzle may surface Postgres 23505 or
      // Payload may wrap it in ValidationError before returning.
      const code = (err as { code?: string }).code
      const name = (err as { name?: string }).name
      if (code === '23505' || name === 'ValidationError') {
        return Response.json({ error: 'already_voted' }, { status: 409 })
      }
      throw err
    }

    // Counter maintenance + SSE emission live in the poll-votes collection
    // hooks — single source of truth for endpoint and admin-created votes.
    const counters = await readCounters(req.payload, { poll: poll.id })
    const counts: Record<string, number> = {}
    for (const row of counters) {
      counts[row.key] = row.count
    }

    return Response.json({ counts })
  },
  method: 'post',
  path: '/polls/:id/vote',
}
