import { EventEmitter } from 'node:events'

import { incrCounter } from './metrics'

/**
 * In-process event bus feeding the SSE service (T2.3). Single-instance MVP —
 * the Redis pub/sub fanout for multi-instance deployments lands with T2.7
 * (infra) behind the same emit/subscribe seam.
 */

export type UndrepostEventType = 'comment.created' | 'poll.voted' | 'reaction.changed'

export type UndrepostEvent = {
  createdAt: string
  data: Record<string, unknown>
  id: number
  type: UndrepostEventType
}

const REPLAY_BUFFER_SIZE = 100

const emitter = new EventEmitter()

// Per-topic ring buffers for Last-Event-ID replay.
const replayBuffers = new Map<string, UndrepostEvent[]>()

let lastEventId = 0

/** Topic key for a post-scoped event. */
export function postTopic(postId: string): string {
  return `post:${postId}`
}

/** Topic key for a poll-scoped event. */
export function pollTopic(pollId: string): string {
  return `poll:${pollId}`
}

export function emitEvent(
  topic: string,
  event: Omit<UndrepostEvent, 'createdAt' | 'id'>,
): UndrepostEvent {
  lastEventId += 1
  const full: UndrepostEvent = { ...event, id: lastEventId, createdAt: new Date().toISOString() }

  const buffer = replayBuffers.get(topic) ?? []
  buffer.push(full)
  if (buffer.length > REPLAY_BUFFER_SIZE) {
    buffer.splice(0, buffer.length - REPLAY_BUFFER_SIZE)
  }
  replayBuffers.set(topic, buffer)

  emitter.emit(topic, full)
  incrCounter('eventsEmitted')
  return full
}

export function subscribe(topic: string, listener: (event: UndrepostEvent) => void): () => void {
  emitter.on(topic, listener)
  return () => {
    emitter.off(topic, listener)
  }
}

/** Events after `afterEventId` (exclusive) from the topic's replay buffer. */
export function getReplayAfter(topic: string, afterEventId: number): UndrepostEvent[] {
  const buffer = replayBuffers.get(topic) ?? []
  return buffer.filter((event) => event.id > afterEventId)
}
