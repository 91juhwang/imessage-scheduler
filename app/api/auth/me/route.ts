import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/app/lib/auth/session";

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    paid_user: user.paidUser,
  });
}
