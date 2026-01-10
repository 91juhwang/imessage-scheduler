import { redirect } from "next/navigation";

import { getUserFromRequest } from "@/app/lib/auth/session";

export default async function Home() {
  const user = await getUserFromRequest();

  if (user) {
    redirect("/timeline");
  }

  redirect("/login");
}
