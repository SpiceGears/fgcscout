import type { Metadata } from "next";
import "./globals.css";
import Topbar from "@/components/layout/Topbar";
import Sidebar from "@/components/layout/Sidebar";

export const metadata: Metadata = {
  title: "FGCScout",
  description: "App for scouting FGC matches",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Topbar />
        <div className="flex flex-grow mt-16">
          <Sidebar />
          <main className="flex-1 transition-all duration-300 ease-in-out 2xl:ml-70">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
