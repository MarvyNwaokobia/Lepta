const OWNCAST_URL = process.env.OWNCAST_URL ?? "http://localhost:8080";
const OWNCAST_ADMIN_TOKEN = process.env.OWNCAST_ADMIN_TOKEN ?? "";

export function getOwncastConfig() {
  return {
    url: OWNCAST_URL,
    adminToken: OWNCAST_ADMIN_TOKEN,
    hlsUrl: `${OWNCAST_URL}/hls/stream.m3u8`,
    rtmpUrl: `rtmp://localhost:1935/live`,
  };
}

export async function getOwncastStatus(): Promise<{
  online: boolean;
  viewerCount: number;
  title: string;
  streamKey: string | null;
}> {
  try {
    const res = await fetch(`${OWNCAST_URL}/api/status`);
    if (!res.ok) return { online: false, viewerCount: 0, title: "", streamKey: null };

    const data = (await res.json()) as {
      online: boolean;
      viewerCount: number;
      name: string;
    };

    return {
      online: data.online,
      viewerCount: data.viewerCount,
      title: data.name,
      streamKey: null,
    };
  } catch {
    return { online: false, viewerCount: 0, title: "", streamKey: null };
  }
}

export async function configureOwncastWebhook(leaptaUrl: string) {
  if (!OWNCAST_ADMIN_TOKEN) {
    console.warn("[Owncast] No admin token — cannot configure webhook");
    return false;
  }

  try {
    const webhookUrl = `${leaptaUrl}/api/webhooks/owncast`;
    const res = await fetch(`${OWNCAST_URL}/api/admin/config/notifications/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OWNCAST_ADMIN_TOKEN}`,
      },
      body: JSON.stringify({
        url: webhookUrl,
        events: [
          "STREAM_STARTED",
          "STREAM_STOPPED",
          "USER_JOINED",
          "USER_PARTED",
          "CHAT",
        ],
      }),
    });

    return res.ok;
  } catch {
    return false;
  }
}
