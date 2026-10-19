import { useEffect, useState } from 'react';
import { AlertTriangle, Droplets, Fan, FlaskConical, Lightbulb, Power, TestTube, Wind, Waves } from 'lucide-react';
import {
  COMMAND_BITS,
  DOSE_DEVICES,
  LED_COMMAND_REGISTER,
  deviceName,
  deviceOfBit,
  playerDeviceOfDose,
  type DoseDevice,
  type MockPlcMode,
} from '@gol/shared';
import { formatDoseRemaining } from '../lib/format';
import { useLabStore } from '../store/labStore';
import { sendCommand } from '../store/api';
import { Panel } from './Panel';

const ICONS = {
  fan: Fan,
  humidifier: Waves,
  refillPump: Droplets,
  nutrientA: FlaskConical,
  nutrientB: FlaskConical,
  airPump: Wind,
  phDown: TestTube,
} as const;

/** ปุ่มโดส (SPEC § 4.7) — ระยะเวลานับเป็นเวลาจำลองที่ Server ผลเท่ากันทุก Speed */
const DOSES: Record<DoseDevice, { icon: string; label: string; effect: string; address: string }> = {
  refill: { icon: '🚰', label: 'เติมน้ำ', effect: '+10%', address: 'M102' },
  nutrient: { icon: '🧪', label: 'ใส่ปุ๋ย', effect: 'EC +0.15', address: 'M103+M104' },
  phDown: { icon: '⚗️', label: 'pH Down', effect: 'pH −0.2', address: 'M106' },
};

const LED_PRESETS = [
  { value: 0, label: 'ปิด' },
  { value: 50, label: '50%' },
  { value: 80, label: '80%' },
  { value: 100, label: '100%' },
] as const;

const MODES: { mode: MockPlcMode; label: string; hint: string }[] = [
  { mode: 'auto', label: 'Auto', hint: 'Ladder ตัวอย่างใน Mock PLC ควบคุมอัตโนมัติ' },
  { mode: 'manual', label: 'Manual', hint: 'สั่ง Actuator เองเหมือนกดสวิตช์ที่ PLC' },
  { mode: 'offline', label: 'Offline', hint: 'จำลองสาย LAN หลุด เพื่อดู Fail-safe' },
];

function Switch({ on, disabled, onChange, label }: { on: boolean; disabled: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? 'bg-emerald-500' : 'bg-slate-300'} ${
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
      }`}
    >
      <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : ''}`} />
    </button>
  );
}

function LedControl({ value, manual }: { value: number; manual: boolean }) {
  const [draft, setDraft] = useState(value);
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    if (!dragging) setDraft(value);
  }, [value, dragging]);
  const commit = () => {
    setDragging(false);
    if (draft !== value) void sendCommand({ type: 'setManualLed', value: draft });
  };
  return (
    <input
      type="range"
      min={0}
      max={100}
      step={5}
      value={draft}
      disabled={!manual}
      aria-label="LED brightness"
      onChange={(e) => {
        setDragging(true);
        setDraft(Number(e.target.value));
      }}
      onPointerUp={commit}
      onKeyUp={commit}
      className="w-full accent-emerald-600 disabled:opacity-40"
    />
  );
}

