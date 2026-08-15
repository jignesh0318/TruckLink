import { useDeleteSession, type Session } from '@workspace/api-client-react';
import { Bell, ChevronRight, CircleUserRound, LogOut, Radio, Truck, X } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Link, useLocation } from 'wouter';

type Role = 'customer' | 'agency' | 'driver';

const roleCopy: Record<Role, { label: string; icon: typeof Truck; nav: { href: string; label: string; icon: typeof Truck }[] }> = {
  customer: { label: 'Customer workspace', icon: Radio, nav: [{ href: '/customer', label: 'Overview', icon: Radio }] },
  agency: { label: 'Agency control room', icon: Truck, nav: [{ href: '/agency', label: 'Operations', icon: Radio }, { href: '/agency/fleet', label: 'Fleet & drivers', icon: Truck }] },
  driver: { label: 'Driver workspace', icon: Truck, nav: [{ href: '/driver', label: 'Today', icon: Radio }] },
};

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className={`flex items-center gap-2.5 ${compact ? '' : 'mb-10'}`} data-testid="link-brand">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[4px_4px_0_hsl(var(--accent))]">
        <Truck size={19} strokeWidth={2.5} />
      </span>
      <span className="font-extrabold tracking-tight text-[1.12rem]">Truck<span className="text-primary">Link</span></span>
    </Link>
  );
}

