import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

function runPython(args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn('python3', args, { ...options, shell: false })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    child.on('close', (code) => resolve({ code, stdout, stderr }))
  })
}

function scene(id, overrides = {}) {
  return {
    id,
    duration_hint_s: 5,
    information_purpose: `Explain information change ${id}`,
    visual_metaphor: 'A timeline where evidence converges into a decision gate.',
    motion_grammar: ['timeline', 'flow', 'threshold'],
    why_motion_beats_card: 'The changing distance and flow make the causal sequence visible instead of merely listing it.',
    three_d: { used: false, reason: 'The relationship is two-dimensional and does not need depth.' },
    ...overrides,
  }
}

async function writeStoryboard(project, scenes) {
  await writeFile(join(project, 'motion-storyboard.json'), JSON.stringify({
    schema: 'motion-storyboard/v1',
    title: 'Gate fixture',
    scenes,
  }))
}

test('motion storyboard checker accepts information-first motion planning', async () => {
  const project = await mkdtemp(join(tmpdir(), 'storyboard-pass-'))
  await writeStoryboard(project, [scene('S01'), scene('S02'), scene('S03'), scene('S04')])
  const result = await runPython(['scripts/check_storyboard.py', project], { cwd: process.cwd() })
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /MOTION STORYBOARD PASS/)
})

test('motion storyboard checker blocks card-stack-by-default planning', async () => {
  const project = await mkdtemp(join(tmpdir(), 'storyboard-card-'))
  await writeStoryboard(project, [
    scene('S01', { visual_metaphor: 'Text card with a bullet list.' }),
    scene('S02', { visual_metaphor: 'Another card stack for the next point.' }),
    scene('S03'),
    scene('S04'),
  ])
  const result = await runPython(['scripts/check_storyboard.py', project], { cwd: process.cwd() })
  assert.equal(result.code, 2)
  assert.match(result.stderr, /card\/list-like/i)
})

test('motion storyboard checker blocks generic entrance motion posing as explanation', async () => {
  const project = await mkdtemp(join(tmpdir(), 'storyboard-generic-'))
  await writeStoryboard(project, [
    scene('S01', { motion_grammar: ['fade', 'slide'] }),
    scene('S02', { motion_grammar: ['fade', 'zoom'] }),
    scene('S03'),
    scene('S04'),
  ])
  const result = await runPython(['scripts/check_storyboard.py', project], { cwd: process.cwd() })
  assert.equal(result.code, 2)
  assert.match(result.stderr, /generic entrance\/exit motion/i)
})

test('motion storyboard checker requires a concrete ROI reason for 3D', async () => {
  const project = await mkdtemp(join(tmpdir(), 'storyboard-3d-'))
  await writeStoryboard(project, [
    scene('S01', { three_d: { used: true, reason: 'Looks premium.' } }),
    scene('S02'),
    scene('S03'),
  ])
  const result = await runPython(['scripts/check_storyboard.py', project], { cwd: process.cwd() })
  assert.equal(result.code, 2)
  assert.match(result.stderr, /3D without a specific ROI reason/i)
})

test('production render requires storyboard while demo-quality path may omit it', async () => {
  const source = await readFile(join(process.cwd(), 'scripts/render.sh'), 'utf8')
  assert.match(source, /motion-storyboard\.json missing — production render requires motion-first preproduction/)
  assert.match(source, /allowed only on demo-quality script-alignment path/)
  assert.match(source, /check_storyboard\.py/)
})
