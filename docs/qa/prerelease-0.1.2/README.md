# Erste Abnahme für Prerelease 0.1.2 (ursprünglicher Build)

Die anschließend ausdrücklich angeforderte Rückkehr auf tatsächlich 200 Schritte wird im [separaten Nachtrag](../iterations-200-0.1.2/README.md) geprüft. Dieser Bericht bleibt als Beleg des ursprünglichen 100er Builds erhalten.

27. Oktober 2026 · macOS 26.6.2 · Apple M5 Pro · 64 GiB RAM.

## Aktueller Kandidat 0.1.2

Die ursprünglich gefundenen Anzeige- und Parameterfehler sind korrigiert. Die Version ist konsistent 0.1.2. Der neue lokale Standard-Bundle besteht ZIP-/DMG-, Signatur-, Relocation- und App-Sandbox-Prüfungen. **558 automatisierte Tests sind erfolgreich**: 337 Frontend, 28 Desktop, 193 Rust; eine absichtlich ignorierte Rust-Subprozess-Fixture. Details: [Korrekturtests](corrections-tests.md). Die erneute native Standard-/XL-Abnahme ist unten dokumentiert; die vier Plattformbuilds am PR-Head werden am Pull Request ergänzt. Ein Release wurde nicht veröffentlicht.

Bibliothek und Player zeigen dieselbe aus dem WAV gemessene Dauer. Bei erheblicher Abweichung steht direkt am Song ein kurzer Hinweis. Ein zusätzlicher, zeitlich begrenzter LM-Versuch kann ein vorzeitiges Ende verbessern; höchstens zwei LM-Aufrufe und eine Synthese. Er garantiert keine exakte Musiklänge. Der erste echte 0.1.2-Lauf bestätigt sowohl den Nachversuch als auch die ehrliche Restabweichung (9,44 statt 10 Sekunden).

Der IT-Bereich ist auf die unterstützten 1–100 Schritte begrenzt. Alte höhere Formularwerte werden dauerhaft auf 100 angepasst. Neue Aufträge, Varianten und Wiederholungen nutzen wirksame Werte; alte Songparameter bleiben unverändert. Die alte 120-IT-Anfrage wird als tatsächlich ausgeführte 100 IT dargestellt.

## Erneute native Abnahme von 0.1.2

Tatsächlicher mit `npm run bundle` gebauter und aus seinem ZIP entpackter Release-Bundle, App Sandbox aktiv, vorhandene lokale Q8-Modelle, keine simulierten Engineantworten. Die Präferenzmigration zeigt beim ersten Start 100 statt alter 120 IT. Beide Synthesemodelle nutzen bestätigtes Metal; auch Starts mit 100 IT und die Variante erzeugen keinen falschen CPU-Dialog.

| Neuer Auftrag | Angefordert | Gemessener WAV | Wirksame Schritte | LM-Aufrufe | Verhalten |
|---|---|---|---:|---:|---|
| Standard SFT + 4B | 10 s | **9,44 s** | 30 | 2 | Erster Versuch 46 Codes, Nachversuch 47; besseres Ergebnis verwendet, kurzer Abweichungshinweis, Library/Player beide 0:09 |
| Standard SFT + 4B | 30 s | **30,00 s** | 30 | 1 | Kein Abweichungshinweis, korrekte 0:30 |
| XL SFT + 4B | 10 s | **9,44 s** | 100 | 2 | Erster Versuch 47 Codes, Nachversuch 38; besseres erstes Ergebnis behalten, Hinweis sichtbar |
| Variante des alten 120-IT-XL-Auftrags | 30 s | **29,60 s** | 100 | 1 | Neue Params und Ergebnis beide 100, tatsächliches Engineende `Step 100/100`; Library/Player beide 0:29, innerhalb der dokumentierten 0,6-s-Toleranz |

Die Nachmessung verwendet Frames und Samplerate der tatsächlichen WAV-Dateien; Werte stimmen exakt mit `duration_source=wav` und Ergebnis-Metadaten überein. [Aufträge, WAV-Header und SHA-256](evidence/012-native-results.json), [relevante echte Enginezeilen](evidence/012-native-engine-excerpt.log). Der Nachversuch ist begrenzt und ersetzt keine Garantie exakter Zieldauer. Keine synthetische Verlängerung oder Audiopadding.

