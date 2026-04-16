import React, { useState } from 'react'
import type { CSSProperties } from 'react'
import type { PhysarumOptions } from '../simulation/PhysarumSim.ts'

/** All persisted customization fields */
export interface SlimeCustomization {
  slimeName: string
  slimeColor: string
  sensorAngle: number
  rotationAngle: number
  sensorDistance: number
  depositAmount: number
  decayFactor: number
  slimeAvoidanceWeight: number
}

interface Props {
  slimeName: string
  setSlimeName: (v: string) => void
  slimeColor: string
  setSlimeColor: (v: string) => void
  onRegenTerrain: () => void
  foodMode: boolean
  setFoodMode: (v: boolean) => void
  simSpeed: number
  setSimSpeed: (v: number) => void
  paused: boolean
  setPaused: (v: boolean) => void
  agentCount: number
  foodCount: number
  sensorAngle: number
  setSensorAngle: (v: number) => void
  rotationAngle: number
  setRotationAngle: (v: number) => void
  sensorDistance: number
  setSensorDistance: (v: number) => void
  depositAmount: number
  setDepositAmount: (v: number) => void
  decayFactor: number
  setDecayFactor: (v: number) => void
  slimeAvoidanceWeight: number
  setSlimeAvoidanceWeight: (v: number) => void
  defaults: SlimeCustomization
}

const panelStyle: CSSProperties = {
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
  minWidth: 240,
  maxHeight: 'calc(100vh - 24px)',
  overflowY: 'auto',
  backdropFilter: 'blur(8px)',
  userSelect: 'none',
  zIndex: 100,
}

const buttonStyle: CSSProperties = {
  background: 'rgba(50, 120, 50, 0.4)',
  border: '1px solid rgba(100, 200, 100, 0.4)',
  borderRadius: 4,
  color: '#c0e8a0',
  padding: '5px 12px',
  cursor: 'pointer',
  fontSize: 12,
  transition: 'background 0.2s',
}

const activeButtonStyle: CSSProperties = {
  ...buttonStyle,
  background: 'rgba(100, 200, 100, 0.5)',
  border: '1px solid rgba(150, 255, 150, 0.6)',
  color: '#ffffff',
}

const inputStyle: CSSProperties = {
  background: 'rgba(20, 20, 40, 0.8)',
  border: '1px solid rgba(100, 200, 100, 0.3)',
  borderRadius: 4,
  color: '#d0e8c0',
  padding: '4px 8px',
  fontSize: 13,
  outline: 'none',
  width: '100%',
}

const labelStyle: CSSProperties = {
  display: 'block',
  marginBottom: 3,
  fontSize: 11,
  color: '#8ab078',
  textTransform: 'uppercase',
  letterSpacing: 1,
}

const sectionHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  cursor: 'pointer',
  padding: '4px 0',
}

const toDeg = (rad: number) => Math.round(rad * 180 / Math.PI)
const toRad = (deg: number) => deg * Math.PI / 180

interface SliderProps {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
  display: string | number
}

function SliderParam({ label, value, onChange, min, max, step, display }: SliderProps) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
        <span style={{ fontSize: 11, color: '#8ab078' }}>{label}</span>
        <span style={{ fontSize: 11, color: '#a0c890', fontFamily: 'monospace' }}>{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#4a8a3a', height: 4 }}
      />
    </div>
  )
}

