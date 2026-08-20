export const config = { runtime: "edge" } as const;

export default function handler(request: Request) {
  const candidate = request.headers.get("x-vercel-ip-country") ?? undefined;
  const normalized = typeof candidate === "string" ? candidate.trim().toUpperCase() : undefined;
  const countryCode = normalized && /^[A-Z]{2}$/.test(normalized) ? normalized : undefined;

  return new Response(JSON.stringify(countryCode ? { countryCode } : {}), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
      "Vary": "Cookie",
    },
  });
}
