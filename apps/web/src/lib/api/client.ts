'use client';

import { isProblemDetails, type ProblemDetails } from '@skytech/contracts';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly problem: ProblemDetails | null,
    readonly code: string | null,
  ) {
    super(problem?.detail ?? problem?.title ?? `Ошибка запроса (${String(status)})`);
  }

  /** Field errors from a 422/409 response, keyed by path. */
  fieldErrors(): Record<string, string> {
    return Object.fromEntries((this.problem?.errors ?? []).map((e) => [e.path, e.message]));
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Browser → same-origin `/api` (nginx in production, Next.js rewrite in dev).
 * The session cookie is httpOnly; the browser attaches it and the Origin header itself.
 */
export async function api<T>(
  path: string,
  options: { method?: Method; body?: unknown; form?: FormData; signal?: AbortSignal } = {},
): Promise<T> {
  const init: RequestInit = {
    method: options.method ?? 'GET',
    credentials: 'same-origin',
    ...(options.signal ? { signal: options.signal } : {}),
  };
  if (options.form) {
    init.body = options.form;
  } else if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
    init.headers = { 'Content-Type': 'application/json' };
  }

  let res: Response;
  try {
    res = await fetch(`/api${path}`, init);
  } catch {
    throw new ApiError(
      0,
      {
        type: 'about:blank',
        title: 'Нет соединения',
        status: 0,
        detail: 'Сервер недоступен. Проверьте соединение и повторите.',
      },
      'network',
    );
  }
  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(
      res.status,
      isProblemDetails(data) ? data : null,
      res.headers.get('X-Problem-Code'),
    );
  }
  return data as T;
}
