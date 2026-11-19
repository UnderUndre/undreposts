import type { Payload } from 'payload'

const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000
const TOMBSTONE_SHARE_THRESHOLD = 0.05

type SweepReport = {
  aborted?: string
  activeMembers: number
  tombstoned: number
}

/**
 * Member tombstone sweep (T2.20, review F2 — fail-closed): daily comparison of
 * the local Members mirror against IdP active users. Guards:
 *  - requires IDP_M2M_TOKEN (read-only, tenant-scoped) + IDP_ACTIVE_USERS_URL
 *  - aborts on any HTTP error / non-200 / missing payload
 *  - aborts when > 5% of active members would be tombstoned in one run
 * Login re-sync alone never reaches deleted users (review F11).
 */
export async function runTombstoneSweep(payload: Payload): Promise<SweepReport> {
  const token = process.env.IDP_M2M_TOKEN
  const url = process.env.IDP_ACTIVE_USERS_URL

  if (!token || !url) {
    return { aborted: 'not-configured', activeMembers: 0, tombstoned: 0 }
  }

  let response: Response
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      method: 'get',
    })
  } catch (err) {
    payload.logger.warn({ err, msg: 'tombstone-sweep-aborted', reason: 'network-error' })
    return { aborted: 'network-error', activeMembers: 0, tombstoned: 0 }
  }

  if (!response.ok) {
    payload.logger.warn({
      msg: 'tombstone-sweep-aborted',
      reason: 'http-error',
      status: response.status,
    })
    return { aborted: 'http-error', activeMembers: 0, tombstoned: 0 }
  }

  const body = (await response.json()) as { subs?: string[] }
  const activeSubs = body.subs
  if (!Array.isArray(activeSubs) || activeSubs.length === 0) {
    // An empty IdP listing is indistinguishable from an IdP hiccup — fail closed.
    payload.logger.warn({ msg: 'tombstone-sweep-aborted', reason: 'empty-or-invalid-payload' })
    return { aborted: 'empty-or-invalid-payload', activeMembers: 0, tombstoned: 0 }
  }

  const activeSubSet = new Set(activeSubs)
  const members = await payload.find({
    collection: 'members',
    limit: 1000,
    overrideAccess: true,
    where: { tombstonedAt: { exists: false } },
  })

  const activeMembers = members.docs.filter((m) => Boolean(m.sub))
  const toTombstone = activeMembers.filter((m) => !activeSubSet.has(m.sub as string))

  if (activeMembers.length === 0) {
    return { activeMembers: 0, tombstoned: 0 }
  }

  const share = toTombstone.length / activeMembers.length
  if (share > TOMBSTONE_SHARE_THRESHOLD) {
    // Mass-tombstone guard: an IdP hiccup must not wipe all authors (review F2).
    payload.logger.warn({
      activeMembers: activeMembers.length,
      msg: 'tombstone-sweep-aborted',
      reason: 'tombstone-share-exceeded',
      share,
    })
    return {
      aborted: 'tombstone-share-exceeded',
      activeMembers: activeMembers.length,
      tombstoned: 0,
    }
  }

  const now = new Date().toISOString()
  for (const member of toTombstone) {
    await payload.update({
      id: member.id as string,
      collection: 'members',
      data: {
        displayName: '[deleted]',
        profile: {
          avatarUrl: '',
          bio: '',
        },
        tombstonedAt: now,
      },
      overrideAccess: true,
    })
  }

  payload.logger.info({
    activeMembers: activeMembers.length,
    msg: 'tombstone-sweep',
    tombstoned: toTombstone.length,
  })
  return { activeMembers: activeMembers.length, tombstoned: toTombstone.length }
}

export function startTombstoneSweepJob(payload: Payload): () => void {
  const timer = setInterval(() => {
    void runTombstoneSweep(payload).catch((err: unknown) => {
      payload.logger.error({ err, msg: 'tombstone-sweep-error' })
    })
  }, SWEEP_INTERVAL_MS)
  timer.unref?.()
  // Initial boot pass — surfaces the not-configured skip in the startup log
  // and sweeps promptly when the M2M wiring is present.
  const initial = setTimeout(() => {
    void runTombstoneSweep(payload).catch(() => {})
  }, 10_000)
  initial.unref?.()
  return () => {
    clearInterval(timer)
    clearTimeout(initial)
  }
}
