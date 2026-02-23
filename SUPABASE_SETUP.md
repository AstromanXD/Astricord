# Supabase Push – Setup-Anleitung

## 1. Supabase CLI

Die CLI wird über `npx` ausgeführt (keine separate Installation nötig).

## 2. Projekt verlinken

Im Projektordner im Terminal ausführen:

```bash
npm run supabase:link
```

Oder direkt:

```bash
npx supabase link --project-ref ifrqbabnwchudljjbivq
```

**Datenbank-Passwort:**  
Das Passwort findest du im Supabase Dashboard unter **Project Settings → Database → Database password**.

## 3. Migrationen pushen

Nach erfolgreichem Link:

```bash
npm run supabase:push
```

Damit werden alle Migrations aus `supabase/migrations/` auf die Supabase-Datenbank angewendet.

## NPM-Scripts

| Befehl | Beschreibung |
|--------|---------------|
| `npm run supabase:link` | Projekt mit Supabase verbinden |
| `npm run supabase:push` | Migrationen zur Datenbank pushen |
| `npm run supabase:status` | Status prüfen |

## Hinweis

Die Migration `010_realtime_voice_sessions.sql` fügt die Tabelle `voice_sessions` zur Realtime-Publication hinzu. Dadurch wird die Anzeige von Nutzern in Voice-Channels in Echtzeit aktualisiert.
