export default function PrivacyPage() {
  const operator = process.env.NEXT_PUBLIC_SITE_OPERATOR?.trim() || "the FGC Scout deployment operator";
  const operatorAddress = process.env.NEXT_PUBLIC_OPERATOR_ADDRESS?.trim();
  const privacyContact = process.env.NEXT_PUBLIC_PRIVACY_CONTACT?.trim();
  const hostingProvider = process.env.NEXT_PUBLIC_HOSTING_PROVIDER?.trim();

  return (
    <main className="page-shell">
      <article className="page-container max-w-3xl">
        <header className="border-b border-slate-800 pb-8">
          <p className="eyebrow">Project information</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-white">Privacy</h1>
          <p className="mt-3 text-slate-500">Last updated 29 September 2026</p>
        </header>

        <div className="space-y-8 py-8 text-[15px] leading-7 text-slate-400">
          <section>
            <h2 className="font-semibold text-slate-100">Who is responsible</h2>
            <p className="mt-2">The controller responsible for this deployment is {operator}{operatorAddress ? `, ${operatorAddress}` : ""}. Privacy questions and requests can be sent {privacyContact ? <>to <a className="text-sky-400 hover:underline" href={`mailto:${privacyContact}`}>{privacyContact}</a></> : "using the operator contact details published with this deployment"}.</p>
          </section>
          <section>
            <h2 className="font-semibold text-slate-100">What is processed and why</h2>
            <p className="mt-2">FGC Scout has no public accounts, advertising, analytics or user profiles. To deliver pages and protect the service, the server and hosting infrastructure necessarily process technical data such as an IP address, requested URL, request time, browser information and errors. The purpose is to provide the service, diagnose faults, prevent abuse and maintain security. The legal basis is the operator&apos;s legitimate interest in operating a reliable and secure public website (Article 6(1)(f) GDPR).</p>
          </section>
          <section>
            <h2 className="font-semibold text-slate-100">Storage and recipients</h2>
            <p className="mt-2">FGC Scout disables proxy access logs and does not intentionally retain a public visitor history. Short-lived infrastructure, security or error logs may still be created and are normally removed within 30 days, unless a specific incident requires longer retention. Technical data may be processed by {hostingProvider ?? "the hosting provider selected by the operator"} and service providers needed to maintain the server.</p>
          </section>
          <section>
            <h2 className="font-semibold text-slate-100">Cookies and browser storage</h2>
            <p className="mt-2">Public browsing does not require FGC Scout analytics or advertising cookies. Protected administration tools use session storage to keep an administrator signed in for the current browser session. This is necessary for the requested administration function and is not used to track public visitors.</p>
          </section>
          <section>
            <h2 className="font-semibold text-slate-100">YouTube and external links</h2>
            <p className="mt-2">A match video is not loaded automatically. If you select “Load video” or open YouTube, your browser connects directly to Google/YouTube, which may receive your IP address, the page address and device information and may use cookies under its own policies. This may involve processing outside the European Economic Area. See the <a className="text-sky-400 hover:underline" href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google Privacy Policy</a> and <a className="text-sky-400 hover:underline" href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer">YouTube Terms</a>.</p>
          </section>
          <section>
            <h2 className="font-semibold text-slate-100">Competition information</h2>
            <p className="mt-2">The site displays public competition records such as countries, teams, schedules, scores, rankings and awards. It is not intended to collect private participant information. Corrections can be requested using the contact above; official FIRST Global publications remain authoritative.</p>
          </section>
          <section>
            <h2 className="font-semibold text-slate-100">Your rights</h2>
            <p className="mt-2">Where applicable, you may request access, correction, deletion or restriction of personal data and object to processing based on legitimate interests. You may also lodge a complaint with your local supervisory authority; in Poland this is the <a className="text-sky-400 hover:underline" href="https://uodo.gov.pl/" target="_blank" rel="noreferrer">President of the Personal Data Protection Office (UODO)</a>. Providing personal data is not a statutory requirement, and FGC Scout does not use automated decision-making or profiling.</p>
          </section>
          <section>
            <h2 className="font-semibold text-slate-100">Changes</h2>
            <p className="mt-2">This notice may be updated when the service, hosting or integrations change. The revision date above identifies the current version.</p>
          </section>
        </div>
      </article>
    </main>
  );
}
