# Scaler — Cal.com Clone

A full-stack meeting scheduling application inspired by Cal.com. Guests can browse a public booking page and reserve time slots; the host manages event types, weekly availability, date overrides, and bookings from a private dashboard. Confirmation, rescheduling, and cancellation emails are sent automatically via Gmail.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Backend | Node.js, Express 5 |
| ORM | Prisma 7 (client-side adapter pattern) |
| Database | PostgreSQL via Supabase (PgBouncer connection pooling) |
| Email | Nodemailer with Gmail SMTP |
| Icons | lucide-react |

---

## Project Structure

```
scaler/                     ← Next.js frontend
├── app/
│   ├── (dashboard)/        ← Private host dashboard (layout + pages)
│   │   ├── event-types/    ← Create / edit / delete event types
│   │   ├── availability/   ← Weekly schedule + date overrides
│   │   └── bookings/       ← View upcoming / past / cancelled bookings
│   ├── [username]/
│   │   └── [eventslug]/    ← Public booking page (calendar → slot → form)
│   ├── layout.tsx
│   └── page.tsx            ← Root redirect
├── components/
│   ├── header.tsx
│   └── sidebar.tsx
└── next.config.ts          ← API proxy: /api/* → http://localhost:3001/api/*

server/                     ← Express backend
├── server.js               ← All API routes
├── prisma/
│   ├── schema.prisma       ← Database schema
│   ├── seed.js             ← Seed script
│   └── migrations/         ← Prisma migration history
├── prisma.config.ts        ← Prisma CLI config (uses DIRECT_URL)
└── .env                    ← Environment variables
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project (PostgreSQL)
- A Gmail account with an [App Password](https://myaccount.google.com/apppasswords) (requires 2FA)

### 1. Install dependencies

```bash
# Frontend
cd scaler
npm install

# Backend
cd server
npm install
```

### 2. Configure environment variables

Create `server/.env`:

```env
# Supabase — connection pooling (used at runtime)
DATABASE_URL="postgresql://<user>:<password>@<host>:6543/postgres?pgbouncer=true"

# Supabase — direct connection (used by Prisma CLI for migrations)
DIRECT_URL="postgresql://<user>:<password>@<host>:5432/postgres"

# Express server port
PORT=3001

# Gmail credentials for Nodemailer
EMAIL_USER="you@gmail.com"
EMAIL_PASS="your-app-password"
```

### 3. Run database migrations

```bash
cd server
npx prisma migrate dev
```

### 4. (Optional) Seed the database

```bash
cd server
npm run seed
```

### 5. Start both servers

```bash
# Terminal 1 — Backend (port 3001)
cd server
npm run dev

# Terminal 2 — Frontend (port 3000)
cd scaler
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## How the Backend Works

### Startup sequence (`server.js`)

1. `dotenv` loads `.env` from the same directory.
2. A `pg.Pool` is created from `DATABASE_URL` and passed into `PrismaPg` — this is Prisma 7's **client-side driver adapter** pattern, which is required for PgBouncer (transaction-mode pooling).
3. Express is initialised with `cors()` and `express.json()`.
4. On first listen, `initDummyUser()` upserts a single host account (`admin@example.com`). Its UUID is stored in the module-level `DUMMY_USER_ID` variable and scoped to every subsequent query.
5. `markPastBookings()` runs on startup (and on every `GET /api/bookings` call) to flip `UPCOMING → PAST` for any bookings whose `startTime` is now in the past.

### Email (Nodemailer)

A single `nodemailer` transporter is created once at module level using the Gmail service and the App Password from `.env`. The `sendEmail(to, subject, body)` helper is `await`-ed at every booking lifecycle event (confirmed, rescheduled, cancelled) so failures are caught and logged without crashing the request.

### API Proxy (Next.js)

`next.config.ts` rewrites every `/api/*` request from the browser to `http://localhost:3001/api/*`, so the frontend never needs to hardcode the backend port.

---

## API Reference

### Event Types

| Method | Path | Description |
|---|---|---|
| GET | `/api/event-types` | List all event types |
| POST | `/api/event-types` | Create a new event type |
| PUT | `/api/event-types/:id` | Update an event type |
| DELETE | `/api/event-types/:id` | Delete an event type |

**POST / PUT body:**
```json
{
  "title": "30 Min Meeting",
  "description": "A quick call",
  "duration": 30,
  "slug": "30min",
  "bufferTime": 10
}
```

---

### Availability

| Method | Path | Description |
|---|---|---|
| GET | `/api/availability` | Get the current weekly schedule |
| POST | `/api/availability` | Replace the full weekly schedule (atomic transaction) |

**POST body:**
```json
{
  "schedule": [
    { "dayOfWeek": 1, "startTime": "09:00", "endTime": "17:00" },
    { "dayOfWeek": 3, "startTime": "09:00", "endTime": "17:00" }
  ]
}
```

`dayOfWeek`: 0 = Sunday … 6 = Saturday. The POST deletes all existing rows and recreates them in a single Prisma `$transaction`.

---

### Date Overrides

| Method | Path | Description |
|---|---|---|
| GET | `/api/date-overrides` | List all date overrides |
| POST | `/api/date-overrides` | Upsert an override for a specific date |
| DELETE | `/api/date-overrides/:id` | Remove an override |

