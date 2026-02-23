# Chat Demo – Desktop-App

Eine Fake-Discord-ähnliche Chat-App für Lern- und Demo-Zwecke. **Kein echtes Discord.**

## Features

- **Windows-Installation**: Installierbar als Desktop-App (.exe)
- **Auto-Updates**: Nutzer erhalten Updates ohne Neuinstallation
- React + TypeScript + Vite + Tailwind + Supabase + WebRTC

## Entwicklung starten

```bash
npm install
npm run dev
```

Startet die App im Entwicklungsmodus (Electron + Vite HMR).

## Windows-Installer bauen

```bash
npm run build
```

Erzeugt den Installer in `release/`:
- `Chat Demo Setup 1.0.0.exe` – NSIS-Installer

## Auto-Updates einrichten

Damit Nutzer Updates automatisch erhalten (ohne Neuinstallation):

### Option A: GitHub Releases

1. Erstelle ein GitHub-Repository für das Projekt
2. In `package.json` unter `build.publish` anpassen:

```json
"publish": [
  {
    "provider": "github",
    "owner": "DEIN_GITHUB_USER",
    "repo": "DEIN_REPO"
  }
]
```

3. Beim Build: `GH_TOKEN` setzen (GitHub Personal Access Token mit `repo`-Rechten):

```bash
$env:GH_TOKEN="dein_token"
npm run build
```

4. Bei jedem Release: Build ausführen und die Dateien in GitHub Releases hochladen (oder per CI/CD automatisieren)

### Option B: Eigener Server (Generic)

```json
"publish": {
  "provider": "generic",
  "url": "https://dein-server.com/updates"
}
```

Lade nach jedem Build die Inhalte von `release/` auf deinen Server.

## Projektstruktur

```
├── electron/           # Electron Main + Preload + Updater
├── src/                # React-App
├── release/            # Gebaute Installer (nach build)
└── dist/               # Vite-Build-Ausgabe
```

## Supabase

Erstelle ein Supabase-Projekt und führe die SQL-Migration aus:
`supabase/migrations/001_initial_schema.sql`

.env anlegen:
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
VITE_KLIPY_API_KEY=xxx   # optional, für GIF-Suche im Emoji-Picker (https://partner.klipy.com)
```
