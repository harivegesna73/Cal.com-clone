require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

// ── Prisma 7 Connection Setup ─────────────────────────────────────────────────
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ── Express ───────────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// ── Dummy User (assignment requirement) ───────────────────────────────────────
let DUMMY_USER_ID = null;

async function initDummyUser() {
  let user = await prisma.user.findUnique({
    where: { email: "admin@example.com" },
  });
  if (!user) {
    user = await prisma.user.create({
      data: { name: "Admin", email: "admin@example.com" },
    });
    console.log("✔ Dummy user created:", user.id);
  } else {
    console.log("✔ Dummy user found:", user.id);
  }
  DUMMY_USER_ID = user.id;
}

// ── Housekeeping ────────────────────────────────────────────────────────────
async function markPastBookings() {
  try {
    const { count } = await prisma.booking.updateMany({
      where: { status: "UPCOMING", startTime: { lt: new Date() } },
      data:  { status: "PAST" },
    });
    if (count > 0) console.log(`✔ Marked ${count} booking(s) as PAST`);
  } catch (err) {
    console.error("markPastBookings error:", err);
  }
}

const nodemailer = require("nodemailer");

// ── Real Email Configuration ──────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendEmail(to, subject, body) {
  try {
    const info = await transporter.sendMail({
      from: `"Cal Clone" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text: body,
    });
    console.log(`\n✅ REAL EMAIL SENT: ${info.messageId}`);
  } catch (err) {
    console.error("❌ Email failed to send:", err);
  }
}

// ── Event Types ─────────────────────────────────────────────────────────────────

// GET /api/event-types
app.get("/api/event-types", async (req, res) => {
  try {
    const eventTypes = await prisma.eventType.findMany({
      where: { userId: DUMMY_USER_ID },
      orderBy: { duration: "asc" },
    });
    res.json(eventTypes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch event types." });
  }
});

// POST /api/event-types
app.post("/api/event-types", async (req, res) => {
  const { title, description, duration, slug, bufferTime } = req.body;
  if (!title || !duration || !slug) {
    return res.status(400).json({ error: "title, duration, and slug are required." });
  }
  try {
    const eventType = await prisma.eventType.create({
      data: {
        title,
        description: description ?? null,
        duration: Number(duration),
        slug,
        bufferTime: bufferTime != null ? Number(bufferTime) : 0,
        userId: DUMMY_USER_ID,
      },
    });
    res.status(201).json(eventType);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "A slug with that name already exists." });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to create event type." });
  }
});

// PUT /api/event-types/:id
app.put("/api/event-types/:id", async (req, res) => {
  const { title, description, duration, slug, bufferTime } = req.body;
  if (!title || !duration || !slug) {
    return res.status(400).json({ error: "title, duration, and slug are required." });
  }
  try {
    const existing = await prisma.eventType.findFirst({
      where: { id: req.params.id, userId: DUMMY_USER_ID },
    });
    if (!existing) return res.status(404).json({ error: "Event type not found." });
    const updated = await prisma.eventType.update({
      where: { id: req.params.id },
      data: {
        title,
        description: description ?? null,
        duration: Number(duration),
        slug,
        bufferTime: bufferTime != null ? Number(bufferTime) : existing.bufferTime,
      },
    });
    res.json(updated);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "A slug with that name already exists." });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to update event type." });
  }
});

// DELETE /api/event-types/:id
app.delete("/api/event-types/:id", async (req, res) => {
  try {
    await prisma.eventType.deleteMany({
      where: { id: req.params.id, userId: DUMMY_USER_ID },
    });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete event type." });
  }
});

// ── Availability ──────────────────────────────────────────────────────────────

// GET /api/availability
app.get("/api/availability", async (req, res) => {
  try {
    const availability = await prisma.availability.findMany({
      where: { userId: DUMMY_USER_ID },
      orderBy: { dayOfWeek: "asc" },
    });
    res.json(availability);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch availability." });
  }
});

// POST /api/availability  — replaces the full weekly schedule in one shot
app.post("/api/availability", async (req, res) => {
  const { schedule } = req.body;
  if (!Array.isArray(schedule)) {
    return res.status(400).json({ error: "schedule must be an array." });
  }
  try {
    await prisma.$transaction([
      prisma.availability.deleteMany({ where: { userId: DUMMY_USER_ID } }),
      prisma.availability.createMany({
        data: schedule.map(({ dayOfWeek, startTime, endTime }) => ({
          dayOfWeek: Number(dayOfWeek),
          startTime,
          endTime,
          userId: DUMMY_USER_ID,
        })),
      }),
    ]);
    const updated = await prisma.availability.findMany({
      where: { userId: DUMMY_USER_ID },
      orderBy: { dayOfWeek: "asc" },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save availability." });
  }
});

// ── Date Overrides ────────────────────────────────────────────────────────────

// GET /api/date-overrides
app.get("/api/date-overrides", async (req, res) => {
  try {
    const overrides = await prisma.dateOverride.findMany({
      where: { userId: DUMMY_USER_ID },
      orderBy: { date: "asc" },
    });
    res.json(overrides);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch date overrides." });
  }
});

// POST /api/date-overrides — upsert override for a date
// Body: { date: "YYYY-MM-DD", startTime: "HH:mm"|null, endTime: "HH:mm"|null }
// If startTime/endTime are null the whole day is blocked.
app.post("/api/date-overrides", async (req, res) => {
  const { date, startTime, endTime } = req.body;
  if (!date) {
    return res.status(400).json({ error: "date is required." });
  }
  try {
    const dateUTC = new Date(`${date}T00:00:00.000Z`);
    // Upsert: delete existing override for this date, then create new one
    await prisma.dateOverride.deleteMany({
      where: { userId: DUMMY_USER_ID, date: dateUTC },
    });
    const override = await prisma.dateOverride.create({
      data: {
        date: dateUTC,
        startTime: startTime ?? null,
        endTime: endTime ?? null,
        userId: DUMMY_USER_ID,
      },
    });
    res.status(201).json(override);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save date override." });
  }
});

// DELETE /api/date-overrides/:id
app.delete("/api/date-overrides/:id", async (req, res) => {
  try {
    await prisma.dateOverride.deleteMany({
      where: { id: req.params.id, userId: DUMMY_USER_ID },
    });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete date override." });
  }
});

// ── Bookings ──────────────────────────────────────────────────────────────────

// GET /api/bookings/taken?eventTypeId=xxx&date=YYYY-MM-DD
// Returns all UPCOMING booking intervals + bufferTime expansion for the host.
// Also returns dateOverride if one exists for that date.
app.get("/api/bookings/taken", async (req, res) => {
  const { eventTypeId, date } = req.query;
  if (!eventTypeId || !date) {
    return res.status(400).json({ error: "eventTypeId and date are required." });
  }
  try {
    const eventType = await prisma.eventType.findUnique({
      where: { id: String(eventTypeId) },
      select: { userId: true, bufferTime: true },
    });
    if (!eventType) return res.status(404).json({ error: "Event type not found." });

    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd   = new Date(`${date}T23:59:59.999Z`);
    const buffer   = eventType.bufferTime ?? 0; // minutes

    const bookings = await prisma.booking.findMany({
      where: {
        eventType: { userId: eventType.userId },
        status: "UPCOMING",
        startTime: { gte: dayStart, lte: dayEnd },
      },
      select: { startTime: true, endTime: true },
    });

    // Expand each booking by bufferTime on both sides
    const takenWithBuffer = bookings.map((b) => ({
      start: new Date(b.startTime.getTime() - buffer * 60 * 1000).toISOString(),
      end:   new Date(b.endTime.getTime()   + buffer * 60 * 1000).toISOString(),
    }));

    // Check if there's a date override for this day
    const override = await prisma.dateOverride.findFirst({
      where: { userId: eventType.userId, date: dayStart },
    });

    res.json({
      taken: takenWithBuffer,
      dateOverride: override
        ? {
            id: override.id,
            date: override.date.toISOString(),
            startTime: override.startTime,
            endTime: override.endTime,
          }
        : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch taken slots." });
  }
});

// GET /api/bookings
app.get("/api/bookings", async (req, res) => {
  await markPastBookings();
  const { status } = req.query;
  const where = {
    eventType: { userId: DUMMY_USER_ID },
    ...(status ? { status } : {}),
  };
  try {
    const bookings = await prisma.booking.findMany({
      where,
      include: { eventType: { select: { title: true, duration: true, slug: true } } },
      orderBy: { startTime: "asc" },
    });
    res.json(bookings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch bookings." });
  }
});

// POST /api/bookings — called from the public booking page
app.post("/api/bookings", async (req, res) => {
  const { bookerName, bookerEmail, eventTypeId, startTime, endTime, notes } = req.body;
  if (!bookerName || !bookerEmail || !eventTypeId || !startTime || !endTime) {
    return res.status(400).json({
      error: "bookerName, bookerEmail, eventTypeId, startTime, and endTime are required.",
    });
  }
  try {
    const eventType = await prisma.eventType.findFirst({
      where: { id: eventTypeId, userId: DUMMY_USER_ID },
    });
    if (!eventType) {
      return res.status(404).json({ error: "Event type not found." });
    }
    const booking = await prisma.booking.create({
      data: {
        bookerName,
        bookerEmail,
        notes: notes ?? null,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        status: "UPCOMING",
        eventTypeId,
      },
      include: { eventType: { select: { title: true, duration: true, slug: true } } },
    });

    const start = new Date(startTime).toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" });
    await sendEmail(
      bookerEmail,
      `Booking Confirmed: ${eventType.title}`,
      `  Hi ${bookerName},\n\n  Your booking for "${eventType.title}" has been confirmed.\n\n  📅  ${start}\n  ⏱  ${eventType.duration} minutes\n  📍  Google Meet\n\n  See you then!`
    );

    res.status(201).json(booking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create booking." });
  }
});

// PUT /api/bookings/:id/reschedule — update start/end time of an existing booking
app.put("/api/bookings/:id/reschedule", async (req, res) => {
  const { startTime, endTime } = req.body;
  if (!startTime || !endTime) {
    return res.status(400).json({ error: "startTime and endTime are required." });
  }
  try {
    const booking = await prisma.booking.findFirst({
      where: { id: req.params.id, eventType: { userId: DUMMY_USER_ID } },
      include: { eventType: { select: { title: true, duration: true } } },
    });
    if (!booking) {
      return res.status(404).json({ error: "Booking not found." });
    }
    if (booking.status !== "UPCOMING") {
      return res.status(400).json({ error: "Only UPCOMING bookings can be rescheduled." });
    }
    const updated = await prisma.booking.update({
      where: { id: req.params.id },
      data: {
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        status: "UPCOMING",
      },
      include: { eventType: { select: { title: true, duration: true, slug: true } } },
    });

    const newStart = new Date(startTime).toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" });
    await sendEmail(
      booking.bookerEmail,
      `Booking Rescheduled: ${booking.eventType.title}`,
      `  Hi ${booking.bookerName},\n\n  Your booking for "${booking.eventType.title}" has been rescheduled.\n\n  📅  New time: ${newStart}\n  ⏱  ${booking.eventType.duration} minutes\n  📍  Google Meet\n\n  See you then!`
    );

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reschedule booking." });
  }
});

// DELETE /api/bookings/:id — cancel a booking
app.delete("/api/bookings/:id", async (req, res) => {
  try {
    const booking = await prisma.booking.findFirst({
      where: { id: req.params.id, eventType: { userId: DUMMY_USER_ID } },
      include: { eventType: { select: { title: true } } },
    });
    if (!booking) {
      return res.status(404).json({ error: "Booking not found." });
    }
    await prisma.booking.update({
      where: { id: req.params.id },
      data: { status: "CANCELLED" },
    });

    await sendEmail(
      booking.bookerEmail,
      `Booking Cancelled: ${booking.eventType.title}`,
      `  Hi ${booking.bookerName},\n\n  Your booking for "${booking.eventType.title}" has been cancelled.\n\n  If you'd like to reschedule, please visit the booking page again.\n\n  Sorry for any inconvenience.`
    );

    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to cancel booking." });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
  initDummyUser()
    .then(() => markPastBookings())
    .catch((err) => {
      console.error("Failed to initialise dummy user:", err);
    });
});