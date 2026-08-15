# TruckLink

TruckLink is a regional logistics workspace connecting customers, transport agencies, and drivers around booking, dispatch, live trip progress, and delivery completion.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/trucklink run dev` — run the TruckLink web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — the managed PostgreSQL connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/trucklink/src/` — role entry, customer, agency, fleet, and driver screens
- `artifacts/api-server/src/routes/trucklink.ts` — TruckLink session, booking, fleet, trip, location, and pricing routes
- `lib/api-spec/openapi.yaml` — source of truth for the API contract
- `lib/db/src/schema/index.ts` — PostgreSQL schema for profiles, agencies, fleet, bookings, payments, and live locations
- `lib/api-client-react/src/generated/` — generated React Query hooks and types

## Architecture decisions

- The first runnable build uses the managed PostgreSQL database and generated API contracts so the full workflow works without requiring an external service connection.
- Session entry is role-based and uses an HTTP-only session cookie; the API keeps the integration boundary ready for a later Supabase Auth migration.
- Booking payment is modeled as escrow-held until delivery OTP verification changes both the booking and payment status to released.
- Live trip location is persisted and polled through the API, leaving the frontend ready to swap in Supabase Realtime once that connection is authorized.

## Product

Customers can estimate and book a truck, see active trips and live location, review history, and complete delivery with an OTP. Agencies can review incoming work, assign fleet resources, view earnings, and manage trucks and drivers. Drivers can view assigned trips, update trip status, and send live location.

## User preferences

- Keep the product oriented around three distinct workspaces: customer, agency, and driver.

## Gotchas

- After changing `lib/api-spec/openapi.yaml`, run `pnpm --filter @workspace/api-spec run codegen` before using generated hooks or API Zod schemas.
- Use the generated API hooks in the frontend and the shared PostgreSQL schema in the backend.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
