# Reference investigation

## Optic

Reviewed [the requested Optic revision](https://github.com/adnxy/optic-react-native/tree/e445c8f77b4c22370ed03a20e84213ce9cf08344). Its local debug UI is useful inspiration. Name-keyed JS spans, wall-clock timing and fetch response inspection are poor foundations for concurrent performance measurement. This implementation uses independent native span handles, a monotonic recording clock and explicit instrumentation.

## Sentry

Reviewed the official [React Native sample](https://github.com/getsentry/sentry-react-native/tree/main/samples/react-native), including performance screens and end-to-end harness patterns. It exercises SDK features; it is not an embedded Sentry web trace explorer. The inspector uses similar reproducible scenarios, with its own overview, waterfall, metrics and detail UI.

Sentry can provide observable JS spans through public client hooks and accept explicitly exported native spans. Its SDK remains optional and app-owned. Native-only telemetry and server processing do not automatically become available through JS span hooks. Profiles remain separate artifacts.

## Margelo release profiler

[react-native-release-profiler](https://github.com/margelo/react-native-release-profiler) supplies manual Hermes sampling and a local profile file. The package's adapter wraps its lifetime and supports OS file sharing. Symbolication and rich CPU analysis remain external.

## Applied skills

- [Margelo build-nitro-modules](https://github.com/margelo/react-native-skills/tree/main/skills/build-nitro-modules): native state/lifetimes, generated specs, separate entry points, example and publication contents.
- [Sentry React Native SDK](https://github.com/getsentry/sentry-for-ai/blob/main/skills-legacy/sentry-react-native-sdk/SKILL.md): public tracing APIs, app-owned initialization and native-build validation. Broad app monitoring/replay defaults do not apply to this optional library plugin.

Nitro runtime and Nitrogen latest registry versions checked: 0.37.1. Sentry integration types checked against 8.27.0. Reference review does not establish device performance or full Sentry feature parity.
