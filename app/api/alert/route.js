/**
 * POST /api/alert
 * รับข้อมูลเซนเซอร์แล้วส่งแจ้งเตือนไปยัง LINE
 * รองรับการ Verify Webhook จาก LINE Console
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch (err) {
                                                    //   ถ้าส่งมาไม่ใช่ JSON หรือ Body ว่าง (เช่น ตอน LINE ทักมาเช็ค) ให้ตอบ 200 ไปก่อน
    return Response.json(
      { success: true, message: "Keep-alive" },
      { status: 200 },
    );
  }

  const { sensorName, temperature, lat, lng } = body;

                                                      //  ถ้าไม่มีข้อมูลเซนเซอร์ (เช่น ตอนกดปุ่ม Verify ใน LINE Console)
                                                      // ให้ตอบ 200 กลับไปทันทีเพื่อให้ Verify ผ่าน
  if (!sensorName || temperature === undefined) {
    return Response.json(
      {
        success: true,
        message: "Webhook endpoint is active. Waiting for sensor data...",
      },
      { status: 200 },
    );
  }

                                                                // เริ่มกระบวนการส่ง LINE Alert 
  const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const lineUserId = process.env.MY_LINE_USER_ID;

  if (!lineToken || !lineUserId) {
    console.error("Missing LINE environment variables");
    return Response.json(
      { success: false, error: "LINE not configured" },
      { status: 500 },
    );
  }

                                                                // สร้างข้อความแจ้งเตือน
  const alertMessage = [
    "🔥 แจ้งเตือนไฟป่า!",
    "",
    `📍 สถานที่: ${sensorName}`,
    `🌡️ อุณหภูมิ: ${temperature}°C`,
    `📌 พิกัด: ${lat}, ${lng}`,
    `🗺️ แผนที่: https://www.google.com/maps?q=${lat},${lng}`, // สามรถปรับลิงก์ให้กดได้จริง
    "",
    "⚠️ อุณหภูมิเกิน 40°C กรุณาตรวจสอบด่วน!",
  ].join("\n");

  try {
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lineToken}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{ type: "text", text: alertMessage }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("LINE API error:", errorText);
      return Response.json(
        { success: false, error: errorText },
        { status: 500 },
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Network error sending LINE alert:", error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
