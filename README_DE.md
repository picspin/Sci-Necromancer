# Sci-Necromancer

KI-gesteuerter Generator fuer akademische Abstracts fuer medizinische Bildgebung und wissenschaftliche Forschungskonferenzen.

## Ueberblick

Sci-Necromancer vereinfacht den Prozess der Vorbereitung von Konferenz-Abstracts durch den Einsatz grosser Sprachmodelle zur Analyse von Forschungsinhalten, Generierung von Impact-Statements, Vorschlag geeigneter Einreichungskategorien und Erstellung ausgefeilter Abstracts, die den Konferenzrichtlinien entsprechen.

### Unterstuetzte Konferenzen

- **ISMRM** - International Society for Magnetic Resonance in Medicine
- **RSNA** - Radiological Society of North America
- **ESC** - European Society of Cardiology
- **ECR** - European Congress of Radiology

## Funktionen

### Abstract-Generierung

- **Standard-Analysemodus**: PDF/DOCX hochladen oder Text einfuegen, dann einem gefuehrten Workflow folgen:
  - Inhaltsanalyse mit Schluesselwortextraktion
  - Impact-Statement- und Synopsis-Generierung
  - Abstract-Typ-Vorschlag basierend auf Inhalt
  - Finale Abstract-Generierung entsprechend Konferenzrichtlinien
- **Kreativer Erweiterungsmodus**: Kernforschungsidee eingeben und direkt ein vollstaendiges Abstract generieren

### Abbildungsgenerierung

- **Standard-Bearbeitung**: Bilder hochladen und KI-gestuetzte Bearbeitung nach Spezifikationen anwenden
- **Kreative Generierung**: Abbildungen aus Abstract-Kontext (Impact + Synopsis) generieren

### Abstract-Verwaltung

- Generierte Abstracts lokal speichern und organisieren
- Abstracts als JSON importieren/exportieren fuer Backup und Teilen
- Vollstaendige CRUD-Operationen fuer gespeicherte Abstracts

### Exportoptionen

- Markdown (.md)
- PDF-Dokument
- JSON-Daten

### Internationalisierung

- Englisch- und Chinesisch-Sprachunterstuetzung
- Automatische Browser-Spracherkennung
- Einfacher Sprachwechsel ueber UI

## Technologie-Stack

| Kategorie          | Technologien                               |
| ------------------ | ------------------------------------------ |
| Frontend           | Vue 3 (Composition API), TypeScript        |
| Zustandsverwaltung | Pinia, Vue Composables                     |
| Styling            | Tailwind CSS                               |
| Build-Tool         | Vite                                       |
| KI-Integration     | Google AI (Gemini), OpenAI-kompatible APIs |
| Dateiverarbeitung  | pdf-parse, mammoth (DOCX)                  |
| Testing            | Vitest                                     |

## Schnellstart

### Voraussetzungen

- Node.js 18 oder hoeher
- API-Schluessel fuer Google AI (Gemini) oder einen OpenAI-kompatiblen Anbieter

### Installation

```bash
# Repository klonen
git clone https://github.com/yourusername/sci-necromancer.git
cd sci-necromancer

# Abhaengigkeiten installieren
npm install

# Entwicklungsserver starten
npm run dev
```

Die Anwendung ist unter `http://localhost:3000` verfuegbar.

### Produktions-Build

```bash
npm run build
npm run preview
```

## Konfiguration

### Ersteinrichtung

