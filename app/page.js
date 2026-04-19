"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";

// ส่วนที่เพิ่มเข้ามา: ฟังก์ชันสร้าง Icon สีต่างๆ 
const L = typeof window !== "undefined" ? require("leaflet") : null;

const createIcon = (color) => {
  if (!L) return null;
  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });
};

// โหลดแผนที่แบบ Dynamic
const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full bg-slate-800 animate-pulse flex items-center justify-center text-orange-500">
        กำลังโหลดแผนที่...
      </div>
    ),
  },
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false },
);
const Marker = dynamic(() => import("react-leaflet").then((m) => m.Marker), {
  ssr: false,
});
const Popup = dynamic(() => import("react-leaflet").then((m) => m.Popup), {
  ssr: false,
});

export default function Home() {
  const [sensors, setSensors] = useState([]);

  const sendLineAlert = useCallback(async (name, temp) => {
    try {
      await fetch("/api/alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, temp }),
      });
      console.log(`🔔 แจ้งเตือนส่งไปที่ LINE แล้ว: ${name}`);
    } catch (err) {
      console.error("❌ ส่ง LINE ไม่สำเร็จ:", err);
    }
  }, []);

  const fetchSensors = useCallback(async () => {
    const { data, error } = await supabase.from("sensors").select("*");
    if (!error) setSensors(data);
  }, []);

  useEffect(() => {
    fetchSensors();

    const channel = supabase
      .channel("db-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sensors" },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            const newData = payload.new;
            const oldData = payload.old;
            if (
              (newData.temp > 40 && oldData.temp <= 40) ||
              (newData.status === "fire" && oldData.status !== "fire")
            ) {
              sendLineAlert(newData.name, newData.temp);
            }
          }
          fetchSensors();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSensors, sendLineAlert]);

  return (
    <main className="min-h-screen p-4 md:p-8 bg-slate-950 text-white font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600 uppercase tracking-tighter italic">
            Fire Watch Dashboard
          </h1>
          <p className="text-slate-400 mt-2 font-light">
            ระบบเฝ้าระวังไฟป่าอัจฉริยะ (Real-time Cloud Monitoring)
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 h-[600px] rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-slate-800 relative">
            <MapContainer
              center={[13.96, 100.58]} // ปรับให้ใกล้ RSU มากขึ้น
              zoom={12}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                opacity={0.8}
              />

              {sensors.map((sensor) => (
                <Marker
                  key={sensor.id}
                  position={[sensor.lat, sensor.lng]}
                  icon={createIcon(sensor.temp > 40 ? "red" : "green")} // จุดที่เพิ่ม เปลี่ยนสีหมุด
                >
                  <Popup>
                    <div className="text-slate-900 p-2 min-w-[150px]">
                      <h3 className="font-bold text-lg border-b pb-1 mb-2 text-slate-800">
                        {sensor.name}
                      </h3>
                      <div className="flex justify-between items-center mb-1">
                        <span>อุณหภูมิ:</span>
                        <span
                          className={`font-black ${sensor.temp > 40 ? "text-red-600 animate-pulse" : "text-green-600"}`}
                        >
                          {sensor.temp}°C
                        </span>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          <div className="lg:col-span-1 bg-slate-900/50 rounded-3xl p-6 border border-slate-800 backdrop-blur-sm">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-orange-400">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
              </span>
              Live Status
            </h2>
            <div className="space-y-4">
              {sensors.map((s) => (
                <div
                  key={s.id}
                  className="p-4 bg-slate-800/50 rounded-xl border border-slate-700"
                >
                  <p className="text-sm text-slate-400">{s.name}</p>
                  <p
                    className={`text-2xl font-bold ${s.temp > 40 ? "text-red-500" : "text-green-400"}`}
                  >
                    {s.temp}°C
                  </p>
                </div>
              ))}
              {sensors.length === 0 && (
                <p className="text-slate-500 italic text-sm text-center">
                  กำลังเชื่อมต่อข้อมูล...
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
