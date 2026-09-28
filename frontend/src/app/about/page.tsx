import { Database, RefreshCw, ScanSearch } from "lucide-react";

export default function AboutPage() {
  return (
    <main className="page-shell">
      <div className="page-container max-w-5xl">
        <header className="max-w-3xl border-b border-slate-800 pb-8">
          <p className="eyebrow">About the project</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">Competition data should be easy to use.</h1>
          <p className="mt-5 text-lg leading-8 text-slate-400">
            FGC Scout is an independent interface for exploring FIRST Global Challenge matches, teams, rankings and awards.
          </p>
        </header>

        <section className="grid gap-px overflow-hidden border-x border-b border-slate-800 bg-slate-800 md:grid-cols-3">
          {[
            { icon: ScanSearch, title: "Focused", copy: "Built for finding a team or result quickly, without navigating event software." },
            { icon: Database, title: "Traceable", copy: "Season data stays connected to individual matches and scoring breakdowns." },
            { icon: RefreshCw, title: "Current", copy: "Live season synchronization keeps schedules and results useful throughout an event." },
          ].map((item) => (
            <article key={item.title} className="bg-gray-900 p-6">
              <item.icon className="h-5 w-5 text-sky-400" />
              <h2 className="mt-8 font-semibold text-white">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">{item.copy}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-8 py-10 md:grid-cols-2">
          <div>
            <p className="subtle-label">What you can explore</p>
            <h2 className="mt-3 text-xl font-semibold text-white">One place for the whole competition</h2>
            <p className="mt-3 text-sm leading-7 text-slate-500">
              Browse season results, compare rankings, open detailed score breakdowns and follow a team&apos;s match history and awards without jumping between separate event pages.
            </p>
          </div>
          <div>
            <p className="subtle-label">Data and independence</p>
            <h2 className="mt-3 text-xl font-semibold text-white">Built around public event data</h2>
            <p className="mt-3 text-sm leading-7 text-slate-500">
              Competition information is collected from publicly available FIRST Global sources and organized for easier discovery. FGC Scout is an independent project and is not operated, endorsed or maintained by FIRST Global.
            </p>
          </div>
        </section>

        <section className="border-t border-slate-800 py-10">
          <h2 className="text-xl font-semibold text-white">Accuracy and availability</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">
            During an active event, schedules, participants and scores can change as official results are corrected. FGC Scout refreshes season data regularly, but the official event publication remains the authoritative source for competition decisions.
          </p>
        </section>
      </div>
    </main>
  );
}
