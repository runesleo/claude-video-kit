import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { access, chmod, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { pathToFileURL } from 'node:url'

import {
  collectDoctorObservations,
  createRenderedReviewReceipt,
  createReviewReceipt,
  evaluateDoctor,
  prepareDemoProject,
  runGuardedRender,
  validateRenderedReviewReceipt,
  validateReviewReceipt,
} from '../scripts/video-explainer.mjs'

const passingChecks = {
  facts: { status: 'pass', notes: 'No unsupported factual claims.' },
  structure: { status: 'pass', notes: 'Hook, explanation, and close are present.' },
  duration: { status: 'pass', notes: 'Target is under 30 seconds.' },
  visual_feasibility: { status: 'pass', notes: 'Every slide maps to a supported composition.' },
  hierarchy: { status: 'pass', notes: 'Each frame has one obvious primary message.' },
  simplicity: { status: 'pass', notes: 'No unnecessary decorative elements.' },
  clarity: { status: 'pass', notes: 'Scale, spacing, contrast, and labels establish reading order.' },
  legibility: { status: 'pass', notes: 'Text remains readable at phone viewing size.' },
  craft: { status: 'pass', notes: 'Alignment, spacing, components, and motion are consistent.' },
  privacy: { status: 'pass', notes: 'No personal data or credentials.' },
  copyright: { status: 'pass', notes: 'Repository-owned text and shapes only.' },
}

const passingRenderChecks = {
  hierarchy: { status: 'pass', notes: 'Primary focus survives the actual render.' },
  simplicity: { status: 'pass', notes: 'No rendered element creates unnecessary visual load.' },
  clarity: { status: 'pass', notes: 'Reading order remains clear in motion.' },
  legibility: { status: 'pass', notes: 'Phone-size playback remains readable.' },
  craft: { status: 'pass', notes: 'Alignment, animation, and visual rhythm are polished.' },
  audio_consistency: { status: 'pass', notes: 'No chapter-level loudness or pacing jump.' },
  end_card: { status: 'pass', notes: 'The correct end card is present and unobscured.' },
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { ...options, shell: false })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    child.on('close', (code) => resolve({ code, stdout, stderr }))
  })
}

function runNode(args, options = {}) {
  return runCommand(process.execPath, args, options)
}

test('review receipt is bound to the exact script and requires an independent reviewer', async () => {
  const project = await mkdtemp(join(tmpdir(), 'video-explainer-review-'))
  await writeFile(join(project, 'script.json'), JSON.stringify({
    title: 'Demo',
    slides: [{ type: 'cover', title: 'Review first' }],
  }))

  const receipt = await createReviewReceipt(project, {
    author: 'writer-agent',
    reviewer: 'review-agent',
    checks: passingChecks,
  })
  assert.equal(receipt.schema, 'video-explainer-review/v2')
  assert.equal(receipt.status, 'pass')
  assert.equal((await validateReviewReceipt(project, receipt)).ok, true)

  await writeFile(join(project, 'script.json'), JSON.stringify({
    title: 'Changed after review',
    slides: [{ type: 'cover', title: 'Review first' }],
  }))
  const stale = await validateReviewReceipt(project, receipt)
  assert.equal(stale.ok, false)
  assert.match(stale.reason, /changed after review/i)

  await assert.rejects(
    () => createReviewReceipt(project, {
      author: 'same-agent',
      reviewer: 'same-agent',
      checks: passingChecks,
    }),
    /independent reviewer/i,
  )
})

test('legacy six-check reviews cannot silently bypass the new design-quality gate', async () => {
  const project = await mkdtemp(join(tmpdir(), 'video-explainer-design-gate-'))
  await writeFile(join(project, 'script.json'), JSON.stringify({
    title: 'Design gate', slides: [{ type: 'cover', title: 'One focal point' }],
  }))
  const legacyChecks = {
    facts: passingChecks.facts,
    structure: passingChecks.structure,
    duration: passingChecks.duration,
    visual_feasibility: passingChecks.visual_feasibility,
    privacy: passingChecks.privacy,
    copyright: passingChecks.copyright,
  }
  await assert.rejects(
    () => createReviewReceipt(project, {
      author: 'writer-agent', reviewer: 'review-agent', checks: legacyChecks,
    }),
    /hierarchy.*pass, fix, or block/i,
  )
  const legacyReceipt = {
    schema: 'video-explainer-review/v1',
    author: 'writer-agent',
    reviewer: 'review-agent',
    status: 'pass',
    script_sha256: 'legacy',
    checks: legacyChecks,
  }
  const result = await validateReviewReceipt(project, legacyReceipt)
  assert.equal(result.ok, false)
  assert.match(result.reason, /eleven-check review/i)
})

