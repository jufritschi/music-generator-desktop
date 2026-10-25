# UI-Nachweise zu Issue #13

Aufgenommen am 25. Oktober 2026 in einer isolierten Browser-Vorschau der tatsächlichen UI-Module. Backend-Antworten und Hardwarewerte sind **Beispieldaten**; insbesondere ist „Treiber 580.0“ kein geprüfter Mindesttreiber. Es wurden weder Benutzerdaten noch eine echte Windows-/Pascal-Engine verwendet.

- `setup-compatibility.png`: Hardware und CUDA-Architekturhinweis vor dem Test.
- `setup-result.png`: gemessenes Sprachmodell-Backend als Fixture, Synthese noch unbestätigt, ausdrücklicher Studio-Wechsel.
- `studio-details.png`: Backend-Details nach einer simulierten Synthese; normal lesbare Gründe statt geerbter Großschreibung.

Die noch offene Hardwareabnahme und die statische Analyse des echten Windows-Archivs stehen in [backend-status.md](../../backend-status.md).

## Standards

Review gegen `main` (`e966530`): keine harten Verstöße. Ein Ermessensbefund (P3, mögliche Speculative Generality): `Arc<BackendSession>` wurde nirgends geteilt oder geklont. Behoben durch direkten Besitz der Sitzung im `Engine`.

## Spec

Zwei P2-Befunde aus der unabhängigen Prüfung gegen Issue #13 und den bestätigten Plan:

- „CUDA ≥ 7.5“ konnte als Toolkit-Version verstanden werden. Die Oberfläche nennt jetzt ausdrücklich die minimale **Compute Capability**; ein UI-Regressionstest prüft die sichtbare Beschriftung.
- Aktuelle `load_backend: failed to load …ggml-cuda.dll`- beziehungsweise CUDA-Backend-Registrierungsfehler wurden nicht erklärt. Die Statusauswertung erkennt diese CUDA-spezifischen Meldungen jetzt zusätzlich zu `ggml_cuda_init:`. Regressionen prüfen den öffentlichen Status, unverwandte CPU-Fehler und die Isolation des nächsten Startversuchs.

Standards: 0 harte Verstöße, 1 Vereinfachung behoben. Spec: 2 Befunde behoben; der schwerwiegendere Fall war die fehlende Erklärung belegter CUDA-Ladefehler. Die Pascal-Hardwareabnahme bleibt ausdrücklich offen.
