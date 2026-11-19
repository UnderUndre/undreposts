import type { CollectionConfig } from 'payload'

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
  upload: {
    imageSizes: [
      {
        name: 'thumbnail',
        height: 300,
        position: 'centre',
        width: 400,
      },
      {
        name: 'og',
        height: 630,
        position: 'centre',
        width: 1200,
      },
    ],
    mimeTypes: ['image/*'],
  },
}
