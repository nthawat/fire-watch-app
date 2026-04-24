"use client";

/**
 * FireWatch v2 — ระบบเฝ้าระวังไฟป่าประเทศไทย
 *
 * ฟีเจอร์:
 *  1. Real-time map — หมุดเปลี่ยนสีตามอุณหภูมิ
 *  2. Heartbeat — หมุดสีเทาถ้าเซนเซอร์ขาดการติดต่อ > 5 นาที
 *  3. Historical logs — กราฟอุณหภูมิย้อนหลัง 24 ชั่วโมง
 *  4. Authentication — Login ด้วย password ก่อนเข้าใช้งาน
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";

// ค่าคงที่

const ALERT_THRESHOLD = 40;
const OFFLINE_THRESHOLD = 15 * 60 * 1000;
const MAP_CENTER = [13.0, 101.0];
const MAP_ZOOM = 6;
const DASHBOARD_PASSWORD = "firewatch2025";

// หน้า Login

function LoginPage({ onLogin }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = () => {
    if (password === DASHBOARD_PASSWORD) {
      localStorage.setItem("fw_auth", "true");
      onLogin();
    } else {
      setError(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0f1e",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Sarabun', sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&family=IBM+Plex+Mono:wght@400;600&display=swap');
        @keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-8px)} 40%,80%{transform:translateX(8px)} }
      `}</style>
      <div
        style={{
          background: "#0d1424",
          border: "1px solid #1e2d42",
          borderRadius: 16,
          padding: "40px 36px",
          width: 340,
          animation: shake ? "shake 0.4s ease" : "none",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🔥</div>
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 18,
              fontWeight: 700,
              color: "#f97316",
            }}
          >
            FIREWATCH
          </div>
          <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
            ระบบเฝ้าระวังไฟป่าประเทศไทย
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>
            รหัสผ่าน
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(false);
            }}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="กรอกรหัสผ่าน"
            style={{
              width: "100%",
              padding: "10px 14px",
              background: "#111827",
              border: `1px solid ${error ? "#ef4444" : "#1e2d42"}`,
              borderRadius: 8,
              color: "#e2e8f0",
              fontSize: 14,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          {error && (
            <div style={{ color: "#ef4444", fontSize: 12, marginTop: 6 }}>
              รหัสผ่านไม่ถูกต้อง
            </div>
          )}
        </div>
        <button
          onClick={handleSubmit}
          style={{
            width: "100%",
            padding: 11,
            background: "#f97316",
            border: "none",
            borderRadius: 8,
            color: "white",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "'Sarabun', sans-serif",
          }}
        >
          เข้าสู่ระบบ
        </button>
      </div>
    </div>
  );
}

// กราฟประวัติ (Chart.js)

function HistoryChart({ logs }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || logs.length === 0) return;
    const render = () => {
      if (chartRef.current) chartRef.current.destroy();
      chartRef.current = new window.Chart(canvasRef.current, {
        type: "line",
        data: {
          labels: logs.map((l) =>
            new Date(l.recorded_at).toLocaleTimeString("th-TH", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          ),
          datasets: [
            {
              label: "°C",
              data: logs.map((l) => l.temp),
              borderColor: "#f97316",
              backgroundColor: "rgba(249,115,22,0.1)",
              borderWidth: 2,
              pointRadius: 3,
              pointBackgroundColor: "#f97316",
              fill: true,
              tension: 0.4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              ticks: { color: "#64748b", font: { size: 10 } },
              grid: { color: "#1e2d42" },
            },
            y: {
              ticks: {
                color: "#64748b",
                font: { size: 10 },
                callback: (v) => v + "°",
              },
              grid: { color: "#1e2d42" },
              min: 20,
            },
          },
        },
      });
    };
    if (!window.Chart) {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/chart.js";
      s.onload = render;
      document.head.appendChild(s);
    } else render();
    return () => {
      if (chartRef.current) chartRef.current.destroy();
    };
  }, [logs]);

  if (logs.length === 0)
    return (
      <div
        style={{
          textAlign: "center",
          color: "#475569",
          padding: 20,
          fontSize: 12,
        }}
      >
        ยังไม่มีประวัติข้อมูล
      </div>
    );
  return (
    <div style={{ height: 140 }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

// Dashboard หลัก

function Dashboard({ onLogout }) {
  const [sensors, setSensors] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selectedSensor, setSelectedSensor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [activeTab, setActiveTab] = useState("sensors");

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});
  const alertedIds = useRef(new Set());

  const getSensorStatus = (sensor) => {
    if (!sensor.last_seen) return "normal";
    const diff = Date.now() - new Date(sensor.last_seen).getTime();
    if (diff > OFFLINE_THRESHOLD) return "offline";
    if (sensor.temp > ALERT_THRESHOLD) return "critical";
    return "normal";
  };

  const sendLineAlert = useCallback(async (sensor) => {
    if (alertedIds.current.has(sensor.id)) return;
    alertedIds.current.add(sensor.id);
    try {
      await fetch("/api/alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sensorName: sensor.name,
          temperature: sensor.temp,
          lat: sensor.lat,
          lng: sensor.lng,
        }),
      });
    } catch (e) {
      console.error("LINE alert error:", e);
    }
  }, []);

  const recordLog = useCallback(async (sensor) => {
    await supabase
      .from("logs")
      .insert({
        sensor_id: sensor.id,
        temp: sensor.temp,
        status: sensor.temp > ALERT_THRESHOLD ? "critical" : "normal",
      });
  }, []);

  const updateMarkers = useCallback(
    (sensorList) => {
      if (!mapInstanceRef.current || !window.L) return;
      const L = window.L;
      sensorList.forEach((sensor) => {
        const status = getSensorStatus(sensor);
        const color =
          status === "offline"
            ? "#64748b"
            : status === "critical"
              ? "#ef4444"
              : "#22c55e";
        const html = `
        <div style="position:relative;width:44px;height:44px;display:flex;align-items:center;justify-content:center">
          <div style="width:32px;height:32px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.4);z-index:2;position:relative">
            <span style="color:white;font-size:8px;font-weight:700;font-family:monospace">${status === "offline" ? "OFF" : sensor.temp?.toFixed(0) + "°"}</span>
          </div>
          ${status === "critical" ? `<div style="position:absolute;width:44px;height:44px;border-radius:50%;border:2px solid ${color};animation:pulse 1.2s ease-out infinite;opacity:0.5"></div>` : ""}
        </div>`;
        const icon = L.divIcon({
          className: "",
          html,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        });
        const popup = `
        <div style="font-family:'Sarabun',sans-serif;min-width:180px;padding:4px">
          <div style="font-weight:700;font-size:14px;margin-bottom:8px;color:#1e293b">${sensor.name}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <span style="color:#64748b;font-size:13px">อุณหภูมิ</span>
            <span style="font-weight:700;font-size:22px;color:${color}">${sensor.temp?.toFixed(1)}°C</span>
          </div>
          <div style="padding:4px 8px;border-radius:6px;background:${status === "offline" ? "#1e293b" : status === "critical" ? "#fef2f2" : "#f0fdf4"};text-align:center;margin-bottom:6px">
            <span style="font-size:12px;font-weight:600;color:${color}">${status === "offline" ? "⚫ ขาดการติดต่อ" : status === "critical" ? "🔴 วิกฤต" : "🟢 ปกติ"}</span>
          </div>
          ${sensor.last_seen ? `<div style="font-size:11px;color:#94a3b8;text-align:center">อัปเดต: ${new Date(sensor.last_seen).toLocaleTimeString("th-TH")}</div>` : ""}
        </div>`;
        if (markersRef.current[sensor.id]) {
          markersRef.current[sensor.id].setIcon(icon);
          markersRef.current[sensor.id].setPopupContent(popup);
        } else {
          markersRef.current[sensor.id] = L.marker([sensor.lat, sensor.lng], {
            icon,
          })
            .bindPopup(popup)
            .on("click", () => {
              setSelectedSensor(sensor);
              setActiveTab("history");
            })
            .addTo(mapInstanceRef.current);
        }
        if (status === "critical") sendLineAlert(sensor);
      });
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

  // โหลด Leaflet
  useEffect(() => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => {
      if (!mapRef.current || mapInstanceRef.current) return;
      const L = window.L;
      const map = L.map(mapRef.current, { zoomControl: false }).setView(
        MAP_CENTER,
        MAP_ZOOM,
      );
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        { attribution: "© OpenStreetMap © CARTO", maxZoom: 19 },
      ).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      mapInstanceRef.current = map;
    };
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(css);
      document.head.removeChild(script);
    };
  }, []);

  // ดึงข้อมูล + Subscribe

  useEffect(() => {
    const fetchAll = async () => {
      const { data: s } = await supabase.from("sensors").select("*");
      setSensors(s ?? []);
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: l } = await supabase
        .from("logs")
        .select("*")
        .gte("recorded_at", since)
        .order("recorded_at", { ascending: true });
      setLogs(l ?? []);
      setLastUpdate(new Date());
      setLoading(false);
    };
    fetchAll();

    const sc = supabase
      .channel("sensors-v2")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sensors" },
        (p) => {
          setSensors((prev) => {
            if (p.eventType === "INSERT") return [...prev, p.new];
            if (p.eventType === "UPDATE") {
              if (p.new.temp <= ALERT_THRESHOLD)
                alertedIds.current.delete(p.new.id);
              recordLog(p.new);
              return prev.map((s) => (s.id === p.new.id ? p.new : s));
            }
            if (p.eventType === "DELETE")
              return prev.filter((s) => s.id !== p.old.id);
            return prev;
          });
          setLastUpdate(new Date());
        },
      )
      .subscribe();

    const lc = supabase
      .channel("logs-v2")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "logs" },
        (p) => {
          setLogs((prev) => [...prev, p.new]);
        },
      )
      .subscribe();

    const hb = setInterval(() => setSensors((prev) => [...prev]), 60000);

    return () => {
      supabase.removeChannel(sc);
      supabase.removeChannel(lc);
      clearInterval(hb);
    };
  }, [recordLog]);

  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => updateMarkers(sensors), 500);
      return () => clearTimeout(t);
    }
  }, [sensors, loading, updateMarkers]);

  const criticalCount = sensors.filter(
    (s) => getSensorStatus(s) === "critical",
  ).length;
  const offlineCount = sensors.filter(
    (s) => getSensorStatus(s) === "offline",
  ).length;
  const avgTemp =
    sensors.length > 0
      ? (
          sensors.reduce((sum, s) => sum + (s.temp ?? 0), 0) / sensors.length
        ).toFixed(1)
      : "--";
  const selectedLogs = selectedSensor
    ? logs.filter((l) => l.sensor_id === selectedSensor.id).slice(-24)
    : [];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&family=IBM+Plex+Mono:wght@400;600&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Sarabun',sans-serif;background:#0a0f1e;color:#e2e8f0}
        .layout{display:flex;height:100vh;overflow:hidden}
        .sidebar{width:300px;min-width:300px;background:#0d1424;border-right:1px solid #1e2d42;display:flex;flex-direction:column;overflow:hidden}
        .sidebar-header{padding:16px;border-bottom:1px solid #1e2d42}
        .brand{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
        .stats{display:grid;grid-template-columns:1fr 1fr;gap:7px}
        .stat{background:#111827;border:1px solid #1e2d42;border-radius:8px;padding:9px 12px}
        .stat-label{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px}
        .stat-value{font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:600;color:#f1f5f9}
        .tabs{display:flex;border-bottom:1px solid #1e2d42}
        .tab{flex:1;padding:10px;text-align:center;font-size:12px;color:#475569;cursor:pointer;border-bottom:2px solid transparent;transition:all 0.2s}
        .tab.active{color:#f97316;border-bottom-color:#f97316}
        .sensor-list{flex:1;overflow-y:auto;padding:0 10px 10px}
        .sensor-list::-webkit-scrollbar{width:3px}
        .sensor-list::-webkit-scrollbar-thumb{background:#1e2d42;border-radius:2px}
        .sensor-card{background:#111827;border:1px solid #1e2d42;border-radius:10px;padding:11px 13px;margin-bottom:7px;cursor:pointer;transition:all 0.2s;position:relative;overflow:hidden}
        .sensor-card:hover{border-color:#2d3f55}
        .sensor-card.selected{border-color:#f97316}
        .sensor-card.critical{border-color:#7f1d1d;background:#0f0808}
        .sensor-card.offline{border-color:#1e2d42;background:#0d1017;opacity:0.7}
        .sensor-card.critical::before,.sensor-card.offline::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px}
        .sensor-card.critical::before{background:#ef4444;animation:blink 1s ease-in-out infinite alternate}
        .sensor-card.offline::before{background:#475569}
        @keyframes blink{from{opacity:0.3}to{opacity:1}}
        .history-panel{flex:1;overflow-y:auto;padding:12px}
        .last-update{padding:10px 16px;border-top:1px solid #1e2d42;font-size:11px;color:#334155;font-family:'IBM Plex Mono',monospace}
        .map-area{flex:1;position:relative}
        #map{width:100%;height:100%}
        .map-badge{position:absolute;top:14px;left:14px;background:rgba(13,20,36,0.92);border:1px solid #1e2d42;border-radius:8px;padding:8px 14px;font-size:12px;color:#94a3b8;z-index:1000;backdrop-filter:blur(6px);font-family:'IBM Plex Mono',monospace}
        .legend{position:absolute;bottom:40px;left:14px;background:rgba(13,20,36,0.92);border:1px solid #1e2d42;border-radius:8px;padding:10px 14px;z-index:1000;backdrop-filter:blur(6px);font-size:11px;color:#94a3b8}
        .legend-item{display:flex;align-items:center;gap:8px;margin-bottom:4px}
        .legend-dot{width:10px;height:10px;border-radius:50%}
        @keyframes pulse{0%{transform:scale(0.8);opacity:0.6}100%{transform:scale(1.6);opacity:0}}
        .loading{position:fixed;inset:0;background:#0a0f1e;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;z-index:9999}
        .loading-icon{font-size:40px;animation:bounce 0.8s ease-in-out infinite alternate}
        @keyframes bounce{from{transform:scale(1)}to{transform:scale(1.2)}}
        .loading-text{font-family:'IBM Plex Mono',monospace;color:#f97316;font-size:13px;letter-spacing:2px}
        .loading-bar{width:180px;height:2px;background:#1e2d42;border-radius:1px;overflow:hidden}
        .loading-bar-fill{height:100%;background:#f97316;animation:fill 1.5s ease-in-out infinite}
        @keyframes fill{0%{width:0}100%{width:100%}}
        @media(max-width:640px){.layout{flex-direction:column}.sidebar{width:100%;min-width:unset;height:45vh;border-right:none;border-bottom:1px solid #1e2d42}.map-area{height:55vh}}
      `}</style>

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
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="brand">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 22 }}>🔥</span>
                <div>
                  <div
                    style={{
                      fontFamily: "'IBM Plex Mono',monospace",
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#f97316",
                    }}
                  >
                    FIREWATCH
                  </div>
                  <div style={{ fontSize: 10, color: "#475569" }}>
                    ระบบเฝ้าระวังไฟป่าประเทศไทย
                  </div>
                </div>
              </div>
              <button
                onClick={onLogout}
                style={{
                  fontSize: 11,
                  color: "#475569",
                  background: "none",
                  border: "1px solid #1e2d42",
                  borderRadius: 6,
                  padding: "4px 8px",
                  cursor: "pointer",
                }}
              >
                ออกจากระบบ
              </button>
            </div>
            <div className="stats">
              <div className="stat">
                <div className="stat-label">เซนเซอร์</div>
                <div className="stat-value">{sensors.length}</div>
              </div>
              <div className="stat">
                <div className="stat-label">แจ้งเตือน</div>
                <div
                  className="stat-value"
                  style={{ color: criticalCount > 0 ? "#ef4444" : "#22c55e" }}
                >
                  {criticalCount}
                </div>
              </div>
              <div className="stat">
                <div className="stat-label">อุณหภูมิเฉลี่ย</div>
                <div className="stat-value" style={{ color: "#f97316" }}>
                  {avgTemp}°C
                </div>
              </div>
              <div className="stat">
                <div className="stat-label">ออฟไลน์</div>
                <div
                  className="stat-value"
                  style={{ color: offlineCount > 0 ? "#64748b" : "#22c55e" }}
                >
                  {offlineCount}
                </div>
              </div>
            </div>
          </div>

          <div className="tabs">
            <div
              className={`tab ${activeTab === "sensors" ? "active" : ""}`}
              onClick={() => setActiveTab("sensors")}
            >
              📍 เซนเซอร์
            </div>
            <div
              className={`tab ${activeTab === "history" ? "active" : ""}`}
              onClick={() => setActiveTab("history")}
            >
              📊 ประวัติ
            </div>
          </div>

          {activeTab === "sensors" && (
            <div className="sensor-list">
              {[...sensors]
                .sort((a, b) => b.temp - a.temp)
                .map((sensor) => {
                  const status = getSensorStatus(sensor);
                  const color =
                    status === "offline"
                      ? "#64748b"
                      : status === "critical"
                        ? "#ef4444"
                        : "#22c55e";
                  return (
                    <div
                      key={sensor.id}
                      className={`sensor-card ${status} ${selectedSensor?.id === sensor.id ? "selected" : ""}`}
                      onClick={() => {
                        setSelectedSensor(sensor);
                        setActiveTab("history");
                        mapInstanceRef.current?.flyTo(
                          [sensor.lat, sensor.lng],
                          13,
                        );
                        markersRef.current[sensor.id]?.openPopup();
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#94a3b8",
                          marginBottom: 5,
                          lineHeight: 1.4,
                        }}
                      >
                        {sensor.name}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div
                          style={{
                            fontFamily: "'IBM Plex Mono',monospace",
                            fontSize: 20,
                            fontWeight: 600,
                            color,
                          }}
                        >
                          {sensor.temp?.toFixed(1)}°C
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            padding: "3px 9px",
                            borderRadius: 20,
                            background:
                              status === "offline"
                                ? "#0f172a"
                                : status === "critical"
                                  ? "#450a0a"
                                  : "#052e16",
                            color,
                            border: `1px solid ${status === "offline" ? "#1e2d42" : status === "critical" ? "#7f1d1d" : "#166534"}`,
                          }}
                        >
                          {status === "offline"
                            ? "⚫ ออฟไลน์"
                            : status === "critical"
                              ? "🔴 วิกฤต"
                              : "🟢 ปกติ"}
                        </div>
                      </div>
                      {sensor.last_seen && (
                        <div
                          style={{
                            fontSize: 10,
                            color: "#334155",
                            marginTop: 4,
                          }}
                        >
                          อัปเดต:{" "}
                          {new Date(sensor.last_seen).toLocaleTimeString(
                            "th-TH",
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}

          {activeTab === "history" && (
            <div className="history-panel">
              {selectedSensor ? (
                <>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#94a3b8",
                      marginBottom: 6,
                    }}
                  >
                    📊 {selectedSensor.name}
                  </div>
                  <div
                    style={{ fontSize: 11, color: "#475569", marginBottom: 10 }}
                  >
                    ประวัติ 24 ชั่วโมงล่าสุด ({selectedLogs.length} รายการ)
                  </div>
                  <HistoryChart logs={selectedLogs} />
                  <div
                    style={{
                      marginTop: 10,
                      fontSize: 11,
                      color: "#334155",
                      textAlign: "center",
                    }}
                  >
                    คลิกเซนเซอร์ในแท็บเซนเซอร์เพื่อดูกราฟ
                  </div>
                </>
              ) : (
                <div
                  style={{
                    textAlign: "center",
                    color: "#334155",
                    padding: "40px 16px",
                    fontSize: 13,
                  }}
                >
                  คลิกเซนเซอร์เพื่อดูกราฟประวัติอุณหภูมิ
                </div>
              )}
            </div>
          )}

          <div className="last-update">
            {lastUpdate
              ? `อัปเดต: ${lastUpdate.toLocaleTimeString("th-TH")}`
              : "กำลังเชื่อมต่อ..."}
          </div>
        </aside>

        <main className="map-area">
          <div id="map" ref={mapRef} />
          <div className="map-badge">
            แผนที่เฝ้าระวัง &nbsp;|&nbsp;{" "}
            <span style={{ color: "#f97316", fontWeight: 600 }}>ประเทศไทย</span>
          </div>
          <div className="legend">
            <div className="legend-item">
              <div className="legend-dot" style={{ background: "#22c55e" }} />{" "}
              ปกติ
            </div>
            <div className="legend-item">
              <div className="legend-dot" style={{ background: "#ef4444" }} />{" "}
              วิกฤต {">"}
              {ALERT_THRESHOLD}°C
            </div>
            <div className="legend-item">
              <div className="legend-dot" style={{ background: "#64748b" }} />{" "}
              ออฟไลน์
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

// Root — จัดการ Auth

export default function FireWatchApp() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (localStorage.getItem("fw_auth") === "true") setIsLoggedIn(true);
    setChecking(false);
  }, []);

  if (checking) return null;
  if (!isLoggedIn) return <LoginPage onLogin={() => setIsLoggedIn(true)} />;
  return (
    <Dashboard
      onLogout={() => {
        localStorage.removeItem("fw_auth");
        setIsLoggedIn(false);
      }}
    />
  );
}
