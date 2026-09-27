import { handleEndpoints } from 'payload'

import config from '@payload-config'

/** Payload-REST im Prozess aufrufen (ohne Next-Server), z. B. für anonyme Zugriffe. */
export async function rest(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  const request = new Request(`http://localhost:3000/api${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return handleEndpoints({ config, request })
}
