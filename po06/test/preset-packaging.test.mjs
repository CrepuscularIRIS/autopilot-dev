import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')

test('the Wish bundle attaches globally and declares no replacement agent preset', () => {
  const patch = read('../cordis.patch.yml')
  assert.match(patch, /^- insert:\s*\n    - id: dsh-wish-specializer\s*\n      name: '@dsh-external\/dsh-wish-specializer'/m)
  assert.doesNotMatch(patch, /preset-wish|preset-ptc|preset-standard/)
  assert.equal((patch.match(/@deepseek-ai\/dsh-agent-preset/g) || []).length, 0)
})

test('both install entries publish the playbooks and keep the existing check export', () => {
  for (const [manifest, dir] of [['../../package.json', 'po06/'], ['../package.json', '']]) {
    const pkg = JSON.parse(read(manifest))
    assert.ok(pkg.files.includes(dir + 'playbooks'))
    assert.ok(!pkg.files.includes(dir + 'research'))
    assert.ok(!pkg.files.includes(dir + 'presets'))
    assert.equal(pkg.exports['./check'].default, './' + dir + 'lib/wish-check.js')
  }
})
