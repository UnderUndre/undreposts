import type { Endpoint } from 'payload'

import { IdpValidationError, validateIdpJwt } from '../auth/idpJwt'
import { upsertMemberFromClaims } from '../auth/provision'

/**
 * POST /api/internal/jit-provision (members.contract.md, review F7).
 *
 * Auth: `Authorization: Bearer <IdP JWT>` — this endpoint runs the full
 * 5-check validation itself; requests without a valid token → 401.
 * Claims source: sub/email/name extracted EXCLUSIVELY from the validated
 * token — the request body carries no claims (spoofing guard).
 * Roles: never accepted from the client; derived server-side from the sub
 * allowlist. Response: 200 { memberId, created }.
 */
export const jitProvisionEndpoint: Endpoint = {
  handler: async (req) => {
    const authHeader = req.headers.get('authorization') || ''
    if (!authHeader.startsWith('Bearer ')) {
      return Response.json({ error: 'missing_bearer_token' }, { status: 401 })
    }
    const token = authHeader.slice('Bearer '.length).trim()

    try {
      const claims = await validateIdpJwt(token)
      const result = await upsertMemberFromClaims(req.payload, claims)
      return Response.json({ created: result.created, memberId: result.memberId })
    } catch (err) {
      if (err instanceof IdpValidationError) {
        // tenant_mismatch (403) doubles as the audit event per contract.
        req.payload.logger.warn({
          code: err.code,
          msg: 'jit-provision-rejected',
          status: err.status,
        })
        return Response.json({ error: err.code }, { status: err.status })
      }
      req.payload.logger.error({ err, msg: 'jit-provision-error' })
      return Response.json({ error: 'internal_error' }, { status: 500 })
    }
  },
  method: 'post',
  path: '/internal/jit-provision',
}
