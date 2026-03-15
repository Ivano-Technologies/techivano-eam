/**
 * Marketing/landing page for techivano.com (apex).
 * Shown when host is techivano.com or www.techivano.com. No EAM app or login here.
 */
const NRCS_EAM_URL = "https://nrcseam.techivano.com";
const IVANO_STAFF_URL = "https://admin.techivano.com";

export default function Marketing() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <span className="text-lg font-semibold tracking-tight">Techivano</span>
          <nav className="flex gap-4 text-sm">
            <a href="#product" className="text-slate-400 hover:text-white transition-colors">Product</a>
            <a href="#access" className="text-slate-400 hover:text-white transition-colors">Access</a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
        <section className="text-center mb-20">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl mb-4">
            Enterprise Asset Management
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10">
            Manage assets, work orders, and maintenance in one place. Built for organizations that need clarity and control.
          </p>
        </section>

        <section id="product" className="mb-20">
          <h2 className="text-2xl font-semibold mb-6">Product</h2>
          <ul className="grid gap-4 sm:grid-cols-2 text-slate-300">
            <li className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
              <strong className="text-white">Asset lifecycle</strong> — Track acquisition, assignment, maintenance, and retirement.
            </li>
            <li className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
              <strong className="text-white">Work orders</strong> — Schedule and complete maintenance with clear status and history.
            </li>
            <li className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
              <strong className="text-white">Multi-tenant</strong> — Separate data and branding per organization.
            </li>
            <li className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
              <strong className="text-white">Reports & compliance</strong> — Audits, depreciation, and compliance tracking.
            </li>
          </ul>
        </section>

        <section id="access" className="rounded-xl border border-slate-800 bg-slate-900/30 p-8">
          <h2 className="text-2xl font-semibold mb-4">Access</h2>
          <p className="text-slate-400 mb-6">
            Sign in to your organization’s instance or contact us for a demo.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href={NRCS_EAM_URL}
              className="inline-flex items-center justify-center rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-700 transition-colors"
            >
              NRCS EAM
            </a>
            <a
              href={IVANO_STAFF_URL}
              className="inline-flex items-center justify-center rounded-lg border border-slate-600 bg-slate-800/50 px-5 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800 hover:border-slate-500 transition-colors"
            >
              Ivano Staff
            </a>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            NRCS EAM: Nigerian Red Cross Society instance. Ivano Staff: Ivano Technologies internal.
          </p>
        </section>
      </main>

      <footer className="border-t border-slate-800 px-4 py-6 sm:px-6 mt-16">
        <div className="mx-auto max-w-4xl flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <span>© {new Date().getFullYear()} Techivano / Ivano Technologies</span>
          <div className="flex gap-6">
            <a href={`${NRCS_EAM_URL}/legal/terms`} className="hover:text-slate-400 transition-colors">Terms of Service</a>
            <a href={`${NRCS_EAM_URL}/legal/privacy`} className="hover:text-slate-400 transition-colors">Privacy Policy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
