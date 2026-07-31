#!/usr/bin/env node

/**
 * Publishes the extension to the Chrome Web Store via the v2 API.
 *
 * The v1.1 API is switched off on 15 October 2026 and never supported service
 * accounts, so this talks to v2 and authenticates as a service account. No
 * refresh token is involved: a short-lived access token is minted per run.
 *
 * Usage:
 *   chrome-webstore.mjs prepare <version>   stamp the version and build the zip
 *   chrome-webstore.mjs publish             upload the zip and submit for review
 *   chrome-webstore.mjs status              report live and in-review versions
 *
 * Environment:
 *   CWS_PUBLISHER_ID              publisher UUID from the developer dashboard
 *   CWS_EXTENSION_ID              extension id
 *   GOOGLE_SERVICE_ACCOUNT_KEY    service account key, as JSON
 *   CWS_ACCESS_TOKEN              pre-minted token; takes precedence over the key
 */

import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, rmSync, statSync } from 'node:fs'

const SCOPE = 'https://www.googleapis.com/auth/chromewebstore'
const API = 'https://chromewebstore.googleapis.com'
const DIST = 'dist/butler'
const ZIP = 'butler.zip'

const required = (name) => {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is not set`)
  }
  return value
}

const itemName = () =>
  `publishers/${required('CWS_PUBLISHER_ID')}/items/${required('CWS_EXTENSION_ID')}`

/**
 * Exchanges a service account key for an access token using a signed JWT.
 * Skipped entirely when CWS_ACCESS_TOKEN is supplied, which is how workload
 * identity federation would feed a token in without a stored key.
 */
async function accessToken() {
  if (process.env.CWS_ACCESS_TOKEN) {
    return process.env.CWS_ACCESS_TOKEN
  }

  const key = JSON.parse(required('GOOGLE_SERVICE_ACCOUNT_KEY'))
  const issued = Math.floor(Date.now() / 1000)
  const encode = (part) =>
    Buffer.from(JSON.stringify(part)).toString('base64url')
  const claims = encode({
    iss: key.client_email,
    scope: SCOPE,
    aud: 'https://oauth2.googleapis.com/token',
    iat: issued,
    exp: issued + 3600,
  })

  const payload = `${encode({ alg: 'RS256', typ: 'JWT' })}.${claims}`
  const signature = crypto
    .sign('RSA-SHA256', Buffer.from(payload), key.private_key)
    .toString('base64url')

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${payload}.${signature}`,
    }),
  })

  const body = await response.json()
  if (!response.ok) {
    throw new Error(
      `Token request failed (${response.status}): ${body.error_description ?? body.error}`,
    )
  }
  return body.access_token
}

async function call(token, url, { method = 'POST', body, contentType } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(contentType ? { 'Content-Type': contentType } : {}),
    },
    body,
  })

  const text = await response.text()
  const parsed = text ? JSON.parse(text) : {}
  if (!response.ok) {
    throw new Error(
      `${method} ${url} failed (${response.status}): ${JSON.stringify(parsed.error ?? parsed)}`,
    )
  }
  return parsed
}

/**
 * The upload is asynchronous, so a SUCCEEDED state has to be observed before
 * publishing. Publishing against an in-flight upload submits the old package.
 */
async function awaitUpload(token, state) {
  let current = state
  for (let attempt = 0; current === 'IN_PROGRESS' && attempt < 30; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 5000))
    const status = await call(token, `${API}/v2/${itemName()}:fetchStatus`, {
      method: 'GET',
    })
    // lastAsyncUploadState tracks the upload itself. The states on
    // submittedItemRevisionStatus describe review progress instead, and never
    // report IN_PROGRESS, so polling those would fall through immediately.
    // It is only set when an upload happened in the last 24 hours.
    current = status.lastAsyncUploadState ?? 'SUCCEEDED'
    console.log(`  upload state: ${current}`)
  }

  if (current === 'IN_PROGRESS') {
    throw new Error('Upload did not finish within 150s')
  }
  if (current === 'FAILED' || current === 'NOT_FOUND') {
    throw new Error(`Upload finished in state ${current}`)
  }
}

function prepare(version) {
  if (!version) {
    throw new Error('prepare requires a version argument')
  }

  const manifestPath = `${DIST}/manifest.json`
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  manifest.version = version
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`Wrote version ${version} to ${manifestPath}`)

  rmSync(ZIP, { force: true })
  execFileSync('zip', ['-r', '-9', '-q', `../../${ZIP}`, '.'], { cwd: DIST })
  console.log(`Wrote ${ZIP} (${statSync(ZIP).size} bytes)`)
}

async function publish() {
  const token = await accessToken()
  const zip = readFileSync(ZIP)

  console.log(`Uploading ${ZIP} (${zip.length} bytes)`)
  const uploaded = await call(
    token,
    `${API}/upload/v2/${itemName()}:upload?uploadType=media`,
    { body: zip, contentType: 'application/zip' },
  )
  console.log(
    `  uploaded version ${uploaded.crxVersion ?? '?'} (${uploaded.uploadState})`,
  )
  await awaitUpload(token, uploaded.uploadState)

  const published = await call(token, `${API}/v2/${itemName()}:publish`, {
    body: JSON.stringify({}),
    contentType: 'application/json',
  })
  console.log(`Submitted: state ${published.state}`)

  for (const warning of published.warningInfo?.warnings ?? []) {
    console.log(`  warning: ${warning.detail ?? JSON.stringify(warning)}`)
  }
}

/** Read-only check that the credentials work and the item is reachable. */
async function status() {
  const token = await accessToken()
  const item = await call(token, `${API}/v2/${itemName()}:fetchStatus`, {
    method: 'GET',
  })

  const describe = (revision) =>
    revision
      ? `${revision.state} (${revision.distributionChannels
          ?.map((channel) => channel.crxVersion)
          .join(', ')})`
      : 'none'

  console.log(`live:     ${describe(item.publishedItemRevisionStatus)}`)
  console.log(`in review: ${describe(item.submittedItemRevisionStatus)}`)
}

const [command, ...args] = process.argv.slice(2)
try {
  if (command === 'prepare') {
    prepare(args[0])
  } else if (command === 'publish') {
    await publish()
  } else if (command === 'status') {
    await status()
  } else {
    throw new Error(`Unknown command: ${command ?? '(none)'}`)
  }
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