Alle acht vorher vorhandenen Songdatensätze behalten Params, rohe Ergebnis-Metadaten, Datei, Status, Engine, Lyrics, Favorit und Ordner. Vier neue QA-Songs bleiben erhalten; vorhandene Audios wurden nicht überschrieben. Die ursprünglichen Einstellungen sind nach dem Test wiederhergestellt, mit der vorgesehenen Migration 120→100 IT. [Screenshots 27 – XL/100 IT](screenshots/27-012-xl-100-iterations.png), [28 – historische Variante und Player](screenshots/28-012-historical-variant-100it.png).

Die beiden neuen Pakete einschließlich Prüfsummen bestehen die Release-Asset-/Versionsprüfung für `v0.1.2`. Die tatsächlichen verlagerten Pakete bestehen [ZIP-Prüfung](evidence/012-verify-zip.log) und [DMG-Prüfung](evidence/012-verify-dmg.log), einschließlich schreibgeschütztem DMG-Startschutz, nativer Titelruntime, isoliertem Enginezugriff und Sandbox-WAV/MP3/ZIP-Export. Keine neuen Modellgewichte wurden heruntergeladen.

Die letzte Alt-Song-Retry-Korrektur gleicht den CPU-Guard mit den tatsächlichen Backend-Defaults ab (Standard 50, Turbo 8); sie ist durch zusätzliche rote/grüne Repros und den vollständigen erneuten Testlauf abgedeckt. Anschließend wurden ZIP und DMG neu gebaut und beide Paketprüfungen erneut erfolgreich ausgeführt. Der tatsächliche endgültige Bundle startet mit den wiederhergestellten Originalpräferenzen (90 s, 100 IT), erkennt Metal vor Inferenz und zeigt die korrigierte Bibliothek und Playerdauer. [Finaler nativer Screenshot 29](screenshots/29-012-final-candidate.png).

## Tatsächlicher CI-Download und Intel-Testkorrektur

