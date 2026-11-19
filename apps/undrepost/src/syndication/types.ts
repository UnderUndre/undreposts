import type { Payload } from 'payload'

/**
 * Social adapter interface (FR-045 Wave-1). External API failures MUST NOT
 * fail local publication (business-plan FM-02) — adapters report failures via
 * SyndicationLog, they never throw past runSyndication().
 */
export type SyndicationChannel = 'habr' | 'linkedin' | 'telegram' | 'x'

export type SyndicationContext = {
  canonicalUrl: string
  payload: Payload
  post: {
    excerpt?: null | string
    id: number | string
    title: string
  }
}

export type SyndicationResult = {
  externalRef?: string
  skipped?: boolean
  skipReason?: string
}

export interface SocialAdapter {
  channel: SyndicationChannel
  send(ctx: SyndicationContext): Promise<SyndicationResult>
}
