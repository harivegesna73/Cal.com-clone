// Seed script — run with: node prisma/seed.js
// Inserts 3 × 15-min and 2 × 30-min UPCOMING bookings spread across the next 10 days.
// Skips days with no availability (Wednesday = 3, Saturday = 6, Sunday = 0).
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const EVENT_15 = "7374c8d8-5979-4bcd-aa45-ca2142cce03a"; // 15 min meeting
const EVENT_30 = "48810ff5-8c08-4a51-b3a8-7dc7c3b1027f"; // 30 min meeting

// Availability from the screenshot: Mon–Fri except Wed (06:00–late).
// We keep it simple and pick slots well within the window.
const UNAVAILABLE_DAYS = new Set([0, 3, 6]); // Sun, Wed, Sat

// Build a list of the next 10 calendar days that fall on available days.
function getAvailableDays() {
  const days = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 1; days.length < 10; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    if (!UNAVAILABLE_DAYS.has(d.getDay())) days.push(d);
  }
  return days;
}

// Make a UTC Date for a given local date at a given local HH:MM.
// We're in Asia/Kolkata (UTC+5:30), so subtract 5h30m.
function localToUtc(date, hours, minutes) {
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  // Offset IST → UTC: -5h30m
  return new Date(d.getTime() - (5 * 60 + 30) * 60 * 1000);
}

async function main() {
  // Resolve dummy user id
  const user = await prisma.user.findUnique({ where: { email: "admin@example.com" } });
  if (!user) throw new Error("Dummy user not found — start the server first.");

  const days = getAvailableDays();

  // Predefined seed bookings: [dayIndex (0-9), localHour, localMin, eventType, name, email, notes]
  const seeds = [
    // Three 15-min bookings
    [0,  8, 30, EVENT_15, "Alice Kumar",   "alice@example.com",   "Quick sync"],
    [2, 10,  0, EVENT_15, "Bob Sharma",    "bob@example.com",     "Follow up"],
    [5, 14, 15, EVENT_15, "Carol Nair",    "carol@example.com",   "Intro call"],
    // Two 30-min bookings
    [3, 11,  0, EVENT_30, "David Reddy",   "david@example.com",   "Product demo"],
    [7, 15, 30, EVENT_30, "Eva Menon",     "eva@example.com",     "Strategy discussion"],
  ];

  let created = 0;
  for (const [di, h, m, eventTypeId, name, email, notes] of seeds) {
    const day = days[di];
    const startUtc = localToUtc(day, h, m);
    const duration = eventTypeId === EVENT_15 ? 15 : 30;
    const endUtc = new Date(startUtc.getTime() + duration * 60 * 1000);

    // Skip if a booking already exists at this exact time for this event type
    const existing = await prisma.booking.findFirst({
      where: { eventTypeId, startTime: startUtc },
    });
    if (existing) {
      console.log(`⏭  Skipping duplicate: ${name} @ ${startUtc.toISOString()}`);
      continue;
    }

    await prisma.booking.create({
      data: {
        bookerName:  name,
        bookerEmail: email,
        notes,
        startTime:   startUtc,
        endTime:     endUtc,
        status:      "UPCOMING",
        eventTypeId,
      },
    });
    const localStr = `${day.toDateString()} ${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")} IST`;
    console.log(`✅  Created: ${name} — ${duration}min @ ${localStr}`);
    created++;
  }

  console.log(`\n🌱  Seed complete. ${created} booking(s) inserted.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
