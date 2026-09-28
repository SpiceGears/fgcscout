"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { MAIN_NAV_ITEMS, OTHER_NAV_ITEMS } from "@/constants/Sidebar";

export default function Sidebar() {
    const pathname = usePathname();
    const isCurrent = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);

    return (
        <aside className="fixed bottom-0 left-0 top-14 z-30 hidden w-60 flex-col border-r border-gray-700 bg-gray-800 lg:flex">
            <div className="flex flex-1 flex-col px-3 py-5">
                <p className="subtle-label px-3 pb-2">Explore</p>
                <nav className="space-y-1">
                    {MAIN_NAV_ITEMS.map((item) => {
                        const isActive = isCurrent(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition ${
                                  isActive
                                    ? "border-sky-700 bg-sky-800 font-semibold text-white"
                                    : "border-transparent text-gray-300 hover:bg-gray-700 hover:text-white"
                                }`}
                            >
                                {React.createElement(item.icon, {
                                    className: `h-4 w-4 ${isActive ? "text-sky-300" : "text-gray-400"}`,
                                })}
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>
                <div className="my-5 h-px bg-slate-800" />
                <p className="subtle-label px-3 pb-2">Project</p>
                <nav className="space-y-1">
                    {OTHER_NAV_ITEMS.map((item) => {
                        const isActive = isCurrent(item.href);

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition ${
                                  isActive
                                    ? "border-sky-700 bg-sky-800 font-semibold text-white"
                                    : "border-transparent text-gray-400 hover:bg-gray-700 hover:text-white"
                                }`}
                            >
                                {React.createElement(item.icon, {
                                    className: `h-4 w-4 ${isActive ? "text-sky-300" : "text-gray-400"}`,
                                })}
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>
                <div className="mt-auto px-3 pt-8">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-700">Independent data project</p>
                </div>
            </div>
        </aside>
    );
}
