import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();
    console.log("LINE Webhook received:", body);
    return NextResponse.json({ message: "OK" });
  } catch (error) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
