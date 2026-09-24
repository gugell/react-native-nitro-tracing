# Releasing

The npm package is `react-native-nitro-tracing`. The workspace root and `apps/example` are private. Releases follow the same setup as [expo-native-config](https://github.com/gugell/expo-native-config): release-it, a conventional changelog, and npm trusted publishing from GitHub Actions.

## Before a release

```sh
pnpm install --frozen-lockfile
pnpm codegen:check   # committed Nitro bindings match the specs
pnpm check           # build, typecheck, JS/native/Sentry tests, prettier, clang-format, release script
pnpm pack:check      # install the packed tarball into a fresh npm project and check what shipped
pnpm release:dry-run # offline rehearsal: next version, changelog, tag
```

Native behavior needs devices. Build the example (`pnpm example ios` / `android`) or a host app from the packed tarball, and record what you verified in [status](status.md).

## Commit messages

The changelog is generated from [conventional commits](https://www.conventionalcommits.org):

| Type                         | Changelog section | Bump                    |
| ---------------------------- | ----------------- | ----------------------- |
| `feat`                       | Features          | minor                   |
| `fix`                        | Bug Fixes         | patch                   |
| `perf`                       | Performance       | patch                   |
| `docs`                       | Documentation     | —                       |
| `chore(deps)`                | Dependencies      | —                       |
| `feat!` / `BREAKING CHANGE:` | Features, flagged | major (minor while 0.x) |

Scopes are optional, and the changelog groups by them: `native`, `client`, `plugins`, `inspector`, `example`. Commits of other types (`build`, `test`, `chore`) are released but not listed.

Merge pull requests with **Rebase and merge**, so each conventional commit reaches `main`. A squash merge leaves one commit whose subject is the PR title. If you squash, give the PR a conventional title (`feat: …`), and accept that the changelog shows one line for the whole PR.

## How `pnpm release` works

`scripts/release.sh` resolves **one** version from the conventional commits, or from an explicit increment, and runs release-it in two passes with it:

1. **Package pass** (`packages/react-native-nitro-tracing`). Its own `release-it` block publishes to npm only; git and GitHub are disabled.
   - `before:init` runs `pnpm check`.
   - `after:bump` runs `scripts/pack-check.mjs --release`, which builds, packs and verifies `artifacts/release/react-native-nitro-tracing.tgz`. That exact file is what gets published.
2. **Root pass.** npm publishing is disabled. `@release-it/bumper` writes the version into the package manifest, and `@release-it/conventional-changelog` prepends the release to the package's `CHANGELOG.md`. Then one commit (`chore: release vX.Y.Z`), one tag (`vX.Y.Z`) and one GitHub release are created.

The root pass allows a dirty working directory on purpose: the package pass has already bumped its manifest. `scripts/check-release-script.sh` (part of `pnpm check`) runs `release.sh` against a stubbed `pnpm` on the real, dry-run, explicit-increment and prerelease paths. It exists because macOS bash 3.2 treats an empty array as unbound under `set -u`, so a dry run alone cannot prove the real path works.

The script reads `GITHUB_TOKEN`, then `GH_TOKEN`, then `gh auth token`, and stops with instructions if it finds none. `pnpm release:dry-run` needs no token and contacts nothing.

## From GitHub Actions

**Actions → Release → Run workflow** on `main`:

| Input        | Options                                      | Meaning                                                                                 |
| ------------ | -------------------------------------------- | --------------------------------------------------------------------------------------- |
| `increment`  | `auto`, `patch`, `minor`, `major`, `initial` | `auto` lets the commits decide; `initial` publishes the version already in the manifest |
| `prerelease` | `none`, `alpha`, `beta`, `rc`                | Publishes `X.Y.Z-<id>.N` under that dist-tag instead of `latest`                        |

The workflow checks out `main` with full history, runs `pnpm codegen:check && pnpm check` and `pnpm pack:check`, then `pnpm release … --ci`. It runs in the `npm` environment, and one release can run at a time.

## Prerelease channels

```sh
pnpm release:dry-run --preRelease=alpha
pnpm release --preRelease=alpha
```

The prerelease reaches both passes, so the registry and the tag agree:

- It publishes under the `alpha` dist-tag; `npm install react-native-nitro-tracing` still resolves `latest`.
- Re-running advances `alpha.0` → `alpha.1`.
- The GitHub release is marked as a prerelease.

Graduate with an ordinary `pnpm release`. Do not pass a positional increment with `--preRelease` unless you mean to pin it.

## First publication

0.6.0 was published on 2026-09-24 with `pnpm release --no-increment`, keeping its hand-written changelog: the history before it was not in conventional commits. On that path, `release.sh` skips the generated changelog and takes the GitHub release notes from the version's `CHANGELOG.md` section (`scripts/release-notes.mjs`).

The root pass commits only files release-it changed (`addUntrackedFiles: false`). Untracked local files never enter a release commit.

Trusted publishing is configured once, now that the package exists:

1. **Create the GitHub environment** named exactly `npm` (Settings → Environments). Add required reviewers if you want a human gate.
2. **Configure the trusted publisher** on the package's **Settings** tab at `https://www.npmjs.com/package/react-native-nitro-tracing` → Trusted Publisher → GitHub Actions. Enter the user `gugell`, the repository `react-native-nitro-tracing`, the workflow filename `release.yml` and the environment `npm`. npm does not validate these; a typo shows up only as a failed publish.
3. **Lock it down**: under Publishing access, choose "Require two-factor authentication and disallow tokens". From then on, OIDC is the only way to publish.

The workflow already has `id-token: write`, installs npm 11 (trusted publishing needs npm ≥ 11.5.1), and uses `environment: npm`. Never store npm or GitHub tokens in the repository.

If a publish fails with `npm error need auth`, the trusted publisher is not configured or does not match the repository, workflow or environment. If a release publishes without a provenance badge, check that `repository.url` is exactly `git+https://github.com/gugell/react-native-nitro-tracing.git`, or add `--provenance` to `publishArgs`.

## After publishing

Install the published version into a fresh Expo app and build it on a device. Check that the registry tarball and the tag point at the release commit, and add the verification to the GitHub release notes.
