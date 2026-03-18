export interface StreetViewInput {
  logradouro?: string;
  municipio?: string;
  cep?: string;
}

function onlyDigits(v: string): string {
  return String(v || "").replace(/\D/g, "");
}

function formatCep(cep: string): string {
  const d = onlyDigits(cep);
  if (d.length !== 8) return "";
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

function buildAddress({ logradouro, municipio, cep }: StreetViewInput): string {
  const c = formatCep(cep || "");
  return [logradouro?.trim(), municipio?.trim(), c, "Brasil"].filter(Boolean).join(", ");
}

async function geocodeAddress(address: string): Promise<{ lat: string; lon: string } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=${encodeURIComponent(address)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!Array.isArray(data) || data.length === 0) return null;
  return { lat: data[0].lat, lon: data[0].lon };
}

export async function openStreetViewPopup(input: StreetViewInput): Promise<void> {
  const address = buildAddress(input);
  if (!address) return;

  const popup = window.open("about:blank", "_blank", "noopener,noreferrer,width=1200,height=800");
  const fallback = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  let targetUrl = fallback;

  try {
    const geo = await geocodeAddress(address);
    if (geo?.lat && geo?.lon) {
      targetUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${geo.lat},${geo.lon}`;
    }
  } catch {
    targetUrl = fallback;
  }

  if (popup) popup.location.href = targetUrl;
  else window.open(targetUrl, "_blank");
}

