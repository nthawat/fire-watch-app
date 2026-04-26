/**
 * GET /api/sync-weather
 * ดึงอุณหภูมิจริงจาก Open-Meteo API 
 * แล้วอัปเดตค่า temp และ last_seen ในตาราง sensors ของ Supabase
 *
 * วิธีใช้:
 *  - เรียก GET /api/sync-weather จากหน้าเว็บ หรือตั้ง Cron Job ก็ได้
 *  - Open-Meteo ให้ข้อมูลอุณหภูมิปัจจุบัน (ณ พิกัด lat/lng นั้น) แม่นมาก
 */

import { createClient } from '@supabase/supabase-js'

//        ใช้ Service Role Key เพื่อ bypass RLS (อัปเดตได้จาก server)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function GET() {
  try {
    //    ดึงรายการเซนเซอร์ทั้งหมด
    const { data: sensors, error: fetchError } = await supabase
      .from('sensors')
      .select('id, name, lat, lng')

    if (fetchError) throw new Error(`Supabase fetch error: ${fetchError.message}`)
    if (!sensors || sensors.length === 0) {
      return Response.json({ success: true, message: 'No sensors found', updated: 0 })
    }

    //    สร้าง URL แบบ batch — Open-Meteo รับหลายพิกัดในครั้งเดียว
    //    แต่ต้องเรียกทีละตัวเพราะแต่ละพิกัดต่างกัน
    const results = await Promise.allSettled(
      sensors.map(async (sensor) => {
        const url = new URL('https://api.open-meteo.com/v1/forecast')
        url.searchParams.set('latitude', sensor.lat)
        url.searchParams.set('longitude', sensor.lng)
        url.searchParams.set('current', 'temperature_2m')           // อุณหภูมิปัจจุบัน ณ ความสูง 2 เมตร
        url.searchParams.set('timezone', 'Asia/Bangkok')

        const res = await fetch(url.toString(), { next: { revalidate: 0 } })
        if (!res.ok) throw new Error(`Weather API failed for sensor ${sensor.id}`)

        const data = await res.json()
        const temp = data?.current?.temperature_2m

        if (temp === undefined || temp === null) {
          throw new Error(`No temperature data for sensor ${sensor.id}`)
        }

        //            อัปเดต temp และ last_seen ใน Supabase
        const { error: updateError } = await supabase
          .from('sensors')
          .update({
            temp: Math.round(temp * 10) / 10,               // ปัดทศนิยม 1 ตำแหน่ง
            status: temp > 40 ? 'critical' : 'normal',
            last_seen: new Date().toISOString(),
          })
          .eq('id', sensor.id)

        if (updateError) throw new Error(`Update failed for sensor ${sensor.id}: ${updateError.message}`)

        return { id: sensor.id, name: sensor.name, temp }
      })
    )

    const succeeded = results.filter((r) => r.status === 'fulfilled').map((r) => r.value)
    const failed = results.filter((r) => r.status === 'rejected').map((r) => r.reason?.message)

    return Response.json({
      success: true,
      updated: succeeded.length,
      failed: failed.length,
      sensors: succeeded,
      errors: failed.length > 0 ? failed : undefined,
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    console.error('sync-weather error:', error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }
}
