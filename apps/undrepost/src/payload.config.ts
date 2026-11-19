import { postgresAdapter } from '@payloadcms/db-postgres'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { sharpTransformer } from '@payloadcms/transformer-sharp'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'

import { AuctionRef } from './collections/AuctionRef'
import { Comments } from './collections/Comments'
import { CustomEmoji } from './collections/CustomEmoji'
import { GiveawayRef } from './collections/GiveawayRef'
import { Media } from './collections/Media'
import { Members } from './collections/Members'
import { NewsletterSubscriber } from './collections/NewsletterSubscriber'
import { Polls } from './collections/Polls'
import { PollVote } from './collections/PollVote'
import { Posts } from './collections/Posts'
import { QuestionPool } from './collections/QuestionPool'
import { Reactions } from './collections/Reactions'
import { Sessions } from './collections/Sessions'
import { SyndicationLog } from './collections/SyndicationLog'
import { jitProvisionEndpoint } from './endpoints/jitProvision'
import { loginEndpoint, logoutEndpoint } from './endpoints/sessionAuth'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: ' — Undrepost',
    },
    user: Members.slug,
  },
  collections: [
    Members,
    Sessions,
    Media,
    Posts,
    Comments,
    Reactions,
    CustomEmoji,
    Polls,
    PollVote,
    NewsletterSubscriber,
    SyndicationLog,
    QuestionPool,
    GiveawayRef,
    AuctionRef,
  ],
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
  }),
  editor: lexicalEditor(),
  endpoints: [jitProvisionEndpoint, loginEndpoint, logoutEndpoint],
  plugins: [
    seoPlugin({
      collections: ['posts'],
      generateDescription: ({ doc }) => doc?.excerpt ?? '',
      generateTitle: ({ doc }) => doc?.title ?? 'Undrepost',
      generateURL: ({ doc }) =>
        `${process.env.SITE_URL || 'http://localhost:3000'}/blog/${doc?.slug ?? ''}`,
      uploadsCollection: 'media',
    }),
  ],
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  upload: {
    transformers: [sharpTransformer()],
  },
})