Der ARM64-Job des [PR-Laufs 40504054874](https://github.com/rabbitfiremediacreation/music-generator-desktop/actions/runs/40504054874) für `4cf6fa1` bestand Tests, ZIP-/DMG-Paketprüfung und Upload. Das tatsächliche [Artefakt 12733839206](https://github.com/rabbitfiremediacreation/music-generator-desktop/actions/runs/40504054874/artifacts/12733839206) wurde erneut heruntergeladen: beide SHA-256 stimmen, strikte tiefe Codesign-Prüfung bestanden, Bundleversion 0.1.2. Auf dem M5 zeigt es schon vor Inferenz Metal und die korrekte Bibliothek.

Eine fünfte reale 0.1.2-Generierung in genau diesem Download mit XL/4B, 30 Sekunden und 100 IT wurde ohne falschen CPU-Dialog angenommen. WAV und Metadaten ergeben **29.60 Sekunden**, tatsächlich 100 Schritte, Library und Player übereinstimmend 0:29. [Ungekürzte Auftrag-/WAV-Belege](evidence/012-ci-arm64-native-result.json), [nativer Screenshot 30](screenshots/30-012-ci-download-generation.png). Die acht ursprünglichen Songdatensätze bleiben unverändert, insgesamt fünf neue QA-Songs seit der 0.1.2-Korrektur; Formularlänge wieder auf 90 Sekunden, IT auf migrierten 100.

Der Intel-Job desselben Laufs deckte eine falsche plattformübergreifende **Testannahme** auf: Nach beendeter Synthesesession muss macOS Intel CPU melden, weil die portable Intel-Ausgabe absichtlich CPU verwendet; die Assertion erwartete `unknown`. Ausschließlich dieser Test wurde plattformgerecht korrigiert und zusätzlich gegen alte Metal-Beobachtungen abgesichert. Lokal bestehen alle fünf Policytests und Rustfmt erneut. Kein Runtimecode wurde dabei verändert. Der neue aktuelle PR-Head benötigt einen erneuten vollständigen CI-Lauf; nur dessen abschließende Artefakte werden als aktuelle Testbuilds angeboten.

## Ursprüngliche Entscheidung zum heruntergeladenen 0.1.1-Stand

**Den heruntergeladenen Stand vorerst nicht als 0.1.2 freigeben.** Der native Test hat zwei funktionale Probleme gezeigt: eine unpassende CPU-/Unbekannt-Warnung auf dem M5 mit bestätigter Metal-Synthese und einen als zehn Sekunden beschrifteten Song mit tatsächlich nur 5,6 Sekunden Audio. Die Warnung wurde auf ausdrücklichen Benutzerwunsch während dieser Abnahme korrigiert und in einem lokal gebauten, signierten Release-Bundle auf dem M5 geprüft. Die anschließend gewünschte kompakte Backend-Anzeige ist ebenfalls nativ auf Deutsch, Englisch und bei 480 Pixel Fensterbreite abgenommen. Der Dauerfehler ist unabhängig davon offen. Außerdem trägt der Kandidat noch Version 0.1.1.

Eine vollständige GUI-/Inferenzfreigabe für alle Plattformen lässt sich auf diesem Mac nicht erteilen. Die unten benannten Plattformprüfungen bleiben offen.

## Geprüfter Ausgangsdownload und Vergleichsbasis

- Basis: `v0.1.0`, Commit `b0a41567d09c5464b2216bf55b4cfd6d8cc75f71`.
- Kandidat: `c8f8b0e15aeba986e2edd374800aa81a4d817eb1`, 44 Commits seit der Basis.
- [Erfolgreicher Main-Build 40488317504](https://github.com/rabbitfiremediacreation/music-generator-desktop/actions/runs/40488317504), [macOS-arm64-Artefakt 12726471957](https://github.com/rabbitfiremediacreation/music-generator-desktop/actions/runs/40488317504/artifacts/12726471957).
- Heruntergeladen wurden DMG und ZIP `Music-Generator-0.1.1-macos-arm64`; beide SHA-256-Prüfungen bestanden. Die native Prüfung verwendet die unveränderte heruntergeladene App mit deren tatsächlichen App-Sandbox-Entitlements.
- [PR-Build 40480471989](https://github.com/rabbitfiremediacreation/music-generator-desktop/actions/runs/40480471989) bestand für macOS arm64, macOS Intel, Windows x64 und Linux Vulkan einschließlich Paketprüfung und der beiden macOS-DMG-Prüfungen. PR-Commit `3c94544` und Main-Kandidat haben denselben Git-Tree `6a120db1fa7edb12d589888179d309d16d358cad`. Dieser CI-Nachweis gilt für den Ausgangsstand, nicht automatisch für den späteren lokalen Warnungsfix.
- Die Assets sind ad hoc signiert, ohne Developer-ID-Notarisierung. Eine Veröffentlichung wurde nicht ausgelöst.

## Native Ergebnisse des ursprünglichen Downloads

| Bereich | Tatsächlich geprüft | Ergebnis |
|---|---|---|
| DMG und Splash | Start direkt vom schreibgeschützten DMG; Beenden; Start der entpackten App nach Auswerfen des DMG | Installationshinweis blockiert den DMG-Start korrekt; kopierte App erreicht das Studio |
| Upgrade/Bibliothek | Bestehendes Profil mit fünf fertigen Songs geöffnet; vorher SQLite-Sicherung erstellt | Fünf ursprüngliche Songdatensätze nach den Tests unverändert; zwei neue QA-Generierungen hinzugefügt |
| Settings | Zahnrad, unmittelbarer Auto→CPU-Wechsel, Abbrechen und erneutes Öffnen, Rückwechsel | Gerätewahl bleibt ohne zusätzlichen Speicherklick erhalten; andere Formularwerte bleiben bestehen |
| Gleichzeitige Operation | CPU-Gerätewechsel während echter laufender Generierung | Verständliche Fehlermeldung, bisherige Gerätewahl bleibt aktiv; laufender Song wird fertig |
| Expert Mode/Modelle | Expert Mode speichern, erweiterten Katalog öffnen, wieder deaktivieren; vorhandenes XL→Standard im Studio | Katalog und getrennte Auswahl sichtbar; lokaler Wechsel ohne Modelldownload erfolgreich; echte Standard-Inferenz geprüft |
| Automatischer Prompt | Leeres Promptfeld absenden, Warnung abbrechen, anschließend erneut starten | Prompt wird vor Auftrag sichtbar mit GENERATED-Badge eingesetzt und bleibt erhalten |
| CPU-Warnung | Über 30 IT bei unbekannter Synthese, Abbrechen, danach „Mit 30 starten“ | Abbrechen erzeugt keinen Song; Bestätigung speichert genau 30 IT im Auftrag. Auf echtem M5 erscheint die Unbekannt-Warnung allerdings fälschlich, siehe Befund 1 |
| Inferenz A | Standard SFT Q8 + 4B Q8, Auto-LM, instrumental, 10 s, 30 IT, automatischer Titel | Song nach 33 s fertig; WAV nur 5,6 s, Bibliothek zeigt 10 s. Automatischer Titel entspricht dem vollständigen Prompt, siehe Befund 2 |
| Inferenz B | Nach Auto→CPU: eigener Titel, Prompt `A lighthouse in the rain`, Stil `quiet piano`, 30 s, 30 IT | Song nach 46 s fertig, tatsächlicher WAV genau 30 s; sichtbare und gespeicherte Eingaben stimmen überein |
| Backend-Anzeige | Echte Engine-Logs und laufende Anzeige getrennt für LM/Synthese | Metal · MTL0 für Synthese und CPU · CPU für ausdrücklich auf CPU gesetztes LM korrekt. Warnung widerspricht der Syntheseanzeige bis zur korrigierten Erkennung |
| Player | Erstes Ergebnis im Waveform-Player geöffnet und abgespielt | Waveform und laufender Zeitzeiger vorhanden; Player zeigt korrekt etwa 5 s, Bibliothek gleichzeitig 10 s. Kein subjektiver Hör-/Qualitätsnachweis |
| WAV | Nativer Speicherdialog, erstes Ziel Downloads, QA-Ziel auswählen, exportieren | Exportdatei bytegleich mit dem Original |
| TXT | Vorhandene Modell-Lyrics anzeigen und als Text exportieren | Export entspricht exakt den angezeigten Ergebnis-Lyrics |
| ZIP | Alle sieben fertigen Songs exportieren | ZIP-CRC korrekt; alle sieben WAVs bytegleich mit den Bibliotheksoriginalen |
| MP3 | Exportformat umstellen und Einzeldatei mit gebündeltem Encoder exportieren | MP3, 48 kHz, Stereo, 192 kbit/s; Original-WAV bleibt erhalten |
| Gemeinsames Exportziel | WAV-Ziel wählen, anschließend ZIP, TXT und MP3 öffnen | Alle Dialoge starten im selben gewählten QA-Verzeichnis |
| Setup-Pfade | Manuellen Pfad `~/models` eingeben und anschließend ohne Speichern zum Studio zurückkehren | Deutscher Hinweis verlangt absoluten Pfad ohne `~`, Setup-Start gesperrt; gespeicherte Konfiguration bleibt unverändert |
| Import bei bestehender Bibliothek | Vorbereitete alte QA-Installation über nativen Ordnerdialog wählen, dann abbrechen | Klarer Hinweis verlangt leere Bibliothek; Übernahme gesperrt, sieben vorhandene Songs bleiben erhalten |
| Neustart/Persistenz | App vollständig beenden und erneut starten | Länge 30 s, IT 30, VAR 1,2, BPM Auto und eine Variante wiederhergestellt; Titel/Prompt/Stil erwartungsgemäß leer. SQLite enthält weiter gemeinsamen Exportordner und MP3-Präferenz |

Die ursprüngliche Bibliothek wurde nicht für Import-/Verschiebetests geleert oder verschoben. Die anfänglich zwei QA-Songs und Exporte bleiben als Belege erhalten. Ein dritter, später im lokalen Warnungsfix-Build erzeugter XL-Song bleibt ebenfalls erhalten. Vor dem nativen Warnungsfix-Test wurden ausschließlich die während der QA geänderten Einstellungen aus der Anfangssicherung wiederhergestellt; vorhandene Songs wurden dabei nicht zurückgesetzt. Der Datenvergleich und die Exportprüfung stehen in [export-evidence.json](evidence/export-evidence.json).

## Befund 1: Falsche CPU-/Unbekannt-Warnung auf M5/Metal

Dies wurde im unveränderten heruntergeladenen Bundle auf echter Hardware beobachtet, ohne simulierte Tauri-/Hardwareantworten. Die Studioanzeige bestätigt Metal · MTL0, während unter dem Formular weiter „Das Rechengerät der Klangerzeugung konnte nicht ermittelt werden“ steht. Das explizit auf CPU gesetzte Sprachmodell ändert nichts daran, dass die Klangerzeugung Metal nutzt.

Der ursprüngliche modellfreie GGML-Probeaufruf initialisiert den Metal-Backend vollständig. Dabei kompiliert die erste Ausführung die eingebettete FA-Metal-Library: **13,414 s**, Gesamtlauf **13,483 s**. Die App setzt für diesen Aufruf jedoch ein Limit von fünf Sekunden. Sie beendet damit die gültige Erkennung und verwendet `unknown`. Der bereits warme Vergleichslauf liefert `gpu` in **0,069 s**; die explizite CPU-Probe braucht **0,016 s**. Zusätzlich aktualisierte die bisherige Health-Anzeige die separate Warnpolicy nicht.

Belege: [Kaltlauf](evidence/backend-probe-main-auto.json), [Warmlauf](evidence/backend-probe-main-auto-repeat.json), [CPU-Probe](evidence/backend-probe-main-cpu.json), [echte Metal-/CPU-Anzeige mit widersprüchlicher Warnung](screenshots/13-metal-and-cpu-backends.png).

Der lokale Fix prüft auf macOS das tatsächliche Metal-Gerät, eine Command Queue und das enthaltene Metal-Plugin, ohne die GGML-Shaderregistrierung zu starten. Bestätigte laufende Synthese hat Vorrang vor der modellfreien Probe; die LM-Platzierung bleibt unabhängig. Stop und unbestätigte Zustände verwerfen alte Inferenzbeobachtungen. Ein eigener Probe-Fallback und Revisionsschutz verhindern, dass verspätete Health-/Policyantworten alte GPU-Entscheidungen zurückbringen. Die Modellverwaltung verwendet dieselbe aufgelöste Entscheidung.

Der anschließend lokal gebaute optimierte Tauri-Release-Bundle trägt weiterhin 0.1.1 und die unveränderten App-Sandbox-Entitlements. `codesign --verify --deep --strict` bestand. Seine native Probe liefert **gpu in 0,115 s** und **cpu mit --cpu in 0,013 s** ([Beleg](evidence/packaged-probes-warning-fix.json)). Im tatsächlichen Studio mit dem wiederhergestellten Originalprofil und **120 IT** fehlen die falsche Warnung und die rote CPU-Markierung bereits vor einer Generierung ([Screenshot](screenshots/18-fixed-metal-no-cpu-warning.png)).

Nach diesem Fix bestanden **284 Frontendtests, 170 Rust-Tests und 28 Desktoptests**, außerdem Build, ESLint, Rustfmt und Clippy. Die Fehler und mehrere Antwort-Rennen wurden vor den Korrekturen mit roten Regressionstests nachgewiesen. Ein unabhängiger Review fand anschließend keine offenen konkreten Fehler. [Frontend-Prüfbericht](warning-fix-tests.md). Die abschließenden Header-Ergebnisse folgen unten.

## Neue kompakte Backend-Anzeige

Auf anschließenden ausdrücklichen Benutzerwunsch ist das Studio-Dropdown durch einen readonly Inline-Chip **„Rechenbackend Metal“** neben Sprache und Zahnrad ersetzt. Es gibt keine eigene Statuszeile. Vor dem ersten Lauf der aktuellen App-Sitzung steht bereits die tatsächlich geprüfte Backend-Art dort; Tooltip und zugänglicher Text sagen **„Erkannt und verfügbar“**. Erst aktuelle Engine-Evidenz wird als **„In der Engine bestätigt“** bezeichnet. Die getrennte Sprachmodellwahl Automatisch/Nur CPU und gegebenenfalls ihre tatsächliche Ausführung stehen ebenfalls nur in diesen Details. Eine leere Begründung erzeugt im Studio keinen unnötigen Text.

Die vorhandene GenerationPolicy liefert die konkrete Probe-Art, LM-Auswahl und denselben aktuellen Backend-Snapshot wie die Warnentscheidung. Dadurch sind zusätzliche Abfragen, Timer oder Engine-Starts unnötig. CPU-Fallback gewinnt auch bei grundsätzlich verfügbarer Metal-Hardware; Stop und verspätete Antworten zeigen keine veraltete Ausführung. Alle neuen Texte sind in zwölf Sprachen vorhanden; die ausführliche Darstellung des Setup-Ergebnisses bleibt erhalten.

**Native Endabnahme:** Ein erneuter optimierter, mit den tatsächlichen App-Sandbox-Entitlements signierter Release-Bundle zeigt schon beim Studio-Start Metal, bevor in dieser Sitzung ein Modell ausgeführt wurde. Deutsch und Englisch stimmen einschließlich Tooltip/AX-Text. Bei tatsächlich auf 480 CSS-Pixel (960 Screenshotpixel bei 2×) verkleinertem Fenster bleiben Sprache, Backendchip und Zahnrad gemeinsam in einer Zeile; kein abgeschnittenes Label oder horizontales Überlaufen. Anschließend wurde die breite Ansicht wiederhergestellt. Ein sofort gespeicherter LM-Wechsel auf Nur CPU ließ den Metal-Chip und die fehlende CPU-Synthesewarnung korrekt bestehen; die Automatik wurde danach wiederhergestellt.

**Abschließende automatisierte Prüfung: 495 Tests bestanden – 296 Frontend, 171 Rust, 28 Desktop.** Build, ESLint, Rustfmt und Clippy bestanden; eine absichtlich ignorierte Rust-Fixture. Der unabhängige Review meldet keine offenen konkreten Befunde. [Header-Prüfbericht](header-tests.md).

Der abschließende Paketnachweis enthält Legacy- und Detail-CLI-Proben (Metal/GPU, CPU), erfolgreiche Signaturprüfung und die tatsächliche Sandbox-Abnahme: ungewählte Datei/Verzeichnisse werden abgewiesen, native Engine und Titelruntime erben die Sandbox, Loopback/Shutdown funktionieren, MP3- und ZIP-Export erhalten das Original-WAV. [Paketproben](evidence/packaged-probes.json), [Sandbox-Nachweis](evidence/sandbox-probe.log).

Der lokale QA-Testbuild liegt unter `release/Music-Generator-0.1.1-QA-metal-header-macos-arm64.zip`, mit SHA-256-Nachweis daneben. Er enthält die Korrekturen, meldet weiterhin ausdrücklich **0.1.1** und wurde nicht veröffentlicht. Der [Quellmanifest-Nachweis](evidence/source-manifest.json) bindet ihn an den Ausgangscommit plus die lokalen Quelldatei-Änderungen. Die vier Plattform-CI-Builds oben gelten weiterhin nur für den ursprünglichen heruntergeladenen Stand; für diese lokalen Korrekturen wurde keine neue plattformübergreifende CI ausgelöst.

Die acht Songs enthalten die ursprünglichen fünf unveränderten Datensätze plus drei QA-Songs. Originaleinstellungen sind wiederhergestellt; lediglich der vorher implizite Standard `cpu_iteration_behavior=ask` ist nun ausdrücklich gespeichert. [Profilvergleich](evidence/profile-preservation.json).

## Befund 2: Erfolgreich gemeldete Audiodauer weicht erheblich ab

| Auftrag | Gespeicherte Vorgabe | Ergebnis-Metadaten/Bibliothek | WAV-Header | Audiocodes |
|---|---:|---:|---:|---:|
| `87f0aea393f64a98814c2b0f03993380` | 10,0 s | 10,0 s | **268.800 Frames / 48.000 Hz = 5,6 s** | 28 |
| `159d3f986a6741a99ff0b48b4ef2e9d7` | 30,0 s | 30,0 s | 1.440.000 Frames / 48.000 Hz = 30,0 s | 150 |

Das ist eine tatsächliche Abweichung von 44 % im ersten Versuch, nicht nur ein falsches Formular nach dem Gerätewechsel. Der zweite Versuch war korrekt. Die vollständigen beiden Aufträge, Ergebnis-Metadaten und WAV-Header stehen in [duration-evidence.json](evidence/duration-evidence.json); [Player und Bibliothek widersprechen einander sichtbar](screenshots/09-player-duration-mismatch.png).

Der gepinnte LM darf vorzeitig ein Endtoken liefern. Die Synthese richtet sich bei vorhandenen Codes nach deren Anzahl (0,2 s je Code), die Metadaten behalten die angeforderte Dauer. Der App-Client prüft nicht auf ausreichende Länge und übernimmt diese Metadaten anschließend ungeprüft in die Bibliotheksanzeige. Dieser Pfad besteht bereits in 0.1.0 und ist **keine neue Regression** der aktuellen Änderungen.

Vor Freigabe sollten mindestens die tatsächliche Audiodauer und eine deutliche Meldung bei erheblicher Abweichung stimmen. Die gewünschte Musiklänge verlässlich zu erzeugen erfordert zusätzlich einen Umgang mit vorzeitigem LM-Ende. Der Warnungsfix behebt diesen unabhängigen Fehler nicht.

Kleinere Qualitätsbeobachtung: Der erste automatisch akzeptierte Titel hat elf Wörter, obwohl der Modellprompt zwei bis sieben verlangt. Es handelt sich laut gespeichertem `generated_title` um ein akzeptiertes Modellergebnis; kein Laufzeitfehler oder nachgewiesener Prompt-Fallback.

## Zusätzliche native Abnahme des Warnungsfixes

Mit unverändert ausgewählten XL-/4B-Modellen wurde im lokal gebauten Release-Bundle ein dritter echter Auftrag angelegt: eigener Titel `QA Metal 120 IT`, Prompt `A lighthouse in the rain`, Stil `quiet piano`, 30 Sekunden und 120 angeforderte IT. Er wurde **ohne CPU-Bestätigungsdialog und ohne Reduzierung auf 30** angenommen und nach 66 Sekunden fertiggestellt. Der WAV-Header bestätigt genau 30 Sekunden. Die Backendanzeige bestätigt Metal; falsche CPU-Warnung und rote Markierung fehlen. [Auftrag und Metadaten](evidence/high-it-generation.json), [nativer Screenshot](screenshots/20-fixed-completed-metal.png).

Dabei zeigte sich eine weitere bestehende Parameterinkonsistenz: Die Oberfläche erlaubt bis 200 IT und dieser Auftrag sowie seine Ergebnis-Metadaten behalten 120. Die gepinnte Engine protokolliert jedoch `inference_steps 120 clamped to 100` und führt tatsächlich `Step 100/100` aus (`pipeline-synth-ops.cpp:245–247`). Damit ist der Startschutz auf Metal geprüft, **nicht die Ausführung von 120 tatsächlichen Schritten**. Sliderbereich/effektive Iterationsanzeige sollten an den Enginevertrag angeglichen werden; dieser unabhängige bestehende Fehler wurde während der Warnungs-/Headerkorrektur nicht verändert.

## Abdeckung seit 0.1.0

Die [vollständige Änderungsmatrix](change-test-matrix.md) führt sämtliche 18 Änderungsbereiche mit konkreten Regressionstests, historischen Nachweisen und offenen Prüfungen auf. Die heutige Baseline-Prüfung bestand mit **455 Tests: 264 Frontend, 28 Desktop, 163 Rust**. Eine Rust-Subprozess-Fixture ist absichtlich ignoriert. TypeScript/Vite, ESLint, Rustfmt und Clippy mit Warnungen als Fehler bestanden. [Testergebnis](baseline-tests.md).

Der Import wurde zusätzlich mit einer neu erstellten alten Datenbank und ausschließlich neuen temporären Zielen durch die öffentlichen Rust-Funktionen geprüft: zwei Songs, ein Ordner, eine künstliche Einsekunden-WAV, ein fehlendes Audio; Teilimport-Zustimmung, Erhalt von Lyrics/Favorit, unveränderte Read-only-Quelle, Nichtleer-Sperre und Abbruch nach kopierten Bytes mit Rollback. Das ist ein Produktionsfunktions-/Fixturetest, kein vollständiger nativer Importnachweis des heruntergeladenen Bundles.

## Ursprüngliche Freigabepunkte und verbleibende Hardwareabnahme

- Erledigt im neuen Kandidaten: Versionsnummern und Lockfiles sind konsistent 0.1.2; ein neuer Standard-Bundle wurde gebaut und geprüft. Die folgenden Hardwaregrenzen bestehen unabhängig davon.
- Die aktuelle Windows-GUI-/Inferenzabnahme zu Gerätewechseln und realer Audiodauer (#17) sowie der ursprünglich betroffene Windows-Erststart bleiben offen. Die Mac-Prüfung ersetzt diese nicht.
- Echte Pascal-/GTX-1060-Treiber- und Backend-Abnahme; Linux-CUDA-Build für diesen Stand und reale NVIDIA-Inferenz.
- Native GUI-/Audioabnahme auf Intel, Windows, Linux und Mindestversionen der Betriebssysteme; alle Modellfamilien und Quantisierungen, lange Songs auf Intel/8 GiB.
- Physisches Mikrofon, tatsächliche VoiceOver-/NVDA-/JAWS-Bedienung und subjektive Audioqualität wurden nicht verifiziert. Bei den HTML-Modaldialogen konnte die native Automationsschnittstelle die Bedienelemente teilweise nicht lesen; Tastaturbedienung war möglich. Das allein ist kein abgeschlossener Screenreadertest.

## Screenshots

Aktueller 0.1.2-Kandidat: [25 – korrigierte historische Werte](screenshots/25-012-historical-duration-iterations.png), [26 – tatsächlicher LM-Nachversuch und einheitliche Playerdauer](screenshots/26-012-bounded-retry-measured-duration.png).

Alle folgenden Bilder wurden während dieser Abnahme aus der echten nativen App aufgenommen. 01–17 zeigen den unveränderten Download; 18–20 den lokalen Warnungsfix; 21–24 den abschließenden lokalen Header-/Warnungsfix. Bestehende Mock-/Debug-Aufnahmen aus früheren PRs wurden nicht als neue Releasebuild-Nachweise verwendet.

| Bild | Inhalt |
|---|---|
| [01](screenshots/01-dmg-installation.png) | Terminaler Installationshinweis im heruntergeladenen DMG |
| [02](screenshots/02-startup-splash.png) | Splash der kopierten App |
| [03](screenshots/03-upgrade-library.png) | Erhaltene fünf Songs nach dem Upgrade |
| [04](screenshots/04-device-saved.png) | Sofort gespeicherte Gerätewahl |
| [05](screenshots/05-cpu-warning.png) | CPU-/Unbekannt-Bestätigung vor dem Auftrag |
| [06](screenshots/06-generation-progress.png) | Echte erste Generierung |
| [07](screenshots/07-device-running-guard.png) | Abgewiesener Gerätewechsel während der Generierung |
| [08](screenshots/08-expert-models.png) | Native Expert-Modellverwaltung mit vorhandenen Modellen |
| [09](screenshots/09-player-duration-mismatch.png) | Bibliotheksdauer und tatsächlicher Player unterscheiden sich |
| [10](screenshots/10-30s-request-after-cpu.png) | Erhaltene Eingaben nach dem CPU-Wechsel |
| [11](screenshots/11-backend-cpu.png) | Bestätigtes CPU-LM, Synthese noch unbestätigt |
| [12](screenshots/12-wav-save-dialog.png) | Erster nativer WAV-Speicherdialog |
| [13](screenshots/13-metal-and-cpu-backends.png) | Bestätigte Metal-Synthese und CPU-LM; falsche Warnung |
| [14](screenshots/14-shared-export-directory.png) | Gemeinsames WAV-/ZIP-Exportziel |
| [15](screenshots/15-restored-form-after-restart.png) | Gespeicherte Zahlenwerte und geleerte Textfelder nach Neustart |

| [16](screenshots/16-invalid-setup-path.png) | Ungültiger manueller Modellpfad mit gesperrtem Setup-Start |
| [17](screenshots/17-import-nonempty-guard.png) | Native Importsperre bei nichtleerer Bibliothek |
| [18](screenshots/18-fixed-metal-no-cpu-warning.png) | Lokal korrigierter Warnungsbuild: 120 IT ohne falsche CPU-Warnung; noch vor Header-Neugestaltung |
| [19](screenshots/19-fixed-120it-generation.png) | Lokaler Warnungsfix: Auftrag mit 120 angeforderten IT ohne CPU-Bestätigung angenommen |
| [20](screenshots/20-fixed-completed-metal.png) | Derselbe Auftrag abgeschlossen, Metal bestätigt und keine falsche Warnung |
| [21](screenshots/21-inline-metal-before-generation-de.png) | Abschließender Header auf Deutsch: Metal bereits vor erster Modellinferenz dieser Sitzung |
| [22](screenshots/22-inline-metal-before-generation-en.png) | Derselbe Zustand auf Englisch |
| [23](screenshots/23-inline-metal-480px.png) | Echte native 480-Pixel-Fensterbreite; alle drei Kopfzeilen-Steuerelemente zusammen |
| [24](screenshots/24-inline-metal-with-cpu-lm.png) | LM explizit auf CPU; Metal für die Klangerzeugung bleibt korrekt, ohne CPU-Warnung |
