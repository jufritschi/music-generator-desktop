# Automatisierte Releaseprüfung 0.1.2-Kandidat

Geprüft am 27. Oktober 2026 gegen `c8f8b0e15aeba986e2edd374800aa81a4d817eb1` (44 Commits seit `v0.1.0`, Basis `b0a41567d09c5464b2216bf55b4cfd6d8cc75f71`). Aktuelle Quellversion: **0.1.1**.

| Prüfung | Ergebnis | Log |
|---|---|---|
| `npm ci --offline` | bestanden, Lockfile unverändert | `npm-ci.log` |
| `npm run build` | bestanden; TypeScript + Vite-Produktionsbuild | `build.log` |
| `npm run lint` | bestanden | `lint.log` |
| `npm test` | **264 Tests / 35 Dateien bestanden**, 0 Fehler | `frontend.log` |
| `npm run test:desktop` | **28 Tests bestanden**, 0 Fehler | `desktop.log` |
| `cargo fmt --manifest-path src-tauri/Cargo.toml --check` | bestanden | `rustfmt.log` |
| `cargo test --manifest-path src-tauri/Cargo.toml --locked --offline` mit freigegebenem Loopback-Zugriff | **163 Tests bestanden**, 0 Fehler, 1 absichtlich ignorierte Subprozess-Fixture | `rust-unsandboxed.log` |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --locked --offline --all-targets -- -D warnings` | bestanden, keine Warnungen | `clippy.log` |

**Insgesamt 455 bestandene Tests.** Zum Abschluss dieser Baseline-Prüfung war das Arbeitsverzeichnis laut `git status --short` unverändert; der später angeforderte Warnungsfix gehört nicht zu diesem Testergebnis. Lediglich ignorierte Entwicklungsabhängigkeiten und Buildausgaben wurden erzeugt.

Der erste Rust-Lauf innerhalb der eingeschränkten Agent-Sandbox scheiterte an `healthy_servers_do_not_confirm_a_backend_until_models_execute`, weil ein lokaler Testserver keinen Port binden durfte (`Operation not permitted`). Der vollständige Wiederholungslauf mit genehmigtem Loopback-Zugriff bestand. Das ist eine Umgebungsbeschränkung und kein reproduzierter Appfehler. Die absichtlich ignorierte `process_output::tests::probe_fixture` ist als Subprozess-Fixture markiert; die zugehörigen öffentlichen Probe-Tests laufen regulär.

Die separate [Änderungsmatrix](change-test-matrix.md) ordnet alle funktionalen Änderungen seit 0.1.0 den heutigen Tests, historischen Belegen und offenen Hardware-/GUI-Prüfungen zu.

Diese Quelltests liefern **keine vollständige native Bundle-/Inferenzfreigabe**. Der Hauptagent prüft den heruntergeladenen aktuellen macOS-Build mit echten Screenshots. Offen bleiben insbesondere reale Windows-Parameter-/Dauerabnahme (#17), Windows-Erststart (#12), Intel-CPU-30/50/80-Iterations-Hörvergleich (#15), Pascal-/Linux-CUDA-Hardware, physisches Mikrofon, Screenreader und Mindest-OS-GUI. Historische Debug-App-/Mock-Screenshots wurden nicht als aktuelle Releasebuild-Evidenz gewertet.

Aus Sicht der automatisierten Regression gibt es **keinen gefundenen Blocker**. Vor einer Veröffentlichung als 0.1.2 muss die Version konsistent angehoben und der neue Kandidat gebaut/geprüft werden; gegenwärtiger HEAD trägt 0.1.1.
