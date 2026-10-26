# Issue #21: visible automatic prompt

`de.png` and `en.png` show the actual generation form after submitting an empty prompt and style with two versions. The automatic prompt is visible in the editable field and is the same text submitted to the native generation command. Switching the UI language changes the explanatory hint while preserving that prompt.

Captured at 1440 × 1100 in Chromium using the real frontend and simulated Tauri commands for startup, settings, queue and generation. The queued songs are simulated; these images do not demonstrate audio inference. The capture checked the visible/submitted prompt equality and reported no browser errors.
