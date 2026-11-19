import { postgresAdapter } from '@payloadcms/db-postgres'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import { sharpTransformer } from '@payloadcms/transformer-sharp'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'

import { AuctionRef } from './collections/AuctionRef'
import { Comments } from './collections/Comments'
import { Counters } from './collections/Counters'
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
import { eventsStreamEndpoint } from './endpoints/eventsStream'
import { jitProvisionEndpoint } from './endpoints/jitProvision'
import {
  newsletterConfirmEndpoint,
  newsletterSubscribeEndpoint,
  newsletterUnsubscribeEndpoint,
} from './endpoints/newsletter'
import { loginEndpoint, logoutEndpoint } from './endpoints/sessionAuth'
import { startReconcileJob } from './jobs/reconcile'
import { startTombstoneSweepJob } from './jobs/tombstoneSweep'
import { startMetricsReporter } from './lib/metrics'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// T2.8: S3 storage adapter is env-gated — S3 emulation (MinIO) in dev/test,
// real S3 in prod; local disk fallback keeps zero-config dev boot working.
const storagePlugins = []
if (process.env.S3_BUCKET) {
  storagePlugins.push(
    s3Storage({
      bucket: process.env.S3_BUCKET,
      collections: { media: true },
      config: {
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
        },
        endpoint: process.env.S3_ENDPOINT,
        forcePathStyle: true,
        region: process.env.S3_REGION || 'us-east-1',
      },
    }),
  )
}

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
    Counters,
  ],
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
  }),
  editor: lexicalEditor(),
  // NOTE: endpoints whose first path segment collides with a collection slug
  // (posts/:id/reactions, polls/:id/vote) MUST live on the collection config —
  // the router resolves collection slugs to collection.endpoints first and
  // global endpoints never see those paths (handleEndpoints.ts:195).
  endpoints: [
    jitProvisionEndpoint,
    loginEndpoint,
    logoutEndpoint,
    eventsStreamEndpoint,
    newsletterSubscribeEndpoint,
    newsletterConfirmEndpoint,
    newsletterUnsubscribeEndpoint,
  ],
  onInit: (payload) => {
    // Background jobs: counter reconciliation (T2.4b, every 5 min), member
    // tombstone sweep (T2.20, daily, fail-closed) and the metrics reporter
    // (T2.10, every 60 s). Intervals are unref'd — single-instance MVP;
    // the Redis-backed multi-instance fanout lands with T2.7.
    startReconcileJob(payload)
    startTombstoneSweepJob(payload)
    startMetricsReporter(payload.logger)
  },
  plugins: [
    seoPlugin({
      collections: ['posts'],
      generateDescription: ({ doc }) => doc?.excerpt ?? '',
      generateTitle: ({ doc }) => doc?.title ?? 'Undrepost',
      generateURL: ({ doc }) =>
        `${process.env.SITE_URL || 'http://localhost:3000'}/blog/${doc?.slug ?? ''}`,
      uploadsCollection: 'media',
    }),
    ...storagePlugins,
  ],
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  upload: {
    // Beta.10 transformer API: sizes are authored per-collection via the
    // transformer (upload.imageSizes was removed in Payload 4.0).
    transformers: [
      sharpTransformer({
        collections: {
          media: {
            variants: [
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
          },
        },
      }),
    ],
  },
})
