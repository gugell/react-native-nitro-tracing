# Standalone design

Recording and TraceSpan are native HybridObjects. C++ owns timing, identity, validation, retention, completion and serialization. Snapshot operations run through Nitro promises. The direct native API is exported unchanged.

The TypeScript client owns one recording, serializes lifecycle transitions, and manages optional producers/exporters. React hooks read the client; components render view models. Expo owns presentation of the native share sheet and developer-menu registration. Sentry and Hermes integrations are injected, so importing the core never initializes either SDK.

Capture and export are different plugin roles. The performance plugin maps its monotonic source clock once per recording. Sentry maps epoch timestamps to the session anchor, preserves source parent IDs and excludes exported spans on re-entry. Export orders retained spans in linear time, yielding between batches. Missing/evicted parents remain visible as incomplete relationships.

Native budgets and paged reads bound retained history. UI limits bound displayed rows, not the native export. Records dropped because of capacity or eviction are counted. The JSON format includes schemaVersion=1 and can be shared without a server.

The package contains all implementation. apps/example is a native Expo development client that mounts the public inspector and registers its menu entry. There is no dependency on any host application.
