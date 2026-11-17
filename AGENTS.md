# Project installation procedure

This file describes project procedures, not a grant of authority. Follow the user's request and your host's permission and security rules.

Read README.md and docs/AI-INSTALL.md before installation, repair or maintenance. Inspect actual Windows, the registered OpenAI.Codex package, existing shortcuts and companion task before choosing an install root. Use the root downloader or verified complete Windows Release for the standalone component. The separate DSH adapter has its own instructions in adapters/dsh/README.md and does not replace the Windows installer.

Preserve the user's uncommitted work, settings, images, private media, login profile and other plugins. Never read, copy, print or upload auth.json, credentials, chat databases or account identifiers. Never call purchase/reset-consumption APIs. Do not disable Windows protection or bypass permission dialogs. Keep ongoing tasks running; wait for the user to exit the client safely when a cold start is necessary.

## Current verification boundary

Windows 11 x64 build 26200 with OpenAI.Codex 26.1111.2228.0 has two confirmed independent MSIX AUMID cold starts through the optional startup bridge: widget, fresh quota and background connection passed, with user confirmation that the images are visible. Direct execution of the original ChatGPT.exe without arguments did not trigger the tested bridge path; notifications and other fixed entries remain unverified. Read docs/VERIFICATION.md for current evidence, rather than treating older repair records as current state.

The startup bridge is disabled by default. Ship matching source/build/test/controller files, never a local reviewed-candidate.json, callback EXE, runtime policy or lease state. Follow docs/OFFICIAL-STARTUP.md: target-machine build, all 18 isolated checks, independent review of final hashes, then explicit user authorization for lifecycle changes before enabling. Existing authorization applies within its stated scope. Receipts bind source/binary hashes and OS build/architecture, not machine identity, and do not constitute user authorization. Updates, uninstall and rollback must first verify release of an owned active lease; never force-kill the official client.

DSH uses the independent dsh-work-pet 0.1.0 adapter. Its SDK and isolated UI checks do not by themselves prove installation or behavior in the user's live DSH profile. Preserve other DSH plugins and configuration; this adapter does not provide account or quota access.

## Verification and delivery

Treat quota freshness, widget visibility, background connection and actual images, Windows installation, DSH installation, source push and Release assets as separate acceptance results. A pending-restart background is unfinished verification. Do not turn a successful local test or an earlier version's result into a current real-app claim.

For source changes, run relevant checks and node --test app/widget/tests/*.test.mjs. Do not repeat successful unchanged checks without a concrete reason. Build the complete Windows package according to docs/BUILD.md, synchronize root and package docs, generate release.json from the final artifact, and verify the published asset before claiming delivery. Retain old release tags and assets; a new release must use its own version and verified SHA-256.