export default function UI({
  slimeName, setSlimeName, slimeColor, setSlimeColor,
  onRegenTerrain, foodMode, setFoodMode,
  simSpeed, setSimSpeed, paused, setPaused,
  agentCount, foodCount,
  sensorAngle, setSensorAngle,
  rotationAngle, setRotationAngle,
  sensorDistance, setSensorDistance,
  depositAmount, setDepositAmount,
  decayFactor, setDecayFactor,
  slimeAvoidanceWeight, setSlimeAvoidanceWeight,
  defaults,
}: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [behaviorOpen, setBehaviorOpen] = useState(false)

  const resetBehavior = () => {
    setSensorAngle(defaults.sensorAngle)
    setRotationAngle(defaults.rotationAngle)
    setSensorDistance(defaults.sensorDistance)
    setDepositAmount(defaults.depositAmount)
    setDecayFactor(defaults.decayFactor)
    setSlimeAvoidanceWeight(defaults.slimeAvoidanceWeight)
  }

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
          style={{ ...sectionHeaderStyle, marginBottom: collapsed ? 0 : 12 }}
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
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="color"
                  value={slimeColor}
                  onChange={e => setSlimeColor(e.target.value)}
                  style={{ width: 32, height: 28, border: 'none', cursor: 'pointer', background: 'none' }}
                />
                <span style={{ fontSize: 12, color: '#8ab078' }}>{slimeColor}</span>
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

            {/* Behavior section */}
            <div>
              <div style={sectionHeaderStyle} onClick={() => setBehaviorOpen(!behaviorOpen)}>
                <label style={{ ...labelStyle, marginBottom: 0, cursor: 'pointer' }}>Behavior</label>
                <span style={{ fontSize: 10, color: '#708860' }}>{behaviorOpen ? '[ - ]' : '[ + ]'}</span>
              </div>

              {behaviorOpen && (
                <div style={{ marginTop: 6 }}>
                  <SliderParam label="Sensor Spread" value={toDeg(sensorAngle)}
                    onChange={v => setSensorAngle(toRad(v))} min={5} max={90} step={1}
                    display={`${toDeg(sensorAngle)}\u00B0`} />
                  <SliderParam label="Turn Sharpness" value={toDeg(rotationAngle)}
                    onChange={v => setRotationAngle(toRad(v))} min={5} max={90} step={1}
                    display={`${toDeg(rotationAngle)}\u00B0`} />
                  <SliderParam label="Sensor Range" value={sensorDistance}
                    onChange={setSensorDistance} min={1} max={9} step={1} display={sensorDistance} />
                  <SliderParam label="Trail Strength" value={depositAmount}
                    onChange={setDepositAmount} min={1} max={15} step={1} display={depositAmount} />
                  <SliderParam label="Trail Persistence" value={decayFactor}
                    onChange={setDecayFactor} min={0.5} max={0.99} step={0.01}
                    display={decayFactor.toFixed(2)} />
                  <SliderParam label="Memory (Slime Avoidance)" value={slimeAvoidanceWeight}
                    onChange={setSlimeAvoidanceWeight} min={0} max={1} step={0.05}
                    display={slimeAvoidanceWeight.toFixed(2)} />
                  <button style={{ ...buttonStyle, marginTop: 4, fontSize: 11 }} onClick={resetBehavior}>
                    Reset to Defaults
                  </button>
                </div>
              )}
            </div>

            {/* Terrain */}
            <div>
              <label style={labelStyle}>Terrain</label>
              <button style={buttonStyle} onClick={onRegenTerrain}>Regenerate Terrain</button>
            </div>

            {/* Food placement */}
            <div>
              <label style={labelStyle}>Food</label>
              <button
                style={foodMode ? activeButtonStyle : buttonStyle}
                onClick={() => setFoodMode(!foodMode)}
              >
                {foodMode ? 'Tap terrain to place food (active)' : 'Place Food Mode'}
              </button>
              {foodMode && (
                <div style={{ fontSize: 10, color: '#708860', marginTop: 4 }}>
                  Tap to place | Shift+Click to remove
                </div>
              )}
            </div>

            {/* Simulation controls */}
            <div>
              <label style={labelStyle}>Simulation</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button style={paused ? activeButtonStyle : buttonStyle} onClick={() => setPaused(!paused)}>
                  {paused ? 'Resume' : 'Pause'}
                </button>
                <span style={{ fontSize: 11, color: '#708860' }}>Speed:</span>
                <input type="range" min={1} max={10} value={simSpeed}
                  onChange={e => setSimSpeed(Number(e.target.value))}
                  style={{ width: 80, accentColor: '#4a8a3a' }} />
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
        Drag to orbit | Pinch to zoom | Place food to attract your slime mold
      </div>
    </>
  )
}
