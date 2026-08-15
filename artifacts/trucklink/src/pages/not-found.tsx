import { ArrowLeft, Compass } from 'lucide-react';
import { Link } from 'wouter';

export default function NotFound() {
  return (
    <div className="app-shell flex min-h-[100dvh] items-center justify-center p-6">
      <div className="surface w-full max-w-md rounded-2xl p-8 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary"><Compass size={26} /></span>
        <p className="eyebrow mt-6">Route not found</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">This road ends here.</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">The page you are looking for is not part of this workspace.</p>
        <Link href="/" className="btn-secondary mt-6 inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold" data-testid="link-return-home"><ArrowLeft size={16} /> Return to TruckLink</Link>
      </div>
    </div>
  );
}
