export default function TermsPage() {
  const operator = process.env.NEXT_PUBLIC_SITE_OPERATOR?.trim() || "the FGC Scout deployment operator";
  const contact = process.env.NEXT_PUBLIC_PRIVACY_CONTACT?.trim();

  return (
    <main className="page-shell">
      <article className="page-container max-w-3xl">
        <header className="border-b border-slate-800 pb-8">
          <p className="eyebrow">Project information</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-white">Terms and disclaimer</h1>
          <p className="mt-3 text-slate-500">Last updated 29 September 2026</p>
        </header>

        <div className="space-y-8 py-8 text-[15px] leading-7 text-slate-400">
          <section>
            <h2 className="font-semibold text-slate-100">Independent project</h2>
            <p className="mt-2">FGC Scout is an independent community project operated by {operator}. It is not an official FIRST Global service and is not operated, sponsored, endorsed or maintained by FIRST Global. FIRST, FIRST Global and related names and marks belong to their respective owners.</p>
          </section>
          <section>
            <h2 className="font-semibold text-slate-100">Informational use</h2>
            <p className="mt-2">The site reorganizes publicly available competition information to make matches, rankings, teams and awards easier to explore. It is provided for informational and scouting purposes. Official event publications and decisions always take priority.</p>
          </section>
          <section>
            <h2 className="font-semibold text-slate-100">Accuracy and availability</h2>
            <p className="mt-2">Schedules and results may change, contain delays or be corrected after publication. No guarantee is made that the service will be uninterrupted, complete or error-free. Do not rely on FGC Scout as the sole source for an official competition decision.</p>
          </section>
          <section>
            <h2 className="font-semibold text-slate-100">Acceptable use</h2>
            <p className="mt-2">You may browse and link to public pages for lawful personal, educational and competition-related purposes. You must not attempt to bypass administration controls, disrupt the service, overload it with automated requests, introduce malicious code or misrepresent FGC Scout as an official FIRST Global service.</p>
          </section>
          <section>
            <h2 className="font-semibold text-slate-100">Third-party services</h2>
            <p className="mt-2">YouTube videos and external links are provided by third parties and remain subject to their own terms. Using the embedded YouTube player is also subject to the <a className="text-sky-400 hover:underline" href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer">YouTube Terms of Service</a> and <a className="text-sky-400 hover:underline" href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google Privacy Policy</a>.</p>
          </section>
          <section>
            <h2 className="font-semibold text-slate-100">Corrections and contact</h2>
            <p className="mt-2">To report an incorrect result, rights issue or other problem, contact {contact ? <a className="text-sky-400 hover:underline" href={`mailto:${contact}`}>{contact}</a> : "the deployment operator using the published contact details"}.</p>
          </section>
        </div>
      </article>
    </main>
  );
}
