import { NextRequest, NextResponse } from "next/server";
import { getOwncastStatus, getOwncastConfig } from "@/lib/owncast/config";
import { getWatcherStatus } from "@/lib/owncast/segment-watcher";

export async function GET() {
  const config = getOwncastConfig();
  const [status, watcher] = await Promise.all([
    getOwncastStatus(),
    Promise.resolve(getWatcherStatus()),
  ]);

  return NextResponse.json({
    owncast: {
      ...status,
      hlsUrl: config.hlsUrl,
      rtmpUrl: config.rtmpUrl,
    },
    watcher,
  });
}
