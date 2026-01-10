import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/Badge";
import { getUserFromRequest } from "@/app/lib/auth/session";

import { LogoutButton } from "./_components/LogoutButton";
import { NavLinks } from "./_components/NavLinks";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUserFromRequest();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background text-zinc-900">
      <header className="bg-background">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-xl font-semibold">iMessage Scheduler</span>
            <Badge variant={user.paidUser ? "default" : "secondary"} className="text-indigo-900 bg-indigo-100 px-1.5 py-0.5 rounded-md text-xs font-medium">
              {user.paidUser ? "Paid" : "Free"}
            </Badge>
          </div>
          <nav className="flex items-center gap-2">
            <NavLinks />
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-6 py-6">{children}</main>
    </div>
  );
}
