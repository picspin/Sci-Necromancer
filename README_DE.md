<div align="center">
  <a href="https://www.rad-sci.org/" target="_blank"><img src="public/readme-assets/sci-necromancer-logo.svg" height="180" alt="SCI-Necromancer Logo"></a>

  <p><a href="README.md">English</a> · <a href="README_CN.md">中文</a> · <a href="README_DE.md">Deutsch</a></p>
  <p>
    <a href="https://github.com/picspin/Sci-Necromancer/actions/workflows/ci.yml"><img src="https://github.com/picspin/Sci-Necromancer/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
    <a href="https://vite.dev/"><img src="https://img.shields.io/badge/Vite-6-646CFF?logo=vite&amp;logoColor=white" alt="Vite 6"></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-4A959F.svg" alt="MIT License"></a>
    <a href="https://github.com/picspin/Sci-Necromancer"><img src="https://img.shields.io/badge/Open%20Source-Yes-567A87" alt="Open Source"></a>
    <a href="#deployment"><img src="https://img.shields.io/badge/Deploy-Cloudflare%20%7C%20Vercel%20%7C%20Netlify-B4C3D7" alt="Cloudflare Vercel Netlify"></a>
  </p>
</div>

[![SCI cultivation path](public/readme-assets/sci-necromancer-cultivation.png)](https://www.rad-sci.org/)

## Überblick

SCI-Necromancer ist ein quelloffener KI-Assistent für Abstracts medizinischer Bildgebungs- und Kardiologiekongresse. Aus Quellenmaterial entstehen im Standardmodus oder im spielerischen **邪修-/Alchemie-Modus** strukturierte Entwürfe für ISMRM, RSNA, ECR/ER und ESC.

Die Anwendung unterstützt Analyse, Sprachoptimierung, Formatierung, Abbildungen, Export und unabhängige Blindprüfung. Sie **garantiert nicht** die Richtigkeit von Daten, Ethikvoten, De-Identifizierung, Statistik, Zitaten oder Einreichungsregeln. Die Verantwortung bleibt bei den Autorinnen und Autoren.

## Architektur

![Architektur](public/readme-assets/architecture.svg)

Vue 3 stellt die gemeinsame Oberfläche und Kongress-Slices bereit. Deterministische Regeln begrenzen Modellprompts und validieren Ergebnisse. Die optionale Skills-&-MCP-Schicht ergänzt einen schreibgeschützten Blind-Review-Skill, einen MGA-Agenten zur Forschungsverifikation für Mitglieder sowie freigegebene PubMed-, Semantic-Scholar-, Hubble-Abstract-, CiteCheck- und DOI-Prüfung. Standardmäßig wird lokal gespeichert; Supabase ist optional.

## Funktionen

- Geführter Ablauf von Quelle, Analyse und Klassifikation bis Generierung, Speichern und Export.
- Einheitliche „一键炼丹“-Aktion im kreativen 邪修-Modus.
- ISMRM, RSNA Science/Education, ECR/ER und ESC.
- Vollständige englische/chinesische UI-Lokalisierung inklusive Fehlern und Barrierefreiheit.
- Bildgenerierung/-bearbeitung sowie Markdown-, PDF-, JSON- und Bildexport.
- Neun Journal-Stilvorlagen und sieben erklärbare Schaubild-Layouts mit manueller Übersteuerung.
- Optionale Mitgliedsdienste: GitHub-Anmeldung, fünf Start-Boni, täglicher Check-in, verwaltete Gemini-/GPT-Image-Generierung, Stripe-Aufladung und explizites privates Supabase-Speichern.
- Ein verwalteter Standardablauf Analyse→Generierung kostet einen Bonus; Neugenerierung, Deep Update oder ein einzelnes Bild kosten je einen Bonus. BYOK verbraucht keine Plattform-Boni.
- Getrennte Skills-/MCP-Schalter, sicherer lokaler JSON-Manifestimport und herunterladbarer Review-Skill.
- Strukturierte Prüfung von Ethik, Einwilligung, De-Identifizierung, Daten, Methodik, Zitaten und Kongressregeln.
- Fail-closed: Nicht verfügbare Evidenzdienste gelten niemals als verifiziert.

## Schnellstart

Voraussetzungen: Node.js 18+ und ein Google-Gemini- oder OpenAI-kompatibler API-Schlüssel.

```bash
git clone https://github.com/picspin/Sci-Necromancer.git
cd Sci-Necromancer
npm install
npm run dev
```

Danach die von Vite ausgegebene lokale URL öffnen und den Anbieter unter **Models** konfigurieren.

## Verwendung

1. ISMRM, RSNA, ECR/ER oder ESC wählen.
2. Quellenmaterial einfügen/hochladen oder im 邪修-Modus eine Forschungsidee eingeben.
3. Analysieren, Einreichungsroute bestätigen und Abstract generieren.
4. Speichern, exportieren oder unabhängig blind prüfen.
5. Vor der Einreichung Fakten, Ethik, Datenschutz, Statistik, Zitate und aktuelle Regeln manuell prüfen.

Unter **Skills & MCP** lassen sich beide Laufzeiten getrennt laden. Externe `.json`-Dateien können nur einen benannten, bereits integrierten und vertrauenswürdigen Adapter aktivieren; ungebundene Manifeste bleiben reine Registry-Einträge. Browserbefehle und Zugangsdaten werden ignoriert. Neue ausführbare MCP-Adapter müssen weiterhin serverseitig bereitgestellt werden.

## Deployment

```bash
npm run test -- --run
npm run lint
npm run build
```

`dist/` kann mit SPA-Fallback auf Cloudflare, Vercel oder Netlify bereitgestellt werden. `api/` wird separat auf Vercel betrieben; [vercel.json](vercel.json) bindet Functions an die US-Region `iad1`. Supabase-, Turnstile-, Provider- und Stripe-Geheimnisse werden gemäß [.env.example](.env.example) serverseitig gesetzt; statische Hosts erhalten nur `VITE_API_BASE_URL`. Beide SQL-Dateien unter `supabase/migrations/` müssen angewandt werden. Provider-Regionen und Nutzungsbedingungen bleiben verbindlich.

Der Stripe-Webhook unter `/api/stripe-webhook` muss auf API-Version `2026-02-25.clover` fixiert sein und `checkout.session.completed`, `refund.created`, `refund.updated`, `charge.dispute.created` sowie das explizit auswählbare Ereignis `charge.dispute.funds_reinstated` abonnieren. Kauf, erfolgreiche Erstattung, doppelte Zustellung, Dispute und Wiederherstellung der Gelder sind vor Live-Zahlungen mit der Stripe CLI im Testmodus zu prüfen.

HTTPS-Facades und Trusted-Edge-Token für CiteCheck/DOI MCP sind im [Backend-Leitfaden](docs/BLIND_REVIEW_BACKEND.md) beschrieben. Servergeheimnisse gehören niemals in `VITE_*`-Variablen.

## Referenzen

- [RSNA Abstract Submission](https://www.rsna.org/annual-meeting/abstract-submission)
- [RSNA Presenter Resources](https://www.rsna.org/annual-meeting/attendee-resources/faculty-and-presenter-resources)
- [ISMRM Submission Guide](https://www.ismrm.org/26m/call/submission-guide/)
- [ECR Abstract Submission](https://www.myesr.org/congress/submit/abstract-submission/)
- [ESC Abstract Rules](https://www.escardio.org/events/congresses/esc-congress/call-for-science/abstracts/rules/)
- [STARD](https://www.equator-network.org/reporting-guidelines/stard/) · [TRIPOD](https://www.tripod-statement.org/)

Offizielle Regeln ändern sich. Interne Referenzen sind nur Entwurfshilfen; vor jeder Einreichung gilt die aktuelle Kongresswebsite.

## Fehlerbehebung

- **Leere Seite:** Node 18+ verwenden, Abhängigkeiten neu installieren und Browserkonsole prüfen.
- **Providerfehler:** API-Schlüssel, Base URL, Modell, Kontingent und Datenschutzbedingungen prüfen.
- **Dateiextraktion scheitert:** Klartext einfügen oder geschützte/gescannte Datei vorher aufbereiten.
- **Reviewer nicht verfügbar:** Checkbox, Backend-Facade, HTTPS, Timeout und Trusted-Edge-Header prüfen.
- **Unerwartete Ausgabe:** Workflow löschen, aus verifizierten Quellen neu generieren und KI-Text nie ungeprüft einreichen.

MIT-lizenziert; Beiträge und evidenzbasierte Korrekturen sind willkommen.
