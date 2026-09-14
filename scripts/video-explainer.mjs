#!/usr/bin/env node
/**
 * video-explainer — guarded entrypoint for the reviewed vertical-video flow.
 *
 * asset-version: v0.3.0-rc.1 / 2026-09-14 / add design-quality and rendered-output review gates
 * owner_surface: claude-video-kit / T0580 / video-explainer Agent Skill
 * behavior_change: rendering requires eleven current pre-render checks; publication-quality acceptance also requires an independent review bound to the exact rendered video bytes
 * rollback: revert the 2026-09-14 review-gate change; legacy render.sh remains available
 */

import { createHash } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { constants, existsSync } from 'node:fs'
import { access, copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const KIT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export const DESIGN_QUALITY_CHECKS = [
  'hierarchy',
  'simplicity',
  'clarity',
  'legibility',
  'craft',
]

export const REQUIRED_REVIEW_CHECKS = [
  'facts',
  'structure',
  'duration',
  'visual_feasibility',
  ...DESIGN_QUALITY_CHECKS,
  'privacy',
  'copyright',
]

export const REQUIRED_RENDER_REVIEW_CHECKS = [
  ...DESIGN_QUALITY_CHECKS,
  'audio_consistency',
  'end_card',
]

const REVIEW_STATES = new Set(['pass', 'fix', 'block'])

function aggregateReviewStatus(checks, required) {
  const states = required.map((name) => checks[name].status)
  return states.includes('block') ? 'block' : states.includes('fix') ? 'fix' : 'pass'
}

function validateRequiredChecks(checks, required, label = 'review check') {
  for (const name of required) {
    if (!REVIEW_STATES.has(checks[name]?.status)) {
      throw new Error(`${label} ${name} must be pass, fix, or block`)
    }
  }
}

export function evaluateDoctor(observations) {
  const required = ['node', 'python', 'ffmpeg', 'ffprobe', 'remotion', 'outputWritable']
  const actions = []
  for (const name of required) {
    if (observations[name]?.ok) continue
    if (name === 'node') actions.push('Install Node.js 20 or newer, then rerun doctor.')
    else if (name === 'python') actions.push('Install Python 3.10 or newer, then rerun doctor.')
    else if (name === 'ffmpeg' || name === 'ffprobe') actions.push('Install ffmpeg so both ffmpeg and ffprobe are available.')
    else if (name === 'remotion') actions.push('Run npm install inside remotion/, then rerun doctor.')
    else actions.push('Choose a writable output directory.')
  }

  let ttsMode = 'unavailable'
  const warnings = []
  if (observations.fishAudio?.ok) ttsMode = 'fish-audio'
  else if (observations.platform === 'darwin' && observations.say?.ok) {
    ttsMode = 'say-demo'
    warnings.push('macOS say is a demo-quality fallback, not publication-quality narration.')
  } else {
    actions.push('Set Fish Audio credentials, or run the demo on macOS with the built-in say command.')
  }

  return {
    ok: actions.length === 0,
    ttsMode,
    actions: [...new Set(actions)],
    warnings,
    observations,
  }
}

function commandVersion(command, args, minimum = [0, 0]) {
  const result = spawnSync(command, args, { encoding: 'utf8', shell: false })
  const output = `${result.stdout || ''}\n${result.stderr || ''}`.trim()
  const match = output.match(/(\d+)\.(\d+)(?:\.(\d+))?/)
  const version = match ? match[0] : output.split('\n')[0] || ''
  const major = match ? Number(match[1]) : 0
  const minor = match ? Number(match[2]) : 0
  const meetsMinimum = major > minimum[0] || (major === minimum[0] && minor >= minimum[1])
  return { ok: !result.error && result.status === 0 && meetsMinimum, version }
}

export async function collectDoctorObservations(outputDir = resolve(KIT_ROOT, 'out')) {
  const outputPath = resolve(outputDir)
  let outputWritable = true
  let writableProbe = outputPath
  while (true) {
    try {
      const info = await stat(writableProbe)
      if (!info.isDirectory()) outputWritable = false
      else await access(writableProbe, constants.W_OK)
      break
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        outputWritable = false
        break
      }
      const parent = dirname(writableProbe)
      if (parent === writableProbe) {
        outputWritable = false
        break
      }
      writableProbe = parent
    }
  }

  let remotionVersion = ''
  const remotionBinary = resolve(KIT_ROOT, 'remotion/node_modules/.bin/remotion')
  try {
    const pkg = JSON.parse(await readFile(resolve(KIT_ROOT, 'remotion/package.json'), 'utf8'))
    remotionVersion = pkg.dependencies?.remotion || pkg.version || ''
  } catch {
    // The actionable result below remains remotion=false.
  }

  return {
    platform: process.platform,
    node: commandVersion(process.execPath, ['--version'], [20, 0]),
    python: commandVersion('python3', ['--version'], [3, 10]),
    ffmpeg: commandVersion('ffmpeg', ['-version']),
    ffprobe: commandVersion('ffprobe', ['-version']),
    remotion: { ok: existsSync(remotionBinary), version: remotionVersion },
    say: { ok: process.platform === 'darwin' && existsSync('/usr/bin/say'), version: 'macOS built-in' },
    fishAudio: {
      ok: Boolean(process.env.FISH_AUDIO_API_KEY && process.env.FISH_AUDIO_VOICE_ID),
      version: process.env.FISH_AUDIO_API_KEY && process.env.FISH_AUDIO_VOICE_ID ? 'configured' : '',
    },
    outputWritable: { ok: outputWritable, version: outputWritable ? outputPath : '' },
  }
}

