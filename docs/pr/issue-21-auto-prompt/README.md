# Issue #21: visible automatic prompt

`empty.png` shows the grey explanatory placeholder inside the empty prompt field. `de.png` and `en.png` show the actual form after submitting an empty prompt and style with two versions: the used text appears in the editable field with a `GENERATED` chip beside its label. `edited.png` shows that the chip disappears as soon as the text changes. Switching languages preserves the used text and chip while translating the placeholder and accessible chip description; the requested `GENERATED` label stays the same.

Captured at 1440 × 1100 in Chromium using the real frontend and simulated Tauri commands for startup, settings, queue and generation. The queued songs are simulated; these images do not demonstrate audio inference. The capture checked the grey placeholder color, visible/submitted prompt equality, chip appearance/removal and language switching, and reported no browser errors.
