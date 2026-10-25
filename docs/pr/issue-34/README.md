# Issue #34: native screenshots

Captured from implementation commit `f15a31f5179a9b030c534298696a693d54c6ccb3` using a Tauri CLI packaged macOS debug app, a separate test app identifier and a temporary library. The library contains a synthetic one-second WAV and test lyrics. These images demonstrate the actual native UI, without model downloads/inference or release signing/App Sandbox entitlements.

- `settings.png`: localized Settings heading, CPU-only selection and immediate-save confirmation. No Save click was used for the device change.
- `export-dialog.png`: native WAV save dialog opens in the remembered `exports` test directory, shared with lyrics and ZIP exports.

See [the verification record](../../verification.md) for the full test coverage and acceptance limitations.
