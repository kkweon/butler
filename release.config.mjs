/**
 * @type {import('semantic-release').GlobalConfig}
 */
export default {
  branches: ['master'],
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    [
      '@semantic-release/exec',
      {
        prepareCmd:
          'node scripts/chrome-webstore.mjs prepare ${nextRelease.version}',
        publishCmd: 'node scripts/chrome-webstore.mjs publish',
      },
    ],
    [
      '@semantic-release/github',
      {
        assets: ['butler.zip'],
      },
    ],
  ],
}