test('rendered-output review is video-bound, independent, and includes audio/end-card QA', async () => {
  const root = await mkdtemp(join(tmpdir(), 'video-explainer-render-review-'))
  const video = join(root, 'full.mp4')
  await writeFile(video, 'render-v1')

  const receipt = await createRenderedReviewReceipt(video, {
    producer: 'render-agent', reviewer: 'independent-reviewer', checks: passingRenderChecks,
  })
  assert.equal(receipt.schema, 'video-explainer-render-review/v1')
  assert.equal(receipt.status, 'pass')
  assert.equal((await validateRenderedReviewReceipt(video, receipt)).ok, true)

  const fixChecks = structuredClone(passingRenderChecks)
  fixChecks.audio_consistency = { status: 'fix', notes: 'Chapter 3 is visibly louder than chapter 2.' }
  const fixReceipt = await createRenderedReviewReceipt(video, {
    producer: 'render-agent', reviewer: 'independent-reviewer', checks: fixChecks,
  })
  assert.equal(fixReceipt.status, 'fix')
  assert.equal((await validateRenderedReviewReceipt(video, fixReceipt)).ok, false)

  await writeFile(video, 'render-v2')
  const stale = await validateRenderedReviewReceipt(video, receipt)
  assert.equal(stale.ok, false)
  assert.match(stale.reason, /video changed/i)

  await assert.rejects(
    () => createRenderedReviewReceipt(video, {
      producer: 'same-agent', reviewer: 'same-agent', checks: passingRenderChecks,
    }),
    /independent reviewer/i,
  )
})

test('guarded render never starts for fix receipts and runs for a current pass receipt', async () => {
  const project = await mkdtemp(join(tmpdir(), 'video-explainer-render-'))
  await writeFile(join(project, 'script.json'), JSON.stringify({
    title: 'Guard demo',
    slides: [{ type: 'cover', title: 'Stop before render' }],
  }))
  const fakeRender = join(project, 'fake-render.sh')
  const marker = join(project, 'rendered.marker')
  await writeFile(fakeRender, [
    '#!/bin/sh',
    'printf rendered > "$1/rendered.marker"',
    'printf \'%s\\n\' "$TTS_BACKEND|$FISH_AUDIO_API_KEY|$FISH_AUDIO_VOICE_ID|$VIDEO_EXPLAINER_ALIGN_MODE" > "$1/render-env.txt"',
    '',
  ].join('\n'))

  const fixChecks = structuredClone(passingChecks)
  fixChecks.facts = { status: 'fix', notes: 'One claim still needs a source.' }
  const fixReceipt = await createReviewReceipt(project, {
    author: 'writer-agent', reviewer: 'review-agent', checks: fixChecks,
  })
  await writeFile(join(project, 'review-result.json'), JSON.stringify(fixReceipt))
  await assert.rejects(
    () => runGuardedRender(project, { renderScript: fakeRender }),
    /cannot render.*status is fix/i,
  )
  await assert.rejects(() => access(marker))

  const passReceipt = await createReviewReceipt(project, {
    author: 'writer-agent', reviewer: 'review-agent', checks: passingChecks,
  })
  await writeFile(join(project, 'review-result.json'), JSON.stringify(passReceipt))
  await runGuardedRender(project, { renderScript: fakeRender })
  assert.equal(await readFile(marker, 'utf8'), 'rendered')

  await runGuardedRender(project, {
    renderScript: fakeRender,
    demoQuality: true,
    env: {
      TTS_BACKEND: 'indextts2',
      FISH_AUDIO_API_KEY: 'must-not-leak',
      FISH_AUDIO_VOICE_ID: 'must-not-leak',
    },
  })
  assert.equal(
    (await readFile(join(project, 'render-env.txt'), 'utf8')).trim(),
    'fish|||script',
  )
})

