import type { JWTPayload } from 'jose'

import { createLocalJWKSet, jwtVerify } from 'jose'

/**
 * 5-check IdP token validation (members.contract.md §Token Validation):
 *  1. Signature — against undrlla JWKS
 *  2. iss — exact IDP_ISSUER match
 *  3. aud — MUST include 'undrepost' (ecosystem interlock, undrlla 005 §3.2/§3.3)
 *  4. exp — enforced by jose; ±60s clock-skew tolerance
 *  5. sub — present and non-empty
 * Plus tenant_id claim check (contract) → 403 on mismatch.
 *
 * JWKS cache: TTL 1h with last-known-good fallback, so signature verification
 * survives short IdP outages (plan.md §Auth & Session Architecture).
 */

const REQUIRED_AUDIENCE = 'undrepost'
const JWKS_TTL_MS = 60 * 60 * 1000
const CLOCK_TOLERANCE_SECONDS = 60

export class IdpValidationError extends Error {
  status: number

  constructor(
    public code:
      | 'audience'
      | 'expired'
      | 'issuer'
      | 'jwks_unavailable'
      | 'missing_sub'
      | 'signature'
      | 'tenant_mismatch',
    message: string,
    status = 401,
  ) {
    super(message)
    this.name = 'IdpValidationError'
    this.status = status
  }
}

type JwkCache = {
  fetchedAt: number
  jwks: { keys: JsonWebKey[] } | null
}

// Module-level LKG cache — survives across requests in the server runtime.
const cache: JwkCache = { fetchedAt: 0, jwks: null }

async function fetchJwks(): Promise<{ keys: JsonWebKey[] }> {
  const url = process.env.IDP_JWKS_URL
  if (!url) {
    throw new IdpValidationError('jwks_unavailable', 'IDP_JWKS_URL is not configured')
  }
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    throw new IdpValidationError(
      'jwks_unavailable',
      `JWKS fetch failed with status ${response.status}`,
    )
  }
  const body = (await response.json()) as { keys?: JsonWebKey[] }
  if (!Array.isArray(body.keys) || body.keys.length === 0) {
    throw new IdpValidationError('jwks_unavailable', 'JWKS response has no keys')
  }
  return { keys: body.keys }
}

async function ensureJwks(): Promise<{ keys: JsonWebKey[] }> {
  const now = Date.now()
  if (cache.jwks && now - cache.fetchedAt < JWKS_TTL_MS) {
    return cache.jwks
  }
  try {
    const fresh = await fetchJwks()
    cache.jwks = fresh
    cache.fetchedAt = now
    return fresh
  } catch (err) {
    // Last-known-good fallback: stale keys are better than no keys.
    if (cache.jwks) {
      return cache.jwks
    }
    throw err
  }
}

export type ValidatedClaims = {
  sub: string
  tenant_id?: string
} & JWTPayload

export async function validateIdpJwt(token: string): Promise<ValidatedClaims> {
  const issuer = process.env.IDP_ISSUER
  if (!issuer) {
    throw new IdpValidationError('issuer', 'IDP_ISSUER is not configured')
  }

  let payload: JWTPayload
  try {
    const result = await jwtVerify(token, createLocalJWKSet(await ensureJwks()), {
      audience: REQUIRED_AUDIENCE,
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
      issuer,
    })
    payload = result.payload
  } catch (err) {
    if (err instanceof IdpValidationError) {
      throw err
    }
    const code = (err as { code?: string }).code
    if (code === 'ERR_JWT_EXPIRED') {
      throw new IdpValidationError('expired', 'Token expired')
    }
    if (code === 'ERR_JWT_ISSUER_MISMATCH') {
      throw new IdpValidationError('issuer', 'Issuer mismatch')
    }
    if (code === 'ERR_JWT_AUDIENCE_MISMATCH') {
      // A marketplace-audience token is rejected (contract check #3).
      throw new IdpValidationError(
        'audience',
        `Token audience does not include "${REQUIRED_AUDIENCE}"`,
        403,
      )
    }
    throw new IdpValidationError('signature', 'Token signature or format validation failed')
  }

  if (!payload.sub || payload.sub.trim().length === 0) {
    throw new IdpValidationError('missing_sub', 'Token has no subject claim')
  }

  const expectedTenant = process.env.IDP_TENANT_ID
  if (expectedTenant && payload.tenant_id !== expectedTenant) {
    // Contract: tenant mismatch → 403 + audit event.
    throw new IdpValidationError('tenant_mismatch', 'tenant_id claim does not match instance', 403)
  }

  return payload as ValidatedClaims
}
