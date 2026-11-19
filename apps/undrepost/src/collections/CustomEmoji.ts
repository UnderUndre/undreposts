import type { CollectionConfig } from 'payload'

export const CustomEmoji: CollectionConfig = {
  slug: 'custom-emoji',
  access: {
    create: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
    read: () => true,
    update: ({ req }) => Boolean(req.user),
  },
  admin: {
    useAsTitle: 'shortcode',
  },
  fields: [
    {
      name: 'shortcode',
      type: 'text',
      admin: {
        description: 'Shortcode without colons, e.g. "pepe" (used as :pepe: in emojiRef).',
      },
      index: true,
      required: true,
      unique: true,
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      required: true,
    },
    {
      name: 'uploadedBy',
      type: 'relationship',
      index: true,
      relationTo: 'members',
    },
  ],
}
