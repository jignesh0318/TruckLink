import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGetSession, getGetSessionQueryKey, type Session } from '@workspace/api-client-react';
import { type ReactNode } from 'react';
import { Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import Customer from '@/pages/customer';
import Agency from '@/pages/agency';
import Fleet from '@/pages/fleet';
import Driver from '@/pages/driver';
import Home from '@/pages/home';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: true } } });

function Guarded({ role, children }: { role: Session['role']; children: (session: Session) => ReactNode }) {
  const session = useGetSession({ query: { queryKey: getGetSessionQueryKey(), retry: false } });
  if (session.isLoading) return <div className="app-shell flex min-h-[100dvh] items-center justify-center"><div className="surface w-full max-w-sm rounded-2xl p-7"><div className="h-4 w-32 animate-pulse rounded bg-muted" /><div className="mt-5 h-3 w-full animate-pulse rounded bg-muted" /><div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-muted" /></div></div>;
  if (session.isError || !session.data) return <Redirect to="/" />;
  if (session.data.role !== role) return <Redirect to={`/${session.data.role}`} />;
  return <>{children(session.data)}</>;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch><Route path="/" component={Home} /><Route path="/customer">{() => <Guarded role="customer">{(session) => <Customer session={session} />}</Guarded>}</Route><Route path="/agency">{() => <Guarded role="agency">{(session) => <Agency session={session} />}</Guarded>}</Route><Route path="/agency/fleet">{() => <Guarded role="agency">{(session) => <Fleet session={session} />}</Guarded>}</Route><Route path="/driver">{() => <Guarded role="driver">{(session) => <Driver session={session} />}</Guarded>}</Route><Route component={NotFound} /></Switch></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;