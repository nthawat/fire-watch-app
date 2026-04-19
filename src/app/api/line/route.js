import { NextResponse } from "next/server";

export async function POST(request) {
  const { name, temp } = await request.json();

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const userId = process.env.MY_LINE_USER_ID;

  const message = {
    to: userId,
    messages: [
      {
        type: "text",
        text: `🔥 แจ้งเตือนไฟป่า!\nพบเหตุที่: ${name}\nอุณหภูมิ: ${temp}°C\nตรวจสอบด่วนที่หน้าเว็บ!`,
      },
    ],
  };

  try {
    await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(message),
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
