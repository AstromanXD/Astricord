# Astricord Backend (Node.js + MySQL)

## Setup

### 1. MySQL Datenbank erstellen

```sql
CREATE DATABASE astricord;
```

### 2. Schema importieren

```bash
mysql -u root -p astricord < schema.sql
```

### 3. Umgebungsvariablen

Kopiere `.env.example` nach `.env` und passe an:

```bash
cp .env.example .env
```

### 4. Abhängigkeiten installieren

```bash
cd server
npm install
```

### 5. Server starten

```bash
npm run dev
```

Der Server läuft auf `http://localhost:3001`.

## API Endpoints

### Auth
- `POST /api/auth/register` - Registrierung
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Aktuelles Profil (JWT erforderlich)

### Server
- `GET /api/servers` - Server-Liste
- `POST /api/servers` - Server erstellen
- `GET /api/servers/:id` - Server-Details
- `PATCH /api/servers/:id` - Server bearbeiten
- `DELETE /api/servers/:id` - Server löschen
- `POST /api/servers/join` - Via Invite-Code beitreten

### Channels, Messages, Friends, DMs, Voice, Invites
Siehe die Route-Dateien in `src/routes/`.

## WebSocket

Verbinde zu `ws://localhost:3001/ws?token=JWT_TOKEN`

Nach dem Verbinden:
```json
{"type": "subscribe", "channel": "messages:CHANNEL_ID"}
{"type": "unsubscribe", "channel": "messages:CHANNEL_ID"}
```

Empfangen: `{"event": "INSERT", "payload": {...}}`

## Desktop-App (Electron)

Bei einer Electron-App gibt es **keine Frontend-URL** – die App läuft lokal auf dem Rechner.

- **VITE_API_URL** = Adresse deines Backends (z.B. `https://dein-server.de` oder `http://dein-server-ip:3001`)
- Beim Build wird diese URL in die App eingebaut – die App verbindet sich dann mit deinem Server
- **CORS** auf dem Server: `CORS_ORIGIN=*` oder weglassen – für Desktop-Apps reicht das
