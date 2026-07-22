import { cloudConfig, isSharedApiEnabled } from '../config/cloud';
import { getSession } from '../utils/authSession';

function buildUrl(path, query) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${cloudConfig.apiBaseUrl}${normalizedPath}`);

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    url.searchParams.set(key, String(value));
  });

  return url.toString();
}

export async function requestSharedApi(path, {
  method = 'GET',
  query,
  body,
  headers,
  signal,
  auth = true,
} = {}) {
  if (!isSharedApiEnabled()) {
    return {
      ok: false,
      mode: 'shared-api-disabled',
      message: 'Shared API URL is not configured.',
    };
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), cloudConfig.apiTimeoutMs);

  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const accessToken = auth ? getSession()?.accessToken : '';
    const response = await fetch(buildUrl(path, query), {
      method,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(cloudConfig.apiKey ? { 'x-api-key': cloudConfig.apiKey } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const contentType = response.headers.get('content-type') ?? '';
    const payload = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: payload?.message ?? response.statusText,
        data: payload,
      };
    }

    return {
      ok: true,
      status: response.status,
      data: payload,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      message: error.name === 'AbortError' ? 'Shared API request timed out.' : error.message,
    };
  } finally {
    window.clearTimeout(timeout);
  }
}
