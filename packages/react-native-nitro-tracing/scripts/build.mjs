import { build } from 'esbuild'
import { rm } from 'node:fs/promises'
await rm('lib', { recursive: true, force: true })
const entryPoints = {
  index: 'src/index.ts',
  ...Object.fromEntries(
    [
      'client',
      'react',
      'expo',
      'plugins',
      'performance',
      'sentry',
      'release-profiler',
    ].map((name) => [name, `${name}.ts`])
  ),
}
for (const [format, folder, extension] of [
  ['esm', 'module', '.mjs'],
  ['cjs', 'commonjs', '.cjs'],
]) {
  await build({
    entryPoints,
    bundle: true,
    packages: 'external',
    platform: 'neutral',
    format,
    target: 'es2020',
    outdir: `lib/${folder}`,
    outExtension: { '.js': extension },
    sourcemap: true,
  })
}
