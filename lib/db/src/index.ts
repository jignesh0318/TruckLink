import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const INIT_DDL = `
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agencies (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  agency_name TEXT NOT NULL,
  gst_number TEXT NOT NULL DEFAULT '27AABCU9603R1ZM',
  address TEXT NOT NULL DEFAULT 'Mumbai, Maharashtra',
  verified BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS trucks (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL,
  truck_number TEXT NOT NULL,
  type TEXT NOT NULL,
  body_type TEXT NOT NULL,
  has_ac BOOLEAN NOT NULL DEFAULT FALSE,
  capacity_kg INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'available',
  lat NUMERIC,
  lng NUMERIC
);

CREATE TABLE IF NOT EXISTS drivers (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  agency_id TEXT NOT NULL,
  license_number TEXT NOT NULL,
  license_expiry TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available'
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  agency_id TEXT,
  truck_id TEXT,
  driver_id TEXT,
  pickup_address TEXT NOT NULL,
  pickup_lat NUMERIC NOT NULL DEFAULT '19.076',
  pickup_lng NUMERIC NOT NULL DEFAULT '72.8777',
  drop_address TEXT NOT NULL,
  drop_lat NUMERIC NOT NULL DEFAULT '18.5204',
  drop_lng NUMERIC NOT NULL DEFAULT '73.8567',
  truck_type TEXT NOT NULL,
  body_type TEXT NOT NULL,
  has_ac BOOLEAN NOT NULL DEFAULT FALSE,
  distance_km NUMERIC NOT NULL DEFAULT '148',
  base_fare NUMERIC NOT NULL DEFAULT '1200',
  toll_charge NUMERIC NOT NULL DEFAULT '220',
  overtime_charge NUMERIC NOT NULL DEFAULT '0',
  total_fare NUMERIC NOT NULL DEFAULT '1491',
  status TEXT NOT NULL DEFAULT 'pending',
  payment_status TEXT NOT NULL DEFAULT 'held_in_escrow',
  otp_code TEXT,
  stops TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'razorpay_test',
  status TEXT NOT NULL DEFAULT 'held_in_escrow',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS live_locations (
  id TEXT PRIMARY KEY,
  driver_id TEXT NOT NULL,
  booking_id TEXT NOT NULL,
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS waiting_timers (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL,
  arrived_at TIMESTAMPTZ,
  free_minutes INTEGER NOT NULL DEFAULT 45,
  overtime_minutes INTEGER NOT NULL DEFAULT 0,
  overtime_charge NUMERIC NOT NULL DEFAULT '0'
);
`;

let dbInstance: any;
let poolInstance: any = null;

const dbUrl = process.env.DATABASE_URL;

if (dbUrl && (dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://")) && !dbUrl.includes("localhost:5432")) {
  try {
    poolInstance = new Pool({ connectionString: dbUrl });
    dbInstance = drizzlePg(poolInstance, { schema });
    // Execute DDL asynchronously to ensure tables exist
    poolInstance.query(INIT_DDL).catch((err: any) => {
      console.warn("PostgreSQL DDL init notice:", err.message);
    });
  } catch (err) {
    console.warn("Failed to connect to PostgreSQL via Pool, falling back to embedded PGlite:", err);
    const pglite = new PGlite();
    pglite.exec(INIT_DDL).catch(() => {});
    dbInstance = drizzlePglite(pglite, { schema });
  }
} else {
  // Use embedded in-memory PGlite WASM PostgreSQL engine
  const pglite = new PGlite("memory://");
  pglite.exec(INIT_DDL).catch(() => {});
  dbInstance = drizzlePglite(pglite, { schema });
}

export const pool = poolInstance;
export const db = dbInstance;

export * from "./schema";
