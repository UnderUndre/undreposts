import type { AuthStrategy } from 'payload'

import { readSessionCookie, SESSION_IDLE_TTL_MS, validateSession } from './sessionStore'

/**
 * Custom AuthStrategy for ecosystem (AUTH_STRATEGY=directus) mode.
 * Validates the opaque `__Secure-undrepost-session` cookie against the local
 * session store and serves identity from the Member mirror — no per-request
 * IdP call (plan.md §Auth & Session Architecture).
 *
 * Verified natively supported in Payload 4.0.0-beta.10
 * (packages/payload/src/auth/types.ts:269,348 — `disableLocalStrategy` +
 * `strategies?: AuthStrategy[]`); spike S2 / T1.5.
 */
export const undrllaSessionStrategy: AuthStrategy = {
  name: 'undrlla-session',
  authenticate: async ({ headers, payload }) => {
    const token = readSessionCookie(headers.get('cookie'))

    if (!token) {
      return { user: null }
    }

    const session = await validateSession(payload, token)
    if (!session) {
      return { user: null }
    }

    const member = await payload.findByID({
      id: session.member,
      collection: 'members',
      overrideAccess: true,
    })

    if (!member || member.tombstonedAt) {
      return { user: null }
    }

    // Idle-expiry check is done in validateSession; mirror a safety net here.
    if (Date.now() - new Date(session.lastSeenAt).getTime() > SESSION_IDLE_TTL_MS) {
      return { user: null }
    }

    return {
      user: {
        ...member,
        collection: 'members',
      },
    }
  },
}
