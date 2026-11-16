import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
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

async function fakeMedia({ width, height, duration, videoDuration, audioResult } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'video-preflight-'))
  const bin = join(root, 'bin')
  await mkdir(bin)
  const video = join(root, 'final.mp4')
  await writeFile(video, 'isolated synthetic fixture')
  const probe = JSON.stringify({
    streams: [{ width, height, duration: String(videoDuration ?? duration), r_frame_rate: '30/1' }],
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
  assert.match(result.stdout, /explainer pacing requires independent chapter-level motion review/)
  assert.match(result.stdout, /no detected cut in first 2s/)
  assert.doesNotMatch(result.stdout, /avg detected scene interval/)
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

test('shorts uses picture duration and warns on small AAC mux padding', async () => {
  const padded = await fakeMedia({ width: 1080, height: 1920, duration: 60.01, videoDuration: 60 })
  const accepted = await runNode([padded.video, '--format', 'shorts'], { env: padded.env })
  assert.equal(accepted.code, 0, accepted.stderr || accepted.stdout)
  assert.ok(accepted.stdout.includes('duration: 60.00s'))
  assert.ok(accepted.stdout.includes('container duration: 60.01s'))
  assert.ok(accepted.stdout.includes('review codec padding and platform fit'))

  const excessive = await fakeMedia({ width: 1080, height: 1920, duration: 60.4, videoDuration: 60 })
  const rejected = await runNode([excessive.video, '--format', 'shorts'], { env: excessive.env })
  assert.equal(rejected.code, 1)
  assert.ok(rejected.stdout.includes('container duration 60.40s exceeds'))
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

test('real FFmpeg audio preflight accepts normalized audio and rejects quiet audio', {
  skip: ['ffmpeg', 'ffprobe', 'python3'].some((tool) =>
    spawnSync(tool, [tool === 'python3' ? '--version' : '-version'], { stdio: 'ignore' }).status !== 0),
}, async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'video-audio-real-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const normalized = join(root, 'normalized.mp4')
  const quiet = join(root, 'quiet.mp4')
  const generated = spawnSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error',
    '-f', 'lavfi', '-i', 'color=c=black:s=720x1280:r=30:d=3',
    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=3',
    '-af', 'loudnorm=I=-14:TP=-2:LRA=8',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-ar', '48000', '-ac', '2',
    '-t', '3', '-y', normalized,
  ], { encoding: 'utf8', timeout: 60000 })
  assert.equal(generated.status, 0, generated.stderr || generated.error?.message)
  const passed = await runNode([normalized, '--check-audio'])
  assert.equal(passed.code, 0, passed.stderr || passed.stdout)
  assert.ok(passed.stdout.includes('audio preflight: PASS'))
  assert.ok(passed.stdout.includes('PASS (3/3 technical gates)'))

  const attenuated = spawnSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-i', normalized,
    '-map', '0:v:0', '-map', '0:a:0', '-c:v', 'copy',
    '-af', 'volume=0.03', '-c:a', 'aac', '-ar', '48000', '-ac', '2',
    '-y', quiet,
  ], { encoding: 'utf8', timeout: 60000 })
  assert.equal(attenuated.status, 0, attenuated.stderr || attenuated.error?.message)
  const failed = await runNode([quiet, '--check-audio'])
  assert.equal(failed.code, 1, failed.stderr || failed.stdout)
  assert.ok(failed.stdout.includes('audio preflight: FAIL'))
  assert.ok(failed.stdout.includes('integrated loudness'))
})

test('unknown format is a usage error', async () => {
  const { video, env } = await fakeMedia({ width: 1080, height: 1920, duration: 40 })
  const result = await runNode([video, '--format', 'horizontal'], { env })
  assert.equal(result.code, 2)
  assert.match(result.stderr, /unsupported format/)
})
