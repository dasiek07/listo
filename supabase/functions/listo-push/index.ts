// Listo – wysyłanie przypomnień (Web Push), gdy aplikacja jest zamknięta.
// Uruchamiane co minutę przez harmonogram z pliku supabase/push.sql.
// Wklej całość w Supabase: Edge Functions → Deploy a new function → Via Editor → nazwa: listo-push.
// Klucze VAPID tworzą się same przy pierwszym uruchomieniu i zostają w bazie (niedostępne dla użytkowników).
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function config() {
  const { data, error } = await sb.from("listo_push_config").select("*").eq("id", 1).single();
  if (error) throw error;
  if (!data.public_key || !data.private_key) {
    const k = webpush.generateVAPIDKeys();
    const { error: e2 } = await sb.from("listo_push_config").update({ public_key: k.publicKey, private_key: k.privateKey }).eq("id", 1);
    if (e2) throw e2;
    data.public_key = k.publicKey;
    data.private_key = k.privateKey;
  }
  return data as { public_key: string; private_key: string; cron_secret: string };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const cfg = await config();
    const url = new URL(req.url);
    // aplikacja pobiera klucz publiczny, by zapisać urządzenie do powiadomień
    if (url.searchParams.has("vapid")) return json({ publicKey: cfg.public_key });
    // wysyłkę może uruchomić tylko harmonogram z bazy (tajny nagłówek)
    if (req.headers.get("x-listo-cron") !== cfg.cron_secret) return json({ error: "forbidden" }, 403);

    webpush.setVapidDetails("https://dasiek07.github.io/listo/", cfg.public_key, cfg.private_key);
    const { data: due, error } = await sb.from("listo_reminders").select("*")
      .eq("sent", false).lte("fire_at", new Date().toISOString()).order("fire_at").limit(300);
    if (error) throw error;

    let sent = 0, removed = 0;
    if (due && due.length) {
      const users = [...new Set(due.map((r) => r.user_id))];
      const { data: subs } = await sb.from("listo_push_subs").select("*").in("user_id", users);
      for (const r of due) {
        // przypomnienia spóźnione o ponad 30 min pomijamy (np. po przerwie serwera)
        if (Date.now() - Date.parse(r.fire_at) > 30 * 60_000) continue;
        const payload = JSON.stringify({ title: r.title, body: r.body || "", url: r.url || "./#today", tag: r.tag || r.id, task: r.task_id });
        for (const s of (subs || []).filter((s) => s.user_id === r.user_id)) {
          try {
            await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600, urgency: "high" });
            sent++;
          } catch (e) {
            const code = (e as { statusCode?: number }).statusCode;
            if (code === 404 || code === 410) { await sb.from("listo_push_subs").delete().eq("endpoint", s.endpoint); removed++; }
          }
        }
      }
      await sb.from("listo_reminders").update({ sent: true }).in("id", due.map((r) => r.id));
    }
    // sprzątanie starych wpisów
    await sb.from("listo_reminders").delete().lt("fire_at", new Date(Date.now() - 3 * 86_400_000).toISOString());
    return json({ ok: true, due: due?.length || 0, sent, removed });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
