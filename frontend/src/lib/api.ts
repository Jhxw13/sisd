import { getToken } from "./supabase";
const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5000";
export async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "Content-Type":"application/json",
      ...(token ? { Authorization:`Bearer ${token}` } : {}),
      ...(opts.headers ?? {}) },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.erro ?? `Erro ${res.status}`);
  return json;
}
export async function apiFetchPublic(path: string) {
  const res = await fetch(`${BASE}${path}`);
  return res.json();
}
