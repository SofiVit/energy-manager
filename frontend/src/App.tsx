import { useEffect, useState } from 'react'
import './App.css'

interface DevicePreset {
  id: number
  title: string
  power_watts: number
  priority: number
  avg_duration_minutes: number
  category_name: string
}

export function App() {
  const [devices, setDevices] = useState<DevicePreset[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('http://localhost:5000/api/devices/presets')
      .then((res) => {
        if (!res.ok) {
          throw new Error('Помилка завантаження даних із сервера')
        }
        return res.json()
      })
      .then((data) => {
        setDevices(data)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Помилка запиту:', err)
        setError('Не вдалося завантажити список приладів')
        setLoading(false)
      })
  }, [])

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1>⚡ Energy Manager</h1>
      <h2>Каталог приладів (з бази даних PostgreSQL)</h2>

      {loading && <p>Завантаження приладів...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {!loading && !error && (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {devices.map((device) => (
            <li
              key={device.id}
              style={{
                background: '#2a2a2a',
                color: '#fff',
                margin: '10px 0',
                padding: '15px',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <strong>{device.title}</strong>
                <div style={{ fontSize: '0.85rem', color: '#aaa' }}>{device.category_name}</div>
              </div>
              <span style={{ fontWeight: 'bold', color: '#4caf50' }}>{device.power_watts} Вт</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default App