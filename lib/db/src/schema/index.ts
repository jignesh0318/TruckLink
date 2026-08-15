import {
  boolean,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

const id = (name: string) => text(name).primaryKey();

export const profilesTable = pgTable("profiles", {
  id: id("id"),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull(),
  phone: text("phone"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agenciesTable = pgTable("agencies", {
  id: id("id"),
  ownerId: text("owner_id").notNull(),
  agencyName: text("agency_name").notNull(),
  gstNumber: text("gst_number").notNull().default("27AABCU9603R1ZM"),
  address: text("address").notNull().default("Mumbai, Maharashtra"),
  verified: boolean("verified").notNull().default(true),
});

export const trucksTable = pgTable("trucks", {
  id: id("id"),
  agencyId: text("agency_id").notNull(),
  truckNumber: text("truck_number").notNull(),
  type: text("type").notNull(),
  bodyType: text("body_type").notNull(),
  hasAc: boolean("has_ac").notNull().default(false),
  capacityKg: integer("capacity_kg").notNull(),
  status: text("status").notNull().default("available"),
  lat: numeric("lat"),
  lng: numeric("lng"),
});

export const driversTable = pgTable("drivers", {
  id: id("id"),
  profileId: text("profile_id").notNull(),
  agencyId: text("agency_id").notNull(),
  licenseNumber: text("license_number").notNull(),
  licenseExpiry: text("license_expiry").notNull(),
  status: text("status").notNull().default("available"),
});

export const bookingsTable = pgTable("bookings", {
  id: id("id"),
  customerId: text("customer_id").notNull(),
  agencyId: text("agency_id"),
  truckId: text("truck_id"),
  driverId: text("driver_id"),
  pickupAddress: text("pickup_address").notNull(),
  pickupLat: numeric("pickup_lat").notNull().default("19.076"),
  pickupLng: numeric("pickup_lng").notNull().default("72.8777"),
  dropAddress: text("drop_address").notNull(),
  dropLat: numeric("drop_lat").notNull().default("18.5204"),
  dropLng: numeric("drop_lng").notNull().default("73.8567"),
  truckType: text("truck_type").notNull(),
  bodyType: text("body_type").notNull(),
  hasAc: boolean("has_ac").notNull().default(false),
  distanceKm: numeric("distance_km").notNull().default("148"),
  baseFare: numeric("base_fare").notNull().default("1200"),
  tollCharge: numeric("toll_charge").notNull().default("220"),
  overtimeCharge: numeric("overtime_charge").notNull().default("0"),
  totalFare: numeric("total_fare").notNull().default("1491"),
  status: text("status").notNull().default("pending"),
  paymentStatus: text("payment_status").notNull().default("held_in_escrow"),
  otpCode: text("otp_code"),
  stops: text("stops").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const paymentsTable = pgTable("payments", {
  id: id("id"),
  bookingId: text("booking_id").notNull(),
  amount: numeric("amount").notNull(),
  paymentMethod: text("payment_method").notNull().default("razorpay_test"),
  status: text("status").notNull().default("held_in_escrow"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const liveLocationsTable = pgTable("live_locations", {
  id: id("id"),
  driverId: text("driver_id").notNull(),
  bookingId: text("booking_id").notNull(),
  lat: numeric("lat").notNull(),
  lng: numeric("lng").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const waitingTimersTable = pgTable("waiting_timers", {
  id: id("id"),
  bookingId: text("booking_id").notNull(),
  arrivedAt: timestamp("arrived_at", { withTimezone: true }),
  freeMinutes: integer("free_minutes").notNull().default(45),
  overtimeMinutes: integer("overtime_minutes").notNull().default(0),
  overtimeCharge: numeric("overtime_charge").notNull().default("0"),
});