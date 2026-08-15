import { useCreateSession, type SessionInputRole } from '@workspace/api-client-react';
import { ArrowRight, BadgeCheck, CircleHelp, MapPin, Truck, UserRound, Warehouse } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';

const roles: { role: SessionInputRole; title: string; detail: string; icon: typeof Truck; tint: string }[] = [
  { role: 'customer', title: 'I need a truck', detail: 'Book a vehicle, follow the route, and close the delivery.', icon: MapPin, tint: 'bg-primary/15 text-primary' },
  { role: 'agency', title: 'I run a fleet', detail: 'Coordinate bookings, vehicles, drivers, and payouts.', icon: Warehouse, tint: 'bg-accent/15 text-accent' },
  { role: 'driver', title: 'I drive with TruckLink', detail: 'See your next trip, share location, and finish cleanly.', icon: UserRound, tint: 'bg-secondary text-primary' },
];

export default function Home() {
  const [, setLocation] = useLocation();
  const [selected, setSelected] = useState<SessionInputRole>('customer');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const session = useCreateSession();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    session.mutate({ data: { role: selected, name: name.trim(), email: email.trim() || undefined } }, { onSuccess: (created) => setLocation(`/${created.role}`) });
  };
  return <div className="app-shell noise grid min-h-[100dvh] overflow-hidden lg:grid-cols-[1.08fr_.92fr]">
    <section className="relative overflow-hidden bg-secondary px-6 py-8 text-secondary-foreground md:px-14 md:py-12 lg:px-20">
      <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full border-[70px] border-primary/15" /><div className="absolute -bottom-32 -left-24 h-72 w-72 rounded-full border-[42px] border-accent/20" />
      <div className="relative flex h-full flex-col"><div className="flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Truck size={19} /></span><span className="font-extrabold tracking-tight text-xl">Truck<span className="text-primary">Link</span></span></div>
        <div className="my-auto max-w-xl py-16"><p className="eyebrow text-primary">Regional logistics / 01</p><h1 className="mt-5 text-5xl font-extrabold leading-[1.02] tracking-[-.05em] md:text-7xl">Move with a clear line of sight.</h1><p className="mt-6 max-w-md text-base leading-7 text-white/65 md:text-lg">One calm control room for the people who book, coordinate, and drive the loads that keep a region moving.</p><div className="mt-10 flex flex-wrap gap-5 text-xs font-bold text-white/55"><span className="flex items-center gap-2"><BadgeCheck size={16} className="text-primary" /> Escrow-protected bookings</span><span className="flex items-center gap-2"><CircleHelp size={16} className="text-primary" /> Human support, when needed</span></div></div>
        <div className="flex items-center justify-between border-t border-white/10 pt-5 text-xs text-white/40"><span>Built for the roads between cities.</span><span className="mono">TL / 2024</span></div>
      </div>
    </section>
    <section className="flex items-center justify-center px-5 py-10 md:px-12"><div className="w-full max-w-lg">
      <div className="mb-8"><p className="eyebrow text-accent">Enter your workspace</p><h2 className="mt-3 text-3xl font-extrabold tracking-tight">Who are you moving as?</h2><p className="mt-2 text-sm text-muted-foreground">Choose a role to open the right set of tools.</p></div>
      <div className="space-y-3">{roles.map(({ role, title, detail, icon: Icon, tint }) => <button key={role} type="button" onClick={() => setSelected(role)} className={`surface flex w-full items-center gap-4 rounded-2xl p-4 text-left transition ${selected === role ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'hover:-translate-y-0.5'}`} data-testid={`button-role-${role}`}><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tint}`}><Icon size={20} /></span><span className="min-w-0 flex-1"><span className="block font-bold">{title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{detail}</span></span><span className={`h-3 w-3 rounded-full border-2 ${selected === role ? 'border-primary bg-primary' : 'border-border'}`} /></button>)}</div>
      <form onSubmit={submit} className="surface mt-6 rounded-2xl p-5 md:p-6"><p className="eyebrow">Your details</p><label className="mt-5 block text-sm font-bold">Name<input required value={name} onChange={(e) => setName(e.target.value)} className="field mt-2 w-full rounded-xl px-4 py-3 text-sm" placeholder="e.g. Anika Rao" data-testid="input-session-name" /></label><label className="mt-4 block text-sm font-bold">Work email <span className="font-normal text-muted-foreground">(optional)</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field mt-2 w-full rounded-xl px-4 py-3 text-sm" placeholder="you@company.com" data-testid="input-session-email" /></label><button disabled={session.isPending || !name.trim()} className="btn-primary mt-6 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-enter-workspace">{session.isPending ? 'Opening workspace…' : 'Open workspace'}<ArrowRight size={17} /></button>{session.isError && <p className="mt-3 text-center text-xs font-semibold text-destructive" data-testid="status-session-error">The workspace service is unavailable. Try again.</p>}</form>
      <p className="mt-5 text-center text-xs text-muted-foreground">Your session stays on this device until you sign out.</p>
    </div></section>
  </div>;
}