async function fileDigest(path) {
  const body = await readFile(path)
  return createHash('sha256').update(body).digest('hex')
}

async function scriptDigest(projectDir) {
  return fileDigest(resolve(projectDir, 'script.json'))
}

export async function createReviewReceipt(projectDir, review) {
  const author = String(review?.author || '').trim()
  const reviewer = String(review?.reviewer || '').trim()
  if (!author || !reviewer || author === reviewer) {
    throw new Error('review requires an independent reviewer distinct from the script author')
  }

  const checks = review?.checks || {}
  validateRequiredChecks(checks, REQUIRED_REVIEW_CHECKS)

  return {
    schema: 'video-explainer-review/v2',
    created_at: new Date().toISOString(),
    script_sha256: await scriptDigest(projectDir),
    author,
    reviewer,
    status: aggregateReviewStatus(checks, REQUIRED_REVIEW_CHECKS),
    checks,
  }
}

export async function validateReviewReceipt(projectDir, receipt) {
  if (!receipt || receipt.schema !== 'video-explainer-review/v2') {
    return { ok: false, reason: 'review receipt missing or unsupported; rerun the current eleven-check review' }
  }
  if (!receipt.author || !receipt.reviewer || receipt.author === receipt.reviewer) {
    return { ok: false, reason: 'review receipt has no independent reviewer' }
  }
  for (const name of REQUIRED_REVIEW_CHECKS) {
    if (!REVIEW_STATES.has(receipt.checks?.[name]?.status)) {
      return { ok: false, reason: `review receipt is missing ${name}` }
    }
  }
  if (receipt.status !== 'pass') {
    return { ok: false, reason: `review status is ${receipt.status}; fix or block cannot render` }
  }
  if (receipt.script_sha256 !== await scriptDigest(projectDir)) {
    return { ok: false, reason: 'script changed after review' }
  }
  return { ok: true, reason: 'current eleven-check pass receipt' }
}

export async function createRenderedReviewReceipt(videoPath, review) {
  const producer = String(review?.producer || '').trim()
  const reviewer = String(review?.reviewer || '').trim()
  if (!producer || !reviewer || producer === reviewer) {
    throw new Error('rendered-output review requires an independent reviewer distinct from the video producer')
  }

  const checks = review?.checks || {}
  validateRequiredChecks(checks, REQUIRED_RENDER_REVIEW_CHECKS, 'rendered-output check')

  return {
    schema: 'video-explainer-render-review/v1',
    created_at: new Date().toISOString(),
    video_sha256: await fileDigest(resolve(videoPath)),
    producer,
    reviewer,
    status: aggregateReviewStatus(checks, REQUIRED_RENDER_REVIEW_CHECKS),
    checks,
  }
}