1. Anwendung starten und auf die **Modelle**-Schaltflaeche (Zahnrad-Symbol) in der Kopfzeile klicken
2. KI-Anbieter auswaehlen:
   - **Google AI**: Gemini API-Schluessel von [Google AI Studio](https://aistudio.google.com/) eingeben
   - **OpenAI-kompatibel**: Basis-URL und API-Schluessel eingeben (unterstuetzt OpenAI, SiliconFlow und andere kompatible APIs)
3. Modelle konfigurieren (optional):
   - Textmodell (z.B. `gemini-2.5-pro`, `gpt-4o`)
   - Bildverarbeitungsmodell (fuer Bildanalyse)
   - Bildgenerierungsmodell (fuer Abbildungsgenerierung)
4. Einstellungen speichern

Einstellungen werden im Browser localStorage gespeichert und bleiben sitzungsuebergreifend erhalten.

### Unterstuetzte Anbieter

| Anbieter          | Basis-URL                       | Hinweise                        |
| ----------------- | ------------------------------- | ------------------------------- |
| Google AI         | N/A                             | Verwendet `@google/genai` SDK   |
| OpenAI            | `https://api.openai.com/v1`     | Offizielle OpenAI API           |
| SiliconFlow       | `https://api.siliconflow.cn/v1` | Bildgenerierungs-Unterstuetzung |
| Benutzerdefiniert | Ihre Endpunkt-URL               | Jede OpenAI-kompatible API      |

## Verwendung

### Standard-Analyse-Workflow

1. **Konferenz auswaehlen**: Zielkonferenz-Tab auswaehlen (ISMRM, RSNA, ESC, ECR)
2. **Inhalt eingeben**: PDF/DOCX-Datei hochladen oder Forschungstext einfuegen
3. **Analysieren**: "Analysieren" klicken, um Kategorien und Schluesselwoerter zu extrahieren
4. **Impact & Synopsis generieren**: Impact-Statement und Synopsis erstellen
5. **Typ auswaehlen**: KI-vorgeschlagene Abstract-Typen ueberpruefen oder manuell auswaehlen
6. **Abstract generieren**: Finales Abstract entsprechend Konferenzrichtlinien erstellen
7. **Exportieren**: Als Markdown, PDF oder JSON herunterladen

### Kreativer Erweiterungsmodus

1. Konferenz auswaehlen und zum "Kreative Erweiterung"-Modus wechseln
2. Kernforschungsidee oder Hypothese eingeben
3. Vollstaendiges Abstract direkt aus dem Konzept generieren

### Abbildungsgenerierung

1. Zum "Abbildungsgenerierung"-Tab navigieren
2. Modus auswaehlen:
   - **Standard-Bearbeitung**: Bild hochladen und Bearbeitungsanweisungen angeben
   - **Kreative Generierung**: Abbildungen basierend auf Abstract-Kontext generieren
3. Generierte Abbildung herunterladen

## ECR (European Congress of Radiology) Spezialfunktionen

### Forschungstyp-Richtlinien (EQUATOR Network)

Das ECR-Modul integriert EQUATOR Network Berichtsrichtlinien:

| Studientyp                         | Checkliste | Beschreibung                                                    |
| ---------------------------------- | ---------- | --------------------------------------------------------------- |
| Fall-Kontroll-Studie               | STROBE     | Staerkung der Berichterstattung von Beobachtungsstudien         |
| Querschnittsstudie                 | STROBE     | Staerkung der Berichterstattung von Beobachtungsstudien         |
| Diagnostische/prognostische Studie | STARD      | Standards fuer Berichte ueber diagnostische Genauigkeitsstudien |
| Experimentelle Studie (Tier)       | ARRIVE     | Tierforschung: Berichterstattung von In-vivo-Experimenten       |
| Beobachtungsstudie                 | STROBE     | Staerkung der Berichterstattung von Beobachtungsstudien         |
| Randomisierte kontrollierte Studie | CONSORT    | Konsolidierte Standards fuer die Berichterstattung von Studien  |

### Einreichungslink

- **ECR Abstract-Einreichungsportal**: [www.myESR.org/abstractsubmission](https://www.myesr.org/abstractsubmission)

## Projektstruktur

```
sci-necromancer/
├── src/
│   ├── main.ts                 # Anwendungs-Einstiegspunkt
│   ├── App.vue                 # Wurzelkomponente
│   ├── components/
│   │   ├── panels/             # Konferenzspezifische Panels
│   │   ├── managers/           # Abstract- und Modell-Manager
│   │   ├── ui/                 # Wiederverwendbare UI-Komponenten
│   │   └── export/             # Export-Funktionalitaet
│   ├── composables/            # Vue Composables (Hooks)
│   └── plugins/                # Vue Plugins (i18n, etc.)
├── lib/
│   ├── llm/                    # LLM-Anbieter-Integrationen
│   │   ├── index.ts            # Einheitliche API-Fassade
│   │   ├── gemini.ts           # Google AI Integration
│   │   └── openai.ts           # OpenAI-kompatible Integration
│   ├── conference/             # Konferenzmodul-System
│   │   ├── modules/            # Pro-Konferenz-Implementierungen
│   │   ├── ConferenceRegistry.ts
│   │   └── ConferenceRouter.ts
│   ├── file/                   # Dateiverarbeitungs-Utilities
│   └── utils/                  # Gemeinsame Utilities
├── public/
│   ├── locales/                # i18n-Uebersetzungsdateien
│   └── *.md                    # Konferenzrichtlinien
├── types.ts                    # TypeScript-Typdefinitionen
├── vite.config.ts              # Vite-Konfiguration
└── tsconfig.json               # TypeScript-Konfiguration
```

## Entwicklung

### Verfuegbare Skripte

| Befehl             | Beschreibung                      |
| ------------------ | --------------------------------- |
| `npm run dev`      | Entwicklungsserver starten        |
| `npm run build`    | Fuer Produktion bauen             |
| `npm run preview`  | Produktions-Build vorschauen      |
| `npm run lint`     | TypeScript-Typpruefung ausfuehren |
| `npm run lint:fix` | ESLint-Probleme beheben           |
| `npm run format`   | Code mit Prettier formatieren     |
| `npm run test`     | Tests mit Vitest ausfuehren       |
| `npm run test:ui`  | Tests mit UI ausfuehren           |

### Pfad-Aliase

Der `@`-Alias verweist auf das Projektstammverzeichnis:

```typescript
import { useSettings } from '@/src/composables/useSettings';
import { analyzeContent } from '@/lib/llm';
```

### Neue Konferenz hinzufuegen

1. Neues Modul in `lib/conference/modules/` erstellen
2. `BaseConferenceModule` mit konferenzspezifischen Richtlinien und Typen erweitern
3. Modul in `ConferenceRegistry` registrieren
4. Entsprechende Panel-Komponente in `src/components/panels/` erstellen
5. Uebersetzungen in `public/locales/` hinzufuegen

## Bereitstellung

### Vercel (Empfohlen)

1. Repository zu GitHub pushen
2. Projekt in Vercel importieren
3. Konfigurieren:
   - Framework-Preset: **Vite**
   - Build-Befehl: `npm run build`
   - Ausgabeverzeichnis: `dist`
4. Bereitstellen

Keine Umgebungsvariablen erforderlich; API-Schluessel werden ueber UI eingegeben und lokal gespeichert.

### Andere Plattformen

Die Build-Ausgabe ist eine statische Seite in `dist/`. Kann auf jedem statischen Hosting-Service bereitgestellt werden (Netlify, GitHub Pages, Cloudflare Pages, etc.).

## Sicherheit

- API-Schluessel werden nur im Browser localStorage gespeichert
- Keine serverseitige Speicherung oder Uebertragung von Anmeldedaten
- Dateiverarbeitung laeuft vollstaendig im Browser
- Vermeiden Sie das Hochladen sensibler oder vertraulicher Forschungsdaten

## Fehlerbehebung

| Problem                    | Loesung                                                                   |
| -------------------------- | ------------------------------------------------------------------------- |
| API-Fehler                 | Pruefen Sie, ob API-Schluessel korrekt ist und ausreichend Kontingent hat |
| PDF-Parsing fehlgeschlagen | Versuchen Sie eine kleinere Datei oder fuegen Sie Text direkt ein         |
| Port 3000 belegt           | Vite waehlt automatisch einen anderen Port (Terminal-Ausgabe pruefen)     |
| Build-Typfehler            | `npm run lint` ausfuehren, um TypeScript-Probleme zu identifizieren       |

## Mitwirken

1. Repository forken
2. Feature-Branch erstellen (`git checkout -b feature/your-feature`)
3. Aenderungen committen (`git commit -m 'Add your feature'`)
4. Zum Branch pushen (`git push origin feature/your-feature`)
5. Pull Request erstellen

## Danksagungen

- [ISMRM](https://www.ismrm.org/), [RSNA](https://www.rsna.org/), [ESC](https://www.escardio.org/), [ESR](https://www.myesr.org/) fuer oeffentliche Abstract-Richtlinien
- [Google AI](https://ai.google.dev/) (Gemini) fuer Sprachmodell-Faehigkeiten
- [OpenAI](https://openai.com/) fuer API-Kompatibilitaetsstandards
- [SiliconFlow](https://siliconflow.cn/) fuer Bildgenerierungs-APIs
- [EQUATOR Network](http://equator-network.org/) fuer Forschungsberichts-Richtlinien

---

[English](README.md) | [中文](README_CN.md) | **Deutsch**
