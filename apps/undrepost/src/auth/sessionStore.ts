import type { Payload } from 'payload'

import { randomBytes } from 'node:crypto'

export const SESSION_COOKIE_NAME = '__Secure-undrepost-session'

// TTLs per members.contract.md §Session Bridge.
export const SESSION_ABSOLUTE_TTL_MS = 24 * 60 * 60 * 1000
export const SESSION_IDLE_TTL_MS = 2 * 60 * 60 * 1000
export const SESSION_COOKIE_MAX_AGE_SECONDS = 24 * 60 * 60

export function buildSessionCookie(token: string, maxAge = SESSION_COOKIE_MAX_AGE_SECONDS): string {
  // SameSite=Lax + Secure + HttpOnly per contract / review F6.
  return `${SESSION_COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`
}

export function buildClearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
}

export function readSessionCookie(cookieHeader: null | string): null | string {
  if (!cookieHeader) {
    return null
  }
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === SESSION_COOKIE_NAME) {
      return rest.join('=') || null
    }
  }
  return null
}

/** 256-bit opaque session id (base64url) — not a JWT (FR-014). */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

export async function createSession(
  payload: Payload,
  memberId: string,
): Promise<{ token: string }> {
  const token = generateSessionToken()
  const now = new Date()
  await payload.create({
    collection: 'sessions',
    data: {
      expiresAt: new Date(now.getTime() + SESSION_ABSOLUTE_TTL_MS).toISOString(),
      lastSeenAt: now.toISOString(),
      member: memberId,
      token,
    },
    overrideAccess: true,
  })
  return { token }
}

export type SessionRecord = {
  expiresAt: string
  id: string
  lastSeenAt: string
  member: string
}

/**
 * Validate + touch an opaque session. Returns the session record or null
 * (missing / absolute-expired / idle-expired). Expired records are cleaned up.
 */
export async function validateSession(
  payload: Payload,
  token: string,
): Promise<null | SessionRecord> {
  const result = await payload.find({
    collection: 'sessions',
    limit: 1,
    overrideAccess: true,
    where: { token: { equals: token } },
  })
  const session = result.docs[0]
  if (!session) {
    return null
  }

  const now = Date.now()
  const expiresAt = new Date(session.expiresAt).getTime()
  const lastSeenAt = new Date(session.lastSeenAt).getTime()

  if (expiresAt < now || now - lastSeenAt > SESSION_IDLE_TTL_MS) {
    await payload.delete({ id: session.id, collection: 'sessions', overrideAccess: true })
    return null
  }

  // Sliding idle window — fire-and-forget refresh.
  void payload
    .update({
      id: session.id,
      collection: 'sessions',
      data: { lastSeenAt: new Date().toISOString() },
      overrideAccess: true,
    })
    .catch(() => {})

  return session as unknown as SessionRecord
}

export async function destroySession(payload: Payload, token: string): Promise<void> {
  const result = await payload.find({
    collection: 'sessions',
    limit: 1,
    overrideAccess: true,
    where: { token: { equals: token } },
  })
  const session = result.docs[0]
  if (session) {
    await payload.delete({ id: session.id, collection: 'sessions', overrideAccess: true })
  }
}
