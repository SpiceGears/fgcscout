'use client';

import { useState } from 'react';
import Topbar from '@/components/layout/Topbar';
import Sidebar from './Sidebar';
import MobileSidebar from './MobileSidebar';

interface ClientLayoutProps {
  children: React.ReactNode;
}

export default function ClientLayout({ children }: ClientLayoutProps): React.ReactElement | null {

  return (
    <div className="flex min-h-screen">
      <Sidebar />
        <Topbar />
        <main className="p-4">
          {children}
        </main>
    </div>
  );
}