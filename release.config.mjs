/**
 * @type {import('semantic-release').GlobalConfig}
 */
export default {
  branches: ['master'],
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    [
      'semantic-release-chrome',
      {
        asset: 'butler.zip',
        distFolder: 'dist/butler',
        extensionId: 'haepoecmeobjjfeonmpphmpajaefcnfo',
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
