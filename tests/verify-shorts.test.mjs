import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { chmod, mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

const VERIFIER = join(process.cwd(), 'scripts/verify-shorts.mjs')

function runNode(args, options) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [VERIFIER, ...args], { ...options, shell: false })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (data) => { stdout += data.toString() })
    child.stderr.on('data', (data) => { stderr += data.toString() })
    child.on('close', (code) => resolve({ code, stdout, stderr }))
  })
}

async function fakeMedia({ width, height, duration, audioResult } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'video-preflight-'))
  const bin = join(root, 'bin')
  await mkdir(bin)
  const video = join(root, 'final.mp4')
  await writeFile(video, 'isolated synthetic fixture')
  const probe = JSON.stringify({
    streams: [{ width, height, r_frame_rate: '30/1' }],
    format: { duration: String(duration), size: '1048576' },
  })
  await writeFile(join(bin, 'ffprobe'), `#!/bin/sh\nprintf '%s\\n' '${probe}'\n`)
  await writeFile(join(bin, 'ffmpeg'), '#!/bin/sh\nexit 0\n')
  if (audioResult) {
    const response = JSON.stringify(audioResult)
    await writeFile(join(bin, 'python3'),
      `#!/bin/sh\nprintf '%s\\n' '${response}'\nexit ${audioResult.status === 'FAIL' ? 2 : 0}\n`)
    await chmod(join(bin, 'python3'), 0o755)
  }
  await chmod(join(bin, 'ffprobe'), 0o755)
  await chmod(join(bin, 'ffmpeg'), 0o755)
  return { video, env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } }
}

test('720p shorts geometry passes; scene rhythm warns without approving publication', async () => {
  const { video, env } = await fakeMedia({ width: 720, height: 1280, duration: 53 })
  const result = await runNode([video, '--format', 'shorts'], { env })
  assert.equal(result.code, 0, result.stderr || result.stdout)
  assert.match(result.stdout, /PASS \(2\/2 technical gates\)/)
  assert.match(result.stdout, /below recommended 1080×1920/)
  assert.match(result.stdout, /no detected cut in first 2s/)
  assert.match(result.stdout, /audio preflight: NOT RUN/)
})

test('long-form vertical explainer uses no hidden shorts duration cap', async () => {
  const { video, env } = await fakeMedia({ width: 1080, height: 1920, duration: 189.47 })
  const result = await runNode([video, '--format', 'explainer'], { env })
  assert.equal(result.code, 0, result.stderr || result.stdout)
  assert.match(result.stdout, /format: explainer/)
  assert.match(result.stdout, /PASS \(2\/2 technical gates\)/)
  assert.doesNotMatch(result.stdout, /review pacing/)
})

test('shorts recipe keeps 60-second target and still rejects bad aspect ratio', async () => {
  const long = await fakeMedia({ width: 1080, height: 1920, duration: 189.47 })
  const longResult = await runNode([long.video], { env: long.env })
  assert.equal(longResult.code, 1)
  assert.match(longResult.stdout, /duration 189\.47s/)

  const square = await fakeMedia({ width: 1080, height: 1080, duration: 30 })
  const squareResult = await runNode([square.video, '--format', 'explainer'], { env: square.env })
  assert.equal(squareResult.code, 1)
  assert.match(squareResult.stdout, /not supported 9:16 vertical/)
})

test('explicit audio preflight FAIL blocks early even when video geometry passes', async () => {
  const { video, env } = await fakeMedia({
    width: 1080,
    height: 1920,
    duration: 58,
    audioResult: {
      status: 'FAIL',
      failures: ['integrated loudness -17.9 LUFS outside -14.0±1.5 LU'],
      metrics: { integrated_lufs: -17.86, true_peak_dbtp: -1.66 },
    },
  })
  const result = await runNode([video, '--check-audio'], { env })
  assert.equal(result.code, 1, result.stdout)
  assert.match(result.stdout, /audio preflight: FAIL/)
  assert.match(result.stdout, /audio loudness: -17\.86 LUFS/)
  assert.match(result.stdout, /FAIL \(1 of 3 technical gates failed\)/)
})

test('unknown format is a usage error', async () => {
  const { video, env } = await fakeMedia({ width: 1080, height: 1920, duration: 40 })
  const result = await runNode([video, '--format', 'horizontal'], { env })
  assert.equal(result.code, 2)
  assert.match(result.stderr, /unsupported format/)
})
