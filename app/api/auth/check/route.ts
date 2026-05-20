import { NextResponse } from "next/server";

/**
 * Tiny passphrase validator. The LockToggle calls this when the user
 * submits the unlock form so we can fail fast on a bad passphrase rather
 * than letting every subsequent PATCH 401.
 */
export async function POST(request: Request): Promise<Response> {
  const secret = process.env.API_WRITE_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Server is missing API_WRITE_SECRET." },
      { status: 500 },
    );
  }
  const passphrase = request.headers.get("x-passphrase");
  if (passphrase !== secret) {
    return NextResponse.json(
      { error: "Invalid passphrase." },
      { status: 401 },
    );
  }
  return NextResponse.json({ ok: true });
}
