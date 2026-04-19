import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// ตรวจสอบความพร้อมของกุญแจก่อนเริ่มงาน
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ ข้อมูลใน .env.local ไม่ครบถ้วน!");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // ปิดการเก็บ Session ถ้าเราแค่ทำ Dashboard เพื่อให้เว็บเบาขึ้น
  },
});
