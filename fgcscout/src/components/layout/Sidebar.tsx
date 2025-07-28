"use client"

import Link from "next/link";
import { useMemo } from "react";
import { Home, Users, CalendarDays, Info, ScrollText, Code, Swords } from "lucide-react";
import { FaGithub } from 'react-icons/fa';
import { usePathname } from "next/navigation";
import React from 'react';

export default function Sidebar() {
    const pathname = usePathname();

    const mainNavItems = useMemo(() => [
        { label: "Home", href: "/", icon: Home },
        { label: "Teams", href: "/teams", icon: Users },
        { label: "Matches", href: "/matches", icon: Swords },
        { label: "Seasons", href: "/seasons", icon: CalendarDays },
    ], []);

    const otherNavItems = useMemo(() => [
        { label: "About", href: "/about", icon: Info },
        { label: "Privacy Policy", href: "/privacy", icon: ScrollText },
        { label: "API", href: "/api", icon: Code },
        { label: "Repository", href: "https://github.com/spicegears/fgcscout", icon: FaGithub, isExternal: true },
    ], []);

    return (
        <aside
            className='sticky left-0 top-16 flex h-sreen w-fit flex-col justify-between bg-gray-950 pt-18 text-white max-sm:hidden lg:w-70'>
            <div className="flex-1 flex flex-col p-4 space-y-6 overflow-y-auto">
                <nav className="flex-1 flex-col space-y-3">
                    {mainNavItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`
                                    flex items-center gap-3 p-2 rounded
                                    hover:bg-gray-700
                                    ${isActive ? 'bg-gray-800 font-bold' : ''}
                                `}
                            >
                                {React.createElement(item.icon, { className: "h-5 w-5 text-gray-300" })}
                                <span className="text-white">
                                    {item.label}
                                </span>
                            </Link>
                        )
                    })}
                    <hr className="my-6 border-t border-gray-700" />
                    {otherNavItems.map((item) => {
                        const isExternal = item.isExternal;
                        const isActive = !isExternal && pathname === item.href;
                        const linkProps = isExternal
                            ? { target: "_blank", rel: "noopener noreferrer" }
                            : {};

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`
                                    flex items-center gap-3 p-2 rounded
                                    hover:bg-gray-700
                                    ${isActive ? 'bg-gray-800 font-bold' : ''}
                                `}
                                {...linkProps}
                            >
                                {React.createElement(item.icon, { className: "h-5 w-5 text-gray-300" })}
                                <span className="text-white">
                                    {item.label}
                                </span>
                            </Link>
                        )
                    })}
                </nav>
            </div>
        </aside>
    )
}