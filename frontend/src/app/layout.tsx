import type { Metadata } from "next";
import "./globals.css";
import Topbar from "@/components/layout/Topbar";
import Sidebar from "@/components/layout/Sidebar";
import Link from "next/link";

export const metadata: Metadata = {
  title: {
    default: "FGC Scout",
    template: "%s · FGC Scout",
  },
  description: "Independent match data, rankings and team profiles for the FIRST Global Challenge.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body>
        <Topbar />
        <div className="min-h-screen pt-14">
          <Sidebar />
          <main className="min-h-[calc(100vh-3.5rem)] lg:ml-60">
            {children}
            <footer className="border-t border-slate-800 px-6 py-6 text-xs text-slate-600">
              <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
                <p>Independent project. Not operated, endorsed or maintained by FIRST Global.</p>
                <nav className="flex gap-4" aria-label="Legal information">
                  <Link href="/privacy" className="hover:text-slate-300">Privacy</Link>
                  <Link href="/terms" className="hover:text-slate-300">Terms</Link>
                  <Link href="/about" className="hover:text-slate-300">About</Link>
                </nav>
              </div>
            </footer>
          </main>
        </div>
      </body>
    </html>
  );
}
