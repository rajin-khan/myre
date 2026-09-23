const SUPABASE_URL = "https://pzooigdwmekbhhuzwmbe.supabase.co";

module.exports = async function heartbeat(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ ok: false });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.authorization !== `Bearer ${cronSecret}`) {
    return response.status(401).json({ ok: false });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return response.status(503).json({ ok: false, error: "missing server key" });
  }

  try {
    const result = await fetch(`${SUPABASE_URL}/rest/v1/myre_heartbeat?id=eq.1`, {
      method: "PATCH",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ last_ping_at: new Date().toISOString() }),
    });
    if (!result.ok) {
      return response.status(502).json({ ok: false, error: "database request failed" });
    }
    const rows = await result.json();
    if (!Array.isArray(rows) || rows.length !== 1) {
      return response.status(502).json({ ok: false, error: "heartbeat row missing" });
    }
    return response.status(200).json({ ok: true });
  } catch {
    return response.status(502).json({ ok: false, error: "database unavailable" });
  }
};