export async function validateRenderedReviewReceipt(videoPath, receipt) {
  if (!receipt || receipt.schema !== 'video-explainer-render-review/v1') {
    return { ok: false, reason: 'rendered-output review receipt missing or unsupported' }
  }
  if (!receipt.producer || !receipt.reviewer || receipt.producer === receipt.reviewer) {
    return { ok: false, reason: 'rendered-output review has no independent reviewer' }
  }
  for (const name of REQUIRED_RENDER_REVIEW_CHECKS) {
    if (!REVIEW_STATES.has(receipt.checks?.[name]?.status)) {
      return { ok: false, reason: `rendered-output review is missing ${name}` }
    }
  }
  if (receipt.status !== 'pass') {
    return { ok: false, reason: `rendered-output review status is ${receipt.status}` }
  }
  if (receipt.video_sha256 !== await fileDigest(resolve(videoPath))) {
    return { ok: false, reason: 'video changed after rendered-output review' }
  }
  return { ok: true, reason: 'current rendered-output pass receipt' }
}

export async function runGuardedRender(projectDir, options = {}) {
  const receiptPath = resolve(projectDir, 'review-result.json')
  let receipt
  try {
    receipt = JSON.parse(await readFile(receiptPath, 'utf8'))
  } catch {
    throw new Error('cannot render: review-result.json is missing or invalid')
  }
  const gate = await validateReviewReceipt(projectDir, receipt)
  if (!gate.ok) throw new Error(`cannot render: ${gate.reason}`)

  const renderScript = resolve(options.renderScript || resolve(KIT_ROOT, 'scripts/render.sh'))
  const env = { ...process.env, ...(options.env || {}) }
  if (options.demoQuality) {
    env.TTS_BACKEND = 'fish'
    env.FISH_AUDIO_API_KEY = ''
    env.FISH_AUDIO_VOICE_ID = ''
    env.VIDEO_EXPLAINER_ALIGN_MODE = 'script'
  }

  await new Promise((resolveRun, rejectRun) => {
    const child = spawn('bash', [renderScript, resolve(projectDir)], {
      cwd: KIT_ROOT,
      env,
      stdio: options.quiet ? 'pipe' : 'inherit',
      shell: false,
    })
    let stderr = ''
    if (options.quiet) child.stderr?.on('data', (chunk) => { stderr += chunk.toString() })
    child.on('error', rejectRun)
    child.on('close', (code) => {
      if (code === 0) resolveRun()
      else rejectRun(new Error(`render failed with exit ${code}${stderr ? `: ${stderr.trim()}` : ''}`))
    })
  })
}

