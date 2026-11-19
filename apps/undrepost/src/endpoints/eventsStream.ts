import type { Endpoint } from 'payload'

import { getReplayAfter, postTopic, subscribe, type UndrepostEvent } from '../lib/events'
import { incrCounter, setGauge } from '../lib/metrics'

const MAX_CONNECTIONS_PER_USER = 5
const HEARTBEAT_INTERVAL_MS = 25_000
const sseConnections = new Map<string, number>()

function formatSse(event: UndrepostEvent): string {
  return `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
}

/**
 * GET /api/events/stream?post=<id>&lastEventId=<n> (T2.3)
 * Authenticated SSE per spec: cookie-authenticated (payload session or
 * undrlla-session strategy), 25s heartbeat, Last-Event-ID replay from the
 * per-post ring buffer, per-user connection cap. Anonymous requests → 401.
 */
export const eventsStreamEndpoint: Endpoint = {
  handler: (req) => {
    if (!req.user) {
      return Response.json({ error: 'authentication_required' }, { status: 401 })
    }

    const postId = typeof req.query.post === 'string' ? req.query.post : ''
    if (!postId) {
      return Response.json({ error: 'missing_post' }, { status: 400 })
    }

    const userId = String(req.user.id)
    const current = sseConnections.get(userId) ?? 0
    if (current >= MAX_CONNECTIONS_PER_USER) {
      incrCounter('sseConnectionLimitRejected')
      return Response.json({ error: 'connection_limit_reached' }, { status: 429 })
    }
    sseConnections.set(userId, current + 1)
    setGauge('sseConnections', totalConnections())

    const topic = postTopic(postId)
    const lastEventIdHeader = req.headers.get('last-event-id')
    const lastEventIdQuery = typeof req.query.lastEventId === 'string' ? req.query.lastEventId : ''
    const parsedLastEventId = Number.parseInt(lastEventIdHeader || lastEventIdQuery || '0', 10)

    let heartbeat: ReturnType<typeof setInterval> | undefined
    let unsubscribe: (() => void) | undefined
    let closed = false

    const stream = new ReadableStream<Uint8Array>({
      cancel() {
        cleanup()
      },
      start(controller) {
        const encoder = new TextEncoder()
        const send = (chunk: string) => {
          if (!closed) {
            controller.enqueue(encoder.encode(chunk))
          }
        }

        // Retry hint + initial padding so proxies flush headers early.
        send('retry: 3000\n\n')

        if (Number.isFinite(parsedLastEventId) && parsedLastEventId > 0) {
          for (const event of getReplayAfter(topic, parsedLastEventId)) {
            send(formatSse(event))
          }
        }

        unsubscribe = subscribe(topic, (event) => {
          send(formatSse(event))
        })

        heartbeat = setInterval(() => {
          send(': hb\n\n')
        }, HEARTBEAT_INTERVAL_MS)
        heartbeat.unref?.()

        return () => {
          cleanup()
        }
      },
    })

    function cleanup() {
      if (closed) {
        return
      }
      closed = true
      if (heartbeat) {
        clearInterval(heartbeat)
      }
      unsubscribe?.()
      const count = (sseConnections.get(userId) ?? 1) - 1
      if (count <= 0) {
        sseConnections.delete(userId)
      } else {
        sseConnections.set(userId, count)
      }
      setGauge('sseConnections', totalConnections())
      incrCounter('sseConnectionsClosed')
    }

    incrCounter('sseConnectionsOpened')

    return new Response(stream, {
      headers: {
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'Content-Type': 'text/event-stream',
        'X-Accel-Buffering': 'no',
      },
    })
  },
  method: 'get',
  path: '/events/stream',
}

function totalConnections(): number {
  let total = 0
  for (const count of sseConnections.values()) {
    total += count
  }
  return total
}
