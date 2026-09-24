import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Prints one version's section of the package changelog, for a GitHub release
// whose changelog was written by hand (the initial release; see release.sh).
const version = process.argv[2]
if (!version) {
  console.error('usage: node scripts/release-notes.mjs <version>')
  process.exit(1)
}
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const changelog = readFileSync(
  join(root, 'packages/react-native-nitro-tracing/CHANGELOG.md'),
  'utf8'
)
const heading = new RegExp(`^## ${version.replaceAll('.', '\\.')}(\\s|$)`, 'm')
const start = changelog.search(heading)
if (start < 0) {
  console.error(`CHANGELOG.md has no section for ${version}`)
  process.exit(1)
}
const rest = changelog.slice(start)
const next = rest.slice(1).search(/^## /m)
const section = next < 0 ? rest : rest.slice(0, next + 1)
// Drop the heading: GitHub shows the release name above the notes.
console.log(section.replace(/^## .*\n+/, '').trimEnd())
