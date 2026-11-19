import type { CollectionConfig } from 'payload'

export const NewsletterSubscriber: CollectionConfig = {
  slug: 'newsletter-subscribers',
  access: {
    // Double-opt-in lifecycle is managed exclusively by server-side flows (T2.6).
    create: () => false,
    delete: ({ req }) => Boolean(req.user),
    read: ({ req }) => Boolean(req.user),
    update: () => false,
  },
  admin: {
    defaultSort: '-createdAt',
    useAsTitle: 'email',
  },
  fields: [
    {
      name: 'email',
      type: 'email',
      index: true,
      required: true,
      unique: true,
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'pending',
      index: true,
      options: ['pending', 'confirmed', 'unsubscribed'],
    },
    {
      name: 'confirmToken',
      type: 'text',
      admin: {
        description: '32-byte URL-safe base64 token; expires after 24h.',
      },
      index: true,
      unique: true,
    },
    {
      name: 'confirmTokenExpiresAt',
      type: 'date',
    },
    {
      name: 'unsubToken',
      type: 'text',
      admin: {
        description: '32-byte URL-safe base64 token; single-use.',
      },
      index: true,
      unique: true,
    },
    {
      name: 'confirmedAt',
      type: 'date',
    },
    {
      name: 'unsubscribedAt',
      type: 'date',
    },
  ],
}