test('doctor accepts the no-key macOS demo path and gives actionable blockers', () => {
  const healthy = evaluateDoctor({
    platform: 'darwin',
    node: { ok: true, version: '25.9.0' },
    python: { ok: true, version: '3.11.9' },
    ffmpeg: { ok: true, version: '7.1' },
    ffprobe: { ok: true, version: '7.1' },
    remotion: { ok: true, version: '4.0.433' },
    say: { ok: true, version: 'macOS built-in' },
    fishAudio: { ok: false, version: '' },
    outputWritable: { ok: true, version: 'yes' },
  })
  assert.equal(healthy.ok, true)
  assert.equal(healthy.ttsMode, 'say-demo')
  assert.match(healthy.warnings.join('\n'), /demo-quality/i)

  const blocked = evaluateDoctor({
    ...healthy.observations,
    ffmpeg: { ok: false, version: '' },
  })
  assert.equal(blocked.ok, false)
  assert.match(blocked.actions.join('\n'), /install ffmpeg/i)
})

test('demo preparation copies only the public fixture and refuses to overwrite output', async () => {
  const root = await mkdtemp(join(tmpdir(), 'video-explainer-demo-'))
  const source = join(root, 'fixture')
  const output = join(root, 'output')
  await mkdir(source)
  await writeFile(join(source, 'brief.md'), '# Neutral demo\n')
  await writeFile(join(source, 'script.json'), '{"title":"Neutral demo","slides":[]}\n')
  await writeFile(join(source, 'review-input.json'), '{"author":"fixture","reviewer":"maintainer","checks":{}}\n')

  await prepareDemoProject(output, { sourceDir: source })
  assert.equal(await readFile(join(output, 'brief.md'), 'utf8'), '# Neutral demo\n')
  assert.equal(await readFile(join(output, 'script.json'), 'utf8'), '{"title":"Neutral demo","slides":[]}\n')
  await assert.rejects(
    () => prepareDemoProject(output, { sourceDir: source }),
    /already exists/i,
  )
})

test('CLI writes a pass receipt and dry-run render validates it without launching work', async () => {
  const project = await mkdtemp(join(tmpdir(), 'video-explainer-cli-'))
  await writeFile(join(project, 'script.json'), JSON.stringify({
    title: 'CLI demo', slides: [{ type: 'cover', title: 'Review first' }],
  }))
  await writeFile(join(project, 'review-input.json'), JSON.stringify({
    author: 'fixture-author', reviewer: 'independent-reviewer', checks: passingChecks,
  }))

  const cli = join(process.cwd(), 'scripts/video-explainer.mjs')
  const reviewed = await runNode([cli, 'review', project, '--input', join(project, 'review-input.json')])
  assert.equal(reviewed.code, 0, reviewed.stderr)
  const receipt = JSON.parse(await readFile(join(project, 'review-result.json'), 'utf8'))
  assert.equal(receipt.status, 'pass')

  const dryRun = await runNode([cli, 'render', project, '--dry-run'])
  assert.equal(dryRun.code, 0, dryRun.stderr)
  assert.match(dryRun.stdout, /review gate: pass/i)
})

test('CLI writes a video-bound rendered-output review receipt', async () => {
  const root = await mkdtemp(join(tmpdir(), 'video-explainer-review-render-cli-'))
  const video = join(root, 'full.mp4')
  const input = join(root, 'render-review-input.json')
  await writeFile(video, 'synthetic reviewed render')
  await writeFile(input, JSON.stringify({
    producer: 'render-agent', reviewer: 'independent-render-reviewer', checks: passingRenderChecks,
  }))

  const cli = join(process.cwd(), 'scripts/video-explainer.mjs')
  const reviewed = await runNode([cli, 'review-render', video, '--input', input])
  assert.equal(reviewed.code, 0, reviewed.stderr)
  assert.match(reviewed.stdout, /rendered-output review gate: pass/i)
  const receipt = JSON.parse(await readFile(join(root, 'render-review-result.json'), 'utf8'))
  assert.equal((await validateRenderedReviewReceipt(video, receipt)).ok, true)
})

