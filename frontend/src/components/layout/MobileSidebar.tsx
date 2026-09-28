"use client"

import { useState } from 'react';
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Menu } from "lucide-react"
import { MAIN_NAV_ITEMS, OTHER_NAV_ITEMS } from "@/constants/Sidebar";


export default function MobileSidebar() {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();

    const handleLinkClick = () => {
        setIsOpen(false);
    };

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
                <button className="flex h-8 w-8 items-center justify-center rounded-md text-white transition hover:bg-emerald-800 lg:hidden" aria-label="Open navigation">
                    <Menu className="h-5 w-5" />
                </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-r border-gray-700 bg-gray-800 p-0 [&>button]:hidden">
                <SheetHeader className="border-b border-gray-700 p-5 text-left">
                    <SheetTitle className="text-left text-lg font-bold tracking-wide text-white">
                      FGC Scout
                    </SheetTitle>
                </SheetHeader>

                <div className="flex flex-1 flex-col overflow-y-auto p-4">
                    <p className="subtle-label px-3 pb-2">Explore</p>
                    <nav className="space-y-1">
                        {MAIN_NAV_ITEMS.map((item) => {
                            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${isActive ? "bg-sky-800 font-semibold text-white" : "text-gray-300 hover:bg-gray-700"}`}
                                    onClick={handleLinkClick}
                                >
                                    {React.createElement(item.icon, { className: `h-4 w-4 ${isActive ? "text-sky-300" : "text-gray-400"}` })}
                                    <span>{item.label}</span>
                                </Link>
                            )
                        })}
                    </nav>
                    <div className="my-5 h-px bg-slate-800" />
                    <p className="subtle-label px-3 pb-2">Project</p>
                    <nav className="space-y-1">
                        {OTHER_NAV_ITEMS.map((item) => {
                            const isActive = pathname.startsWith(item.href);

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${isActive ? "bg-sky-800 font-semibold text-white" : "text-gray-400 hover:bg-gray-700"}`}
                                    onClick={handleLinkClick}
                                >
                                    {React.createElement(item.icon, { className: `h-4 w-4 ${isActive ? "text-sky-300" : "text-gray-400"}` })}
                                    <span>{item.label}</span>
                                </Link>
                            )
                        })}
                    </nav>
                </div>
            </SheetContent>
        </Sheet>
    )
}
