import {
  getGetDriverSummaryQueryKey,
  getListDriverTripsQueryKey,
  useGetDriverSummary,
  useListDriverTrips,
  useUpdateTripLocation,
  useUpdateTripStatus,
  type Booking,
  type TripStatusInputStatus,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, Camera, CheckCircle2, Clock3, MapPin, Navigation,
  PackageCheck, Radio, Route, ShieldCheck, Timer, Truck, Upload,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Shell, ErrorBlock, EmptyBlock, LoadingBlock, SectionTitle, StatCard, StatusPill } from '@/components/layout';

const money = (value = 0) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

// ─── Waiting timer component ──────────────────────────────────
function WaitingTimer({ bookingId }: { bookingId: string }) {
  const [timerData, setTimerData] = useState<any>(null);
  const [marking, setMarking] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pollTimer = useCallback(async () => {
    try {
      const r = await fetch(`/api/driver/trips/${bookingId}/timer`, { credentials: 'include' });
      if (r.ok) setTimerData(await r.json());
    } catch { /* ok */ }
  }, [bookingId]);

  useEffect(() => {
    pollTimer();
    intervalRef.current = setInterval(pollTimer, 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [pollTimer]);

  const markArrived = async () => {
    setMarking(true);
    try {
      const r = await fetch(`/api/driver/trips/${bookingId}/arrived`, {
        method: 'POST',
        credentials: 'include',
      });
      if (r.ok) { await pollTimer(); }
    } finally { setMarking(false); }
  };

  if (!timerData?.arrived) {
    return (
      <button
        onClick={markArrived}
        disabled={marking}
        className="btn-quiet flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold sm:col-span-2"
        data-testid={`button-mark-arrived-${bookingId}`}>
        <MapPin size={16} />
        {marking ? 'Marking arrived…' : 'Mark arrived at pickup'}
      </button>
    );
  }

  const elapsed = timerData.elapsed_minutes ?? 0;
  const free = timerData.free_minutes ?? 45;
  const remaining = Math.max(0, free - elapsed);
  const overtime = timerData.overtime_minutes ?? 0;
  const overtimeCharge = timerData.overtime_charge ?? 0;
  const pct = Math.min(100, (elapsed / free) * 100);

  return (
    <div className={`rounded-xl border p-4 sm:col-span-2 ${overtime > 0 ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-muted/30'}`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer size={16} className={overtime > 0 ? 'text-destructive' : 'text-accent'} />
          <span className="text-xs font-bold">Waiting timer</span>
        </div>
        {overtime > 0 ? (
          <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-bold text-destructive">
            Overtime: {money(overtimeCharge)}
          </span>
        ) : (
          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-bold text-accent">
            {remaining} min free remaining
          </span>
        )}
      </div>
      {/* Progress bar */}
      <div className="h-2 overflow-hidden rounded-full bg-border">
        <div
          className={`h-full rounded-full transition-all ${overtime > 0 ? 'bg-destructive' : 'bg-accent'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
        <span>Arrived {new Date(timerData.arrived_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <span>{elapsed} min elapsed · ₹2/min after {free} min</span>
      </div>
    </div>
  );
}

// ─── POD Upload component ─────────────────────────────────────
function PodUpload({ bookingId, tripStatus }: { bookingId: string; tripStatus: string }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (tripStatus !== 'in_transit' && tripStatus !== 'completed') return null;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const upload = async () => {
    if (!preview) return;
    setUploading(true);
    try {
      const r = await fetch(`/api/driver/trips/${bookingId}/pod`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pod_data_url: preview, note }),
      });
      if (r.ok) setUploaded(true);
    } finally { setUploading(false); }
  };

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 sm:col-span-2">
      <div className="mb-3 flex items-center gap-2">
        <Camera size={16} className="text-accent" />
        <span className="text-xs font-bold">Proof of Delivery (POD)</span>
      </div>
      {uploaded ? (
        <div className="flex items-center gap-2 text-xs font-bold text-accent">
          <CheckCircle2 size={14} /> POD uploaded successfully
        </div>
      ) : (
        <>
          {preview ? (
            <img src={preview} alt="POD preview" className="mb-3 h-28 w-full rounded-lg object-cover" />
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-5 text-xs text-muted-foreground hover:border-accent hover:text-accent transition"
              data-testid={`button-pod-choose-${bookingId}`}>
              <Upload size={16} /> Tap to capture or choose photo
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
          <input
            value={note} onChange={(e) => setNote(e.target.value)}
            className="field mb-3 w-full rounded-lg px-3 py-2 text-xs"
            placeholder="Delivery note (optional)" />
          <button
            onClick={upload} disabled={!preview || uploading}
            className="btn-secondary w-full rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50"
            data-testid={`button-pod-upload-${bookingId}`}>
            {uploading ? 'Uploading…' : 'Upload Proof of Delivery'}
          </button>
        </>
      )}
    </div>
  );
}

// ─── Auto-GPS location sender ─────────────────────────────────
function useAutoGps(bookingId: string, active: boolean) {
  const sendLocation = useUpdateTripLocation();
  const watchRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback((lat: number, lng: number) => {
    sendLocation.mutate({ bookingId, data: { lat, lng } });
  }, [bookingId]);

  useEffect(() => {
    if (!active) {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    if (!navigator.geolocation) {
      setError('Geolocation not available in this browser');
      return;
    }

    let lastLat = 0, lastLng = 0;

    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        lastLat = pos.coords.latitude;
        lastLng = pos.coords.longitude;
        setCoords({ lat: lastLat, lng: lastLng });
        setError(null);
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    // Send location every 10 seconds
    intervalRef.current = setInterval(() => {
      if (lastLat && lastLng) send(lastLat, lastLng);
    }, 10000);

    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active, send]);

  return { coords, error, isPending: sendLocation.isPending };
}

// ─── Trip card ────────────────────────────────────────────────
function TripCard({ trip }: { trip: Booking }) {
  const statusMutation = useUpdateTripStatus();
  const client = useQueryClient();
  const isActive = trip.status === 'matched' || trip.status === 'in_transit';
  const isInTransit = trip.status === 'in_transit';

  const { coords, error: gpsError } = useAutoGps(trip.id, isInTransit);

  const updateStatus = (next: TripStatusInputStatus) =>
    statusMutation.mutate(
      { bookingId: trip.id, data: { status: next } },
      {
        onSuccess: () => {
          client.invalidateQueries({ queryKey: getListDriverTripsQueryKey() });
          client.invalidateQueries({ queryKey: getGetDriverSummaryQueryKey() });
        },
      }
    );

  return (
    <div className="surface overflow-hidden rounded-2xl">
      <div className="border-b border-border bg-secondary p-5 text-secondary-foreground md:p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="eyebrow text-primary">Assigned trip</p>
            <h2 className="mt-2 text-xl font-extrabold">
              {trip.pickup_address} <span className="text-primary">→</span> {trip.drop_address}
            </h2>
            <p className="mt-2 text-xs text-white/55">
              {trip.distance_km} km · {trip.truck_type} truck · Booking #{trip.id.slice(-6).toUpperCase()}
            </p>
          </div>
          <StatusPill status={trip.status} />
        </div>
      </div>

      <div className="grid gap-6 p-5 md:p-6 lg:grid-cols-[1fr_.9fr]">
        {/* Left: Trip actions */}
        <div>
          <p className="eyebrow">Trip actions</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {trip.status === 'matched' && (
              <>
                <WaitingTimer bookingId={trip.id} />
                <button
                  onClick={() => updateStatus('in_transit')}
                  disabled={statusMutation.isPending}
                  className="btn-primary flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold sm:col-span-2"
                  data-testid={`button-start-trip-${trip.id}`}>
                  <Navigation size={16} /> Start trip
                </button>
              </>
            )}
            {trip.status === 'in_transit' && (
              <button
                onClick={() => updateStatus('completed')}
                disabled={statusMutation.isPending}
                className="btn-primary flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold sm:col-span-2"
                data-testid={`button-complete-trip-${trip.id}`}>
                <CheckCircle2 size={16} /> Mark delivered
              </button>
            )}
            {isActive && (
              <button
                onClick={() => updateStatus('cancelled')}
                disabled={statusMutation.isPending}
                className="btn-quiet rounded-xl px-3 py-3 text-sm font-bold"
                data-testid={`button-cancel-trip-${trip.id}`}>
                Unable to complete
              </button>
            )}
            <PodUpload bookingId={trip.id} tripStatus={trip.status} />
          </div>

          {/* OTP display */}
          <div className="mt-6 rounded-xl bg-muted p-4">
            <div className="flex items-start gap-3">
              <PackageCheck size={18} className="mt-0.5 text-accent" />
              <div>
                <p className="text-sm font-bold">Delivery handoff OTP</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Show this code to the recipient at the drop point for delivery confirmation.
                </p>
                {trip.otp_code && (
                  <p
                    className="mono mt-3 text-2xl font-bold tracking-[.2em] text-accent"
                    data-testid={`text-trip-otp-${trip.id}`}>
                    {trip.otp_code}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: GPS status */}
        <div>
          <p className="eyebrow">Live location</p>
          <div className="mt-4 rounded-xl border border-border p-4">
            {isInTransit ? (
              <>
                <div className="mb-3 flex items-center gap-2 text-xs font-bold text-accent">
                  <span className="status-dot" /> GPS tracking active — sending every 10s
                </div>
                {coords ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-muted px-3 py-2">
                        <p className="text-[10px] text-muted-foreground">Latitude</p>
                        <p className="mono text-xs font-bold">{coords.lat.toFixed(5)}</p>
                      </div>
                      <div className="rounded-lg bg-muted px-3 py-2">
                        <p className="text-[10px] text-muted-foreground">Longitude</p>
                        <p className="mono text-xs font-bold">{coords.lng.toFixed(5)}</p>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Sharing live coordinates with the customer</p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Acquiring GPS signal…</p>
                )}
                {gpsError && (
                  <div className="mt-2 flex items-start gap-2 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                    <span>{gpsError}. Location updates paused.</span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 py-4 text-center text-xs text-muted-foreground">
                <Radio size={22} className="text-border" />
                <div>
                  <p className="font-semibold">Location sharing paused</p>
                  <p className="mt-1">GPS will activate automatically when you start the trip.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Driver page ─────────────────────────────────────────
export default function Driver({ session }: { session?: any }) {
  const summary = useGetDriverSummary({ query: { queryKey: getGetDriverSummaryQueryKey(), retry: 1 } });
  const trips = useListDriverTrips({ query: { queryKey: getListDriverTripsQueryKey() } });
  const active = summary.data?.active_trip ?? trips.data?.find((t) => t.status === 'matched' || t.status === 'in_transit');
  const completed = trips.data?.filter((t) => t.status === 'completed') ?? [];

  return (
    <Shell role="driver" session={session} title="Make today count." subtitle="Your next movement is clear. Keep the handoff clean.">
      <div className="mb-7 flex items-center gap-2 text-sm text-muted-foreground">
        <span className="status-dot text-accent" /> Dispatch is live{' '}
        <span className="mx-1 text-border">/</span> GPS auto-tracks when trip starts
      </div>

      {summary.isLoading || trips.isLoading ? (
        <LoadingBlock />
      ) : summary.isError || trips.isError ? (
        <ErrorBlock onRetry={() => { summary.refetch(); trips.refetch(); }} />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Today's trips" value={summary.data?.today_count ?? 0} detail="Assigned to you" icon={Route} />
            <StatCard label="Completed trips" value={summary.data?.completed_count ?? 0} detail="All time" icon={CheckCircle2} tone="accent" />
            <StatCard label="Today's earnings" value={money(summary.data?.today_earnings)} detail="Before settlement" icon={ShieldCheck} tone="dark" />
          </div>

          <div className="mt-8">
            <SectionTitle eyebrow="The next handoff" title="Your active trip" />
            {active ? (
              <TripCard trip={active} />
            ) : (
              <EmptyBlock
                title="No trip on deck"
                detail="You are clear for now. New assignments will appear here as dispatch sends them."
                action={
                  <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock3 size={14} /> Check back when dispatch pings you
                  </div>
                }
              />
            )}
          </div>

          <div className="mt-9">
            <SectionTitle eyebrow="Trip log" title="Completed today" />
            {completed.length === 0 ? (
              <EmptyBlock title="Nothing closed yet" detail="Your completed trips will be recorded here." />
            ) : (
              <div className="surface overflow-hidden rounded-2xl">
                {completed.map((trip) => (
                  <div key={trip.id} className="flex flex-col gap-3 border-b border-border/70 p-5 last:border-0 sm:flex-row sm:items-center" data-testid={`row-driver-trip-${trip.id}`}>
                    <span className="rounded-xl bg-accent/12 p-2 text-accent"><CheckCircle2 size={17} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{trip.pickup_address} <span className="text-primary">→</span> {trip.drop_address}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{trip.distance_km} km · {new Date(trip.created_at).toLocaleDateString()}</p>
                    </div>
                    <p className="font-extrabold">{money(trip.total_fare)}</p>
                    <StatusPill status={trip.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </Shell>
  );
}