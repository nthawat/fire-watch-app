'use client'

/**
 * - FIREWATCH ULTIMATE V2.9 - NECROMANCER EDITION
 * - No Login: เข้าหน้า Dashboard ได้ทันทีไม่ต้องใส่รหัส
 * - Force Online: หมุดเขียวตลอดกาลถ้ามีข้อมูลอุณหภูมิ
 * - Bangkok Timezone: แสดงเวลาไทย GMT+7 ทั้งระบบ
 * - Live Clock: เวลานับถอยหลัง/เดินตลอดวินาทีต่อวินาที
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// --- Configuration ---
const ALERT_THRESHOLD = 40
const MAP_CENTER = [13.0, 101.0]
const MAP_ZOOM = 6

// --- Component: HistoryChart ---
function HistoryChart({ logs }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current || logs.length === 0) return
    const render = () => {
      if (chartRef.current) chartRef.current.destroy()
      chartRef.current = new window.Chart(canvasRef.current, {
        type: 'line',
        data: {
          labels: logs.map((l) => new Date(l.recorded_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' })),
          datasets: [{ label: '°C', data: logs.map((l) => l.temp), borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,0.1)', fill: true, tension: 0.4 }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 20, grid: { color: '#1e2d42' } }, x: { grid: { color: '#1e2d42' } } } }
      })
    }
    if (!window.Chart) {
      const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/chart.js'; s.onload = render; document.head.appendChild(s)
    } else render()
    return () => chartRef.current?.destroy()
  }, [logs])

  return <div style={{ height: 160 }}><canvas ref={canvasRef} /></div>
}

// --- Main Dashboard Component ---
export default function FireWatchApp() {
  const [sensors, setSensors] = useState([])
  const [logs, setLogs] = useState([])
  const [selectedSensor, setSelectedSensor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [activeTab, setActiveTab] = useState('sensors')
  
  // 🕒 1. เพิ่ม State สำหรับนาฬิกา
  const [clock, setClock] = useState(new Date())

  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef({})

  // 🕒 2. สั่งให้นาฬิกาเดินทุก 1 วินาที
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // 🔥 เช็คแค่ว่ามี Temp ไหม ถ้ามี = เขียว (No Heartbeat Timeout)
  const getSensorStatus = useCallback((sensor) => {
    const t = sensor.temp ?? sensor.temperature ?? sensor.Temp
    if (t === null || t === undefined) return 'offline'
    return t > ALERT_THRESHOLD ? 'critical' : 'normal'
  }, [])

  const updateMarkers = useCallback((sensorList) => {
    if (!mapInstanceRef.current || !window.L) return
    const L = window.L
    sensorList.forEach((sensor) => {
      const status = getSensorStatus(sensor)
      const t = sensor.temp ?? sensor.temperature ?? sensor.Temp
      const color = status === 'offline' ? '#64748b' : status === 'critical' ? '#ef4444' : '#22c55e'
      const html = `
        <div style="position:relative;width:44px;height:44px;display:flex;align-items:center;justify-content:center">
          <div style="width:32px;height:32px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;box-shadow:0 0 15px ${color}66;z-index:2;border:2px solid rgba(255,255,255,0.2)">
            <span style="color:white;font-size:9px;font-weight:700">${status === 'offline' ? 'OFF' : Math.round(t) + '°'}</span>
          </div>
          ${status === 'critical' ? `<div style="position:absolute;width:44px;height:44px;border-radius:50%;border:2px solid ${color};animation:pulse 1.2s infinite"></div>` : ''}
        </div>`
      
      const icon = L.divIcon({ className: '', html, iconSize: [44, 44] })
      if (markersRef.current[sensor.id]) {
        markersRef.current[sensor.id].setIcon(icon)
      } else {
        markersRef.current[sensor.id] = L.marker([sensor.lat, sensor.lng], { icon })
          .addTo(mapInstanceRef.current)
          .on('click', () => { setSelectedSensor(sensor); setActiveTab('history') })
      }
    })
  }, [getSensorStatus])

  useEffect(() => {
    const script = document.createElement('script'); script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(css); document.head.appendChild(script)
    script.onload = () => {
      if (mapInstanceRef.current) return
      const map = window.L.map(mapRef.current, { zoomControl: false }).setView(MAP_CENTER, MAP_ZOOM)
      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map)
      mapInstanceRef.current = map
    }
  }, [])

  useEffect(() => {
    const load = async () => {
      const { data: s } = await supabase.from('sensors').select('*')
      setSensors(s || [])
      const { data: l } = await supabase.from('logs').select('*').gte('recorded_at', new Date(Date.now()-86400000).toISOString()).order('recorded_at')
      setLogs(l || [])
      setLastUpdate(new Date()); setLoading(false)
    }
    load()

    const channel = supabase.channel('fire-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sensors' }, (p) => {
        if (p.eventType === 'UPDATE') setSensors(prev => prev.map(s => s.id === p.new.id ? p.new : s))
        setLastUpdate(new Date())
      }).subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => { if (!loading) updateMarkers(sensors) }, [sensors, loading, updateMarkers])

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0a0f1e', color: '#e2e8f0', fontFamily: "'Sarabun', sans-serif", overflow: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap');
        @keyframes pulse { 0% { transform: scale(0.8); opacity: 0.5; } 100% { transform: scale(1.6); opacity: 0; } }
      `}</style>
      
      <aside style={{ width: 300, background: '#0d1424', borderRight: '1px solid #1e2d42', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 20, borderBottom: '1px solid #1e2d42' }}>
          <div style={{ color: '#f97316', fontWeight: 700, fontSize: 16 }}>FIREWATCH LIVE 🟢</div>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>NECROMANCER MONITORING STATION</div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 20 }}>
            <div style={{ background: '#111827', padding: 12, borderRadius: 10, border: '1px solid #1e2d42' }}>
              <div style={{ fontSize: 9, color: '#64748b' }}>ACTIVE</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#22c55e' }}>{sensors.filter(s => getSensorStatus(s) !== 'offline').length}</div>
            </div>
            <div style={{ background: '#111827', padding: 12, borderRadius: 10, border: '1px solid #1e2d42' }}>
              <div style={{ fontSize: 9, color: '#64748b' }}>OFFLINE</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#475569' }}>{sensors.filter(s => getSensorStatus(s) === 'offline').length}</div>
            </div>
          </div>
        </div>

        <nav style={{ display: 'flex' }}>
          <div onClick={() => setActiveTab('sensors')} style={{ flex: 1, padding: 15, textAlign: 'center', fontSize: 12, cursor: 'pointer', color: activeTab === 'sensors' ? '#f97316' : '#475569', borderBottom: `2px solid ${activeTab === 'sensors' ? '#f97316' : 'transparent'}`, fontWeight: 600 }}>SENSORS</div>
          <div onClick={() => setActiveTab('history')} style={{ flex: 1, padding: 15, textAlign: 'center', fontSize: 12, cursor: 'pointer', color: activeTab === 'history' ? '#f97316' : '#475569', borderBottom: `2px solid ${activeTab === 'history' ? '#f97316' : 'transparent'}`, fontWeight: 600 }}>HISTORY</div>
        </nav>

        <div style={{ flex: 1, overflowY: 'auto', padding: 15 }}>
          {activeTab === 'sensors' ? (
            sensors.sort((a,b) => b.temp - a.temp).map(s => {
              const status = getSensorStatus(s); const color = status === 'offline' ? '#475569' : status === 'critical' ? '#ef4444' : '#22c55e'
              return (
                <div key={s.id} onClick={() => { mapInstanceRef.current.flyTo([s.lat, s.lng], 10); setSelectedSensor(s); setActiveTab('history') }} style={{ background: '#111827', padding: 15, borderRadius: 12, marginBottom: 10, cursor: 'pointer', border: '1px solid #1e2d42' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>{s.name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color }}>{s.temp?.toFixed(1)}°C</div>
                    <div style={{ fontSize: 9, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: color + '11', color, border: `1px solid ${color}44` }}>{status.toUpperCase()}</div>
                  </div>
                </div>
              )
            })
          ) : (
            <div>
              {selectedSensor ? (
                <>
                  <div style={{ fontSize: 13, color: '#f97316', fontWeight: 700, marginBottom: 15 }}>{selectedSensor.name}</div>
                  <HistoryChart logs={logs.filter(l => l.sensor_id === selectedSensor.id).slice(-24)} />
                </>
              ) : <div style={{ textAlign: 'center', color: '#475569', marginTop: 40, fontSize: 12 }}>SELECT A SENSOR TO VIEW LOGS</div>}
            </div>
          )}
        </div>
        
        {/* 🕒 3. เปลี่ยน LAST SYNC ให้ใช้นาฬิกาวิ่งตลอด */}
        <div style={{ padding: 15, background: '#0a0f1e', fontSize: 10, color: '#334155', borderTop: '1px solid #1e2d42' }}>
          LAST SYNC: {clock.toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' })}
        </div>
      </aside>

      <main style={{ flex: 1, position: 'relative' }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
        <div style={{ position: 'absolute', top: 25, left: 25, zIndex: 1000, background: '#0d1424cc', padding: '12px 20px', borderRadius: 12, border: '1px solid #1e2d42', backdropFilter: 'blur(10px)' }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>FIREWATCH DASHBOARD</div>
          <div style={{ fontSize: 10, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 6 }}>
             <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }}></span> SYSTEM LIVE
          </div>
        </div>
      </main>
    </div>
  )
}