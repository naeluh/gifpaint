// Tiny Response helpers shared by the API routes. Errors are one sentence in
// { error } — never a stack or driver message.

/**
 * @param {unknown} body
 * @param {number} [status]
 * @param {Record<string, string>} [headers]
 */
export function json(body, status = 200, headers = {}) {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store', ...headers } });
}

/** @param {number} status @param {string} message */
export function fail(status, message) {
  return json({ error: message }, status);
}

/**
 * Read a JSON body with a byte cap.
 * @param {Request} request
 * @param {number} maxBytes
 * @returns {Promise<{value: any} | {response: Response}>}
 */
export async function readJson(request, maxBytes) {
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) return { response: fail(413, 'project is too big to save') };
  try {
    return { value: JSON.parse(text) };
  } catch {
    return { response: fail(400, 'body must be JSON') };
  }
}

/**
 * Wrap a handler so an unexpected throw becomes a generic 500.
 * @param {(request: Request) => Promise<Response>} fn
 */
export function guarded(fn) {
  return async (request) => {
    try {
      return await fn(request);
    } catch (err) {
      console.error(err);
      return fail(500, 'something went wrong on our side. try again');
    }
  };
}

/**
 * Rebuild the original /api/auth/<tail> URL when the rewrite dropped it
 * (Better Auth routes on the pathname).
 * @param {Request} request
 * @returns {Promise<Request>}
 */
export async function restorePath(request) {
  const url = new URL(request.url);
  const tail = url.searchParams.get('__ba');
  if (tail === null) return request;
  url.searchParams.delete('__ba');
  if (!url.pathname.startsWith('/api/auth/')) url.pathname = `/api/auth/${tail}`;
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  return new Request(url, {
    method: request.method,
    headers: request.headers,
    body: hasBody ? await request.arrayBuffer() : undefined
  });
}
