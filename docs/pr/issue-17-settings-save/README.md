# Settings save UI evidence for issue #17

These screenshots show the implemented HTML, CSS, studio code and settings dialog controller rendered in the in-app browser. A temporary local Vite preview supplied mock Tauri IPC responses, an empty library and a Windows-style example song path. No user library or model files were used.

- `saving.png`: the user selected **Nur CPU** and clicked **Speichern**. The mock keeps the save pending, so the actual controller keeps the dialog modal, disables its controls and displays the German saving status. The generation form behind the modal retains 30 seconds, `A lighthouse in the rain` and `quiet piano`.
- `error.png`: the mock rejects saving with an explicitly simulated disk-space error. The real error handler keeps **Nur CPU** and the edited 75-minute timeout in the dialog and re-enables saving/cancellation. Generation inputs remain visible behind it.

These are browser UI captures with simulated backend behavior, not native Windows or inference acceptance. The Windows follow-up procedure and the remaining unconfirmed cause are documented in `docs/verification.md`.