export async function prepareDemoProject(outputDir, options = {}) {
  const target = resolve(outputDir)
  try {
    await access(target)
    throw new Error(`demo output already exists: ${target}`)
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  const source = resolve(options.sourceDir || resolve(KIT_ROOT, 'examples/video-explainer-demo'))
  await mkdir(target, { recursive: true })
  for (const name of ['brief.md', 'script.json', 'review-input.json']) {
    await copyFile(resolve(source, name), resolve(target, name))
  }
  return target
}

function optionValue(args, name) {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

async function cli(args) {
  const [command, projectArg] = args
  if (command === 'doctor') {
    const observations = await collectDoctorObservations(optionValue(args, '--output'))
    const report = evaluateDoctor(observations)
    if (args.includes('--json')) console.log(JSON.stringify(report, null, 2))
    else {
      console.log(`doctor: ${report.ok ? 'PASS' : 'BLOCKED'}`)
      console.log(`tts: ${report.ttsMode}`)
      for (const warning of report.warnings) console.log(`warning: ${warning}`)
      for (const action of report.actions) console.log(`action: ${action}`)
    }
    if (!report.ok) process.exitCode = 1
    return
  }

  if (command === 'review') {
    if (!projectArg) throw new Error('usage: video-explainer review <project> --input <review-input.json>')
    const inputPath = optionValue(args, '--input') || resolve(projectArg, 'review-input.json')
    const review = JSON.parse(await readFile(resolve(inputPath), 'utf8'))
    const receipt = await createReviewReceipt(projectArg, review)
    const receiptPath = resolve(projectArg, 'review-result.json')
    await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)
    console.log(`review gate: ${receipt.status}`)
    console.log(`receipt: ${receiptPath}`)
    if (receipt.status !== 'pass') process.exitCode = 2
    return
  }

  if (command === 'render') {
    if (!projectArg) throw new Error('usage: video-explainer render <project> [--demo-quality] [--dry-run]')
    const receipt = JSON.parse(await readFile(resolve(projectArg, 'review-result.json'), 'utf8'))
    const gate = await validateReviewReceipt(projectArg, receipt)
    if (!gate.ok) throw new Error(`cannot render: ${gate.reason}`)
    console.log('review gate: pass')
    if (args.includes('--dry-run')) {
      console.log('dry run: render not launched')
      return
    }
    await runGuardedRender(projectArg, { demoQuality: args.includes('--demo-quality') })
    return
  }

  if (command === 'review-render') {
    if (!projectArg) throw new Error('usage: video-explainer review-render <video.mp4> --input <render-review-input.json> [--output <receipt.json>]')
    const inputPath = optionValue(args, '--input')
    if (!inputPath) throw new Error('review-render requires --input <render-review-input.json>')
    const review = JSON.parse(await readFile(resolve(inputPath), 'utf8'))
    const receipt = await createRenderedReviewReceipt(projectArg, review)
    const receiptPath = resolve(optionValue(args, '--output') || resolve(dirname(resolve(projectArg)), 'render-review-result.json'))
    await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)
    console.log(`rendered-output review gate: ${receipt.status}`)
    console.log(`receipt: ${receiptPath}`)
    if (receipt.status !== 'pass') process.exitCode = 2
    return
  }

  if (command === 'demo') {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const output = resolve(optionValue(args, '--output') || resolve(KIT_ROOT, `out/video-explainer-demo-${stamp}`))
    const prepareOnly = args.includes('--prepare-only')
    const doctor = prepareOnly
      ? null
      : evaluateDoctor(await collectDoctorObservations(output))
    if (doctor && !doctor.ok) throw new Error(`demo doctor blocked: ${doctor.actions.join(' ')}`)

    await prepareDemoProject(output)

    const review = JSON.parse(await readFile(resolve(output, 'review-input.json'), 'utf8'))
    const receipt = await createReviewReceipt(output, review)
    await writeFile(resolve(output, 'review-result.json'), `${JSON.stringify(receipt, null, 2)}\n`)
    console.log(`demo project: ${output}`)
    console.log(`review gate: ${receipt.status}`)
    if (receipt.status !== 'pass') throw new Error('canonical demo review did not pass')
    if (prepareOnly) {
      console.log('prepare only: render not launched')
      return
    }

    await runGuardedRender(output, { demoQuality: true })
    const video = resolve(output, 'out/full.mp4')
    const verification = await runVerification(video, resolve(output, 'metadata.json'))
    const resultPath = resolve(output, 'video-explainer-result.json')
    await writeFile(resultPath, `${JSON.stringify({
      schema: 'video-explainer-result/v1',
      created_at: new Date().toISOString(),
      demo_quality_voice: doctor?.ttsMode === 'say-demo',
      review_status: receipt.status,
      rendered_output_review_status: 'not_run_demo_only',
      script_sha256: receipt.script_sha256,
      video,
      verification: verification.trim(),
    }, null, 2)}\n`)
    console.log(verification.trim())
    console.log('rendered-output review: NOT RUN (demo-only result; not publication-quality acceptance)')
    console.log(`result: ${resultPath}`)
    return
  }

  throw new Error('usage: video-explainer <doctor|review|render|review-render|demo> ...')
}

async function runVerification(videoPath, metadataPath) {
  return await new Promise((resolveRun, rejectRun) => {
    const args = [resolve(KIT_ROOT, 'scripts/verify-shorts.mjs'), videoPath]
    if (metadataPath) args.push('--metadata', metadataPath)
    const child = spawn(process.execPath, args, {
      cwd: KIT_ROOT,
      stdio: 'pipe',
      shell: false,
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    child.on('error', rejectRun)
    child.on('close', (code) => {
      if (code === 0) resolveRun(stdout)
      else rejectRun(new Error(`video verification failed with exit ${code}: ${(stderr || stdout).trim()}`))
    })
  })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  cli(process.argv.slice(2)).catch((error) => {
    console.error(error?.message || error)
    process.exitCode = 1
  })
}
