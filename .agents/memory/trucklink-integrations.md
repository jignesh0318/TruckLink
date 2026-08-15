---
name: TruckLink integration boundary
description: Current external-service decision for TruckLink's first runnable build.
---

TruckLink's first runnable build intentionally uses the managed PostgreSQL database and a local HTTP-only role session instead of Supabase Auth/Realtime/Storage, because the user cancelled the Supabase connection proposal. The API and UI keep clear seams for adding Supabase later.

**Why:** The product needed to be usable and testable immediately without blocking on external authorization, while preserving the requested customer, agency, and driver workflows.

**How to apply:** Treat Supabase setup, real email/password auth, Storage/POD uploads, Realtime GPS, OpenRouteService routing, and Razorpay test payments as follow-on integration work rather than silently assuming they are connected.