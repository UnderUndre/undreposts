import type { Endpoint } from 'payload'

import { IdpValidationError, validateIdpJwt } from '../auth/idpJwt'
import { upsertMemberFromClaims } from '../auth/provision'
import {
  buildClearSessionCookie,
  buildSessionCookie,
  createSession,
  destroySession,
  readSessionCookie,
} from '../auth/sessionStore'

/**
 * Session bridge login (plan.md §Auth & Session Architecture):
 * the SPA obtains an IdP token (OIDC code + PKCE) and exchanges it here for an
 * opaque HttpOnly session cookie. Flow: 5-check validation → JIT upsert →
 * opaque session (24h absolute / 2h idle). No JWT is ever stored client-side.
 */
export const loginEndpoint: Endpoint = {
  handler: async (req) => {
    let body: { token?: string }
    try {
      body = (await req.json()) as { token?: string }
    } catch {
      return Response.json({ error: 'invalid_json' }, { status: 400 })
    }
    const token = body.token?.trim()
    if (!token) {
      return Response.json({ error: 'missing_token' }, { status: 400 })
    }

    try {
      const claims = await validateIdpJwt(token)
      const { memberId } = await upsertMemberFromClaims(req.payload, claims)
      const session = await createSession(req.payload, memberId)
      return Response.json(
        { memberId },
        {
          headers: {
            'Set-Cookie': buildSessionCookie(session.token),
          },
        },
      )
    } catch (err) {
      if (err instanceof IdpValidationError) {
        return Response.json({ error: err.code }, { status: err.status })
      }
      req.payload.logger.error({ err, msg: 'session-login-error' })
      return Response.json({ error: 'internal_error' }, { status: 500 })
    }
  },
  method: 'post',
  path: '/auth/login',
}

export const logoutEndpoint: Endpoint = {
  handler: async (req) => {
    const token = readSessionCookie(req.headers.get('cookie'))
    if (token) {
      await destroySession(req.payload, token)
    }
    return Response.json(
      { ok: true },
      {
        headers: {
          'Set-Cookie': buildClearSessionCookie(),
        },
      },
    )
  },
  method: 'post',
  path: '/auth/logout',
}
