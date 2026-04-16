import React, { useState } from 'react'

const panelStyle = {
  position: 'absolute',
  top: 12,
  left: 12,
  background: 'rgba(10, 10, 30, 0.85)',
  border: '1px solid rgba(100, 200, 100, 0.3)',
  borderRadius: 8,
  padding: '14px 18px',
  color: '#d0e8c0',
  fontFamily: "'Segoe UI', system-ui, sans-serif",
  fontSize: 13,
  minWidth: 220,
  backdropFilter: 'blur(8px)',
  userSelect: 'none',
  zIndex: 100,
}

const buttonStyle = {
  background: 'rgba(50, 120, 50, 0.4)',
  border: '1px solid rgba(100, 200, 100, 0.4)',
  borderRadius: 4,
  color: '#c0e8a0',
  padding: '5px 12px',
  cursor: 'pointer',
  fontSize: 12,
  transition: 'background 0.2s',
}

const activeButtonStyle = {
  ...buttonStyle,
  background: 'rgba(100, 200, 100, 0.5)',
  border: '1px solid rgba(150, 255, 150, 0.6)',
  color: '#ffffff',
}

const inputStyle = {
  background: 'rgba(20, 20, 40, 0.8)',
  border: '1px solid rgba(100, 200, 100, 0.3)',
  borderRadius: 4,
  color: '#d0e8c0',
  padding: '4px 8px',
  fontSize: 13,
  outline: 'none',
  width: '100%',
}

const labelStyle = {
  display: 'block',
  marginBottom: 3,
  fontSize: 11,
  color: '#8ab078',
  textTransform: 'uppercase',
  letterSpacing: 1,
}

export default function UI({
  slimeName, setSlimeName, slimeColor, setSlimeColor,
  onRegenTerrain, foodMode, setFoodMode,
  simSpeed, setSimSpeed, paused, setPaused,
  agentCount, foodCount,
}) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <>
      {/* Title bar */}
      <div style={{
        position: 'absolute', top: 12, right: 12,
        background: 'rgba(10, 10, 30, 0.85)',
        border: '1px solid rgba(100, 200, 100, 0.3)',
        borderRadius: 8,
        padding: '10px 16px',
        color: '#a0d890',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        backdropFilter: 'blur(8px)',
        textAlign: 'right',
        zIndex: 100,
      }}>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 2 }}>
          {slimeName}
        </div>
        <div style={{ fontSize: 11, color: '#708860' }}>
          {agentCount} cells | {foodCount} food
        </div>
      </div>

      {/* Control panel */}
      <div style={panelStyle}>
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: collapsed ? 0 : 12, cursor: 'pointer' }}
          onClick={() => setCollapsed(!collapsed)}
        >
          <span style={{ fontSize: 14, fontWeight: 600 }}>Terrarium Controls</span>
          <span style={{ fontSize: 10, color: '#708860' }}>{collapsed ? '[ + ]' : '[ - ]'}</span>
        </div>

        {!collapsed && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Slime name */}
            <div>
              <label style={labelStyle}>Slime Name</label>
              <input
                style={inputStyle}
                value={slimeName}
                onChange={e => setSlimeName(e.target.value)}
                maxLength={20}
              />
            </div>

            {/* Slime color */}
            <div>
              <label style={labelStyle}>Slime Color</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="color"
                  value={slimeColor}
                  onChange={e => setSlimeColor(e.target.value)}
                  style={{ width: 32, height: 28, border: 'none', cursor: 'pointer', background: 'none' }}
                />
                <span style={{ fontSize: 12, color: '#8ab078' }}>{slimeColor}</span>
                {/* Quick color presets */}
                {['#d4e52e', '#e8a030', '#40c8e0', '#e860a0', '#a0ff60', '#ffffff'].map(c => (
                  <div
                    key={c}
                    onClick={() => setSlimeColor(c)}
                    style={{
                      width: 16, height: 16, borderRadius: 3,
                      background: c, cursor: 'pointer',
                      border: slimeColor === c ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Terrain */}
            <div>
              <label style={labelStyle}>Terrain</label>
              <button style={buttonStyle} onClick={onRegenTerrain}>
                Regenerate Terrain
              </button>
            </div>

            {/* Food placement */}
            <div>
              <label style={labelStyle}>Food</label>
              <button
                style={foodMode ? activeButtonStyle : buttonStyle}
                onClick={() => setFoodMode(!foodMode)}
              >
                {foodMode ? 'Click terrain to place food (active)' : 'Place Food Mode'}
              </button>
              {foodMode && (
                <div style={{ fontSize: 10, color: '#708860', marginTop: 4 }}>
                  Click to place | Shift+Click to remove
                </div>
              )}
            </div>

            {/* Simulation controls */}
            <div>
              <label style={labelStyle}>Simulation</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button
                  style={paused ? activeButtonStyle : buttonStyle}
                  onClick={() => setPaused(!paused)}
                >
                  {paused ? 'Resume' : 'Pause'}
                </button>
                <span style={{ fontSize: 11, color: '#708860' }}>Speed:</span>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={simSpeed}
                  onChange={e => setSimSpeed(Number(e.target.value))}
                  style={{ width: 80, accentColor: '#4a8a3a' }}
                />
                <span style={{ fontSize: 11, color: '#8ab078' }}>x{simSpeed}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div style={{
        position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(10, 10, 30, 0.7)',
        border: '1px solid rgba(100, 200, 100, 0.2)',
        borderRadius: 6,
        padding: '6px 14px',
        color: '#708860',
        fontSize: 11,
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        backdropFilter: 'blur(4px)',
        zIndex: 100,
        whiteSpace: 'nowrap',
      }}>
        Drag to orbit | Scroll to zoom | Place food to attract your slime mold
      </div>
    </>
  )
}