export function Shell({ role, session, title, subtitle, children }: { role: Role; session?: Session | null; title: string; subtitle: string; children: ReactNode }) {
  const [, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const logout = useDeleteSession();
  const info = roleCopy[role];
  const RoleIcon = info.icon;
  const handleLogout = () => logout.mutate(undefined, { onSuccess: () => setLocation('/') });
  return (
    <div className="app-shell noise md:flex">
      <aside className={`sidebar md:fixed md:inset-y-0 md:flex md:w-[254px] md:flex-col ${mobileOpen ? 'fixed inset-0 z-40 flex w-full flex-col p-6' : 'flex items-center justify-between gap-3 px-4 py-3 md:p-7'}`}>
        <div className={mobileOpen ? 'w-full' : 'flex items-center gap-4 md:block'}>
          <div className="flex items-center justify-between">
            <Brand />
            {mobileOpen && <button className="rounded-lg p-2 hover:bg-white/10" onClick={() => setMobileOpen(false)} data-testid="button-close-navigation"><X size={20} /></button>}
          </div>
          <div className="hidden border-t border-white/10 pt-5 md:block">
            <p className="eyebrow text-white/45">Workspace</p>
            <div className="mt-3 flex items-center gap-3 rounded-xl bg-white/8 p-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/80 text-white"><RoleIcon size={17} /></span>
              <div className="min-w-0"><p className="truncate text-sm font-bold">{info.label}</p><p className="truncate text-[11px] text-white/50">{session?.agency_name ?? session?.email ?? 'Connected workspace'}</p></div>
            </div>
          </div>
          <nav className={`${mobileOpen ? 'mt-10' : 'hidden md:block'} space-y-1 md:mt-9`}>
            <p className="eyebrow mb-3 text-white/45">Navigate</p>
            {info.nav.map((item) => {
              const ItemIcon = item.icon;
              return <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/10 hover:text-white" data-testid={`link-nav-${item.label.toLowerCase().replaceAll(' ', '-')}`}><ItemIcon size={17} /><span>{item.label}</span><ChevronRight size={14} className="ml-auto opacity-40" /></Link>;
            })}
          </nav>
        </div>
        <div className={`${mobileOpen ? 'mt-auto w-full' : 'hidden md:block'} border-t border-white/10 pt-4`}>
          <button onClick={handleLogout} disabled={logout.isPending} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-white/65 transition hover:bg-white/10 hover:text-white" data-testid="button-sign-out"><LogOut size={17} />{logout.isPending ? 'Signing out…' : 'Sign out'}</button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 md:ml-[254px]">
        <header className="flex items-center justify-between border-b border-border/70 px-5 py-4 md:px-10 md:py-6">
          <button className="rounded-lg p-2 hover:bg-muted md:hidden" onClick={() => setMobileOpen(true)} data-testid="button-open-navigation"><Truck size={20} /></button>
          <div className="hidden md:block"><p className="eyebrow">{info.label}</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight">{title}</h1><p className="mt-1 text-sm text-muted-foreground">{subtitle}</p></div>
          <div className="ml-auto flex items-center gap-3">
            <button className="relative rounded-xl border border-border p-2.5 text-muted-foreground transition hover:bg-muted" data-testid="button-notifications"><Bell size={17} /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary" /></button>
            <div className="hidden items-center gap-2.5 border-l border-border pl-4 sm:flex"><CircleUserRound size={21} className="text-accent" /><span className="max-w-[140px] truncate text-sm font-bold" data-testid="text-user-name">{session?.name ?? 'Workspace user'}</span></div>
          </div>
        </header>
        <div className="px-5 py-7 md:px-10 md:py-9">
          <div className="mb-7 md:hidden"><p className="eyebrow">{info.label}</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight">{title}</h1><p className="mt-1 text-sm text-muted-foreground">{subtitle}</p></div>
          {children}
        </div>
      </main>
    </div>
  );
}

export function StatCard({ label, value, detail, icon: Icon, tone = 'primary' }: { label: string; value: string | number; detail?: string; icon: typeof Truck; tone?: 'primary' | 'accent' | 'dark' }) {
  return <div className="surface animate-rise rounded-2xl p-5"><div className="flex items-start justify-between"><div><p className="eyebrow">{label}</p><p className="mt-3 text-2xl font-extrabold tracking-tight" data-testid={`stat-${label.toLowerCase().replaceAll(' ', '-')}`}>{value}</p>{detail && <p className="mt-1 text-xs text-muted-foreground" data-testid={`detail-${label.toLowerCase().replaceAll(' ', '-')}`}>{detail}</p>}</div><span className={`rounded-xl p-2.5 ${tone === 'dark' ? 'bg-secondary text-primary' : tone === 'accent' ? 'bg-accent/12 text-accent' : 'bg-primary/15 text-primary'}`}><Icon size={18} /></span></div></div>;
}

export function LoadingBlock({ lines = 3 }: { lines?: number }) {
  return <div className="surface rounded-2xl p-6" data-testid="state-loading"><div className="h-4 w-32 animate-pulse rounded bg-muted" />{Array.from({ length: lines }).map((_, index) => <div key={index} className="mt-5 h-10 animate-pulse rounded-lg bg-muted" />)}</div>;
}

export function ErrorBlock({ onRetry }: { onRetry: () => void }) {
  return <div className="surface rounded-2xl border-destructive/30 bg-destructive/5 p-6" data-testid="state-error"><p className="font-bold">Connection needs a second look</p><p className="mt-1 text-sm text-muted-foreground">TruckLink could not reach the local operations service.</p><button onClick={onRetry} className="btn-secondary mt-4 rounded-lg px-4 py-2 text-sm font-bold" data-testid="button-retry">Retry connection</button></div>;
}

export function EmptyBlock({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return <div className="surface flex min-h-[220px] flex-col items-center justify-center rounded-2xl p-8 text-center" data-testid="state-empty"><span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary"><Radio size={21} /></span><h3 className="font-bold">{title}</h3><p className="mt-1 max-w-xs text-sm text-muted-foreground">{detail}</p>{action}</div>;
}

export function StatusPill({ status }: { status: string }) {
  const label = status.replaceAll('_', ' ');
  const color = status === 'completed' || status === 'released' || status === 'available' ? 'text-accent bg-accent/12' : status === 'cancelled' ? 'text-destructive bg-destructive/10' : status === 'in_transit' || status === 'on_trip' ? 'text-primary-foreground bg-secondary' : 'text-secondary bg-primary/20';
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${color}`} data-testid={`status-${status}`}><span className="status-dot" />{label}</span>;
}

export function SectionTitle({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return <div className="mb-4 flex items-end justify-between gap-4"><div><p className="eyebrow">{eyebrow}</p><h2 className="mt-1 text-lg font-extrabold tracking-tight">{title}</h2></div>{action}</div>;
}