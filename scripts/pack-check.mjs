import assert from 'node:assert/strict'
import spawn from 'cross-spawn'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Packs the library exactly as npm will publish it, installs the tarball into a
// fresh npm project and checks what a consumer receives. With --release the
// tarball is kept at artifacts/release/react-native-nitro-tracing.tgz, the path
// release-it publishes.
const name = 'react-native-nitro-tracing'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packageRoot = join(root, 'packages', name)
const release = process.argv.includes('--release')
const temporary = mkdtempSync(join(tmpdir(), `${name}-pack-`))
const destination = release
  ? join(root, 'artifacts/release')
  : join(temporary, 'tarballs')
mkdirSync(destination, { recursive: true })

function run(command, args, cwd) {
  const result = spawn.sync(command, args, { cwd, stdio: 'inherit' })
  if (result.error) throw result.error
  assert.equal(result.status, 0, `${command} ${args.join(' ')} failed`)
}

try {
  const version = JSON.parse(
    readFileSync(join(packageRoot, 'package.json'), 'utf8')
  ).version
  // pnpm pack runs prepack (nitrogen + build) and rewrites workspace: specs.
  run('pnpm', ['pack', '--pack-destination', destination], packageRoot)
  let tarball = join(destination, `${name}-${version}.tgz`)
  if (release) {
    const stable = join(destination, `${name}.tgz`)
    rmSync(stable, { force: true })
    renameSync(tarball, stable)
    tarball = stable
  }

  const consumer = join(temporary, 'consumer')
  mkdirSync(consumer)
  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify({ name: 'packed-consumer', private: true, version: '1.0.0' })
  )
  // --legacy-peer-deps: the check is about this tarball, not about installing
  // React Native. A consumer app provides the peers.
  run(
    'npm',
    [
      'install',
      '--ignore-scripts',
      '--legacy-peer-deps',
      '--no-audit',
      '--no-fund',
      '--package-lock=false',
      tarball,
    ],
    consumer
  )
  const installed = join(consumer, 'node_modules', name)
  const manifest = JSON.parse(
    readFileSync(join(installed, 'package.json'), 'utf8')
  )
  assert.equal(manifest.version, version)
  assert.equal(manifest.private, undefined)
  for (const field of ['repository', 'bugs', 'homepage', 'license']) {
    assert.ok(manifest[field], `missing ${field}`)
  }
  for (const section of [
    'dependencies',
    'optionalDependencies',
    'peerDependencies',
  ]) {
    for (const spec of Object.values(manifest[section] ?? {})) {
      assert.doesNotMatch(
        spec,
        /^(catalog|workspace|link|file):/,
        `Unresolved ${section} dependency`
      )
    }
  }

  // Every export condition must point at a file that shipped.
  for (const [entry, conditions] of Object.entries(manifest.exports)) {
    const targets =
      typeof conditions === 'string' ? [conditions] : Object.values(conditions)
    for (const target of targets) {
      assert.ok(
        existsSync(join(installed, target)),
        `${entry} → ${target} is missing from the tarball`
      )
    }
  }

  // Native sources and generated glue are compiled by the consumer's build.
  for (const file of [
    'NitroTracing.podspec',
    'nitro.json',
    'react-native.config.js',
    'android/build.gradle',
    'android/CMakeLists.txt',
    'android/proguard-rules.pro',
    'android/src/main/cpp/cpp-adapter.cpp',
    'ios/NitroTracingFrameSource.mm',
    'cpp/core/Recorder.cpp',
    'cpp/core/NativeSampler.cpp',
    'cpp/core/TraceJson.cpp',
    'nitrogen/generated/shared/c++/HybridRecordingSpec.hpp',
    'README.md',
    'LICENSE',
    'CHANGELOG.md',
  ]) {
    assert.ok(existsSync(join(installed, file)), `${file} was not published`)
  }
  for (const unwanted of [
    'tests',
    'scripts',
    'node_modules',
    'jest.config.js',
    'src/react/topics.test.ts',
    'android/build',
    'android/.cxx',
  ]) {
    assert.ok(
      !existsSync(join(installed, unwanted)),
      `${unwanted} should not be published`
    )
  }
  console.log(`Packed npm consumer verified: ${name}@${version}`)
} finally {
  rmSync(temporary, { recursive: true, force: true })
}
