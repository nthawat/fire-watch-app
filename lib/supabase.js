import { createClient } from "@supabase/supabase-js";
import { completeHardNavigation } from "next/dist/client/components/segment-cache/navigation";
// ดึง key จากไฟล์ .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// ตัาเชื่อม Client เพื่อเอาใช้หน้าอื่นๆ
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
