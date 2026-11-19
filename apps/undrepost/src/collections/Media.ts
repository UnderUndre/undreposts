import type { CollectionConfig } from 'payload'

import { sanitizeSvg } from '../lib/sanitizeSvg'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      admin: {
        description: 'Accessibility + SEO alt text.',
      },
      required: true,
    },
    {
      name: 'uploadedBy',
      type: 'relationship',
      index: true,
      relationTo: 'members',
    },
  ],
  hooks: {
    beforeOperation: [
      ({ operation, req }) => {
        // T2.13b: sanitize SVG uploads in place, BEFORE generateFileData
        // extracts the buffers (runs before it in the create pipeline).
        // DOMPurify with the SVG profile strips script/event-handler/foreignObject
        // vectors; a non-SVG payload after sanitization rejects the upload.
        if (operation !== 'create') {
          return
        }
        const file = req.file as
          | { data?: Buffer; mimetype?: string; name?: string; size?: number }
          | undefined
        if (!file?.data || file.mimetype !== 'image/svg+xml') {
          return
        }
        const sanitized = sanitizeSvg(file.data.toString('utf8'))
        if (!sanitized) {
          throw new Error('SVG upload rejected: file does not survive sanitization.')
        }
        const sanitizedBuffer = Buffer.from(sanitized, 'utf8')
        file.data = sanitizedBuffer
        // Payload 4's buildUploadOutput treats `buffer.length !== file.size` as
        // a partial client-upload probe and skips writing the file to disk.
        file.size = sanitizedBuffer.length
        req.payload.logger.info({ name: file.name, msg: 'svg-sanitized' })
      },
    ],
  },
  upload: {
    mimeTypes: ['image/*'],
  },
}
