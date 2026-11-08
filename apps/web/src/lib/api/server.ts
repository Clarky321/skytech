import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const SESSION_COOKIE = 'skytech_session';

function baseUrl(): string {
  return process.env.API_INTERNAL_URL ?? 'http://localhost:4000';
}

export class ServerApiError extends Error {
  constructor(readonly status: number) {
    super(`API responded ${String(status)}`);
  }
}

async function request(path: string, auth: boolean): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (auth) {
    const session = (await cookies()).get(SESSION_COOKIE);
    if (session) headers.Cookie = `${SESSION_COOKIE}=${session.value}`;
  }
  // Public pages are rendered per request in this phase (no stale cache after publishing).
  return fetch(`${baseUrl()}/api${path}`, { headers, cache: 'no-store' });
}

/** Public API: returns null on 404 (the page shows notFound()). */
export async function publicApi<T>(path: string): Promise<T | null> {
  const res = await request(path, false);
  if (res.status === 404) return null;
  if (!res.ok) throw new ServerApiError(res.status);
  return (await res.json()) as T;
}

/** Staff API from server components: forwards the session; 401 → login page. */
export async function adminApi<T>(path: string): Promise<T> {
  const res = await request(path, true);
  if (res.status === 401) redirect('/admin/login');
  if (!res.ok) throw new ServerApiError(res.status);
  return (await res.json()) as T;
}

export async function adminApiOrNull<T>(path: string): Promise<T | null> {
  const res = await request(path, true);
  if (res.status === 401) redirect('/admin/login');
  if (res.status === 404) return null;
  if (!res.ok) throw new ServerApiError(res.status);
  return (await res.json()) as T;
}

/** Public base URL of stored media (runtime value, so one build fits every environment). */
export function mediaBaseUrl(): string {
  return process.env.NEXT_PUBLIC_MEDIA_URL ?? 'http://localhost:9000/skytech-media';
}

export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}
