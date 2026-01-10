"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/Button";

const NAV_LINKS = [
  { href: "/timeline", label: "Timeline" },
  { href: "/dashboard", label: "Dashboard" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-2">
      {NAV_LINKS.map((link) => {
        const isActive = pathname === link.href;

        return (
          <Button
            key={link.href}
            asChild
            variant={isActive ? "secondary" : "ghost"}
            className="hover:bg-indigo-700/15"
          >
            <Link href={link.href}>{link.label}</Link>
          </Button>
        );
      })}
    </div>
  );
}