**POST body:**
```json
{ "date": "2026-03-29", "startTime": null, "endTime": null }
```

- `startTime` / `endTime` = `null` → entire day is **blocked**.
- Providing times (e.g. `"10:00"` / `"12:00"`) → **custom hours** that replace the weekly schedule for that day.

Dates are stored as UTC midnight (`2026-03-29T00:00:00.000Z`) so comparisons are timezone-safe.

---

### Bookings

| Method | Path | Description |
|---|---|---|
| GET | `/api/bookings/taken` | Taken intervals + date override for a given day |
| GET | `/api/bookings` | List all bookings (filter with `?status=UPCOMING\|PAST\|CANCELLED`) |
| POST | `/api/bookings` | Create a new booking |
| PUT | `/api/bookings/:id/reschedule` | Reschedule an existing UPCOMING booking |
| DELETE | `/api/bookings/:id` | Cancel a booking (sets status to CANCELLED) |

**GET `/api/bookings/taken` query params:** `eventTypeId`, `date` (YYYY-MM-DD)

**Response:**
```json
{
  "taken": [
    { "start": "2026-03-30T09:45:00.000Z", "end": "2026-03-30T10:45:00.000Z" }
  ],
  "dateOverride": {
    "id": "...",
    "date": "2026-03-30T00:00:00.000Z",
    "startTime": "10:00",
    "endTime": "12:00"
  }
}
```

Each taken interval is expanded by `bufferTime` minutes on both sides before being returned, so the frontend filters out slots that would violate the buffer.

**POST `/api/bookings` body:**
```json
{
  "bookerName": "Jane Doe",
  "bookerEmail": "jane@example.com",
  "eventTypeId": "uuid",
  "startTime": "2026-03-30T10:00:00.000Z",
  "endTime": "2026-03-30T10:30:00.000Z",
  "notes": "Optional message"
}
```

**PUT `/api/bookings/:id/reschedule` body:**
```json
{
  "startTime": "2026-03-30T11:00:00.000Z",
  "endTime": "2026-03-30T11:30:00.000Z"
}
```

---

## Features

### Core

- **Event Types** — Create multiple meeting types with a title, description, duration (minutes), unique URL slug, and optional buffer time.
- **Weekly Availability** — Toggle days on/off and add multiple time blocks per day (e.g. 09:00–12:00 and 14:00–17:00). Saved atomically.
- **Public Booking Page** — Guests visit `/:username/:eventslug`, browse a calendar, pick an available slot, and submit their name, email, and an optional note.
- **Bookings Dashboard** — View and cancel upcoming, past, and cancelled bookings.

### Bonus

- **Buffer Time Between Meetings** — Each event type has a configurable buffer (minutes). The server expands taken intervals by that buffer when returning availability, preventing back-to-back bookings.
- **Date Overrides** — Block a specific date entirely or set custom hours that override the weekly schedule for that day. Blocked days are grayed out on the public calendar; custom-hour days show only the override slots.
- **Rescheduling Flow** — From the bookings dashboard, click "Reschedule" to open the public booking page in reschedule mode. Picking a new slot calls `PUT /api/bookings/:id/reschedule` instead of creating a new booking.
- **Email Notifications** — Real transactional emails via Gmail/Nodemailer sent to the booker on confirmation, rescheduling, and cancellation.

---

## Database Schema

```
User
├── id            UUID (PK)
├── name          String
├── email         String (unique)
├── timezone      String  default "Asia/Kolkata"
├── eventTypes    → EventType[]
├── availabilities → Availability[]
└── dateOverrides  → DateOverride[]

EventType
├── id            UUID (PK)
├── title         String
├── description   String?
├── duration      Int        (minutes)
├── slug          String     (unique)
├── bufferTime    Int        default 0
├── userId        FK → User
└── bookings      → Booking[]

Availability
├── id            UUID (PK)
├── dayOfWeek     Int        (0=Sun … 6=Sat)
├── startTime     String     "HH:mm"
├── endTime       String     "HH:mm"
└── userId        FK → User

DateOverride
├── id            UUID (PK)
├── date          DateTime   (UTC midnight)
├── startTime     String?    "HH:mm" — null = full-day block
├── endTime       String?    "HH:mm" — null = full-day block
└── userId        FK → User

Booking
├── id            UUID (PK)
├── bookerName    String
├── bookerEmail   String
├── notes         String?
├── startTime     DateTime   (UTC)
├── endTime       DateTime   (UTC)
├── status        Enum       UPCOMING | PAST | CANCELLED
├── createdAt     DateTime
└── eventTypeId   FK → EventType

enum BookingStatus { UPCOMING, PAST, CANCELLED }
```

### Design decisions

- `Availability.startTime` / `endTime` are stored as `"HH:mm"` strings rather than `DateTime` values to avoid timezone-shifting issues when the host changes their timezone.
- `DateOverride.date` is stored as UTC midnight so a simple equality check works regardless of the server's local timezone.
- `Booking.startTime` / `endTime` are full UTC timestamps so they can be compared directly with `new Date()` for the past-booking sweep.
- All writes that must be atomic (e.g. replacing the weekly schedule) use Prisma `$transaction`.
- A single dummy host (`admin@example.com`) is upserted on server start, satisfying the single-user requirement without needing an auth system.
