import { NextResponse } from "next/server";

// ระบบ Cooldown ป้องกันการส่งรัว (1 นาที)
let lastSentTime = 0;
const COOLDOWN_MS = 60000;

export async function POST(request) {
  try {
    const { name, temp, errorMsg } = await request.json();
    const currentTime = Date.now();

    // ตรวจสอบ Cooldown (เฉพาะกรณีแจ้งเตือนไฟไหม้ปกติ)
    // แต่ถ้าเป็น Error ของระบบ เราจะให้ส่งทันทีโดยไม่ติด Cooldown เพื่อความปลอดภัย
    if (!errorMsg && currentTime - lastSentTime < COOLDOWN_MS) {
      return NextResponse.json(
        { message: "Skipped: Cooldown active" },
        { status: 200 },
      );
    }

    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const userId = process.env.MY_LINE_USER_ID;

    // 2. ปรับแต่งข้อความตามประเภทที่ส่งมา
    let textContent = "";
    if (errorMsg) {
      // กรณีแจ้งเตือนเมื่อระบบพัง
      textContent = `⚠️ [System Error]\n💻 พบปัญหา: ${errorMsg}\n👤 อุปกรณ์: ${name}\n⏰ เวลา: ${new Date().toLocaleString("th-TH")}`;
    } else {
      // กรณีแจ้งเตือนไฟไหม้ปกติ
      textContent = `🔥 [FIRE ALERT]\n📍 พิกัด: ${name}\n🌡️ อุณหภูมิ: ${temp}°C\n⚠️ โปรดตรวจสอบด่วน!`;
    }

    const message = {
      to: userId,
      messages: [
        {
          type: "text",
          text: textContent,
        },
      ],
    };

    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(message),
    });

    if (res.ok) {
      // ถ้าไม่ใช่ Error ให้บันทึกเวลา Cooldown
      if (!errorMsg) lastSentTime = currentTime;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false }, { status: 500 });
  } catch (error) {
    console.error("API Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
