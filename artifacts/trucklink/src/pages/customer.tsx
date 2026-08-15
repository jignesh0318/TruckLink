import {
  getGetBookingLocationQueryKey,
  getGetCustomerBookingQueryKey,
  getGetCustomerSummaryQueryKey,
  getListCustomerBookingsQueryKey,
  useCreateBooking,
  useEstimateFare,
  useGetBookingLocation,
  useGetCustomerBooking,
  useGetCustomerSummary,
  useListCustomerBookings,
  useVerifyDeliveryOtp,
  type Booking,
  type BookingInput,
  type FareEstimate,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight, CheckCircle2, Clock3, Crosshair, FileText, MapPin,
  PackageCheck, Plus, Route, ShieldCheck, Truck, X,
} from 'lucide-react';
import { useCallback, useMemo, useState, type FormEvent } from 'react';
import { Shell, EmptyBlock, ErrorBlock, LoadingBlock, SectionTitle, StatCard, StatusPill } from '@/components/layout';
import { LiveMap } from '@/components/map';

const money = (value = 0) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const initialForm: BookingInput & { co_load: boolean } = {
  pickup_address: '',
  drop_address: '',
  truck_type: 'Medium',
  body_type: 'Closed',
  has_ac: false,
  stops: [],
  co_load: false,
};

// ─── Co-load match banner ────────────────────────────────────
function CoLoadBanner({ discount }: { discount: number }) {
  return (
    <div className="mt-3 flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/8 px-4 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
        <Truck size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-accent">Co-load match found!</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Share this truck with another booking going the same way. Save {discount}% on your fare.
        </p>
      </div>
    </div>
  );
}

