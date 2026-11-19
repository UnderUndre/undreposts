import type { SocialAdapter, SyndicationContext, SyndicationResult } from './types'

const TELEGRAM_API_BASE = 'https://api.telegram.org'

/**
 * Telegram channel adapter (FR-045 Wave-1). Without TELEGRAM_BOT_TOKEN /
 * TELEGRAM_CHAT_ID the adapter reports `skipped` — the SyndicationLog entry
 * records `telegram-not-configured` so operators see the wiring gap (FM-02:
 * never throws past runSyndication).
 */
export const telegramAdapter: SocialAdapter = {
  channel: 'telegram',
  async send(ctx: SyndicationContext): Promise<SyndicationResult> {
    const token = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.TELEGRAM_CHAT_ID
    if (!token || !chatId) {
      return { skipped: true, skipReason: 'telegram-not-configured' }
    }

    const text = `${ctx.post.title}\n\n${ctx.post.excerpt ?? ''}\n\n${ctx.canonicalUrl}`.trim()

    const response = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
      body: JSON.stringify({
        chat_id: chatId,
        disable_web_page_preview: false,
        text,
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'post',
    })

    if (!response.ok) {
      throw new Error(`telegram-http-${response.status}`)
    }

    const body = (await response.json()) as { ok?: boolean; result?: { message_id?: number } }
    if (!body.ok || !body.result?.message_id) {
      throw new Error('telegram-unexpected-response')
    }

    return { externalRef: String(body.result.message_id) }
  },
}
