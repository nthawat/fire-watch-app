"use client";
import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import dynamic from "next/dynamic";

const Map = dynamic(() => import("../components/Map"), { ssr: false });

//  Component: กราฟเส้น
function HistoryChart({ logs }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  useEffect(() => {
    // ถ้าไม่มีข้อมูล Logs จะไม่วาดกราฟ
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
              timeZone: "Asia/Bangkok",
            }),
          ),
          datasets: [
            {
              label: "°C",
              data: logs.map((l) => l.temp),
              borderColor: "#f97316",
              backgroundColor: "rgba(249,115,22,0.1)",
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
            y: { min: 20, grid: { color: "#1e2d42" } },
            x: { grid: { color: "#1e2d42" } },
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
  }, [logs]);

  // หากไม่มีข้อมูล ให้แสดงข้อความแทนที่กราฟว่างๆ
  if (logs.length === 0) {
    return (
      <div
        style={{
          height: 180,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#475569",
          fontSize: "11px",
          border: "1px dashed #1e2d42",
          borderRadius: "12px",
          marginTop: 15,
        }}
      >
        ไม่มีข้อมูลประวัติในรอบ 24 ชม.
      </div>
    );
  }

  return (
    <div style={{ height: 180, marginTop: 15 }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

export default function FireWatchApp() {
  const [sensors, setSensors] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selectedSensor, setSelectedSensor] = useState(null);
  const [activeTab, setActiveTab] = useState("sensors");
  const [clock, setClock] = useState(new Date());

  // นาฬิกา Real-time
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // โหลดข้อมูลจาก Supabase
  const loadData = async () => {
    const { data: s } = await supabase.from("sensors").select("*");
    setSensors(s || []);
    // ดึง logs ย้อนหลัง 24 ชั่วโมง
    const { data: l } = await supabase
      .from("logs")
      .select("*")
      .gte("recorded_at", new Date(Date.now() - 86400000).toISOString())
      .order("recorded_at", { ascending: true });
    setLogs(l || []);
  };

  useEffect(() => {
    loadData();
    // ฟังการอัปเดตแบบ Real-time
    const ch = supabase
      .channel("fire-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sensors" },
        () => {
          loadData();
        },
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const getColor = (t) => {
    if (t >= 40) return "#ef4444";
    if (t >= 36) return "#f97316";
    if (t >= 31) return "#eab308";
    return "#22c55e";
  };

  const handleSelect = (s) => {
    window.dispatchEvent(
      new CustomEvent("flyToSensor", { detail: { lat: s.lat, lng: s.lng } }),
    );
    setSelectedSensor(s);
    setActiveTab("history");
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        background: "#0a0f1e",
        color: "#e2e8f0",
        fontFamily: "'Sarabun', sans-serif",
        overflow: "hidden",
      }}
    >
      <aside
        style={{
          width: 320,
          background: "#0d1424",
          borderRight: "1px solid #1e2d42",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: 25, borderBottom: "1px solid #1e2d42" }}>
          <div style={{ color: "#f97316", fontWeight: 700, fontSize: 12 }}>
            FIREWATCH LIVE 🟢
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 5 }}>
            {clock.toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok" })}
          </div>
        </div>

        <nav style={{ display: "flex", borderBottom: "1px solid #1e2d42" }}>
          <div
            onClick={() => setActiveTab("sensors")}
            style={{
              flex: 1,
              padding: 15,
              textAlign: "center",
              fontSize: 12,
              cursor: "pointer",
              color: activeTab === "sensors" ? "#f97316" : "#475569",
              borderBottom: `2px solid ${activeTab === "sensors" ? "#f97316" : "transparent"}`,
              fontWeight: 600,
            }}
          >
            SENSORS
          </div>
          <div
            onClick={() => setActiveTab("history")}
            style={{
              flex: 1,
              padding: 15,
              textAlign: "center",
              fontSize: 12,
              cursor: "pointer",
              color: activeTab === "history" ? "#f97316" : "#475569",
              borderBottom: `2px solid ${activeTab === "history" ? "#f97316" : "transparent"}`,
              fontWeight: 600,
            }}
          >
            HISTORY
          </div>
        </nav>

        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {activeTab === "sensors" ? (
            sensors
              .sort((a, b) => (b.temp || 0) - (a.temp || 0))
              .map((s) => {
                const statusColor = getColor(s.temp);
                return (
                  <div
                    key={s.id}
                    onClick={() => handleSelect(s)}
                    style={{
                      background: "#111827",
                      padding: "15px 20px",
                      borderRadius: 12,
                      marginBottom: 12,
                      cursor: "pointer",
                      border: "1px solid #1e2d42",
                      borderLeft: `4px solid ${statusColor}`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: 8,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#94a3b8",
                        }}
                      >
                        {s.name}
                      </div>
                      <div
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: 20,
                          background: statusColor + "11",
                          color: statusColor,
                          border: `1px solid ${statusColor}44`,
                        }}
                      >
                        {s.temp >= 40 ? "CRITICAL" : "NORMAL"}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 26,
                        fontWeight: 700,
                        color: statusColor,
                      }}
                    >
                      {s.temp?.toFixed(1)}°C
                    </div>
                  </div>
                );
              })
          ) : (
            <div>
              {selectedSensor ? (
                <>
                  <div style={{ marginBottom: 20 }}>
                    <div
                      style={{
                        fontSize: 16,
                        color: "#f97316",
                        fontWeight: 700,
                      }}
                    >
                      {selectedSensor.name}
                    </div>
                    <div
                      style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}
                    >
                      📍 พิกัด: {selectedSensor.lat.toFixed(4)},{" "}
                      {selectedSensor.lng.toFixed(4)}
                    </div>
                  </div>

                  <HistoryChart
                    logs={logs.filter((l) => l.sensor_id === selectedSensor.id)}
                  />

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "10px",
                      marginTop: "15px",
                    }}
                  >
                    <div
                      style={{
                        background: "#111827",
                        padding: "12px",
                        borderRadius: "10px",
                        border: "1px solid #1e2d42",
                      }}
                    >
                      <div style={{ fontSize: "9px", color: "#64748b" }}>
                        MAX (24H)
                      </div>
                      <div
                        style={{
                          fontSize: "18px",
                          fontWeight: "700",
                          color: "#ef4444",
                        }}
                      >
                        {Math.max(
                          ...logs
                            .filter((l) => l.sensor_id === selectedSensor.id)
                            .map((l) => l.temp),
                          selectedSensor.temp,
                        ).toFixed(1)}
                        °C
                      </div>
                    </div>
                    <div
                      style={{
                        background: "#111827",
                        padding: "12px",
                        borderRadius: "10px",
                        border: "1px solid #1e2d42",
                      }}
                    >
                      <div style={{ fontSize: "9px", color: "#64748b" }}>
                        AVG (24H)
                      </div>
                      <div
                        style={{
                          fontSize: "18px",
                          fontWeight: "700",
                          color: "#eab308",
                        }}
                      >
                        {(
                          logs
                            .filter((l) => l.sensor_id === selectedSensor.id)
                            .reduce((a, b) => a + b.temp, 0) /
                          (logs.filter((l) => l.sensor_id === selectedSensor.id)
                            .length || 1)
                        ).toFixed(1)}
                        °C
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: "15px",
                      padding: "15px",
                      background: "#111827",
                      borderRadius: "12px",
                      border: "1px solid #1e2d42",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "10px",
                        color: "#f97316",
                        fontWeight: 700,
                        marginBottom: 5,
                      }}
                    >
                      LOCATION SUMMARY
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#94a3b8",
                        lineHeight: "1.5",
                      }}
                    >
                      สถานะ:{" "}
                      <span
                        style={{
                          color:
                            selectedSensor.temp >= 40 ? "#ef4444" : "#22c55e",
                          fontWeight: 700,
                        }}
                      >
                        {selectedSensor.temp >= 40
                          ? "เฝ้าระวังไฟป่า"
                          : "ปลอดภัย"}
                      </span>
                      <br />
                      พื้นที่: {selectedSensor.name.replace("เซนเซอร์ ", "")}
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveTab("sensors")}
                    style={{
                      width: "100%",
                      marginTop: 20,
                      padding: 14,
                      background: "#1e2d42",
                      color: "#f97316",
                      borderRadius: 12,
                      cursor: "pointer",
                      border: "1px solid #f9731644",
                      fontWeight: 700,
                      fontSize: 12,
                    }}
                  >
                    ← กลับไปหน้ารายชื่อ
                  </button>
                </>
              ) : (
                <div
                  style={{
                    textAlign: "center",
                    color: "#475569",
                    marginTop: 50,
                  }}
                >
                  เลือกเซนเซอร์บนแผนที่เพื่อดูข้อมูล
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      <main style={{ flex: 1, position: "relative" }}>
        <Map sensors={sensors} onSensorClick={handleSelect} />
        <div
          style={{
            position: "absolute",
            top: 25,
            left: 25,
            zIndex: 1000,
            background: "#0d1424cc",
            padding: "12px 20px",
            borderRadius: 12,
            border: "1px solid #1e2d42",
            backdropFilter: "blur(8px)",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700 }}>Dashboard</div>
        </div>
      </main>
    </div>
  );
}