// ─── Booking form ─────────────────────────────────────────────
function BookingForm({ onCreated }: { onCreated: (booking: Booking) => void }) {
  const [form, setForm] = useState(initialForm);
  const estimate = useEstimateFare();
  const create = useCreateBooking();
  const [estimateData, setEstimateData] = useState<FareEstimate | null>(null);
  const [coLoadMatch, setCoLoadMatch] = useState<{ discount: number } | null>(null);
  const [stopInput, setStopInput] = useState('');

  const update = (key: string, value: string | boolean | string[]) =>
    setForm((cur) => ({ ...cur, [key]: value }));

  const getEstimate = () => {
    if (!form.pickup_address || !form.drop_address) return;
    estimate.mutate(
      { data: { pickup_address: form.pickup_address, drop_address: form.drop_address, truck_type: form.truck_type } },
      {
        onSuccess: async (data) => {
          setEstimateData(data);
          // Check co-load match
          if (form.co_load || form.truck_type === 'Small') {
            try {
              const r = await fetch('/api/operations/coload-match', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pickup_lat: 19.076, pickup_lng: 72.8777, drop_lat: 18.52, drop_lng: 73.85 }),
                credentials: 'include',
              });
              const d = await r.json();
              if (d.match_found) setCoLoadMatch({ discount: d.discount_percent });
            } catch { /* ok */ }
          }
        },
      }
    );
  };

  const addStop = () => {
    if (!stopInput.trim() || (form.stops ?? []).length >= 4) return;
    update('stops', [...(form.stops ?? []), stopInput.trim()]);
    setStopInput('');
  };

  const removeStop = (i: number) =>
    update('stops', (form.stops ?? []).filter((_, idx) => idx !== i));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(
      { data: { ...form, co_load: form.co_load } as any },
      {
        onSuccess: (booking) => {
          onCreated(booking);
          setForm(initialForm);
          setEstimateData(null);
          setCoLoadMatch(null);
        },
      }
    );
  };

  const discount = coLoadMatch && form.co_load ? coLoadMatch.discount : 0;
  const displayedTotal = estimateData
    ? discount > 0
      ? Math.round(estimateData.total_fare * (1 - discount / 100))
      : estimateData.total_fare
    : null;

  return (
    <div className="surface rounded-2xl p-5 md:p-6">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <p className="eyebrow text-accent">New movement</p>
          <h2 className="mt-1 text-lg font-extrabold">Book a truck</h2>
        </div>
        <span className="rounded-xl bg-primary/15 p-2 text-primary"><Route size={19} /></span>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-bold">
          Pickup point
          <div className="relative mt-2">
            <MapPin className="absolute left-3 top-3.5 text-accent" size={17} />
            <input
              required minLength={3} value={form.pickup_address}
              onChange={(e) => update('pickup_address', e.target.value)}
              className="field w-full rounded-xl py-3 pl-10 pr-3 text-sm"
              placeholder="Warehouse, street, city" data-testid="input-pickup-address"
            />
          </div>
        </label>

        {/* Multi-stop inputs */}
        {(form.stops ?? []).length > 0 && (
          <div className="space-y-2">
            {(form.stops ?? []).map((stop, i) => (
              <div key={i} className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm">
                <MapPin size={14} className="text-muted-foreground shrink-0" />
                <span className="flex-1 truncate text-xs">{stop}</span>
                <button type="button" onClick={() => removeStop(i)} className="text-muted-foreground hover:text-destructive"><X size={14} /></button>
              </div>
            ))}
          </div>
        )}
        {(form.stops ?? []).length < 4 && (
          <div className="flex gap-2">
            <input
              value={stopInput}
              onChange={(e) => setStopInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addStop())}
              className="field flex-1 rounded-xl px-3 py-2 text-xs"
              placeholder="+ Add a stop (optional, max 4)"
            />
            <button type="button" onClick={addStop} className="btn-quiet rounded-xl px-3 py-2 text-xs font-bold">
              <Plus size={14} />
            </button>
          </div>
        )}

        <label className="block text-sm font-bold">
          Drop point
          <div className="relative mt-2">
            <Crosshair className="absolute left-3 top-3.5 text-primary" size={17} />
            <input
              required minLength={3} value={form.drop_address}
              onChange={(e) => update('drop_address', e.target.value)}
              className="field w-full rounded-xl py-3 pl-10 pr-3 text-sm"
              placeholder="Destination, street, city" data-testid="input-drop-address"
            />
          </div>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-bold">
            Truck size
            <select value={form.truck_type} onChange={(e) => update('truck_type', e.target.value)}
              className="field mt-2 w-full rounded-xl px-3 py-3 text-sm" data-testid="select-truck-type">
              <option value="Small">Small / 1–2T</option>
              <option value="Medium">Medium / 3–7T</option>
              <option value="Big">Big / 8T+</option>
            </select>
          </label>
          <label className="text-sm font-bold">
            Body
            <select value={form.body_type} onChange={(e) => update('body_type', e.target.value)}
              className="field mt-2 w-full rounded-xl px-3 py-3 text-sm" data-testid="select-body-type">
              <option value="Closed">Closed body</option>
              <option value="Open">Open body</option>
            </select>
          </label>
        </div>

        <div className="flex flex-col gap-2.5">
          <label className="flex items-center gap-3 rounded-xl bg-muted p-3 text-sm font-semibold">
            <input type="checkbox" checked={form.has_ac} onChange={(e) => update('has_ac', e.target.checked)}
              className="h-4 w-4 accent-[hsl(var(--primary))]" data-testid="input-ac-required" />
            Temperature-controlled / AC required
          </label>
          <label className="flex items-center gap-3 rounded-xl bg-accent/8 p-3 text-sm font-semibold border border-accent/20">
            <input type="checkbox" checked={form.co_load} onChange={(e) => update('co_load', e.target.checked)}
              className="h-4 w-4 accent-[hsl(var(--accent))]" data-testid="input-co-load" />
            <span>
              <span className="text-accent">Share this truck</span>
              <span className="ml-1 font-normal text-muted-foreground">— co-load &amp; save up to 18%</span>
            </span>
          </label>
        </div>

        {coLoadMatch && form.co_load && <CoLoadBanner discount={coLoadMatch.discount} />}

        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
          <button type="button" onClick={getEstimate}
            disabled={estimate.isPending || !form.pickup_address || !form.drop_address}
            className="btn-quiet flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold disabled:opacity-50"
            data-testid="button-estimate-fare">
            {estimate.isPending ? 'Calculating…' : 'Check fare'}<Clock3 size={16} />
          </button>
          <button type="submit"
            disabled={create.isPending || !form.pickup_address || !form.drop_address}
            className="btn-primary flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold disabled:opacity-50"
            data-testid="button-submit-booking">
            {create.isPending ? 'Booking…' : 'Book this route'}<ArrowRight size={16} />
          </button>
        </div>
      </form>

      {estimateData && (
        <div className="mt-5 rounded-xl border border-primary/30 bg-primary/8 p-4" data-testid="card-fare-estimate">
          <div className="flex items-end justify-between">
            <div>
              <p className="eyebrow text-primary">Route estimate</p>
              <p className="mt-1 text-sm font-bold">{estimateData.distance_km} km · taxes included</p>
            </div>
            <div className="text-right">
              {discount > 0 && (
                <p className="text-xs line-through text-muted-foreground">{money(estimateData.total_fare)}</p>
              )}
              <p className="text-2xl font-extrabold text-accent" data-testid="text-estimate-total">
                {money(displayedTotal ?? estimateData.total_fare)}
              </p>
            </div>
          </div>
          <div className="mt-3 flex justify-between text-xs text-muted-foreground">
            <span>Base {money(estimateData.base_fare)}</span>
            <span>Toll {money(estimateData.toll_charge)}</span>
            <span>GST {money(estimateData.gst)}</span>
            {discount > 0 && <span className="font-bold text-accent">−{discount}% co-load</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Active booking with Leaflet map ─────────────────────────
function ActiveBooking({ booking }: { booking: Booking }) {
  const detail = useGetCustomerBooking(booking.id, {
    query: { enabled: true, queryKey: getGetCustomerBookingQueryKey(booking.id) },
  });
  const currentBooking = (detail.data ?? booking) as any;
  const location = useGetBookingLocation(booking.id, {
    query: { queryKey: getGetBookingLocationQueryKey(booking.id), refetchInterval: 10000 },
  });

  return (
    <div className="surface overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-border p-5">
        <div>
          <p className="eyebrow text-accent">Live movement</p>
          <h2 className="mt-1 font-extrabold">
            Booking <span className="mono text-primary">#{currentBooking.id.slice(-6).toUpperCase()}</span>
          </h2>
        </div>
        <StatusPill status={currentBooking.status} />
      </div>

      {/* Leaflet map */}
      <LiveMap
        pickup={currentBooking.pickup_lat ? { lat: currentBooking.pickup_lat, lng: currentBooking.pickup_lng, label: 'Pickup' } : undefined}
        drop={currentBooking.drop_lat ? { lat: currentBooking.drop_lat, lng: currentBooking.drop_lng, label: 'Drop-off' } : undefined}
        driver={location.data ? { lat: location.data.lat, lng: location.data.lng, label: 'Driver' } : undefined}
        height="220px"
      />

      <div className="flex items-center justify-between border-b border-border/50 bg-muted/40 px-5 py-2.5 text-xs">
        <span className="font-bold">Driver location</span>
        <span className="text-muted-foreground" data-testid="text-location-status">
          {location.data
            ? `Updated ${new Date(location.data.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : 'Connecting…'}
        </span>
      </div>

      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <div>
          <p className="eyebrow">From → to</p>
          <p className="mt-1 text-sm font-bold" data-testid="text-active-route">
            {currentBooking.pickup_address} <span className="text-primary">→</span> {currentBooking.drop_address}
          </p>
        </div>
        <div>
          <p className="eyebrow">Your crew</p>
          <p className="mt-1 text-sm font-bold" data-testid="text-driver-assignment">
            {currentBooking.driver_name ?? 'Matching driver'}{' '}
            <span className="font-normal text-muted-foreground">· {currentBooking.truck_number ?? 'Truck pending'}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── OTP verification card ────────────────────────────────────
function OtpCard({ booking }: { booking: Booking }) {
  const [otp, setOtp] = useState('');
  const verify = useVerifyDeliveryOtp();
  const client = useQueryClient();

  if (booking.status !== 'in_transit' && booking.status !== 'completed') return null;

  return (
    <div className="surface rounded-2xl border-accent/30 bg-accent/5 p-5">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-accent/15 p-2 text-accent"><PackageCheck size={19} /></span>
        <div>
          <p className="eyebrow text-accent">Delivery close-out</p>
          <h3 className="mt-1 font-extrabold">Release payment when it arrives</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Ask your driver for the 4-digit OTP and enter it below to confirm delivery and release the escrow.
          </p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <input
          maxLength={4} value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          className="field mono w-32 rounded-xl px-4 py-3 text-center text-lg tracking-[.4em]"
          placeholder="••••" data-testid={`input-delivery-otp-${booking.id}`}
        />
        <button
          disabled={otp.length !== 4 || verify.isPending || booking.payment_status === 'released'}
          onClick={() =>
            verify.mutate(
              { bookingId: booking.id, data: { otp } },
              {
                onSuccess: () => {
                  client.invalidateQueries({ queryKey: getGetCustomerBookingQueryKey(booking.id) });
                  client.invalidateQueries({ queryKey: getGetCustomerSummaryQueryKey() });
                },
              }
            )
          }
          className="btn-secondary rounded-xl px-4 text-sm font-bold disabled:opacity-50"
          data-testid={`button-verify-otp-${booking.id}`}>
          {booking.payment_status === 'released' ? 'Payment released' : verify.isPending ? 'Verifying…' : 'Verify code'}
        </button>
      </div>
      {verify.isError && (
        <p className="mt-2 text-xs text-destructive" data-testid="status-otp-error">
          That code did not match. Check with your driver and try again.
        </p>
      )}
      {booking.payment_status === 'released' && (
        <div className="mt-3 flex items-center justify-between">
          <p className="flex items-center gap-2 text-xs font-bold text-accent" data-testid="status-otp-success">
            <CheckCircle2 size={15} /> Delivery closed and payment released.
          </p>
          <a
            href={`/api/customer/bookings/${booking.id}/invoice`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-secondary/10 px-3 py-1.5 text-xs font-bold text-secondary hover:bg-secondary/20 transition"
            data-testid={`link-invoice-${booking.id}`}>
            <FileText size={13} /> GST Invoice
          </a>
        </div>
      )}
    </div>
  );
}

// ─── Main Customer page ───────────────────────────────────────
export default function Customer({ session }: { session?: any }) {
  const summary = useGetCustomerSummary({ query: { queryKey: getGetCustomerSummaryQueryKey(), retry: 1 } });
  const bookings = useListCustomerBookings({ query: { queryKey: getListCustomerBookingsQueryKey() } });
  const client = useQueryClient();
  const [justBooked, setJustBooked] = useState<Booking | null>(null);

  const active = justBooked ?? summary.data?.active_booking ??
    bookings.data?.find((b) => ['pending', 'matched', 'in_transit'].includes(b.status));

  const history = useMemo(
    () => (bookings.data ?? []).filter((b) => b.status === 'completed' || b.status === 'cancelled'),
    [bookings.data]
  );

  const loading = summary.isLoading || bookings.isLoading;
  const error = summary.isError || bookings.isError;

  const greeting = `Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, ${session?.name?.split(' ')[0] ?? 'there'}`;

  return (
    <Shell role="customer" session={session} title={greeting} subtitle="Your freight, without the guesswork.">
      <div className="mb-7 flex items-center gap-2 text-sm text-muted-foreground">
        <span className="status-dot text-accent" /> All systems operational{' '}
        <span className="mx-1 text-border">/</span> Last sync just now
      </div>
      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorBlock onRetry={() => { summary.refetch(); bookings.refetch(); }} />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Active bookings" value={summary.data?.active_count ?? 0} detail="Moving or being matched" icon={Truck} />
            <StatCard label="Completed trips" value={summary.data?.completed_count ?? 0} detail="Delivered through TruckLink" icon={CheckCircle2} tone="accent" />
            <StatCard label="Total spend" value={money(summary.data?.total_spend)} detail="Across all movements" icon={ShieldCheck} tone="dark" />
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-[1.08fr_.92fr]">
            <div>
              <SectionTitle eyebrow="Plan a movement" title="Put a route on the board" />
              <BookingForm
                onCreated={(booking) => {
                  setJustBooked(booking);
                  client.invalidateQueries({ queryKey: getListCustomerBookingsQueryKey() });
                  client.invalidateQueries({ queryKey: getGetCustomerSummaryQueryKey() });
                }}
              />
            </div>
            <div className="space-y-6">
              {active ? (
                <>
                  <SectionTitle eyebrow="On the road" title="Your active booking" />
                  <ActiveBooking booking={active} />
                  <OtpCard booking={active} />
                </>
              ) : (
                <>
                  <SectionTitle eyebrow="On the road" title="No active movement" />
                  <EmptyBlock
                    title="The next load starts here"
                    detail="When you book a truck, the live route and driver details will appear in this space."
                  />
                </>
              )}
            </div>
          </div>

          <div className="mt-9">
            <SectionTitle eyebrow="Paper trail" title="Recent bookings" />
            {history.length === 0 ? (
              <EmptyBlock title="Your history is clear" detail="Completed movements will stay here for easy reference." />
            ) : (
              <div className="surface overflow-x-auto rounded-2xl">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-border text-xs text-muted-foreground">
                    <tr>
                      <th className="p-4 font-semibold">Route</th>
                      <th className="p-4 font-semibold">Date</th>
                      <th className="p-4 font-semibold">Truck</th>
                      <th className="p-4 font-semibold">Amount</th>
                      <th className="p-4 font-semibold">Status</th>
                      <th className="p-4 font-semibold">Invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((booking) => (
                      <tr key={booking.id} className="border-b border-border/60 last:border-0" data-testid={`row-booking-${booking.id}`}>
                        <td className="p-4 font-semibold">
                          {booking.pickup_address} <span className="text-primary">→</span> {booking.drop_address}
                        </td>
                        <td className="p-4 text-muted-foreground">{new Date(booking.created_at).toLocaleDateString()}</td>
                        <td className="p-4">{booking.truck_type}</td>
                        <td className="p-4 font-bold">{money(booking.total_fare)}</td>
                        <td className="p-4"><StatusPill status={booking.status} /></td>
                        <td className="p-4">
                          {booking.status === 'completed' && (
                            <a
                              href={`/api/customer/bookings/${booking.id}/invoice`}
                              target="_blank" rel="noreferrer"
                              className="flex items-center gap-1 text-xs font-bold text-accent hover:underline"
                              data-testid={`link-invoice-history-${booking.id}`}>
                              <FileText size={13} /> Invoice
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </Shell>
  );
}