test('doctor CLI is read-only, machine-readable, and reports the supported local demo path', async () => {
  const cli = join(process.cwd(), 'scripts/video-explainer.mjs')
  const output = await mkdtemp(join(tmpdir(), 'video-explainer-doctor-'))
  const doctor = await runNode([cli, 'doctor', '--json', '--output', output])
  const report = JSON.parse(doctor.stdout)
  assert.equal(doctor.code, report.ok ? 0 : 1, doctor.stderr)
  if (report.ok) assert.ok(['say-demo', 'fish-audio'].includes(report.ttsMode))
  else assert.equal(report.ttsMode, 'unavailable')
  for (const name of ['node', 'python', 'ffmpeg', 'ffprobe', 'remotion', 'outputWritable']) {
    assert.equal(typeof report.observations[name].ok, 'boolean')
  }
})

test('doctor treats a new output path as writable without creating it', async () => {
  const root = await mkdtemp(join(tmpdir(), 'video-explainer-doctor-new-output-'))
  const output = join(root, 'not-created-yet', 'first-success')
  const observations = await collectDoctorObservations(output)
  assert.equal(observations.outputWritable.ok, true)
  assert.equal(observations.outputWritable.version, output)
  await assert.rejects(() => access(output))
})

test('demo CLI prepares the neutral fixture and leaves a pass review receipt before render', async () => {
  const root = await mkdtemp(join(tmpdir(), 'video-explainer-demo-cli-'))
  const output = join(root, 'first-success')
  const cli = join(process.cwd(), 'scripts/video-explainer.mjs')
  const demo = await runNode(
    [cli, 'demo', '--output', output, '--prepare-only'],
    { env: { ...process.env, PATH: root } },
  )
  assert.equal(demo.code, 0, demo.stderr)
  assert.match(await readFile(join(output, 'brief.md'), 'utf8'), /reviewed vertical explainer/i)
  const receipt = JSON.parse(await readFile(join(output, 'review-result.json'), 'utf8'))
  assert.equal(receipt.status, 'pass')
  assert.equal((await validateReviewReceipt(output, receipt)).ok, true)
  await assert.rejects(() => access(join(output, 'out/full.mp4')))
})

test('demo-quality rendering selects script-timed captions without loading Whisper', async () => {
  const renderScript = await readFile(join(process.cwd(), 'scripts/render.sh'), 'utf8')
  assert.match(renderScript, /VIDEO_EXPLAINER_ALIGN_MODE/)
  assert.match(renderScript, /--legacy-char-ratio/)
  assert.match(renderScript, /unsupported VIDEO_EXPLAINER_ALIGN_MODE/)
})

test('video-explainer is a discoverable, concise skill with on-demand references', async () => {
  const skillRoot = join(process.cwd(), 'skills/video-explainer')
  const skill = await readFile(join(skillRoot, 'SKILL.md'), 'utf8')
  assert.match(skill, /^---\nname: video-explainer\ndescription: .+\n---/)
  assert.doesNotMatch(skill, /TODO|\/Users\/zhangxu|runes_leo|leolabs/i)
  assert.match(skill, /npx skills add runesleo\/claude-video-kit --skill video-explainer/)
  assert.match(skill, /review-render/)
  for (const name of [
    'setup-and-doctor.md',
    'brief-to-script.md',
    'review-gate.md',
    'render-and-verify.md',
    'errors-and-privacy.md',
  ]) {
    assert.match(skill, new RegExp(name.replace('.', '\\.')))
    await access(join(skillRoot, 'references', name))
  }
  const ui = await readFile(join(skillRoot, 'agents/openai.yaml'), 'utf8')
  assert.match(ui, /\$video-explainer/)
})

test('release-candidate version, commands, changelog, and bilingual entrypoints stay aligned', async () => {
  const rootPackage = JSON.parse(await readFile(join(process.cwd(), 'package.json'), 'utf8'))
  const remotionPackage = JSON.parse(await readFile(join(process.cwd(), 'remotion/package.json'), 'utf8'))
  assert.equal(rootPackage.version, '0.3.0-rc.1')
  assert.equal(remotionPackage.version, rootPackage.version)
  for (const name of ['test', 'check', 'doctor', 'demo']) assert.equal(typeof rootPackage.scripts[name], 'string')

  const changelog = await readFile(join(process.cwd(), 'CHANGELOG.md'), 'utf8')
  assert.match(changelog, /0\.3\.0-rc\.1/)
  assert.match(changelog, /video-explainer/)
  assert.match(changelog, /design-quality/i)
  for (const readme of ['README.md', 'README.zh.md']) {
    const body = await readFile(join(process.cwd(), readme), 'utf8')
    assert.match(body, /npx skills add runesleo\/claude-video-kit --skill video-explainer/)
    assert.match(body, /video-explainer\.mjs demo/)
    assert.match(body, /0\.3\.0-rc\.1/)
  }
  await access(join(process.cwd(), '.github/workflows/ci.yml'))
})

