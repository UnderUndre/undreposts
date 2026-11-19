import createDOMPurify from 'dompurify'
import { JSDOM } from 'jsdom'

/**
 * Server-side SVG sanitizer for CustomEmoji uploads (T2.13b / FR-012).
 * DOMPurify per the spec (contracts/reviews); jsdom provides the server-side
 * DOM implementation. One shared window — sanitization is stateless per call.
 */

const { window } = new JSDOM('')
const DOMPurify = createDOMPurify(window as unknown as Window)

const SANITIZE_CONFIG = {
  FORBID_ATTR: ['foreignObject'],
  FORBID_TAGS: ['foreignobject'],
  USE_PROFILES: { svg: true, svgFilters: true },
}

/**
 * Returns a sanitized SVG string, or null when the input is not a usable SVG
 * document (missing root element after sanitization → reject the upload).
 */
export function sanitizeSvg(input: string): null | string {
  const output = DOMPurify.sanitize(input, SANITIZE_CONFIG)
  const normalized = output.trim()
  if (!normalized.toLowerCase().startsWith('<svg') && !normalized.toLowerCase().includes('<svg')) {
    return null
  }
  return normalized
}
