import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center text-center px-4">
      <div className="max-w-2xl">
        <div className="mb-6 inline-flex items-center rounded-full bg-fd-primary/10 px-4 py-1.5 text-sm font-medium text-fd-primary">
          Open Source Bus Tracking
        </div>
        <h1 className="mb-4 text-5xl font-bold tracking-tight">Mansariya</h1>
        <p className="mb-8 text-lg text-fd-muted-foreground">
          Sri Lanka&apos;s first crowdsource-powered real-time bus tracking system.
          No hardware on buses — passengers&apos; phones become the sensors.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/docs"
            className="inline-flex items-center rounded-lg bg-fd-primary px-6 py-3 text-sm font-medium text-white hover:bg-fd-primary/90 transition-colors"
          >
            Read the Docs
          </Link>
          <Link
            href="https://github.com/theetaz/mansariya"
            className="inline-flex items-center rounded-lg border border-fd-border px-6 py-3 text-sm font-medium hover:bg-fd-accent transition-colors"
          >
            GitHub
          </Link>
        </div>
      </div>
    </main>
  );
}
