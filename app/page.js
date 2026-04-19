"use client";

/**
 * FireWatch — ระบบเฝ้าระวังไฟป่าประเทศไทย
 *
 * โครงสร้างหน้า:
 *  - Sidebar ซ้าย: สถิติ + รายการเซนเซอร์
 *  - แผนที่ขวา: แสดงหมุดสีตามอุณหภูมิ (เขียว = ปกติ, แดง = วิกฤต)
 *
 * การทำงาน:
 *  1. ดึงข้อมูลจาก Supabase ตาราง `sensors` ตอนโหลดหน้า
 *  2. Subscribe real-time ทุกครั้งที่ข้อมูลเปลี่ยน
 *  3. ถ้า temp > 40°C → ส่ง LINE แจ้งเตือนผ่าน /api/alert
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";

// -------------------------------------------------------
// ค่าคงที่
// -------------------------------------------------------
const ALERT_THRESHOLD = 40; // °C — เกินนี้ถือว่าวิกฤต
const MAP_CENTER = [13.0, 101.0]; // จุดกลางแผนที่ประเทศไทย
const MAP_ZOOM = 6; // zoom ระดับประเทศ

// -------------------------------------------------------
// Component หลัก
// -------------------------------------------------------
export default function FireWatchPage() {
  const [sensors, setSensors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  // refs สำหรับ Leaflet (ต้องใช้ ref เพราะ Leaflet ไม่ใช่ React)
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({}); // { [sensorId]: leafletMarker }
  const alertedSensorIds = useRef(new Set()); // ป้องกันส่ง LINE ซ้ำ

  // -------------------------------------------------------
  // ส่ง LINE แจ้งเตือน
  // -------------------------------------------------------
  const sendLineAlert = useCallback(async (sensor) => {
    // ส่งแค่ครั้งแรกที่เกิน threshold เท่านั้น
    if (alertedSensorIds.current.has(sensor.id)) return;
    alertedSensorIds.current.add(sensor.id);

    try {
      const res = await fetch("/api/alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sensorName: sensor.name,
          temperature: sensor.temp,
          lat: sensor.lat,
          lng: sensor.lng,
        }),
      });
      if (!res.ok) {
        console.error("LINE alert failed:", await res.text());
      }
    } catch (err) {
      console.error("LINE alert network error:", err);
    }
  }, []);

  // -------------------------------------------------------
  // อัปเดตหมุดบนแผนที่
  // -------------------------------------------------------
  const updateMapMarkers = useCallback(
    (sensorList) => {
      if (!mapInstanceRef.current || !window.L) return;
      const L = window.L;

      sensorList.forEach((sensor) => {
        const isCritical = sensor.temp > ALERT_THRESHOLD;
        const color = isCritical ? "#ef4444" : "#22c55e";

        // สร้าง HTML ของหมุด
        const markerHtml = `
        <div style="position:relative;width:44px;height:44px;display:flex;align-items:center;justify-content:center">
          <div style="
            width:32px;height:32px;border-radius:50%;
            background:${color};
            display:flex;align-items:center;justify-content:center;
            box-shadow:0 2px 8px rgba(0,0,0,0.4);
            z-index:2;position:relative;
          ">
            <span style="color:white;font-size:8px;font-weight:700;font-family:monospace">
              ${sensor.temp?.toFixed(0)}°
            </span>
          </div>
          ${
            isCritical
              ? `
            <div style="
              position:absolute;width:44px;height:44px;border-radius:50%;
              border:2px solid ${color};
              animation:pulse 1.2s ease-out infinite;
              opacity:0.5;
            "></div>
          `
              : ""
          }
        </div>
      `;

        const icon = L.divIcon({
          className: "",
          html: markerHtml,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        });

        const popupContent = `
        <div style="font-family:'Sarabun',sans-serif;min-width:180px;padding:4px">
          <div style="font-weight:700;font-size:14px;margin-bottom:8px;color:#1e293b">${sensor.name}</div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="color:#64748b;font-size:13px">อุณหภูมิ</span>
            <span style="font-weight:700;font-size:22px;color:${color}">${sensor.temp?.toFixed(1)}°C</span>
          </div>
          <div style="margin-top:6px;padding:4px 8px;border-radius:6px;background:${isCritical ? "#fef2f2" : "#f0fdf4"};text-align:center">
            <span style="font-size:12px;font-weight:600;color:${color}">
              ${isCritical ? "🔴 สถานะวิกฤต" : "🟢 สถานะปกติ"}
            </span>
          </div>
          <div style="margin-top:6px;font-size:11px;color:#94a3b8;text-align:center">
            ${sensor.lat?.toFixed(4)}, ${sensor.lng?.toFixed(4)}
          </div>
        </div>
      `;

        if (markersRef.current[sensor.id]) {
          // อัปเดตหมุดที่มีอยู่แล้ว
          markersRef.current[sensor.id].setIcon(icon);
          markersRef.current[sensor.id].setPopupContent(popupContent);
        } else {
          // สร้างหมุดใหม่
          const marker = L.marker([sensor.lat, sensor.lng], { icon })
            .bindPopup(popupContent)
            .addTo(mapInstanceRef.current);
          markersRef.current[sensor.id] = marker;
        }

        // ส่ง LINE ถ้าวิกฤต
        if (isCritical) sendLineAlert(sensor);
      });

      // ลบหมุดที่ไม่มีในข้อมูลแล้ว
      const activeIds = new Set(sensorList.map((s) => s.id));
      Object.keys(markersRef.current).forEach((id) => {
        if (!activeIds.has(Number(id))) {
          markersRef.current[id].remove();
          delete markersRef.current[id];
        }
      });
    },
    [sendLineAlert],
  );

  // -------------------------------------------------------
  // โหลด Leaflet library (ต้องโหลดใน browser เท่านั้น)
  // -------------------------------------------------------
  useEffect(() => {
    // โหลด CSS
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);

    // โหลด JS
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => {
      // สร้างแผนที่หลังจาก Leaflet โหลดเสร็จ
      if (!mapRef.current || mapInstanceRef.current) return;

      const L = window.L;
      const map = L.map(mapRef.current, { zoomControl: false }).setView(
        MAP_CENTER,
        MAP_ZOOM,
      );

      // ใช้ Dark tile layer ที่ดูชัดสำหรับการแจ้งเตือน
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          attribution: "© OpenStreetMap © CARTO",
          maxZoom: 19,
        },
      ).addTo(map);

      // ย้ายปุ่ม zoom ไปมุมขวาล่าง
      L.control.zoom({ position: "bottomright" }).addTo(map);

      mapInstanceRef.current = map;
    };
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(css);
      document.head.removeChild(script);
    };
  }, []);

  // -------------------------------------------------------
  // ดึงข้อมูลจาก Supabase + Subscribe real-time
  // -------------------------------------------------------
  useEffect(() => {
    // ดึงข้อมูลครั้งแรก
    const fetchSensors = async () => {
      const { data, error } = await supabase.from("sensors").select("*");
      if (error) {
        console.error("Error fetching sensors:", error);
      } else {
        setSensors(data ?? []);
        setLastUpdate(new Date());
      }
      setLoading(false);
    };

    fetchSensors();

    // Subscribe real-time — ทุกครั้งที่ข้อมูลเปลี่ยนใน Supabase
    const channel = supabase
      .channel("sensors-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sensors" },
        (payload) => {
          setSensors((prev) => {
            switch (payload.eventType) {
              case "INSERT":
                return [...prev, payload.new];
              case "UPDATE":
                // ถ้าอุณหภูมิลดลงต่ำกว่า threshold → ให้แจ้งเตือนได้อีกครั้ง
                if (payload.new.temp <= ALERT_THRESHOLD) {
                  alertedSensorIds.current.delete(payload.new.id);
                }
                return prev.map((s) =>
                  s.id === payload.new.id ? payload.new : s,
                );
              case "DELETE":
                return prev.filter((s) => s.id !== payload.old.id);
              default:
                return prev;
            }
          });
          setLastUpdate(new Date());
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // -------------------------------------------------------
  // อัปเดตหมุดบนแผนที่ทุกครั้งที่ข้อมูลเปลี่ยน
  // -------------------------------------------------------
  useEffect(() => {
    if (!loading) {
      // รอให้แผนที่โหลดเสร็จก่อน (อาจใช้เวลานิดนึง)
      const timer = setTimeout(() => updateMapMarkers(sensors), 500);
      return () => clearTimeout(timer);
    }
  }, [sensors, loading, updateMapMarkers]);

  // -------------------------------------------------------
  // คำนวณสถิติ
  // -------------------------------------------------------
  const criticalSensors = sensors.filter((s) => s.temp > ALERT_THRESHOLD);
  const normalSensors = sensors.filter((s) => s.temp <= ALERT_THRESHOLD);
  const avgTemp =
    sensors.length > 0
      ? (
          sensors.reduce((sum, s) => sum + (s.temp ?? 0), 0) / sensors.length
        ).toFixed(1)
      : "--";

  // -------------------------------------------------------
  // UI
  // -------------------------------------------------------
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&family=IBM+Plex+Mono:wght@400;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: 'Sarabun', sans-serif;
          background: #0a0f1e;
          color: #e2e8f0;
        }

        /* Layout */
        .layout { display: flex; height: 100vh; overflow: hidden; }

        /* --- Sidebar --- */
        .sidebar {
          width: 300px;
          min-width: 300px;
          background: #0d1424;
          border-right: 1px solid #1e2d42;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .sidebar-header {
          padding: 18px 16px 14px;
          border-bottom: 1px solid #1e2d42;
        }

        .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
        .brand-icon { font-size: 24px; }
        .brand-name {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 14px;
          font-weight: 600;
          color: #f97316;
          letter-spacing: 1px;
        }
        .brand-sub { font-size: 11px; color: #475569; letter-spacing: 1px; }

        /* Stats grid */
        .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .stat {
          background: #111827;
          border: 1px solid #1e2d42;
          border-radius: 8px;
          padding: 10px 12px;
        }
        .stat-label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px; }
        .stat-value { font-family: 'IBM Plex Mono', monospace; font-size: 20px; font-weight: 600; color: #f1f5f9; }
        .stat-value.danger { color: #ef4444; }
        .stat-value.warning { color: #f97316; }
        .stat-value.safe { color: #22c55e; }

        /* Sensor list */
        .section-label {
          padding: 12px 16px 6px;
          font-size: 10px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #334155;
          font-family: 'IBM Plex Mono', monospace;
        }

        .sensor-list { flex: 1; overflow-y: auto; padding: 0 10px 10px; }
        .sensor-list::-webkit-scrollbar { width: 3px; }
        .sensor-list::-webkit-scrollbar-thumb { background: #1e2d42; border-radius: 2px; }

        .sensor-card {
          background: #111827;
          border: 1px solid #1e2d42;
          border-radius: 10px;
          padding: 11px 13px;
          margin-bottom: 7px;
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s;
          position: relative;
          overflow: hidden;
        }
        .sensor-card:hover { border-color: #2d3f55; background: #131c2e; }

        /* วิกฤต: เส้นแดงซ้าย + พื้นหลังเข้ม */
        .sensor-card.critical {
          border-color: #7f1d1d;
          background: #0f0808;
        }
        .sensor-card.critical::before {
          content: '';
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 3px;
          background: #ef4444;
          animation: blink 1s ease-in-out infinite alternate;
        }
        @keyframes blink { from { opacity: 0.3; } to { opacity: 1; } }

        .sensor-name { font-size: 12px; font-weight: 600; color: #94a3b8; margin-bottom: 5px; line-height: 1.4; }
        .sensor-bottom { display: flex; justify-content: space-between; align-items: center; }
        .sensor-temp { font-family: 'IBM Plex Mono', monospace; font-size: 22px; font-weight: 600; }
        .sensor-temp.safe { color: #22c55e; }
        .sensor-temp.danger { color: #ef4444; }
        .sensor-badge {
          font-size: 10px; font-weight: 600;
          padding: 3px 9px; border-radius: 20px;
        }
        .sensor-badge.safe { background: #052e16; color: #4ade80; border: 1px solid #166534; }
        .sensor-badge.danger {
          background: #450a0a; color: #fca5a5; border: 1px solid #7f1d1d;
          animation: blink 1.5s infinite;
        }

        .last-update {
          padding: 10px 16px;
          border-top: 1px solid #1e2d42;
          font-size: 11px;
          color: #334155;
          font-family: 'IBM Plex Mono', monospace;
        }

        /* --- Map --- */
        .map-area { flex: 1; position: relative; }
        #map { width: 100%; height: 100%; }

        /* ป้ายชื่อบนแผนที่ */
        .map-badge {
          position: absolute;
          top: 14px; left: 14px;
          background: rgba(13,20,36,0.92);
          border: 1px solid #1e2d42;
          border-radius: 8px;
          padding: 8px 14px;
          font-size: 12px;
          color: #94a3b8;
          z-index: 1000;
          backdrop-filter: blur(6px);
          font-family: 'IBM Plex Mono', monospace;
        }
        .map-badge span { color: #f97316; font-weight: 600; }

        /* animation pulse สำหรับหมุดวิกฤต */
        @keyframes pulse {
          0% { transform: scale(0.8); opacity: 0.6; }
          100% { transform: scale(1.6); opacity: 0; }
        }

        /* Loading screen */
        .loading {
          position: fixed; inset: 0;
          background: #0a0f1e;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 12px; z-index: 9999;
        }
        .loading-icon { font-size: 40px; animation: loadBounce 0.8s ease-in-out infinite alternate; }
        @keyframes loadBounce { from { transform: scale(1); } to { transform: scale(1.2); } }
        .loading-text { font-family: 'IBM Plex Mono', monospace; color: #f97316; font-size: 13px; letter-spacing: 2px; }
        .loading-bar { width: 180px; height: 2px; background: #1e2d42; border-radius: 1px; overflow: hidden; }
        .loading-bar-fill { height: 100%; background: #f97316; animation: fillBar 1.5s ease-in-out infinite; }
        @keyframes fillBar { 0% { width: 0; } 100% { width: 100%; } }

        /* Empty state */
        .empty { text-align: center; color: #334155; padding: 32px 16px; font-size: 13px; line-height: 2; }

        /* Responsive สำหรับมือถือ */
        @media (max-width: 640px) {
          .layout { flex-direction: column; }
          .sidebar { width: 100%; min-width: unset; height: 42vh; border-right: none; border-bottom: 1px solid #1e2d42; }
          .map-area { height: 58vh; }
        }
      `}</style>

      {/* Loading overlay */}
      {loading && (
        <div className="loading">
          <div className="loading-icon">🔥</div>
          <div className="loading-text">FIREWATCH</div>
          <div className="loading-bar">
            <div className="loading-bar-fill" />
          </div>
        </div>
      )}

      <div className="layout">
        {/* ===== Sidebar ===== */}
        <aside className="sidebar">
          {/* Header + สถิติ */}
          <div className="sidebar-header">
            <div className="brand">
              <span className="brand-icon">🔥</span>
              <div>
                <div className="brand-name">FIREWATCH</div>
                <div className="brand-sub">ระบบเฝ้าระวังไฟป่าประเทศไทย</div>
              </div>
            </div>

            <div className="stats">
              <div className="stat">
                <div className="stat-label">เซนเซอร์ทั้งหมด</div>
                <div className="stat-value">{sensors.length}</div>
              </div>
              <div className="stat">
                <div className="stat-label">แจ้งเตือน</div>
                <div
                  className={`stat-value ${criticalSensors.length > 0 ? "danger" : "safe"}`}
                >
                  {criticalSensors.length}
                </div>
              </div>
              <div className="stat">
                <div className="stat-label">อุณหภูมิเฉลี่ย</div>
                <div className="stat-value warning">{avgTemp}°C</div>
              </div>
              <div className="stat">
                <div className="stat-label">ปกติ</div>
                <div className="stat-value safe">{normalSensors.length}</div>
              </div>
            </div>
          </div>

          {/* รายการเซนเซอร์ */}
          <div className="section-label">สถานีเซนเซอร์</div>

          <div className="sensor-list">
            {sensors.length === 0 && !loading ? (
              <div className="empty">
                ยังไม่มีข้อมูลเซนเซอร์
                <br />
                <span style={{ fontSize: 11, color: "#1e2d42" }}>
                  กรุณาเพิ่มข้อมูลใน Supabase → sensors
                </span>
              </div>
            ) : (
              // เรียงให้วิกฤตขึ้นมาก่อน
              [...sensors]
                .sort((a, b) => b.temp - a.temp)
                .map((sensor) => {
                  const isCritical = sensor.temp > ALERT_THRESHOLD;
                  return (
                    <div
                      key={sensor.id}
                      className={`sensor-card ${isCritical ? "critical" : ""}`}
                      onClick={() => {
                        // คลิกแล้ว fly ไปที่เซนเซอร์
                        if (mapInstanceRef.current) {
                          mapInstanceRef.current.flyTo(
                            [sensor.lat, sensor.lng],
                            13,
                          );
                          markersRef.current[sensor.id]?.openPopup();
                        }
                      }}
                    >
                      <div className="sensor-name">{sensor.name}</div>
                      <div className="sensor-bottom">
                        <div
                          className={`sensor-temp ${isCritical ? "danger" : "safe"}`}
                        >
                          {sensor.temp?.toFixed(1)}°C
                        </div>
                        <div
                          className={`sensor-badge ${isCritical ? "danger" : "safe"}`}
                        >
                          {isCritical ? "🔴 วิกฤต" : "🟢 ปกติ"}
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>

          <div className="last-update">
            {lastUpdate
              ? `อัปเดต: ${lastUpdate.toLocaleTimeString("th-TH")}`
              : "กำลังเชื่อมต่อ..."}
          </div>
        </aside>

        {/* ===== แผนที่ ===== */}
        <main className="map-area">
          <div id="map" ref={mapRef} />
          <div className="map-badge">
            แผนที่เฝ้าระวัง &nbsp;|&nbsp; <span>ประเทศไทย</span>
          </div>
        </main>
      </div>
    </>
  );
}
