'use client'

/**
 * FIREWATCH ULTIMATE V2.5
 * Optimized for Necromancer System
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// --- Configuration ---
const ALERT_THRESHOLD = 40
const OFFLINE_THRESHOLD = 15 * 60 * 1000 // 15 Minutes (Match with Vercel Cron)
const MAP_CENTER = [13.0, 101.0]
const MAP_ZOOM = 6
const DASHBOARD_PASSWORD = 'firewatch2025'

// --- Component: LoginPage ---
function LoginPage({ onLogin }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)

  const handleSubmit = () => {
    if (password === DASHBOARD_PASSWORD) {
      localStorage.setItem('fw_auth', 'true')
      onLogin()
    } else {
      setError(true); setShake(true)
      setTimeout(() => setShake(false), 500)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0f1e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Sarabun', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&family=IBM+Plex+Mono:wght@400;600&display=swap');
        @keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-8px)} 40%,80%{transform:translateX(8px)} }
      `}</style>
      <div style={{ background: '#0d1424', border: '1px solid #1e2d42', borderRadius: 16, padding: '40px 36px', width: 340, animation: shake ? 'shake 0.4s ease' : 'none' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🔥</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, fontWeight: 700, color: '#f97316' }}>FIREWATCH</div>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>NECROMANCER EDITION</div>
        </div>
        <input
          type="password" value={password}
          onChange={(e) => { setPassword(e.target.value); setError(false) }}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="รหัสผ่านเข้าถึงระบบ"
          style={{ width: '100%', padding: '12px 14px', background: '#111827', border: `1px solid ${error ? '#ef4444' : '#1e2d42'}`, borderRadius: 8, color: '#e2e8f0', fontSize: 14, outline: 'none', marginBottom: 12, boxSizing: 'border-box' }}
        />
        <button onClick={handleSubmit} style={{ width: '100%', padding: 12, background: '#f97316', border: 'none', borderRadius: 8, color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          ACTIVATE SYSTEM
        </button>
      </div>
    </div>
  )
}

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
function Dashboard({ onLogout }) {
  const [sensors, setSensors] = useState([])
  const [logs, setLogs] = useState([])
  const [selectedSensor, setSelectedSensor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [activeTab, setActiveTab] = useState('sensors')

  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef({})

  // 🔥 Smart Status Checker (Bypass Timezone & Force Online)
  const getSensorStatus = useCallback((sensor) => {
    if (!sensor.temp && sensor.temp !== 0) return 'offline'
    
    const timestamp = sensor.last_seen || sensor.updated_at
    if (!timestamp) return sensor.temp > ALERT_THRESHOLD ? 'critical' : 'normal'

    const now = new Date().getTime()
    const lastSeen = new Date(timestamp).getTime()
    const diff = Math.abs(now - lastSeen)
    
    // Check local time vs UTC (7h offset)
    const TZ_OFFSET = 7 * 60 * 60 * 1000
    const isOnline = diff < OFFLINE_THRESHOLD || Math.abs(diff - TZ_OFFSET) < OFFLINE_THRESHOLD

    if (!isOnline) return 'offline'
    return sensor.temp > ALERT_THRESHOLD ? 'critical' : 'normal'
  }, [])

  // 🗺️ Marker Sync Engine
  const updateMarkers = useCallback((sensorList) => {
    if (!mapInstanceRef.current || !window.L) return
    const L = window.L
    sensorList.forEach((sensor) => {
      const status = getSensorStatus(sensor)
      const color = status === 'offline' ? '#64748b' : status === 'critical' ? '#ef4444' : '#22c55e'
      const html = `
        <div style="position:relative;width:44px;height:44px;display:flex;align-items:center;justify-content:center">
          <div style="width:32px;height:32px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;box-shadow:0 0 15px ${color}66;z-index:2;border:2px solid rgba(255,255,255,0.2)">
            <span style="color:white;font-size:9px;font-weight:700">${status === 'offline' ? 'OFF' : Math.round(sensor.temp) + '°'}</span>
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

  // Initial Boot
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

  // Data Engine
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

    const hb = setInterval(() => setSensors(prev => [...prev]), 30000)
    return () => { supabase.removeChannel(channel); clearInterval(hb) }
  }, [])

  useEffect(() => { if (!loading) updateMarkers(sensors) }, [sensors, loading, updateMarkers])

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0a0f1e', color: '#e2e8f0', fontFamily: "'Sarabun', sans-serif", overflow: 'hidden' }}>
      <style>{`@keyframes pulse { 0% { transform: scale(0.8); opacity: 0.5; } 100% { transform: scale(1.6); opacity: 0; } }`}</style>
      
      <aside style={{ width: 300, background: '#0d1424', borderRight: '1px solid #1e2d42', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 20, borderBottom: '1px solid #1e2d42' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: '#f97316', fontWeight: 700, letterSpacing: 1 }}>FIREWATCH V2.5</div>
            <button onClick={onLogout} style={{ background: 'none', border: '1px solid #1e2d42', color: '#475569', fontSize: 10, padding: '4px 8px', borderRadius: 4, cursor: 'pointer' }}>LOGOUT</button>
          </div>
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

        <nav style={{ display: 'flex', background: '#0d1424' }}>
          <div onClick={() => setActiveTab('sensors')} style={{ flex: 1, padding: 15, textAlign: 'center', fontSize: 12, cursor: 'pointer', color: activeTab === 'sensors' ? '#f97316' : '#475569', borderBottom: `2px solid ${activeTab === 'sensors' ? '#f97316' : 'transparent'}` }}>SENSORS</div>
          <div onClick={() => setActiveTab('history')} style={{ flex: 1, padding: 15, textAlign: 'center', fontSize: 12, cursor: 'pointer', color: activeTab === 'history' ? '#f97316' : '#475569', borderBottom: `2px solid ${activeTab === 'history' ? '#f97316' : 'transparent'}` }}>HISTORY</div>
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
              ) : <div style={{ textAlign: 'center', color: '#475569', marginTop: 40, fontSize: 12 }}>SELECT A SENSOR ON MAP</div>}
            </div>
          )}
        </div>
        
        <div style={{ padding: 15, background: '#0a0f1e', fontSize: 10, color: '#334155', borderTop: '1px solid #1e2d42' }}>
          SYSTEM TIME: {lastUpdate?.toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' })}
        </div>
      </aside>

      <main style={{ flex: 1, position: 'relative' }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
        <div style={{ position: 'absolute', top: 25, left: 25, zIndex: 1000, background: '#0d1424cc', padding: '12px 20px', borderRadius: 12, border: '1px solid #1e2d42', backdropFilter: 'blur(10px)' }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>FIREWATCH DASHBOARD</div>
          <div style={{ fontSize: 10, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }}></span> LIVE MONITORING
          </div>
        </div>
      </main>
    </div>
  )
}

export default function FireWatchApp() {
  const [auth, setAuth] = useState(false); const [checking, setChecking] = useState(true)
  useEffect(() => { if (localStorage.getItem('fw_auth') === 'true') setAuth(true); setChecking(false) }, [])
  if (checking) return null
  if (!auth) return <LoginPage onLogin={() => setAuth(true)} />
  return <Dashboard onLogout={() => { localStorage.removeItem('fw_auth'); setAuth(false) }} />
}