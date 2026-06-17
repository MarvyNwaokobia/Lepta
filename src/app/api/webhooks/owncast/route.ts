import { NextRequest, NextResponse } from "next/server";
import {
  handleWebhookEvent,
  type OwncastWebhookEvent,
} from "@/lib/owncast/webhooks";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expectedToken = process.env.OWNCAST_ADMIN_TOKEN;

  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const event = (await req.json()) as OwncastWebhookEvent;

  console.log(`[Owncast Webhook] ${event.type}`, JSON.stringify(event.eventData).slice(0, 200));

  const result = handleWebhookEvent(event);

  return NextResponse.json(result);
}
