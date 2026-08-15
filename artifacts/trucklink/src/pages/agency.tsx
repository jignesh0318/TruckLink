import {
  getGetAgencySummaryQueryKey,
  getListAgencyBookingsQueryKey,
  useAssignBooking,
  useGetAgencySummary,
  useListAgencyBookings,
  type Booking,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpRight, BadgeCheck, CheckCircle2, CircleDollarSign, Clock3,
  Filter, Package, RefreshCw, Truck, Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { ErrorBlock, EmptyBlock, LoadingBlock, SectionTitle, Shell, StatCard, StatusPill } from '@/components/layout';

const money = (value = 0) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

// ─── Booking row ──────────────────────────────────────────────
function BookingRow({ booking }: { booking: Booking }) {
  const assign = useAssignBooking();
  const client = useQueryClient();
  return (
    <div
      className="flex flex-col gap-4 border-b border-border/70 p-5 last:border-0 lg:flex-row lg:items-center"
      data-testid={`row-agency-booking-${booking.id}`}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="mt-1 rounded-lg bg-primary/15 p-2 text-primary"><Package size={16} /></span>
        <div className="min-w-0">
          <p className="font-bold">
            {booking.pickup_address} <span className="text-primary">→</span> {booking.drop_address}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {booking.distance_km} km · {booking.truck_type} · Received {new Date(booking.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
          {(booking as any).stops?.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              +{(booking as any).stops.length} stop{(booking as any).stops.length > 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 lg:justify-end">
        <div className="text-right">
          <p className="font-extrabold">{money(booking.total_fare)}</p>
          <p className="text-xs text-muted-foreground">customer fare</p>
        </div>
        <StatusPill status={booking.status} />
        {booking.status === 'pending' && (
          <button
            disabled={assign.isPending}
            onClick={() =>
              assign.mutate(
                { bookingId: booking.id },
                { onSuccess: () => client.invalidateQueries({ queryKey: getListAgencyBookingsQueryKey() }) }
              )
            }
            className="btn-primary rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50"
            data-testid={`button-assign-booking-${booking.id}`}>
            {assign.isPending ? 'Assigning…' : 'Assign nearest'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Earnings chart ───────────────────────────────────────────
const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function EarningsChart({ bookings }: { bookings: Booking[] }) {
  const today = new Date();
  const data = WEEK_DAYS.map((day, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(d); dayEnd.setHours(23, 59, 59, 999);
    const earnings = bookings
      .filter((b) => {
        const t = new Date(b.created_at).getTime();
        return b.status === 'completed' && t >= dayStart.getTime() && t <= dayEnd.getTime();
      })
      .reduce((s, b) => s + b.total_fare, 0);
    return { day, earnings };
  });

  // If all zeros, use demo sparkline data
  const hasData = data.some((d) => d.earnings > 0);
  const chartData = hasData
    ? data
    : WEEK_DAYS.map((day, i) => ({
        day,
        earnings: [12400, 18200, 9800, 21600, 15300, 24800, 19200][i],
      }));

  return (
    <div className="surface rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="eyebrow">Cashflow</p>
          <h3 className="mt-1 font-extrabold">Weekly earnings</h3>
        </div>
        <ArrowUpRight size={18} className="text-accent" />
      </div>
      <ResponsiveContainer width="100%" height={100}>
        <BarChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip
            formatter={(v: number) => [money(v), 'Earnings']}
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '10px',
              fontSize: '11px',
            }}
            cursor={{ fill: 'hsl(var(--muted))' }}
          />
          <Bar dataKey="earnings" radius={[4, 4, 0, 0]}>
            {chartData.map((_, i) => (
              <Cell
                key={i}
                fill={i === chartData.length - 1
                  ? 'hsl(var(--accent))'
                  : 'hsl(var(--primary) / 0.55)'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        <span>7-day window</span>
        <span className="text-accent font-semibold">{hasData ? 'Live data' : 'Demo data'}</span>
      </div>
    </div>
  );
}

// ─── Agency verified badge ────────────────────────────────────
function AgencyBadge() {
  return (
    <div className="surface rounded-2xl bg-secondary p-6 text-secondary-foreground">
      <div className="flex items-start gap-3">
        <BadgeCheck size={20} className="mt-0.5 text-primary shrink-0" />
        <div>
          <p className="eyebrow text-primary">Verified agency</p>
          <h3 className="mt-2 text-lg font-extrabold">Western Arc Logistics</h3>
          <p className="mt-1 text-xs text-white/55">GST: 27AABCU9603R1ZM</p>
          <p className="mt-0.5 text-xs text-white/55">Andheri East, Mumbai, Maharashtra</p>
        </div>
      </div>
      <div className="mt-5 border-t border-white/10 pt-4 text-xs text-white/45">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-primary" />
          Keep your fleet availability clean for fast dispatch
        </div>
      </div>
    </div>
  );
}

// ─── Main Agency page ─────────────────────────────────────────
export default function Agency({ session }: { session?: any }) {
  const summary = useGetAgencySummary({ query: { queryKey: getGetAgencySummaryQueryKey(), retry: 1 } });
  const list = useListAgencyBookings({ query: { queryKey: getListAgencyBookingsQueryKey() } });
  const [filter, setFilter] = useState('all');

  const bookings = useMemo(
    () => (list.data ?? []).filter((b) => filter === 'all' || b.status === filter),
    [list.data, filter]
  );

  const loading = summary.isLoading || list.isLoading;
  const error = summary.isError || list.isError;

  return (
    <Shell role="agency" session={session} title="Operations, in view." subtitle="The board is current. Keep every movement moving.">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="status-dot text-accent" /> Fleet network is healthy
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { summary.refetch(); list.refetch(); }}
            className="btn-quiet flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold"
            data-testid="button-refresh-agency">
            <RefreshCw size={14} /> Refresh board
          </button>
          <Link
            href="/agency/fleet"
            className="btn-secondary flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold"
            data-testid="link-manage-fleet">
            <Truck size={14} /> Manage fleet
          </Link>
        </div>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorBlock onRetry={() => { summary.refetch(); list.refetch(); }} />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Active loads" value={summary.data?.active_count ?? 0} detail="Across the network" icon={Truck} />
            <StatCard label="Completed" value={summary.data?.completed_count ?? 0} detail={`${summary.data?.completion_rate ?? 0}% completion rate`} icon={CheckCircle2} tone="accent" />
            <StatCard label="Total earnings" value={money(summary.data?.total_earnings)} detail="Gross processed" icon={CircleDollarSign} tone="dark" />
            <StatCard label="Pending payout" value={money(summary.data?.pending_payout)} detail="Next settlement cycle" icon={Clock3} />
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
            {/* Left: Dispatch board */}
            <section>
              <SectionTitle
                eyebrow="Dispatch board"
                title="Incoming & active bookings"
                action={
                  <div className="flex items-center gap-2">
                    <Filter size={14} className="text-muted-foreground" />
                    <select
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      className="field rounded-lg px-2 py-2 text-xs font-bold"
                      data-testid="select-booking-filter">
                      <option value="all">All loads</option>
                      <option value="pending">Needs assignment</option>
                      <option value="matched">Assigned</option>
                      <option value="in_transit">In transit</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                }
              />
              {bookings.length === 0 ? (
                <EmptyBlock
                  title="No loads in this view"
                  detail="New customer bookings will land here as they arrive."
                />
              ) : (
                <div className="surface overflow-hidden rounded-2xl">
                  {bookings.map((booking) => (
                    <BookingRow key={booking.id} booking={booking} />
                  ))}
                </div>
              )}
            </section>

            {/* Right: Sidebar cards */}
            <aside className="space-y-6">
              <AgencyBadge />
              <EarningsChart bookings={list.data ?? []} />
            </aside>
          </div>
        </>
      )}
    </Shell>
  );
}