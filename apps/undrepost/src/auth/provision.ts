import type { Payload } from 'payload'

import type { ValidatedClaims } from './idpJwt'

/**
 * JIT provisioning (members.contract.md §JIT Provisioning API).
 *
 * - Identity source: validated token claims ONLY. Request bodies carry no
 *   claims (review F7) — this function is called exclusively with claims that
 *   passed the 5-check validation.
 * - Roles: NEVER claim-derived (contract amendment, review F3). Resolved
 *   server-side from the ADMIN_ALLOWLIST (sub values). Allowlist grants
 *   'admin', everything else 'member'.
 * - Re-sync: email/displayName/profile refreshed on EVERY login; syncedAt
 *   stamped. Allowlist-granted admin survives re-sync because roles are
 *   recomputed from the allowlist, not from claims.
 * - Concurrency: UNIQUE(sub) at DB level; on unique-violation race we re-read
 *   and update (INSERT ... ON CONFLICT UPDATE semantics).
 * - Audit: logs sub + jti + decision. email/displayName are PII and MUST NOT
 *   be logged (contract rule, review F19).
 */

export type ProvisionResult = {
  created: boolean
  memberId: string
}

function resolveRoles(sub: string): string[] {
  const allowlist = (process.env.ADMIN_ALLOWLIST || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return allowlist.includes(sub) ? ['admin'] : ['member']
}

export async function upsertMemberFromClaims(
  payload: Payload,
  claims: ValidatedClaims,
): Promise<ProvisionResult> {
  const sub = claims.sub
  const profile = (claims.profile ?? {}) as Record<string, unknown>

  const data = {
    displayName: typeof claims.name === 'string' ? claims.name : sub,
    email: typeof claims.email === 'string' ? claims.email : '',
    profile: {
      avatarUrl: typeof profile.avatarUrl === 'string' ? profile.avatarUrl : '',
      bio: typeof profile.bio === 'string' ? profile.bio : '',
    },
    roles: resolveRoles(sub),
    sub,
    syncedAt: new Date().toISOString(),
  }

  const audit = {
    decision: '',
    jti: typeof claims.jti === 'string' ? claims.jti : null,
    sub,
  }

  const existing = await payload.find({
    collection: 'members',
    limit: 1,
    overrideAccess: true,
    where: { sub: { equals: sub } },
  })

  if (existing.docs[0]) {
    const member = await payload.update({
      id: existing.docs[0].id as string,
      collection: 'members',
      data,
      overrideAccess: true,
    })
    audit.decision = 'resync'
    payload.logger.info({ ...audit, msg: 'jit-provision' })
    return { created: false, memberId: member.id }
  }

  try {
    const member = await payload.create({
      collection: 'members',
      data,
      overrideAccess: true,
    })
    audit.decision = 'create'
    payload.logger.info({ ...audit, msg: 'jit-provision' })
    return { created: true, memberId: member.id }
  } catch (err) {
    // Concurrent provisioning race: UNIQUE(sub) violated → re-read and update.
    const isUniqueViolation = (err as { code?: string }).code === '23505'
    if (!isUniqueViolation) {
      throw err
    }
    const raced = await payload.find({
      collection: 'members',
      limit: 1,
      overrideAccess: true,
      where: { sub: { equals: sub } },
    })
    if (!raced.docs[0]) {
      throw err
    }
    const member = await payload.update({
      id: raced.docs[0].id as string,
      collection: 'members',
      data,
      overrideAccess: true,
    })
    audit.decision = 'resync-after-race'
    payload.logger.info({ ...audit, msg: 'jit-provision' })
    return { created: false, memberId: member.id }
  }
}
