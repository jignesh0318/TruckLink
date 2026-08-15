import { Router, type IRouter, type Request, type Response } from "express";
import cookieParser from "cookie-parser";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  db,
  agenciesTable,
  bookingsTable,
  driversTable,
  liveLocationsTable,
  paymentsTable,
  profilesTable,
  trucksTable,
  waitingTimersTable,
} from "@workspace/db";
import {
  AssignBookingParams,
  AssignBookingResponse,
  CreateBookingBody,
  CreateBookingResponse,
  CreateDriverBody,
  CreateDriverResponse,
  CreateSessionBody,
  CreateSessionResponse,
  DeleteSessionResponse,
  EstimateFareBody,
  EstimateFareResponse,
  GetAgencySummaryResponse,
  GetBookingLocationParams,
  GetBookingLocationResponse,
  GetCustomerBookingParams,
  GetCustomerBookingResponse,
  GetCustomerSummaryResponse,
  GetDriverSummaryResponse,
  GetSessionResponse,
  ListAgencyBookingsResponse,
  ListCustomerBookingsResponse,
  ListDriverTripsResponse,
  ListFleetResponse,
  OtpInput,
  UpdateTripLocationBody,
  UpdateTripLocationParams,
  UpdateTripLocationResponse,
  UpdateTripStatusBody,
  UpdateTripStatusParams,
  UpdateTripStatusResponse,
  VerifyDeliveryOtpBody,
  VerifyDeliveryOtpParams,
  VerifyDeliveryOtpResponse,
  CreateTruckBody,
  CreateTruckResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();
router.use(cookieParser());

type Role = "customer" | "agency" | "driver";

const DEMO = {
  agency: "demo-agency",
  customer: "demo-customer",
  driver: "demo-driver",
  truck: "demo-truck",
  driverRecord: "demo-driver-record",
  booking: "demo-booking",
  payment: "demo-payment",
  location: "demo-location",
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function numberValue(value: string | number | null | undefined): number {
  return Number(value ?? 0);
}

function currentProfileId(req: Request): string | null {
  return req.cookies?.trucklink_session ?? null;
}

function randomOtp(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Geocode an address string to lat/lng using OpenRouteService.
 * Falls back to null if ORS_API_KEY is not configured or request fails.
 */
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const apiKey = process.env.ORS_API_KEY || "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjkwNzZjYTE1ZDMxOTRkNzk4NDZlYWIxM2JlYWI5ZDQ3IiwiaCI6Im11cm11cjY0In0=";
  if (!apiKey) return null;
  try {
    const url = `https://api.openrouteservice.org/geocode/search?api_key=${apiKey}&text=${encodeURIComponent(address)}&size=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json() as any;
    const coords = data?.features?.[0]?.geometry?.coordinates;
    if (!coords) return null;
    return { lat: coords[1], lng: coords[0] };
  } catch {
    return null;
  }
}

/**
 * Get driving distance in km between two lat/lng points using ORS.
 * Falls back to Haversine estimate if ORS is unavailable.
 */
async function getRouteDistanceKm(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number
): Promise<number> {
  const apiKey = process.env.ORS_API_KEY || "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjkwNzZjYTE1ZDMxOTRkNzk4NDZlYWIxM2JlYWI5ZDQ3IiwiaCI6Im11cm11cjY0In0=";
  if (apiKey) {
    try {
      const url = "https://api.openrouteservice.org/v2/directions/driving-hgv";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Authorization": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ coordinates: [[fromLng, fromLat], [toLng, toLat]] }),
      });
      if (res.ok) {
        const data = await res.json() as any;
        const meters = data?.routes?.[0]?.summary?.distance;
        if (meters) return Math.round(meters / 1000);
      }
    } catch { /* fall through */ }
  }
  // Haversine fallback
  const R = 6371;
  const dLat = (toLat - fromLat) * Math.PI / 180;
  const dLng = (toLng - fromLng) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(fromLat * Math.PI / 180) * Math.cos(toLat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.max(18, Math.round(R * c * 1.35)); // 1.35x road factor
}

/**
 * Calculate fare components from distance and truck type.
 */
function calcFare(distanceKm: number, truckType: string) {
  const rate = truckType === "Small" ? 14 : truckType === "Big" ? 24 : 18;
  const base = Math.round(distanceKm * rate + 480);
  const toll = Math.round(distanceKm * 1.45);
  const gst = Math.round((base + toll) * 0.05);
  return { base, toll, gst, total: base + toll + gst };
}

// ─────────────────────────────────────────────
// Demo workspace bootstrap
// ─────────────────────────────────────────────

async function ensureWorkspace(role: Role, profileId: string, name: string, email: string) {
  const existing = await db.select().from(profilesTable).where(eq(profilesTable.id, profileId));
  if (!existing[0]) {
    await db.insert(profilesTable).values({ id: profileId, name, email, role });
  } else {
    await db.update(profilesTable).set({ name, email }).where(eq(profilesTable.id, profileId));
  }

  const agency = await db.select().from(agenciesTable).where(eq(agenciesTable.id, DEMO.agency));
  if (!agency[0]) {
    await db.insert(agenciesTable).values({
      id: DEMO.agency,
      ownerId: role === "agency" ? profileId : "demo-agency",
      agencyName: "Western Arc Logistics",
      gstNumber: "27AABCU9603R1ZM",
      address: "Andheri East, Mumbai, Maharashtra",
      verified: true,
    });
  }

  const truck = await db.select().from(trucksTable).where(eq(trucksTable.id, DEMO.truck));
  if (!truck[0]) {
    await db.insert(trucksTable).values({
      id: DEMO.truck,
      agencyId: DEMO.agency,
      truckNumber: "MH 04 KT 2841",
      type: "Medium",
      bodyType: "Closed",
      hasAc: true,
      capacityKg: 1200,
      status: "on_trip",
      lat: "19.1383",
      lng: "72.8354",
    });
  }

  const driverProfile = await db.select().from(profilesTable).where(eq(profilesTable.id, DEMO.driver));
  if (!driverProfile[0]) {
    await db.insert(profilesTable).values({
      id: DEMO.driver,
      name: "Arjun Mehta",
      email: "arjun@westernarc.in",
      role: "driver",
      phone: "+91 98765 43210",
    });
  }
  const driver = await db.select().from(driversTable).where(eq(driversTable.id, DEMO.driverRecord));
  if (!driver[0]) {
    await db.insert(driversTable).values({
      id: DEMO.driverRecord,
      profileId: DEMO.driver,
      agencyId: DEMO.agency,
      licenseNumber: "MH14 20220045678",
      licenseExpiry: "2027-09-18",
      status: "on_trip",
    });
  }

  const booking = await db.select().from(bookingsTable).where(eq(bookingsTable.id, DEMO.booking));
  if (!booking[0]) {
    const otp = randomOtp();
    await db.insert(bookingsTable).values({
      id: DEMO.booking,
      customerId: DEMO.customer,
      agencyId: DEMO.agency,
      truckId: DEMO.truck,
      driverId: DEMO.driverRecord,
      pickupAddress: "Bandra Kurla Complex, Mumbai",
      pickupLat: "19.0607",
      pickupLng: "72.8644",
      dropAddress: "Hinjewadi Phase 1, Pune",
      dropLat: "18.5912",
      dropLng: "73.7389",
      truckType: "Medium",
      bodyType: "Closed",
      hasAc: true,
      distanceKm: "149",
      baseFare: "3150",
      tollCharge: "220",
      totalFare: "3539",
      status: "in_transit",
      paymentStatus: "held_in_escrow",
      otpCode: otp,
      stops: "",
    });
    await db.insert(paymentsTable).values({
      id: DEMO.payment,
      bookingId: DEMO.booking,
      amount: "3539",
      status: "held_in_escrow",
    });
    await db.insert(liveLocationsTable).values({
      id: DEMO.location,
      driverId: DEMO.driverRecord,
      bookingId: DEMO.booking,
      lat: "19.1383",
      lng: "72.8354",
    });
  }
}

// ─────────────────────────────────────────────
// Booking view builder
// ─────────────────────────────────────────────

async function bookingView(booking: typeof bookingsTable.$inferSelect) {
  const [driver, truck, agency] = await Promise.all([
    booking.driverId
      ? db.select().from(driversTable).where(eq(driversTable.id, booking.driverId))
      : Promise.resolve([]),
    booking.truckId
      ? db.select().from(trucksTable).where(eq(trucksTable.id, booking.truckId))
      : Promise.resolve([]),
    booking.agencyId
      ? db.select().from(agenciesTable).where(eq(agenciesTable.id, booking.agencyId))
      : Promise.resolve([]),
  ]);
  let driverName: string | null = null;
  if (driver[0]) {
    const profile = await db.select().from(profilesTable).where(eq(profilesTable.id, driver[0].profileId));
    driverName = profile[0]?.name ?? null;
  }
  return {
    id: booking.id,
    pickup_address: booking.pickupAddress,
    pickup_lat: numberValue(booking.pickupLat),
    pickup_lng: numberValue(booking.pickupLng),
    drop_address: booking.dropAddress,
    drop_lat: numberValue(booking.dropLat),
    drop_lng: numberValue(booking.dropLng),
    truck_type: booking.truckType,
    body_type: booking.bodyType,
    has_ac: booking.hasAc,
    distance_km: numberValue(booking.distanceKm),
    base_fare: numberValue(booking.baseFare),
    toll_charge: numberValue(booking.tollCharge),
    overtime_charge: numberValue(booking.overtimeCharge),
    total_fare: numberValue(booking.totalFare),
    status: booking.status as "pending" | "matched" | "in_transit" | "completed" | "cancelled",
    payment_status: booking.paymentStatus as "held_in_escrow" | "released" | "refunded",
    otp_code: booking.otpCode,
    driver_name: driverName,
    truck_number: truck[0]?.truckNumber ?? null,
    agency_name: agency[0]?.agencyName ?? null,
    agency_gst: agency[0]?.gstNumber ?? null,
    agency_address: agency[0]?.address ?? null,
    created_at: booking.createdAt,
    stops: booking.stops ? booking.stops.split("|").filter(Boolean) : [],
  };
}

async function bookingsFor(filter: ReturnType<typeof eq>) {
  const rows = await db.select().from(bookingsTable).where(filter).orderBy(desc(bookingsTable.createdAt));
  return Promise.all(rows.map(bookingView));
}

// ─────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────

router.post("/auth/session", async (req, res): Promise<void> => {
  const parsed = CreateSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const role = parsed.data.role as Role;
  const id = `demo-${role}`;
  const name = parsed.data.name;
  const email = parsed.data.email ?? `${role}@trucklink.local`;
  await ensureWorkspace(role, id, name, email);
  res.cookie("trucklink_session", id, { httpOnly: true, sameSite: "lax" });
  res.json(CreateSessionResponse.parse({
    id,
    name,
    email,
    role,
    agency_name: role === "agency" || role === "driver" ? "Western Arc Logistics" : null,
  }));
});

router.get("/auth/session", async (req, res): Promise<void> => {
  const id = currentProfileId(req);
  if (!id) {
    res.status(401).json({ error: "No active session" });
    return;
  }
  const profile = (await db.select().from(profilesTable).where(eq(profilesTable.id, id)))[0];
  if (!profile) {
    res.status(401).json({ error: "Session expired" });
    return;
  }
  res.json(GetSessionResponse.parse({
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: profile.role,
    agency_name: profile.role === "agency" || profile.role === "driver" ? "Western Arc Logistics" : null,
  }));
});

router.delete("/auth/session", async (_req, res): Promise<void> => {
  res.clearCookie("trucklink_session");
  res.status(204).end();
});

// ─────────────────────────────────────────────
// OPERATIONS — Fare estimate
// ─────────────────────────────────────────────

router.post("/operations/estimate", async (req, res): Promise<void> => {
  const parsed = EstimateFareBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Try to geocode both addresses; fall back to haversine between Indian defaults
  let pickupCoords = { lat: 19.076, lng: 72.8777 };
  let dropCoords = { lat: 18.5204, lng: 73.8567 };

  const [pgeo, dgeo] = await Promise.all([
    geocodeAddress(parsed.data.pickup_address),
    geocodeAddress(parsed.data.drop_address),
  ]);
  if (pgeo) pickupCoords = pgeo;
  if (dgeo) dropCoords = dgeo;

  const distance = await getRouteDistanceKm(
    pickupCoords.lat, pickupCoords.lng,
    dropCoords.lat, dropCoords.lng
  );
  const { base, toll, gst, total } = calcFare(distance, parsed.data.truck_type);

  res.json(EstimateFareResponse.parse({
    distance_km: distance,
    base_fare: base,
    toll_charge: toll,
    gst,
    total_fare: total,
  }));
});

// ─────────────────────────────────────────────
// CO-LOAD MATCHING
// ─────────────────────────────────────────────

router.post("/operations/coload-match", async (req, res): Promise<void> => {
  const { pickup_lat, pickup_lng, drop_lat, drop_lng } = req.body;
  if (!pickup_lat || !drop_lat) {
    res.status(400).json({ error: "Coordinates required" });
    return;
  }

  // Find pending bookings going in a roughly similar direction (within ~5km of pickup)
  const candidates = await db.select().from(bookingsTable)
    .where(and(eq(bookingsTable.status, "pending"), ne(bookingsTable.truckType, "Big")))
    .orderBy(desc(bookingsTable.createdAt))
    .limit(10);

  const pLat = Number(pickup_lat);
  const pLng = Number(pickup_lng);
  const dLat = Number(drop_lat);
  const dLng = Number(drop_lng);

  function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  const RADIUS_KM = 8;
  const match = candidates.find((b) => {
    const pickupDist = haversineKm(pLat, pLng, numberValue(b.pickupLat), numberValue(b.pickupLng));
    const dropDist = haversineKm(dLat, dLng, numberValue(b.dropLat), numberValue(b.dropLng));
    return pickupDist < RADIUS_KM && dropDist < RADIUS_KM;
  });

  if (match) {
    const discount = 0.18; // 18% shared savings
    res.json({
      match_found: true,
      booking_id: match.id,
      route: `${match.pickupAddress} → ${match.dropAddress}`,
      discount_percent: Math.round(discount * 100),
      message: `Co-load match found! Share with another booking and save ${Math.round(discount * 100)}%`,
    });
  } else {
    res.json({ match_found: false });
  }
});

// ─────────────────────────────────────────────
// CUSTOMER
// ─────────────────────────────────────────────

router.get("/customer/summary", async (req, res): Promise<void> => {
  const profileId = currentProfileId(req) ?? DEMO.customer;
  await ensureWorkspace("customer", profileId, "Priya Shah", "priya@trucklink.local");
  const rows = await db.select().from(bookingsTable).where(eq(bookingsTable.customerId, profileId));
  const views = await Promise.all(rows.map(bookingView));
  const active = views.find((item) => ["pending", "matched", "in_transit"].includes(item.status)) ?? null;
  res.json(GetCustomerSummaryResponse.parse({
    active_count: views.filter((item) => ["pending", "matched", "in_transit"].includes(item.status)).length,
    completed_count: views.filter((item) => item.status === "completed").length,
    total_spend: views.filter((item) => item.status === "completed").reduce((sum, item) => sum + item.total_fare, 0),
    active_booking: active,
  }));
});

router.get("/customer/bookings", async (req, res): Promise<void> => {
  const profileId = currentProfileId(req) ?? DEMO.customer;
  await ensureWorkspace("customer", profileId, "Priya Shah", "priya@trucklink.local");
  res.json(ListCustomerBookingsResponse.parse(await bookingsFor(eq(bookingsTable.customerId, profileId))));
});

router.post("/customer/bookings", async (req, res): Promise<void> => {
  const parsed = CreateBookingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const customerId = currentProfileId(req) ?? DEMO.customer;
  await ensureWorkspace("customer", customerId, "Priya Shah", "priya@trucklink.local");

  // Geocode addresses
  let pickupLat = parsed.data.pickup_lat ?? 19.076;
  let pickupLng = parsed.data.pickup_lng ?? 72.8777;
  let dropLat = parsed.data.drop_lat ?? 18.5204;
  let dropLng = parsed.data.drop_lng ?? 73.8567;

  if (!parsed.data.pickup_lat) {
    const geo = await geocodeAddress(parsed.data.pickup_address);
    if (geo) { pickupLat = geo.lat; pickupLng = geo.lng; }
  }
  if (!parsed.data.drop_lat) {
    const geo = await geocodeAddress(parsed.data.drop_address);
    if (geo) { dropLat = geo.lat; dropLng = geo.lng; }
  }

  const distance = await getRouteDistanceKm(pickupLat, pickupLng, dropLat, dropLng);
  const { base, toll, total } = calcFare(distance, parsed.data.truck_type);

  // Apply co-load discount if requested
  let finalTotal = total;
  let finalBase = base;
  if (parsed.data.co_load) {
    finalTotal = Math.round(total * 0.82);
    finalBase = Math.round(base * 0.82);
  }

  const id = randomUUID();
  const otp = randomOtp();

  await db.insert(bookingsTable).values({
    id,
    customerId,
    agencyId: DEMO.agency,
    pickupAddress: parsed.data.pickup_address,
    pickupLat: String(pickupLat),
    pickupLng: String(pickupLng),
    dropAddress: parsed.data.drop_address,
    dropLat: String(dropLat),
    dropLng: String(dropLng),
    truckType: parsed.data.truck_type,
    bodyType: parsed.data.body_type,
    hasAc: parsed.data.has_ac,
    distanceKm: String(distance),
    baseFare: String(finalBase),
    tollCharge: String(toll),
    totalFare: String(finalTotal),
    status: "pending",
    paymentStatus: "held_in_escrow",
    otpCode: otp,
    stops: (parsed.data.stops ?? []).join("|"),
  });
  await db.insert(paymentsTable).values({
    id: randomUUID(),
    bookingId: id,
    amount: String(finalTotal),
    status: "held_in_escrow",
  });
  const booking = (await db.select().from(bookingsTable).where(eq(bookingsTable.id, id)))[0];
  res.status(201).json(CreateBookingResponse.parse(await bookingView(booking)));
});

router.get("/customer/bookings/:bookingId", async (req, res): Promise<void> => {
  const params = GetCustomerBookingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const booking = (await db.select().from(bookingsTable).where(eq(bookingsTable.id, params.data.bookingId)))[0];
  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  res.json(GetCustomerBookingResponse.parse(await bookingView(booking)));
});

router.post("/customer/bookings/:bookingId/verify-otp", async (req, res): Promise<void> => {
  const params = VerifyDeliveryOtpParams.safeParse(req.params);
  const body = VerifyDeliveryOtpBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Enter a valid four digit delivery OTP" });
    return;
  }
  const booking = (await db.select().from(bookingsTable).where(eq(bookingsTable.id, params.data.bookingId)))[0];
  if (!booking || booking.otpCode !== body.data.otp) {
    res.status(400).json({ error: "That OTP does not match the delivery code" });
    return;
  }
  await db.update(bookingsTable)
    .set({ status: "completed", paymentStatus: "released" })
    .where(eq(bookingsTable.id, booking.id));
  await db.update(paymentsTable)
    .set({ status: "released" })
    .where(eq(paymentsTable.bookingId, booking.id));
  if (booking.truckId) {
    await db.update(trucksTable).set({ status: "available" }).where(eq(trucksTable.id, booking.truckId));
  }
  if (booking.driverId) {
    await db.update(driversTable).set({ status: "available" }).where(eq(driversTable.id, booking.driverId));
  }
  const updated = (await db.select().from(bookingsTable).where(eq(bookingsTable.id, booking.id)))[0];
  res.json(VerifyDeliveryOtpResponse.parse(await bookingView(updated)));
});

router.get("/customer/bookings/:bookingId/location", async (req, res): Promise<void> => {
  const params = GetBookingLocationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const location = (await db.select().from(liveLocationsTable)
    .where(eq(liveLocationsTable.bookingId, params.data.bookingId))
    .orderBy(desc(liveLocationsTable.updatedAt)))[0];
  if (!location) {
    res.status(404).json({ error: "No live location yet" });
    return;
  }
  res.json(GetBookingLocationResponse.parse({
    booking_id: location.bookingId,
    lat: numberValue(location.lat),
    lng: numberValue(location.lng),
    updated_at: location.updatedAt,
  }));
});

// GST Invoice endpoint — returns HTML
router.get("/customer/bookings/:bookingId/invoice", async (req, res): Promise<void> => {
  const bookingId = req.params.bookingId;
  const booking = (await db.select().from(bookingsTable).where(eq(bookingsTable.id, bookingId)))[0];
  if (!booking) {
    res.status(404).send("Booking not found");
    return;
  }
  if (booking.status !== "completed") {
    res.status(400).send("Invoice is only available after delivery is completed");
    return;
  }

  const agency = booking.agencyId
    ? (await db.select().from(agenciesTable).where(eq(agenciesTable.id, booking.agencyId)))[0]
    : null;

  const baseF = numberValue(booking.baseFare);
  const tollF = numberValue(booking.tollCharge);
  const otF = numberValue(booking.overtimeCharge);
  const subTotal = baseF + tollF + otF;
  const gst = Math.round(subTotal * 0.05);
  const grand = subTotal + gst;
  const invoiceNo = `TL-${bookingId.slice(-8).toUpperCase()}`;
  const date = new Date(booking.createdAt).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invoice ${invoiceNo} — TruckLink</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Manrope', sans-serif; background: #f7f4ef; color: #1a2e3b; padding: 40px 20px; }
    .page { max-width: 720px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 40px rgba(0,0,0,.08); }
    .header { background: #1e3a4f; color: #fff; padding: 36px 40px; display: flex; justify-content: space-between; align-items: flex-start; }
    .brand { font-size: 1.5rem; font-weight: 800; letter-spacing: -.02em; }
    .brand span { color: #f3a51b; }
    .invoice-meta { text-align: right; font-size: .85rem; opacity: .75; }
    .invoice-meta strong { display: block; font-size: 1.1rem; opacity: 1; color: #f3a51b; font-weight: 800; }
    .body { padding: 36px 40px; }
    .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px; }
    .party-label { font-size: .65rem; text-transform: uppercase; letter-spacing: .12em; color: #7a8fa0; font-weight: 700; margin-bottom: 8px; }
    .party-name { font-weight: 800; font-size: 1rem; }
    .party-detail { font-size: .82rem; color: #5a6e7e; margin-top: 4px; }
    .route-box { background: #f0f4f2; border-radius: 10px; padding: 16px 20px; margin-bottom: 28px; font-size: .9rem; }
    .route-box span { color: #f3a51b; font-weight: 800; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { text-align: left; font-size: .7rem; text-transform: uppercase; letter-spacing: .12em; color: #7a8fa0; padding: 10px 0; border-bottom: 1px solid #e8e2d8; }
    td { padding: 12px 0; border-bottom: 1px solid #f0ebe3; font-size: .9rem; }
    td:last-child { text-align: right; font-weight: 700; }
    .totals { border-top: 2px solid #1e3a4f; padding-top: 14px; }
    .totals tr td { border: none; }
    .grand { font-size: 1.15rem; color: #1e3a4f; }
    .gst-note { margin-top: 28px; font-size: .78rem; color: #7a8fa0; border-top: 1px solid #e8e2d8; padding-top: 16px; }
    .footer { background: #f7f4ef; padding: 20px 40px; font-size: .78rem; color: #7a8fa0; display: flex; justify-content: space-between; }
    @media print { body { background: #fff; padding: 0; } .page { box-shadow: none; border-radius: 0; } }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div><div class="brand">Truck<span>Link</span></div><div style="font-size:.82rem;opacity:.6;margin-top:6px;">Regional Logistics Network</div></div>
      <div class="invoice-meta"><strong>${invoiceNo}</strong>Tax Invoice<br/>${date}</div>
    </div>
    <div class="body">
      <div class="parties">
        <div>
          <div class="party-label">Service Provider</div>
          <div class="party-name">${agency?.agencyName ?? "Western Arc Logistics"}</div>
          <div class="party-detail">GST: ${agency?.gstNumber ?? "27AABCU9603R1ZM"}</div>
          <div class="party-detail">${agency?.address ?? "Mumbai, Maharashtra"}</div>
        </div>
        <div>
          <div class="party-label">Billed To</div>
          <div class="party-name">Customer</div>
          <div class="party-detail">Booking #${bookingId.slice(-8).toUpperCase()}</div>
          <div class="party-detail">${date}</div>
        </div>
      </div>
      <div class="route-box">
        📦 <strong>Route:</strong> ${booking.pickupAddress} <span>→</span> ${booking.dropAddress}
        &nbsp;&nbsp;·&nbsp;&nbsp; ${numberValue(booking.distanceKm)} km &nbsp;&nbsp;·&nbsp;&nbsp; ${booking.truckType} truck
      </div>
      <table>
        <thead><tr><th>Description</th><th style="text-align:right">Amount (₹)</th></tr></thead>
        <tbody>
          <tr><td>Base Transportation Fare (${numberValue(booking.distanceKm)} km × rate)</td><td>₹${baseF.toLocaleString("en-IN")}</td></tr>
          <tr><td>Toll &amp; Highway Charges</td><td>₹${tollF.toLocaleString("en-IN")}</td></tr>
          ${otF > 0 ? `<tr><td>Overtime / Waiting Charges</td><td>₹${otF.toLocaleString("en-IN")}</td></tr>` : ""}
        </tbody>
        <tbody class="totals">
          <tr><td>Subtotal</td><td>₹${subTotal.toLocaleString("en-IN")}</td></tr>
          <tr><td>GST @ 5% (SAC: 996791)</td><td>₹${gst.toLocaleString("en-IN")}</td></tr>
          <tr class="grand"><td><strong>Grand Total</strong></td><td><strong>₹${grand.toLocaleString("en-IN")}</strong></td></tr>
        </tbody>
      </table>
      <div class="gst-note">
        This is a computer-generated invoice. Payment held in escrow and released upon OTP verification at delivery.
        GSTIN: ${agency?.gstNumber ?? "27AABCU9603R1ZM"} · SAC Code: 996791 (Road transportation services)
      </div>
    </div>
    <div class="footer">
      <span>TruckLink Regional Logistics · trucklink.local</span>
      <span>Thank you for your business</span>
    </div>
  </div>
  <div style="text-align:center;margin-top:20px;">
    <button onclick="window.print()" style="background:#1e3a4f;color:#fff;border:none;padding:12px 28px;border-radius:8px;font-size:.9rem;font-weight:700;cursor:pointer;">Print / Save PDF</button>
  </div>
</body>
</html>`);
});

// ─────────────────────────────────────────────
// AGENCY
// ─────────────────────────────────────────────

router.get("/agency/summary", async (req, res): Promise<void> => {
  const profileId = currentProfileId(req) ?? DEMO.agency;
  await ensureWorkspace("agency", profileId, "Western Arc Logistics", "ops@westernarc.in");
  const rows = await db.select().from(bookingsTable).where(eq(bookingsTable.agencyId, DEMO.agency));
  const completed = rows.filter((item) => item.status === "completed");
  const active = rows.filter((item) => ["pending", "matched", "in_transit"].includes(item.status));

  // Weekly earnings for chart (last 7 days)
  const now = Date.now();
  const weeklyEarnings = Array.from({ length: 7 }, (_, i) => {
    const dayStart = new Date(now - (6 - i) * 86400000);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    const dayEarnings = completed
      .filter((b) => {
        const t = new Date(b.createdAt).getTime();
        return t >= dayStart.getTime() && t < dayEnd.getTime();
      })
      .reduce((sum, b) => sum + numberValue(b.totalFare), 0);
    return { day: dayStart.toLocaleDateString("en-IN", { weekday: "short" }), earnings: dayEarnings };
  });

  res.json(GetAgencySummaryResponse.parse({
    active_count: active.length,
    completed_count: completed.length,
    total_earnings: completed.reduce((sum, item) => sum + numberValue(item.totalFare), 0) || 182400,
    pending_payout: active.reduce((sum, item) => sum + numberValue(item.totalFare), 0),
    completion_rate: rows.length ? Math.round((completed.length / rows.length) * 100) : 96,
  }));
});

router.get("/agency/bookings", async (req, res): Promise<void> => {
  await ensureWorkspace("agency", DEMO.agency, "Western Arc Logistics", "ops@westernarc.in");
  res.json(ListAgencyBookingsResponse.parse(await bookingsFor(eq(bookingsTable.agencyId, DEMO.agency))));
});

router.post("/agency/bookings/:bookingId/assign", async (req, res): Promise<void> => {
  const params = AssignBookingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const booking = (await db.select().from(bookingsTable).where(eq(bookingsTable.id, params.data.bookingId)))[0];
  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  await ensureWorkspace("agency", DEMO.agency, "Western Arc Logistics", "ops@westernarc.in");

  // Find nearest available truck by comparing lat/lng to pickup
  const availableTrucks = await db.select().from(trucksTable)
    .where(and(eq(trucksTable.agencyId, DEMO.agency), eq(trucksTable.status, "available")));

  let bestTruck = availableTrucks[0];
  if (availableTrucks.length > 1) {
    const pLat = numberValue(booking.pickupLat);
    const pLng = numberValue(booking.pickupLng);
    let minDist = Infinity;
    for (const t of availableTrucks) {
      if (!t.lat || !t.lng) continue;
      const d = Math.abs(numberValue(t.lat) - pLat) + Math.abs(numberValue(t.lng) - pLng);
      if (d < minDist) { minDist = d; bestTruck = t; }
    }
  }

  const truckId = bestTruck?.id ?? DEMO.truck;
  const driverId = DEMO.driverRecord;
  const newOtp = randomOtp();

  await db.update(bookingsTable)
    .set({ agencyId: DEMO.agency, truckId, driverId, status: "matched", otpCode: newOtp })
    .where(eq(bookingsTable.id, booking.id));
  await db.update(trucksTable).set({ status: "on_trip" }).where(eq(trucksTable.id, truckId));
  await db.update(driversTable).set({ status: "on_trip" }).where(eq(driversTable.id, driverId));

  const updated = (await db.select().from(bookingsTable).where(eq(bookingsTable.id, booking.id)))[0];
  res.json(AssignBookingResponse.parse(await bookingView(updated)));
});

router.get("/agency/fleet", async (_req, res): Promise<void> => {
  await ensureWorkspace("agency", DEMO.agency, "Western Arc Logistics", "ops@westernarc.in");
  const trucks = await db.select().from(trucksTable).where(eq(trucksTable.agencyId, DEMO.agency));
  const drivers = await db.select().from(driversTable).where(eq(driversTable.agencyId, DEMO.agency));
  const driverViews = await Promise.all(drivers.map(async (driver) => {
    const profile = (await db.select().from(profilesTable).where(eq(profilesTable.id, driver.profileId)))[0];
    const expiry = new Date(`${driver.licenseExpiry}T00:00:00Z`).getTime();
    return {
      id: driver.id,
      name: profile?.name ?? "Driver",
      phone: profile?.phone ?? "+91 00000 00000",
      license_number: driver.licenseNumber,
      license_expiry: driver.licenseExpiry,
      status: driver.status as "available" | "on_trip",
      expiring_soon: expiry - Date.now() < 30 * 24 * 60 * 60 * 1000,
    };
  }));
  res.json(ListFleetResponse.parse({
    trucks: trucks.map((truck) => ({
      id: truck.id,
      truck_number: truck.truckNumber,
      type: truck.type,
      body_type: truck.bodyType,
      has_ac: truck.hasAc,
      capacity_kg: truck.capacityKg,
      status: truck.status as "available" | "on_trip" | "maintenance",
    })),
    drivers: driverViews,
  }));
});

router.post("/agency/trucks", async (req, res): Promise<void> => {
  const parsed = CreateTruckBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const id = randomUUID();
  await db.insert(trucksTable).values({
    id,
    agencyId: DEMO.agency,
    truckNumber: parsed.data.truck_number,
    type: parsed.data.type,
    bodyType: parsed.data.body_type,
    hasAc: parsed.data.has_ac,
    capacityKg: Number(parsed.data.capacity_kg),
    status: "available",
  });
  res.status(201).json(CreateTruckResponse.parse({
    id,
    ...parsed.data,
    capacity_kg: Number(parsed.data.capacity_kg),
    status: "available",
  }));
});

router.post("/agency/drivers", async (req, res): Promise<void> => {
  const parsed = CreateDriverBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const profileId = randomUUID();
  const driverId = randomUUID();
  await db.insert(profilesTable).values({
    id: profileId,
    name: parsed.data.name,
    email: `${profileId}@trucklink.local`,
    role: "driver",
    phone: parsed.data.phone,
  });
  const licenseExpiry = parsed.data.license_expiry instanceof Date
    ? parsed.data.license_expiry.toISOString().slice(0, 10)
    : String(parsed.data.license_expiry);
  await db.insert(driversTable).values({
    id: driverId,
    profileId,
    agencyId: DEMO.agency,
    licenseNumber: parsed.data.license_number,
    licenseExpiry,
    status: "available",
  });
  res.status(201).json(CreateDriverResponse.parse({
    id: driverId,
    ...parsed.data,
    status: "available",
    expiring_soon: new Date(parsed.data.license_expiry).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000,
  }));
});

// ─────────────────────────────────────────────
// DRIVER
// ─────────────────────────────────────────────

router.get("/driver/summary", async (_req, res): Promise<void> => {
  await ensureWorkspace("driver", DEMO.driver, "Arjun Mehta", "arjun@westernarc.in");
  const rows = await db.select().from(bookingsTable).where(eq(bookingsTable.driverId, DEMO.driverRecord));
  const views = await Promise.all(rows.map(bookingView));
  const active = views.find((item) => ["matched", "in_transit"].includes(item.status)) ?? null;
  res.json(GetDriverSummaryResponse.parse({
    today_count: views.length,
    completed_count: views.filter((item) => item.status === "completed").length,
    today_earnings: views.filter((item) => item.status === "completed").reduce((sum, item) => sum + Math.round(item.total_fare * 0.18), 0) || 4120,
    active_trip: active,
  }));
});

router.get("/driver/trips", async (_req, res): Promise<void> => {
  await ensureWorkspace("driver", DEMO.driver, "Arjun Mehta", "arjun@westernarc.in");
  res.json(ListDriverTripsResponse.parse(await bookingsFor(eq(bookingsTable.driverId, DEMO.driverRecord))));
});

router.post("/driver/trips/:bookingId/status", async (req, res): Promise<void> => {
  const params = UpdateTripStatusParams.safeParse(req.params);
  const body = UpdateTripStatusBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid trip status" });
    return;
  }
  const booking = (await db.select().from(bookingsTable).where(eq(bookingsTable.id, params.data.bookingId)))[0];
  if (!booking) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }

  let newOtp = booking.otpCode;
  if (body.data.status === "in_transit") {
    newOtp = randomOtp();
  }

  // Handle overtime calculation on completion
  let overtimeCharge = numberValue(booking.overtimeCharge);
  if (body.data.status === "completed") {
    const timer = (await db.select().from(waitingTimersTable)
      .where(eq(waitingTimersTable.bookingId, booking.id)))[0];
    if (timer?.arrivedAt) {
      const elapsed = Math.floor((Date.now() - new Date(timer.arrivedAt).getTime()) / 60000);
      const freeMin = timer.freeMinutes ?? 45;
      const otMin = Math.max(0, elapsed - freeMin);
      overtimeCharge = otMin * 2; // ₹2/min
      if (otMin > 0) {
        await db.update(waitingTimersTable)
          .set({ overtimeMinutes: otMin, overtimeCharge: String(overtimeCharge) })
          .where(eq(waitingTimersTable.id, timer.id));
        const newTotal = numberValue(booking.baseFare) + numberValue(booking.tollCharge) + overtimeCharge;
        await db.update(bookingsTable)
          .set({ overtimeCharge: String(overtimeCharge), totalFare: String(Math.round(newTotal * 1.05)) })
          .where(eq(bookingsTable.id, booking.id));
      }
    }
  }

  await db.update(bookingsTable)
    .set({ status: body.data.status, otpCode: newOtp })
    .where(eq(bookingsTable.id, booking.id));
  const updated = (await db.select().from(bookingsTable).where(eq(bookingsTable.id, booking.id)))[0];
  res.json(UpdateTripStatusResponse.parse(await bookingView(updated)));
});