test('script-timed caption mode derives cover text instead of falling back to Whisper', async () => {
  const probe = await runCommand('python3', [
    '-c',
    'import sys; sys.path.insert(0, "scripts"); import align; print(align.caption_source_for_slide({"type":"cover","title":"Review first","subtitle":"Render once"}))',
  ], { cwd: process.cwd() })
  assert.equal(probe.code, 0, probe.stderr)
  assert.equal(probe.stdout.trim(), 'Review first Render once')
})

test('shorts verification uses the render schedule when metadata is supplied', async () => {
  const root = await mkdtemp(join(tmpdir(), 'video-explainer-verify-'))
  const bin = join(root, 'bin')
  const video = join(root, 'full.mp4')
  const metadata = join(root, 'metadata.json')
  await mkdir(bin)
  await writeFile(video, 'synthetic video placeholder')
  await writeFile(metadata, JSON.stringify({
    width: 1080,
    height: 1920,
    fps: 30,
    slides: Array.from({ length: 8 }, (_, index) => ({
      type: 'text',
      text: `Scene ${index + 1}`,
      durationInFrames: 60,
    })),
  }))

  const fakeProbe = join(bin, 'ffprobe')
  const fakeFfmpeg = join(bin, 'ffmpeg')
  await writeFile(fakeProbe, '#!/bin/sh\nprintf \'%s\\n\' \'{"streams":[{"width":1080,"height":1920,"r_frame_rate":"30/1"}],"format":{"duration":"16.000","size":"1048576"}}\'\n')
  await writeFile(fakeFfmpeg, '#!/bin/sh\nexit 0\n')
  await chmod(fakeProbe, 0o755)
  await chmod(fakeFfmpeg, 0o755)

  const verified = await runNode([
    join(process.cwd(), 'scripts/verify-shorts.mjs'),
    video,
    '--metadata',
    metadata,
  ], {
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
  })
  assert.equal(verified.code, 0, verified.stderr || verified.stdout)
  assert.match(verified.stdout, /scene source: metadata schedule/i)
  assert.match(verified.stdout, /avg interval: 2\.00s/i)
  assert.match(verified.stdout, /first-2s scene changes: 1/i)
  assert.match(verified.stdout, /PASS \(4\/4 hard gates\)/)
})

test('caption wrapping preserves spaces between Latin words', async () => {
  const source = await readFile(
    join(process.cwd(), 'remotion/src/compositions/CaptionsLayer.tsx'),
    'utf8',
  )
  const match = source.match(/function wrapText[\s\S]*?\n}\n\n\/\*\*\n \* Render/)
  assert.ok(match, 'wrapText implementation must remain extractable for its behavior test')

  const root = await mkdtemp(join(tmpdir(), 'caption-wrap-'))
  const modulePath = join(root, 'caption-wrap.mjs')
  const tsImport = await import(pathToFileURL(
    join(process.cwd(), 'remotion/node_modules/typescript/lib/typescript.js'),
  ))
  const ts = tsImport.default ?? tsImport
  const implementation = match[0].replace(/\n\n\/\*\*\n \* Render$/, '')
  const compiled = ts.transpileModule(
    `${implementation}\nexport { wrapText }\n`,
    { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
  ).outputText
  await writeFile(modulePath, compiled)
  const { wrapText } = await import(pathToFileURL(modulePath))

  for (const text of [
    'Fix or block stops rendering',
    'Pass unlocks rendering',
    'Check visuals, privacy, copyright',
  ]) {
    const lines = wrapText(text, 10)
    assert.equal(lines.join(' '), text)
  }
})

test('code slides delegate captions to the single shared caption layer', async () => {
  const source = await readFile(
    join(process.cwd(), 'remotion/src/compositions/CodeSlide.tsx'),
    'utf8',
  )
  assert.doesNotMatch(source, /const active = captions/)
  assert.doesNotMatch(source, /\{active && \(/)
})
