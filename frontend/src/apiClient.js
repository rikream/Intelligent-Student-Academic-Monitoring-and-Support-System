const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api";

export async function requestApi(path, { token, ...options } = {}) {
  const headers = new Headers(options.headers ?? {});
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, { ...options, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail ?? `Request failed with HTTP ${response.status}.`);
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}
