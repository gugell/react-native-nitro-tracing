# Contributing

Use Node.js 24 (see `.node-version`) and the pnpm version pinned in `package.json`.

```sh
pnpm install
pnpm check        # build, typecheck, JS/native/Sentry tests, prettier, clang-format, release script
pnpm pack:check   # what a consumer installs
pnpm example ios  # or android: a development build of apps/example
```

- **Specs first.** Native API changes start in `src/specs/*.nitro.ts`. Run `pnpm codegen` and commit the generated bindings in `nitrogen/`; CI fails if they drift.
- **Keep C++ formatted.** `pnpm format:native:check` uses `.clang-format`. Apply fixes with `clang-format -i` (Xcode's copy via `xcrun clang-format` on macOS).
- **Test what changed.** JS tests live next to the code (`*.test.ts`). Recorder, export and sampler behavior goes in `tests/RecorderTest.cpp` (`pnpm test:native`). A test should fail without the change.
- **Verify native changes on devices.** Anything that touches `cpp/`, `ios/` or `android/` needs a native rebuild. Say what you ran it on, and record unavailable tooling explicitly.
- **Keep entry points independent.** The root, `/client` and `/plugins` must not import UI or optional SDKs. Optional peers are required inside `try` so Metro treats them as optional.

Use [conventional commit](https://www.conventionalcommits.org) messages (`feat(inspector): …`, `fix(native): …`); the changelog is generated from them (see [releasing](docs/releasing.md)). Keep implementation, tests and docs together in a focused pull request, and describe the user-visible problem, the behavior after the change, what you verified and what remains.

Never commit credentials, and never publish as part of an ordinary contribution. Issues and pull requests: <https://github.com/gugell/react-native-nitro-tracing>.