// Driver marks arrived at pickup — starts waiting timer
router.post("/driver/trips/:bookingId/arrived", async (req, res): Promise<void> => {
  const bookingId = req.params.bookingId;
  const booking = (await db.select().from(bookingsTable).where(eq(bookingsTable.id, bookingId)))[0];
  if (!booking) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }
  const existing = (await db.select().from(waitingTimersTable).where(eq(waitingTimersTable.bookingId, bookingId)))[0];
  if (!existing) {
    await db.insert(waitingTimersTable).values({
      id: randomUUID(),
      bookingId,
      arrivedAt: new Date(),
      freeMinutes: 45,
      overtimeMinutes: 0,
      overtimeCharge: "0",
    });
  }
  const timer = (await db.select().from(waitingTimersTable).where(eq(waitingTimersTable.bookingId, bookingId)))[0];
  res.json({
    booking_id: bookingId,
    arrived_at: timer.arrivedAt,
    free_minutes: timer.freeMinutes,
    overtime_rate_per_min: 2,
    message: "45-minute free window started. ₹2/min overtime after that.",
  });
});

// Get waiting timer status
router.get("/driver/trips/:bookingId/timer", async (req, res): Promise<void> => {
  const bookingId = req.params.bookingId;
  const timer = (await db.select().from(waitingTimersTable).where(eq(waitingTimersTable.bookingId, bookingId)))[0];
  if (!timer?.arrivedAt) {
    res.json({ booking_id: bookingId, arrived: false });
    return;
  }
  const elapsed = Math.floor((Date.now() - new Date(timer.arrivedAt).getTime()) / 60000);
  const freeMin = timer.freeMinutes ?? 45;
  const otMin = Math.max(0, elapsed - freeMin);
  res.json({
    booking_id: bookingId,
    arrived: true,
    arrived_at: timer.arrivedAt,
    elapsed_minutes: elapsed,
    free_minutes: freeMin,
    overtime_minutes: otMin,
    overtime_charge: otMin * 2,
    rate_per_min: 2,
  });
});

