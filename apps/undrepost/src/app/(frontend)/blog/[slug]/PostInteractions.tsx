'use client'

import { useEffect, useRef, useState } from 'react'

type CommentRow = {
  author: string
  body: string
  id: string
}

type PostInteractionsProps = {
  canComment: boolean
  initialComments: CommentRow[]
  initialMyReactions: string[]
  initialReactions: Record<string, number>
  postId: string
}

const EMOJIS = ['👍', '❤️', '😮', '😢', '🔥']

type SseData = {
  authorDisplayName?: string
  body?: string
  commentId?: string
  counts?: Record<string, number>
}

export default function PostInteractions({
  canComment,
  initialComments,
  initialMyReactions,
  initialReactions,
  postId,
}: PostInteractionsProps) {
  const [counts, setCounts] = useState<Record<string, number>>(initialReactions)
  const [myReactions, setMyReactions] = useState<string[]>(initialMyReactions)
  const [comments, setComments] = useState<CommentRow[]>(initialComments)
  const [live, setLive] = useState(false)
  const [commentBody, setCommentBody] = useState('')
  const [busy, setBusy] = useState(false)
  const sourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    // T2.3: authenticated SSE — anonymous visitors get 401 and fall back to
    // the server-rendered snapshot (no live updates).
    const source = new EventSource(`/api/events/stream?post=${encodeURIComponent(postId)}`, {
      withCredentials: true,
    })
    sourceRef.current = source

    source.addEventListener('reaction.changed', (event) => {
      try {
        const parsed = JSON.parse((event as MessageEvent<string>).data) as { data?: SseData }
        if (parsed.data?.counts) {
          setCounts(parsed.data.counts)
        }
      } catch {
        // Ignore malformed SSE frames.
      }
    })

    source.addEventListener('comment.created', (event) => {
      try {
        const parsed = JSON.parse((event as MessageEvent<string>).data) as { data?: SseData }
        const data = parsed.data
        if (data?.commentId && data.body) {
          const cid = String(data.commentId)
          setComments((prev) =>
            prev.some((c) => c.id === cid)
              ? prev
              : [
                  ...prev,
                  {
                    author: data.authorDisplayName || 'Member',
                    body: data.body ?? '',
                    id: cid,
                  },
                ],
          )
        }
      } catch {
        // Ignore malformed SSE frames.
      }
    })

    source.onopen = () => {
      setLive(true)
    }
    source.onerror = () => {
      setLive(false)
    }

    return () => {
      source.close()
      sourceRef.current = null
    }
  }, [postId])

  async function react(emoji: string) {
    setBusy(true)
    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(postId)}/reactions`, {
        body: JSON.stringify({ emojiRef: emoji }),
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        method: 'post',
      })
      if (response.ok) {
        const data = (await response.json()) as { action: string; counts: Record<string, number> }
        setCounts(data.counts)
        setMyReactions((prev) =>
          data.action === 'added' ? [...prev, emoji] : prev.filter((e) => e !== emoji),
        )
      }
    } finally {
      setBusy(false)
    }
  }

  async function submitComment() {
    const trimmed = commentBody.trim()
    if (!trimmed || busy) {
      return
    }
    setBusy(true)
    try {
      const numericPostId = /^\d+$/.test(postId) ? Number(postId) : postId
      const response = await fetch('/api/comments', {
        body: JSON.stringify({ body: trimmed, post: numericPostId }),
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        method: 'post',
      })
      if (response.ok) {
        const created = (await response.json()) as { doc?: { id?: number | string } }
        const createdId = created.doc?.id ? String(created.doc.id) : `local-${Date.now()}`
        setCommentBody('')
        setComments((prev) =>
          prev.some((c) => c.id === createdId)
            ? prev
            : [...prev, { author: 'You', body: trimmed, id: createdId }],
        )
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="post-interactions">
      <h2>Reactions</h2>
      <p className="live-status">
        {live ? '● live' : '○ live updates unavailable (sign in for real-time)'}
      </p>
      <div className="reaction-bar">
        {EMOJIS.map((emoji) => (
          <button
            className={myReactions.includes(emoji) ? 'reaction reaction-mine' : 'reaction'}
            disabled={busy || !canComment}
            key={emoji}
            onClick={() => {
              void react(emoji)
            }}
            type="button"
          >
            {emoji} {counts[emoji] ?? 0}
          </button>
        ))}
      </div>

      <h2>Comments</h2>
      {comments.length === 0 ? (
        <p className="post-excerpt">No comments yet.</p>
      ) : (
        <ul className="comment-list">
          {comments.map((comment) => (
            <li key={comment.id}>
              <p className="post-meta">{comment.author}</p>
              <p>{comment.body}</p>
            </li>
          ))}
        </ul>
      )}

      {canComment ? (
        <div className="comment-form">
          <textarea
            onChange={(e) => {
              setCommentBody(e.target.value)
            }}
            placeholder="Write a comment…"
            rows={3}
            value={commentBody}
          />
          <button
            disabled={busy || commentBody.trim().length === 0}
            onClick={() => void submitComment()}
            type="button"
          >
            Post comment
          </button>
        </div>
      ) : (
        <p className="post-excerpt">Sign in to react and comment (member-only, FR-011).</p>
      )}
    </section>
  )
}
