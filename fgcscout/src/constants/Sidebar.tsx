import { Home, Users, CalendarDays, Swords, Info, ScrollText, Code } from "lucide-react";
import { FaGithub } from 'react-icons/fa';

export const MAIN_NAV_ITEMS = [
    { label: "Home", href: "/", icon: Home },
    { label: "Teams", href: "/teams", icon: Users },
    { label: "Matches", href: "/matches", icon: Swords },
    { label: "Seasons", href: "/seasons", icon: CalendarDays },
];

export const OTHER_NAV_ITEMS = [
    { label: "About", href: "/about", icon: Info },
    { label: "Privacy Policy", href: "/privacy", icon: ScrollText },
    { label: "API", href: "/api", icon: Code },
    { label: "Repository", href: "https://github.com/spicegears/fgcscout", icon: FaGithub, isExternal: true },
] 