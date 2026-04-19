/**
 * POST /api/alert
 * รับข้อมูลเซนเซอร์แล้วส่งแจ้งเตือนไปยัง LINE
 *
 * Body: { sensorName, temperature, lat, lng }
 */
export async function POST(request) {
  // ดึงข้อมูลจาก request
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const { sensorName, temperature, lat, lng } = body

  // ตรวจสอบว่ามีข้อมูลครบ
  if (!sensorName || temperature === undefined) {
    return Response.json({ success: false, error: 'Missing required fields' }, { status: 400 })
  }

  // ตรวจสอบ environment variables
  const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const lineUserId = process.env.MY_LINE_USER_ID

  if (!lineToken || !lineUserId) {
    console.error('Missing LINE environment variables')
    return Response.json({ success: false, error: 'LINE not configured' }, { status: 500 })
  }

  // สร้างข้อความแจ้งเตือน
  const alertMessage = [
    '🔥 แจ้งเตือนไฟป่า!',
    '',
    `📍 สถานที่: ${sensorName}`,
    `🌡️ อุณหภูมิ: ${temperature}°C`,
    `📌 พิกัด: ${lat}, ${lng}`,
    `🗺️ แผนที่: https://maps.google.com/?q=${lat},${lng}`,
    '',
    '⚠️ อุณหภูมิเกิน 40°C กรุณาตรวจสอบด่วน!',
  ].join('\n')

  // ส่งไปยัง LINE API
  try {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${lineToken}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{ type: 'text', text: alertMessage }],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('LINE API error:', errorText)
      return Response.json({ success: false, error: errorText }, { status: 500 })
    }

    return Response.json({ success: true })
  } catch (error) {
    console.error('Network error sending LINE alert:', error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }
}