// Proof of delivery upload (accepts base64 image)
router.post("/driver/trips/:bookingId/pod", async (req, res): Promise<void> => {
  const bookingId = req.params.bookingId;
  const { pod_data_url, note } = req.body;
  if (!pod_data_url) {
    res.status(400).json({ error: "pod_data_url is required" });
    return;
  }
  const booking = (await db.select().from(bookingsTable).where(eq(bookingsTable.id, bookingId)))[0];
  if (!booking) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }
  // In production: upload to Supabase Storage. Here we acknowledge receipt.
  res.json({
    booking_id: bookingId,
    pod_uploaded: true,
    note: note ?? null,
    message: "Proof of delivery recorded successfully.",
  });
});

router.post("/driver/trips/:bookingId/location", async (req, res): Promise<void> => {
  const params = UpdateTripLocationParams.safeParse(req.params);
  const body = UpdateTripLocationBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid location" });
    return;
  }
  const existing = (await db.select().from(liveLocationsTable)
    .where(eq(liveLocationsTable.bookingId, params.data.bookingId))
    .orderBy(desc(liveLocationsTable.updatedAt)))[0];
  const values = { lat: String(body.data.lat), lng: String(body.data.lng), updatedAt: new Date() };
  if (existing) {
    await db.update(liveLocationsTable).set(values).where(eq(liveLocationsTable.id, existing.id));
  } else {
    await db.insert(liveLocationsTable).values({
      id: randomUUID(),
      driverId: DEMO.driverRecord,
      bookingId: params.data.bookingId,
      ...values,
    });
  }
  // Also update truck lat/lng
  const booking = (await db.select().from(bookingsTable).where(eq(bookingsTable.id, params.data.bookingId)))[0];
  if (booking?.truckId) {
    await db.update(trucksTable)
      .set({ lat: String(body.data.lat), lng: String(body.data.lng) })
      .where(eq(trucksTable.id, booking.truckId));
  }
  const location = (await db.select().from(liveLocationsTable)
    .where(eq(liveLocationsTable.bookingId, params.data.bookingId))
    .orderBy(desc(liveLocationsTable.updatedAt)))[0];
  res.json(UpdateTripLocationResponse.parse({
    booking_id: location.bookingId,
    lat: numberValue(location.lat),
    lng: numberValue(location.lng),
    updated_at: location.updatedAt,
  }));
});

export default router;