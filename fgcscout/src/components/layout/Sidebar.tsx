"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { MAIN_NAV_ITEMS, OTHER_NAV_ITEMS } from "@/constants/Sidebar";

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside
            className="
        fixed left-0 flex h-screen
        overflow-hidden
        flex-col justify-between bg-gray-800 text-gray-50a
        z-30
        w-70
        2xl:translate-x-0
        transform transition-transform duration-300 ease-in-out
        -translate-x-full
      "
        >
            <div className="flex-1 flex flex-col p-4 space-y-6">
                <nav className="flex-1 flex-col space-y-3">
                    {MAIN_NAV_ITEMS.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`
                                    flex items-center gap-3 p-2 rounded
                                    hover:bg-sky-700
                                    ${isActive ? "bg-sky-800 font-bold" : ""}
                                `}
                            >
                                {React.createElement(item.icon, {
                                    className: "h-5 w-5 text-gray-300",
                                })}
                                <span className="text-white">{item.label}</span>
                            </Link>
                        );
                    })}
                    <hr className="my-6 border-t border-gray-700" />
                    {OTHER_NAV_ITEMS.map((item) => {
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
                                    ${isActive ? "bg-sky-800 font-bold" : ""}
                                `}
                                {...linkProps}
                            >
                                {React.createElement(item.icon, {
                                    className: "h-5 w-5 text-gray-300",
                                })}
                                <span className="text-white">{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </aside>
    );
}