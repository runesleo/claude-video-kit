import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { access, chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const builder = fileURLToPath(new URL('../scripts/build-metadata.mjs', import.meta.url))

async function fixture(t, projectName, { wav = true, slides = 1 } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'video-kit-metadata-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const project = join(root, projectName)
  const workspace = join(project, 'workspace')
  const bin = join(root, 'bin')
  const probeLog = join(root, 'ffprobe-argv.jsonl')
  await mkdir(workspace, { recursive: true })
  await mkdir(bin)
  await writeFile(join(project, 'script.json'), JSON.stringify({
    fps: 30,
    slides: Array.from({ length: slides }, (_, i) => ({ title: `Slide ${i}` })),
  }))
  if (wav) await writeFile(join(workspace, '00.wav'), 'synthetic fixture')

  // An offline probe stub: no audio decoding, network, or real TTS services.
  const probe = join(bin, 'ffprobe')
  await writeFile(probe, [
    '#!/usr/bin/env node',
    "const fs = require('node:fs')",
    "fs.appendFileSync(process.env.FFPROBE_ARGS_LOG, JSON.stringify(process.argv.slice(2)) + '\\n')",
    "if (process.env.FFPROBE_FAIL === '1') process.exit(7)",
    "process.stdout.write(process.env.FFPROBE_DURATION ?? '1.25\\n')",
    '',
  ].join('\n'))
  await chmod(probe, 0o755)
  return { root, project, workspace, bin, probeLog }
}

function build({ root, project, bin, probeLog }, env = {}, projectArg = project) {
  return spawnSync(process.execPath, [builder, projectArg], {
    cwd: root,
    encoding: 'utf8',
    shell: false,
    env: {
      ...process.env,
      PATH: `${bin}${delimiter}${process.env.PATH ?? ''}`,
      FFPROBE_ARGS_LOG: probeLog,
      ...env,
    },
  })
}

async function probeCalls({ probeLog }) {
  return (await readFile(probeLog, 'utf8')).trim().split('\n').map(JSON.parse)
}

test('WAV paths with shell substitutions never execute commands', async (t) => {
  const f = await fixture(t, 'audio$(touch injected.marker)')
  const result = build(f)
  assert.equal(result.status, 0, result.stderr)
  await assert.rejects(access(join(f.root, 'injected.marker')), { code: 'ENOENT' })
  assert.deepEqual(await probeCalls(f), [[
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0',
    '-i', join(f.workspace, '00.wav'),
  ]])
  const metadata = JSON.parse(await readFile(join(f.project, 'metadata.json'), 'utf8'))
  assert.equal(metadata.slides[0].durationInFrames, 53)
  assert.equal(metadata.slides[0].audio, '00.wav')
})

test('spaces, quotes, semicolons and backticks stay within one WAV argument', async (t) => {
  const f = await fixture(t, 'a space "quote" ; dollar$ and `backticks`')
  const result = build(f)
  assert.equal(result.status, 0, result.stderr)
  assert.equal((await probeCalls(f))[0].at(-1), join(f.workspace, '00.wav'))
})

test('a relative project beginning with a dash is treated as a file path', async (t) => {
  const f = await fixture(t, '-leading-dash')
  const result = build(f, {}, '-leading-dash')
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual((await probeCalls(f))[0].slice(-2), ['-i', '-leading-dash/workspace/00.wav'])
})

test('missing WAV keeps the minimum slide duration without calling ffprobe', async (t) => {
  const f = await fixture(t, 'missing-wav', { wav: false })
  const result = build(f)
  assert.equal(result.status, 0, result.stderr)
  const metadata = JSON.parse(await readFile(join(f.project, 'metadata.json'), 'utf8'))
  assert.equal(metadata.slides[0].durationInFrames, 45)
  assert.equal(Object.hasOwn(metadata.slides[0], 'audio'), false)
  await assert.rejects(access(f.probeLog), { code: 'ENOENT' })
})

test('bad probe duration and failed probes do not produce success metadata', async (t) => {
  for (const env of [{ FFPROBE_DURATION: 'not-a-duration' }, { FFPROBE_FAIL: '1' }]) {
    const f = await fixture(t, 'bad-probe')
    const result = build(f, env)
    assert.notEqual(result.status, 0)
    if (env.FFPROBE_DURATION) assert.match(result.stderr, /invalid duration/)
    await assert.rejects(access(join(f.project, 'metadata.json')), { code: 'ENOENT' })
  }
})

test('multiple slides preserve audio ordering and caption mapping', async (t) => {
  const f = await fixture(t, 'multi-slide', { slides: 2 })
  await writeFile(join(f.workspace, '01.wav'), 'second synthetic fixture')
  await writeFile(join(f.workspace, 'captions.json'), JSON.stringify({
    '00': [{ text: 'First caption' }],
    '01': [{ text: 'Second caption' }],
  }))
  const result = build(f)
  assert.equal(result.status, 0, result.stderr)
  const metadata = JSON.parse(await readFile(join(f.project, 'metadata.json'), 'utf8'))
  assert.deepEqual(metadata.slides.map((s) => s.audio), ['00.wav', '01.wav'])
  assert.deepEqual(metadata.slides.map((s) => s.captions?.[0]?.text), ['First caption', 'Second caption'])
  assert.equal((await probeCalls(f)).length, 2)
})
