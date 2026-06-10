import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-16">
        <section className="space-y-6">
          <p className="text-sm font-medium uppercase tracking-wide text-[var(--accent)]">
            Facebook Marketplace · Brazil
          </p>
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
            Get alerted when used deals match your search
          </h1>
          <p className="max-w-xl text-lg text-[var(--muted)]">
            Save searches for items on Facebook Marketplace. When new listings appear within your
            price range, you will see them in your dashboard and get notified.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/sign-in"
              className="rounded-md bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
            >
              Get started
            </Link>
            <Link
              href="/dashboard"
              className="rounded-md border border-[var(--border)] px-5 py-2.5 text-sm font-medium hover:bg-[var(--card)]"
            >
              Go to dashboard
            </Link>
          </div>
        </section>

        <section className="mt-20 grid gap-6 sm:grid-cols-3">
          {[
            {
              title: "Save searches",
              description: "Keywords and optional min/max price in Brazilian reais.",
            },
            {
              title: "Automatic polling",
              description: "Background worker checks Marketplace on a schedule you control.",
            },
            {
              title: "Deal alerts",
              description: "New matches show up in your feed — no manual refreshing.",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5"
            >
              <h2 className="font-semibold">{feature.title}</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">{feature.description}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
