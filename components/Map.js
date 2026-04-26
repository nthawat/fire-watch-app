"use client";
import { useEffect, useRef, useCallback } from "react";

const MAP_CENTER = [13.0, 101.0];
const MAP_ZOOM = 6;

export default function Map({ sensors, onSensorClick }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});

  const getStatus = useCallback((temp) => {
    if (temp === null || temp === undefined)
      return { color: "#64748b", pulse: false };
    if (temp >= 40) return { color: "#ef4444", pulse: true };
    if (temp >= 36) return { color: "#f97316", pulse: false };
    if (temp >= 31) return { color: "#eab308", pulse: false };
    return { color: "#22c55e", pulse: false };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && !mapInstanceRef.current) {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(css);
      document.head.appendChild(script);

      script.onload = () => {
        const L = window.L;
        if (!mapRef.current) return;
        const map = L.map(mapRef.current, { zoomControl: false }).setView(
          MAP_CENTER,
          MAP_ZOOM,
        );
        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        ).addTo(map);
        mapInstanceRef.current = map;
      };
    }
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !window.L || !sensors) return;
    const L = window.L;

    // ระบบรับคำสั่งบินจาก Sidebar
    const handleFlyTo = (e) => {
      const { lat, lng } = e.detail;
      mapInstanceRef.current.flyTo([lat, lng], 14, { duration: 1.5 });
    };
    window.addEventListener("flyToSensor", handleFlyTo);

    sensors.forEach((sensor) => {
      const temp = sensor.temp ?? sensor.temperature;
      const status = getStatus(temp);
      const html = `
        <div style="position:relative;width:44px;height:44px;display:flex;align-items:center;justify-content:center">
          <div style="width:32px;height:32px;border-radius:50%;background:${status.color};display:flex;align-items:center;justify-content:center;box-shadow:0 0 15px ${status.color}66;z-index:2;border:2px solid rgba(255,255,255,0.2)">
            <span style="color:white;font-size:9px;font-weight:700">${temp ? Math.round(temp) + "°" : "OFF"}</span>
          </div>
          ${status.pulse ? `<div style="position:absolute;width:44px;height:44px;border-radius:50%;border:2px solid ${status.color};animation:pulse 1.2s infinite"></div>` : ""}
        </div>`;

      const icon = L.divIcon({ className: "", html, iconSize: [44, 44] });

      if (markersRef.current[sensor.id]) {
        markersRef.current[sensor.id].setIcon(icon);
      } else {
        markersRef.current[sensor.id] = L.marker([sensor.lat, sensor.lng], {
          icon,
        })
          .addTo(mapInstanceRef.current)
          .on("click", () => onSensorClick(sensor));
      }
    });

    return () => window.removeEventListener("flyToSensor", handleFlyTo);
  }, [sensors, getStatus, onSensorClick]);

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <style>{`@keyframes pulse { 0% { transform: scale(0.8); opacity: 0.8; } 100% { transform: scale(1.6); opacity: 0; } }`}</style>
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
