import { NextResponse } from "next/server";
import { connectToDatabase, supportsTransactions } from "@/lib/db/connect";
import { authMode } from "@/lib/auth/provider";

/** Liveness probe: confirms the process can reach MongoDB. */
export async function GET() {
  try {
    await connectToDatabase();
    return NextResponse.json({
      ok: true,
      database: "connected",
      transactions: (await supportsTransactions()) ? "available" : "unavailable",
      auth: authMode(),
    });
  } catch {
    return NextResponse.json({ ok: false, database: "unreachable" }, { status: 503 });
  }
}
