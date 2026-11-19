import type { Payload } from 'payload'

import { recountExact } from '../lib/counters'
import { incrCounter, setGauge } from '../lib/metrics'

const RECONCILE_INTERVAL_MS = 5 * 60 * 1000

/**
 * Counter reconciliation job (T2.4b): idempotent drift correction from source
 * entities. Counters are derived — on dispute, recount from source. Runs every
 * 5 minutes; tolerance is ±0 (job corrects to exact, drift is logged as a
 * metric for observability, data-model.md).
 */
export async function reconcileCounters(payload: Payload): Promise<void> {
  const counters = await payload.find({
    collection: 'counters',
    limit: 500,
    overrideAccess: true,
  })

  let drifted = 0

  for (const counter of counters.docs) {
    const key = counter.key as string
    const rawPost = counter.post as { id: number | string } | null | number | string
    const rawPoll = counter.poll as { id: number | string } | null | number | string
    const post = typeof rawPost === 'object' && rawPost ? rawPost.id : rawPost
    const poll = typeof rawPoll === 'object' && rawPoll ? rawPoll.id : rawPoll

    let exact = 0
    if (post) {
      exact = await payload
        .count({
          collection: 'reactions',
          overrideAccess: true,
          where: { and: [{ emojiRef: { equals: key } }, { post: { equals: post } }] },
        })
        .then((r) => r.totalDocs)
    } else if (poll) {
      exact = await payload
        .count({
          collection: 'poll-votes',
          overrideAccess: true,
          where: { and: [{ optionId: { equals: key } }, { poll: { equals: poll } }] },
        })
        .then((r) => r.totalDocs)
    } else {
      continue
    }

    const wasDrifted = await recountExact(
      payload,
      { key, ...(post ? { post } : {}), ...(poll ? { poll } : {}) },
      exact,
    )
    if (wasDrifted) {
      drifted += 1
    }
  }

  setGauge('lastReconcileDrift', drifted)
  if (drifted > 0) {
    incrCounter('counterDriftFixed', drifted)
    payload.logger.warn({ drifted, msg: 'counter-reconcile-drift' })
  }
}

export function startReconcileJob(payload: Payload): () => void {
  const timer = setInterval(() => {
    void reconcileCounters(payload).catch((err: unknown) => {
      payload.logger.error({ err, msg: 'counter-reconcile-error' })
    })
  }, RECONCILE_INTERVAL_MS)
  timer.unref?.()
  // Initial pass shortly after boot (hooks may have missed during dev restarts).
  const initial = setTimeout(() => {
    void reconcileCounters(payload).catch(() => {})
  }, 15_000)
  initial.unref?.()
  return () => {
    clearInterval(timer)
    clearTimeout(initial)
  }
}
