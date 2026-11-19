import type { Endpoint } from 'payload'

import { randomBytes } from 'node:crypto'

import { checkRateLimit, SUBSCRIBE_RATE_LIMIT } from '../lib/rateLimit'

const CONFIRM_TOKEN_TTL_MS = 24 * 60 * 60 * 1000

const EMAIL_PATTERN = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/

type SubscriberRow = {
  confirmToken?: null | string
  confirmTokenExpiresAt?: null | string
  email: string
  id: string
  status: 'confirmed' | 'pending' | 'unsubscribed'
  unsubToken?: null | string
}

function generateToken(): string {
  // 32 bytes → 256-bit URL-safe token (data-model.md).
  return randomBytes(32).toString('base64url')
}

function clientKey(req: import('payload').PayloadRequest): string {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  return `newsletter:${ip}`
}

function htmlResponse(body: string, status = 200): Response {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Undrepost newsletter</title></head><body style="font-family: system-ui; max-width: 40rem; margin: 4rem auto;"><p>${body}</p></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status },
  )
}

async function deliverConfirmation(
  payload: import('payload').Payload,
  subscriber: SubscriberRow,
  confirmUrl: string,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    // Dev transport: the double-opt-in flow stays testable without a provider.
    payload.logger.info({
      confirmUrl,
      email: subscriber.email,
      msg: 'newsletter-confirmation-dry-run',
    })
    return
  }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      body: JSON.stringify({
        from: process.env.NEWSLETTER_FROM || 'Undrepost <newsletter@undrepost.local>',
        html: `<p>Confirm your Undrepost newsletter subscription: <a href="${confirmUrl}">confirm</a></p><p>The link expires in 24 hours.</p>`,
        subject: 'Confirm your Undrepost subscription',
        to: [subscriber.email],
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      method: 'post',
    })
    if (!response.ok) {
      payload.logger.warn({ msg: 'newsletter-resend-error', status: response.status })
    }
  } catch (err) {
    payload.logger.warn({ err, msg: 'newsletter-resend-exception' })
  }
}

/**
 * POST /api/newsletter/subscribe { email } (T2.6)
 * Double opt-in: creates/refreshes a `pending` subscriber with a 32-byte
 * confirm token (24h expiry). Idempotent per email. Rate limited (5/h per IP).
 */
export const newsletterSubscribeEndpoint: Endpoint = {
  handler: async (req) => {
    let body: { email?: string }
    try {
      body = (await req.json()) as { email?: string }
    } catch {
      return Response.json({ error: 'invalid_json' }, { status: 400 })
    }

    const email = body.email?.trim().toLowerCase()
    if (!email || !EMAIL_PATTERN.test(email)) {
      return Response.json({ error: 'invalid_email' }, { status: 400 })
    }

    if (!checkRateLimit(clientKey(req), SUBSCRIBE_RATE_LIMIT)) {
      return Response.json({ error: 'rate_limited' }, { status: 429 })
    }

    const confirmToken = generateToken()
    const now = new Date()

    const existing = await req.payload.find({
      collection: 'newsletter-subscribers',
      limit: 1,
      overrideAccess: true,
      where: { email: { equals: email } },
    })

    const prior = existing.docs[0] as SubscriberRow | undefined

    let subscriber: SubscriberRow
    if (prior && prior.status === 'confirmed') {
      return Response.json({ status: 'confirmed' })
    }

    const data = {
      confirmToken,
      confirmTokenExpiresAt: new Date(now.getTime() + CONFIRM_TOKEN_TTL_MS).toISOString(),
      email,
      // Resubscribe after unsubscribe resets to a fresh pending state.
      status: 'pending' as const,
      unsubscribedAt: null,
      unsubToken: generateToken(),
    }

    if (prior) {
      subscriber = (await req.payload.update({
        id: prior.id,
        collection: 'newsletter-subscribers',
        data,
        overrideAccess: true,
      })) as unknown as SubscriberRow
    } else {
      subscriber = (await req.payload.create({
        collection: 'newsletter-subscribers',
        data,
        overrideAccess: true,
      })) as unknown as SubscriberRow
    }

    const baseUrl = process.env.SITE_URL || 'http://localhost:3000'
    const confirmUrl = `${baseUrl}/api/newsletter/confirm?token=${confirmToken}`
    await deliverConfirmation(req.payload, subscriber, confirmUrl)

    // No PII in the response beyond the subscriber's own input.
    return Response.json({ status: 'pending' })
  },
  method: 'post',
  path: '/newsletter/subscribe',
}

/**
 * GET /api/newsletter/confirm?token=... — single-use confirm token, 24h TTL.
 */
export const newsletterConfirmEndpoint: Endpoint = {
  handler: async (req) => {
    const token = typeof req.query.token === 'string' ? req.query.token : ''
    if (!token) {
      return htmlResponse('Missing confirmation token.', 400)
    }

    const found = await req.payload.find({
      collection: 'newsletter-subscribers',
      limit: 1,
      overrideAccess: true,
      where: { confirmToken: { equals: token } },
    })
    const subscriber = found.docs[0] as SubscriberRow | undefined

    if (
      !subscriber ||
      subscriber.status !== 'pending' ||
      !subscriber.confirmTokenExpiresAt ||
      new Date(subscriber.confirmTokenExpiresAt).getTime() < Date.now()
    ) {
      return htmlResponse('This confirmation link is invalid or has expired.', 410)
    }

    await req.payload.update({
      id: subscriber.id,
      collection: 'newsletter-subscribers',
      data: {
        confirmedAt: new Date().toISOString(),
        confirmToken: null,
        confirmTokenExpiresAt: null,
        status: 'confirmed',
      },
      overrideAccess: true,
    })

    return htmlResponse('Subscription confirmed. Welcome aboard!')
  },
  method: 'get',
  path: '/newsletter/confirm',
}

/**
 * GET /api/newsletter/unsubscribe?token=... — single-use unsubscribe token.
 */
export const newsletterUnsubscribeEndpoint: Endpoint = {
  handler: async (req) => {
    const token = typeof req.query.token === 'string' ? req.query.token : ''
    if (!token) {
      return htmlResponse('Missing unsubscribe token.', 400)
    }

    const found = await req.payload.find({
      collection: 'newsletter-subscribers',
      limit: 1,
      overrideAccess: true,
      where: { unsubToken: { equals: token } },
    })
    const subscriber = found.docs[0] as SubscriberRow | undefined

    if (!subscriber || subscriber.status !== 'confirmed') {
      return htmlResponse('This unsubscribe link is invalid or has already been used.', 410)
    }

    await req.payload.update({
      id: subscriber.id,
      collection: 'newsletter-subscribers',
      data: {
        status: 'unsubscribed',
        unsubscribedAt: new Date().toISOString(),
        unsubToken: null,
      },
      overrideAccess: true,
    })

    return htmlResponse('You have been unsubscribed.')
  },
  method: 'get',
  path: '/newsletter/unsubscribe',
}
