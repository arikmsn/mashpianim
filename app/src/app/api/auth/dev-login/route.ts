import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Dev login is disabled in production" },
    { status: 403 }
  );
}
