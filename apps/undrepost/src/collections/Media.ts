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
    mimeTypes: ['image/*'],
  },
}
