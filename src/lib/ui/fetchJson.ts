export type FetchResult<T> =
  { ok: true; status: number; data: T } | { ok: false; status: number | null; message: string };

/**
 * fetch() for the UI islands: never throws. Network failures, aborted requests
 * (e.g. the user navigating away mid-request) and API errors all come back as
 * `{ ok: false, message }`, so a component can show the message instead of
 * crashing on an error body or leaving an unhandled promise rejection.
 */
export async function fetchJson<T>(input: string, init?: RequestInit): Promise<FetchResult<T>> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch {
    return { ok: false, status: null, message: 'Network error — please try again' };
  }

  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      (body as { error?: { message?: string } } | null)?.error?.message ??
      `Something went wrong (${response.status}) — please try again`;
    return { ok: false, status: response.status, message };
  }
  return { ok: true, status: response.status, data: body as T };
}
