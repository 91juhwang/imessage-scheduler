import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "sid";

function getSessionIdFromCookieHeader(cookieHeader: string | null) {
  if (!cookieHeader) {
    return null;
  }

  const parts = cookieHeader.split(";").map((part) => part.trim());
  for (const part of parts) {
    if (part.startsWith(`${SESSION_COOKIE_NAME}=`)) {
      return part.slice(`${SESSION_COOKIE_NAME}=`.length);
    }
  }

  return null;
}

export async function getSessionIdFromRequest(request?: Request) {
  if (request) {
    return getSessionIdFromCookieHeader(request.headers.get("cookie"));
  }

  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}
