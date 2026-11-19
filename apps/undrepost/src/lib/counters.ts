import type { Payload } from 'payload'

/**
 * Materialized async counters (T2.4). Source-of-truth entities are Reactions
 * and PollVote — counters are NEVER authoritative (data-model.md): the
 * reconcile job (T2.4b) recomputes exact values from the sources and corrects
 * any drift.
 */

export type CounterScope = {
  key: string
  poll?: number | string
  post?: number | string
}

export async function bumpCounter(
  payload: Payload,
  scope: CounterScope,
  delta: number,
): Promise<void> {
  const where =
    scope.post !== undefined
      ? { and: [{ key: { equals: scope.key } }, { post: { equals: scope.post } }] }
      : { and: [{ key: { equals: scope.key } }, { poll: { equals: scope.poll ?? '' } }] }

  const found = await payload.find({
    collection: 'counters',
    limit: 1,
    overrideAccess: true,
    where,
  })

  const existing = found.docs[0]

  if (!existing) {
    if (delta <= 0) {
      return
    }
    await payload.create({
      collection: 'counters',
      data: {
        count: delta,
        key: scope.key,
        poll: scope.poll ?? undefined,
        post: scope.post ?? undefined,
      },
      overrideAccess: true,
    })
    return
  }

  await payload.update({
    id: existing.id as string,
    collection: 'counters',
    data: { count: Math.max(0, ((existing.count as number) ?? 0) + delta) },
    overrideAccess: true,
  })
}

export type CounterRow = {
  count: number
  key: string
}

export async function readCounters(
  payload: Payload,
  scope: { poll?: number | string; post?: number | string },
): Promise<CounterRow[]> {
  const where =
    scope.post !== undefined
      ? { and: [{ post: { equals: scope.post } }, { poll: { exists: false } }] }
      : { and: [{ poll: { equals: scope.poll ?? '' } }, { post: { exists: false } }] }

  const found = await payload.find({
    collection: 'counters',
    limit: 200,
    overrideAccess: true,
    where,
  })

  return found.docs.map((doc) => ({
    count: (doc.count as number) ?? 0,
    key: doc.key as string,
  }))
}

export async function recountExact(
  payload: Payload,
  scope: CounterScope,
  exact: number,
): Promise<boolean> {
  const where =
    scope.post !== undefined
      ? { and: [{ key: { equals: scope.key } }, { post: { equals: scope.post } }] }
      : { and: [{ key: { equals: scope.key } }, { poll: { equals: scope.poll ?? '' } }] }

  const found = await payload.find({
    collection: 'counters',
    limit: 1,
    overrideAccess: true,
    where,
  })

  const existing = found.docs[0]
  const current = existing ? ((existing.count as number) ?? 0) : 0

  if (current === exact) {
    return false
  }

  if (existing) {
    await payload.update({
      id: existing.id as string,
      collection: 'counters',
      data: { count: exact },
      overrideAccess: true,
    })
  } else if (exact > 0) {
    await payload.create({
      collection: 'counters',
      data: {
        count: exact,
        key: scope.key,
        poll: scope.poll ?? undefined,
        post: scope.post ?? undefined,
      },
      overrideAccess: true,
    })
  }

  return true
}
