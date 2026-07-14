export default async (request: Request, context: any) => {
  const candidate = context.geo?.country?.code ?? request.headers.get("x-vercel-ip-country") ?? undefined;
  const normalized = typeof candidate === "string" ? candidate.trim().toUpperCase() : undefined;
  const countryCode = normalized && /^[A-Z]{2}$/.test(normalized) ? normalized : undefined;
  return new Response(JSON.stringify(countryCode ? { countryCode } : {}), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
    },
  });
};
