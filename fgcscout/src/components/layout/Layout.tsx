'use client';

import { useState } from 'react';
import Topbar from '@/components/layout/Topbar';
// import Sidebar from '@/components/layout/Sidebar';

interface ClientLayoutProps {
    children: React.ReactNode;
}

export default function ClientLayout({ children }: ClientLayoutProps): React.ReactElement | null {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="flex">
      {/* <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} /> */}
      <div className="flex-1">
        <Topbar toggleSidebar={toggleSidebar} />
        {children}
      </div>
    </div>
  );
}