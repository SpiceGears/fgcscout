import type { Metadata } from "next";
import "./globals.css";
import Topbar from "@/components/layout/Topbar";
import ClientLayout from "@/components/layout/Layout";

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
      <body
        className={`antialiased`}
      >
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
