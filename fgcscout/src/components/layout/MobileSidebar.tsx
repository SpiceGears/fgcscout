"use client"

import { useState, useMemo } from 'react';
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
import { Home, Users, CalendarDays, Info, ScrollText, Code, Swords } from "lucide-react";
import { FaGithub } from 'react-icons/fa';


export default function MobileSidebar() {
    const [isOpen, setIsOpen] = useState(false);
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

    const handleLinkClick = () => {
        setIsOpen(false);
    };

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
                <button className="flex 2xl:hidden hover:bg-gray-700 rounded-full h-8 w-8 items-center justify-center text-white" aria-label="Toggle Mobile Menu">
                    <Menu className="h-5 w-5" />
                </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 bg-gray-950 p-0 border-r-0 [&>button]:hidden">
                <SheetHeader className="absolute top-0 left-0 right-0 p-4 pt-6 bg-gray-950">
                    <SheetTitle className="text-xl font-bold text-white text-center">Navigation</SheetTitle>
                </SheetHeader>

                <div className="flex-1 flex flex-col p-4 space-y-6 overflow-y-auto mt-16">
                    <nav className="flex-1 flex-col space-y-3">
                        {mainNavItems.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`
                                        flex items-center gap-3 p-2 rounded
                                        hover:bg-sky-700
                                        ${isActive ? 'bg-sky-800 font-bold' : ''}
                                    `}
                                    onClick={handleLinkClick}
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
                                        hover:bg-sky-700
                                        ${isActive ? 'bg-sky-800 font-bold' : ''}
                                    `}
                                    onClick={handleLinkClick}
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
            </SheetContent>
        </Sheet>
    )
}