import { NextRequest, NextResponse } from "next/server";
import { createAttestation, getLatestAttestation } from "@/lib/attestor";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { stream_id, segment_index, segment_data_base64 } = body;

  if (!stream_id || segment_index === undefined || !segment_data_base64) {
    return NextResponse.json(
      { error: "Missing stream_id, segment_index, or segment_data_base64" },
      { status: 400 }
    );
  }

  const segmentData = Buffer.from(segment_data_base64, "base64");
  const attestation = createAttestation(stream_id, segment_index, segmentData);

  return NextResponse.json(attestation, { status: 201 });
}

export async function GET(req: NextRequest) {
  const streamId = req.nextUrl.searchParams.get("stream_id");
  if (!streamId) {
    return NextResponse.json(
      { error: "Missing stream_id" },
      { status: 400 }
    );
  }

  const attestation = getLatestAttestation(streamId);
  if (!attestation) {
    return NextResponse.json(
      { error: "No attestations found" },
      { status: 404 }
    );
  }

  return NextResponse.json(attestation);
}
