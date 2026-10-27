# Frontend-Fix: falsche CPU-/Unknown-Warnung trotz bestätigter GPU-Synthese

Änderungen: `frontend/generation-policy.ts`, `frontend/studio.js`, `frontend/types.ts`, `frontend/generation-policy.test.ts`, `frontend/studio-settings.test.ts`.

- Vorhandene Health-Antworten aktualisieren CPU-Warntext, rote Slider-Markierung und Generierungsschutz anhand ausschließlich der laufenden bestätigten Synthese. Metal/CUDA/Vulkan gelten als GPU; ein ausdrücklich auf CPU laufendes Sprachmodell ändert diese Einordnung nicht.
- Bestätigte CPU-Synthese aktiviert die CPU-Warnung. Stop, fehlender Status, unbestätigte/unknown Synthese löschen den Laufzeit-Override und verwenden `probed_backend` als unabhängigen Fallback. Historische GPU-Beobachtung bleibt dadurch nicht bestehen.
- Frische erfolgreiche Rust-Policy ist aktueller als zuvor gelieferte Health-Evidenz. Nur während des Policy-Requests neuere Health-Evidenz überstimmt dessen Antwort. Ältere Policyantworten erhalten keinen Vorrang vor dem letzten Policyresultat.
- Überholte Health-Antworten werden über einen Request-Revisionszähler verworfen. Jede übernommene autoritative Policy invalidiert außerdem bereits laufende ältere Health-Erfolgs- und Fehlerantworten über einen gemeinsamen Policyversionsschutz. Health-Abfragen bleiben bei vorhandenen Events und dem vorhandenen 15-Sekunden-Timer; kein neuer Poll/IPC.

Test-first nachgewiesen: zwei native-Studio-Modultests reproduzierten zunächst die bestehenbleibende Warnung bei Metal+CPU-LM und die Wiederherstellung einer alten GPU-Anzeige nach neuerem Stop. Zusätzlich wurden zwei weitere Cross-Source-Repros (alte HealthGPU/alter Healthfehler nach frischer PolicyCPU) zunächst rot nachgewiesen und korrigiert. Drei weitere zunächst rote Race-Tests zeigen alte Health-GPU→frische PolicyCPU, alte HealthCPU→frische PolicyGPU und überholte Policyantwort.

Abschließende Ergebnisse:

- 59/59 gezielte Tests in generation-policy und studio-settings bestanden.
- 284/284 Frontendtests in 35 Dateien bestanden.
- TypeScript + Vite-Produktionsbuild bestanden.
- ESLint bestanden.

Logs: `cpu-warning-red.log`, `cpu-warning-policy-race-red.log`, `cpu-warning-cross-source-red.log`, `cpu-warning-focused.log`, `cpu-warning-frontend.log`, `cpu-warning-build.log`, `cpu-warning-lint.log`.

Keine Versionsänderung, keine GUI-/Benutzerdatenänderung durch diesen Teilagenten. Die native Prüfung ist im Abnahmebericht beschrieben. Rust-Policy-/Probekorrektur separat beim Agenten release_risks.

Finaler unabhängiger Review durch warning_fix_review: keine offene konkrete Frontend-Fehlstelle.