export function ActuatorPanel() {
  const snap = useLabStore((s) => s.snapshot);
  const error = useLabStore((s) => s.commandError);
  if (!snap) return <Panel title="Actuators ← PLC">{null}</Panel>;
  const { commands, plc, failsafe, level } = snap;
  // ด่านที่ยังไม่ปลดล็อกอุปกรณ์ → ผู้ช่วยฟาร์มคุมแทน (SPEC § 4.6)
  const locked = (key: (typeof COMMAND_BITS)[number]['key']) => !!level && !level.playerDevices.includes(deviceOfBit(key));
  const manual = plc.mode === 'manual';
  const doseLocked = (d: DoseDevice) => !!level && !level.playerDevices.includes(playerDeviceOfDose(d));
  const canDose = manual && !failsafe;

  return (
    <Panel title="Actuators ← PLC" icon={<Power className="h-3.5 w-3.5" />}>
      {plc.kind === 'mock' && (
        <div className="border-b border-slate-100 px-3 py-2">
          <div className="mb-1 text-[11px] text-slate-500">Mock PLC mode</div>
          <div className="grid grid-cols-3 gap-1 rounded-md bg-slate-100 p-0.5">
            {MODES.map((m) => (
              <button
                key={m.mode}
                type="button"
                title={m.hint}
                onClick={() => void sendCommand({ type: 'setPlcMode', mode: m.mode })}
                className={`rounded px-2 py-1 text-xs font-medium ${
                  plc.mode === m.mode ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">{MODES.find((m) => m.mode === plc.mode)?.hint}</p>
        </div>
      )}

      {failsafe && (
        <div className="flex gap-2 border-b border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Fail-safe: ไม่ได้รับคำสั่งจาก PLC — ปิดทุกอย่าง ยกเว้น Air Pump</span>
        </div>
      )}

      {canDose && (
        <div className="border-b border-slate-100 px-3 py-2">
          <div className="mb-1 text-[11px] text-slate-500">สั่งเป็นโดส (กดซ้ำ = ต่อคิว)</div>
          <div className="grid grid-cols-3 gap-1">
            {DOSE_DEVICES.map((d) => {
              const info = DOSES[d];
              const active = snap.doses.find((x) => x.device === d);
              const lockedDose = doseLocked(d);
              return (
                <button
                  key={d}
                  type="button"
                  disabled={lockedDose}
                  title={lockedDose ? 'ด่านนี้ยังไม่ปลดล็อก ผู้ช่วยฟาร์มดูแลให้' : `${info.label} 1 โดส (${info.address}) ${info.effect}`}
                  onClick={() => void sendCommand({ type: 'dose', device: d })}
                  className={`flex flex-col items-center rounded-md border px-1 py-1.5 text-[11px] leading-tight ${
                    active ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  } disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  <span className="text-base">{lockedDose ? '🔒' : info.icon}</span>
                  <span className="font-semibold">{info.label}</span>
                  <span className="text-[10px] text-slate-500">
                    {active ? `เหลือ ${formatDoseRemaining(active.remainingS)}` : info.effect}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <ul className="divide-y divide-slate-100">
        {COMMAND_BITS.map((bit) => {
          const Icon = ICONS[bit.key];
          const on = commands[bit.key];
          return (
            <li key={bit.key} className="flex items-center gap-2 px-3 py-1.5">
              <Icon className={`h-4 w-4 shrink-0 ${on ? 'text-emerald-600' : 'text-slate-400'}`} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-slate-700">{bit.label}</div>
                <div className="font-mono text-[10px] text-slate-400">{deviceName('M', bit.address)}</div>
              </div>
              <span
                className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                  on ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {on ? 'ON' : 'OFF'}
              </span>
              {manual && locked(bit.key) && <span className="text-[10px] text-slate-400" title="ด่านนี้ยังไม่ปลดล็อก ผู้ช่วยฟาร์มดูแลให้">🔒 ผู้ช่วย</span>}
              {manual && !locked(bit.key) && (
                <Switch
                  on={on}
                  disabled={failsafe}
                  label={bit.label}
                  onChange={(v) => void sendCommand({ type: 'setManualBit', key: bit.key, value: v })}
                />
              )}
            </li>
          );
        })}
        <li className="px-3 py-1.5">
          <div className="flex items-center gap-2">
            <Lightbulb className={`h-4 w-4 shrink-0 ${commands.ledPct > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-slate-700">{LED_COMMAND_REGISTER.label}</div>
              <div className="font-mono text-[10px] text-slate-400">{deviceName('D', LED_COMMAND_REGISTER.address)}</div>
            </div>
            <span className="font-mono text-sm font-semibold text-slate-800">{commands.ledPct}%</span>
          </div>
          {canDose && (
            <div className="mt-1 grid grid-cols-4 gap-1" role="group" aria-label="LED presets">
              {LED_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  aria-pressed={commands.ledPct === p.value}
                  onClick={() => void sendCommand({ type: 'setManualLed', value: p.value })}
                  className={`rounded px-1 py-0.5 text-[11px] font-medium ${
                    commands.ledPct === p.value ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
          {/* Slider ละเอียดเฉพาะ Free Play (โหมดเกมใช้ Preset) */}
          {canDose && !level && <LedControl value={commands.ledPct} manual={manual} />}
        </li>
      </ul>
      {error && <p className="border-t border-rose-100 px-3 py-1.5 text-xs text-rose-600">{error}</p>}
    </Panel>
  );
}
