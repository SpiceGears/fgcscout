import { Home, Users, CalendarDays, Swords, Info, ScrollText, Scale } from "lucide-react";


export const MAIN_NAV_ITEMS = [
    { label: "Overview", href: "/", icon: Home },
    { label: "Teams", href: "/teams", icon: Users },
    { label: "Matches", href: "/matches", icon: Swords },
    { label: "Events", href: "/events", icon: CalendarDays },
];

export const OTHER_NAV_ITEMS = [
    { label: "About", href: "/about", icon: Info },
    { label: "Privacy", href: "/privacy", icon: ScrollText },
    { label: "Terms", href: "/terms", icon: Scale },
];
