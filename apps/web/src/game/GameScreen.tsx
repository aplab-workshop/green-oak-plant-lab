import type { ReactNode } from 'react';
import { BookOpen, FlaskConical, Map as MapIcon, Sprout } from 'lucide-react';
import type { DoseDevice, HistorySample, LabSnapshot, PlayerDevice } from '@gol/shared';
import { useLabStore } from '../store/labStore';
import { sendCommand } from '../store/api';
import { formatClock, formatDoseRemaining } from '../lib/format';
import { SimControls } from '../dashboard/SimControls';
import { AutoPauseBanner, AutoPauseToggle, ChallengeCard } from '../dashboard/ChallengeCard';
import { PlantView } from '../scene/PlantView';
import { canControl, gauges, goalProgress, helperMessage, type Gauge, type Tone } from './gameModel';

// ค่าคงที่: selector ต้องคืน reference เดิมเมื่อไม่มีข้อมูล
const NO_HISTORY: HistorySample[] = [];

const STATUS_CLASS: Record<Gauge['status'], string> = {
  ok: 'gauge-ok',
  warn: 'gauge-warn',
  alarm: 'gauge-alarm',
  neutral: 'gauge-neutral',
};
const TREND = { up: '↑', down: '↓', flat: '' } as const;
const TONE_CLASS: Record<Tone, string> = {
  info: 'helper-info',
  good: 'helper-good',
  warn: 'helper-warn',
  danger: 'helper-danger',
};

function Bar({ ratio, color, label }: { ratio: number; color: string; label: string }) {
  return (
    <div className="game-bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)}>
      <div style={{ width: `${Math.min(100, Math.max(0, ratio * 100))}%`, background: color }} />
    </div>
  );
}

/** 1. แถบบน: ด่าน/วัน/เวลา/Speed/เป้าหมาย/คะแนน/งบไฟ */
function TopBar({ s, onOpenLevels }: { s: LabSnapshot; onOpenLevels: () => void }) {
  const g = s.game;
  const goal = goalProgress(s);
  const day = g.timeLimitS !== null ? Math.min(Math.floor(g.elapsedS / 86400) + 1, g.timeLimitS / 86400) : null;
  const overBudget = g.energyBudgetKWh !== null && g.energyKWh > g.energyBudgetKWh;
  return (
    <header className="game-top hud-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <b className="text-emerald-900">🌱 ด่าน {s.level!.id.slice(1)} · {s.level!.title}</b>
          {day !== null && <span className="text-sm text-slate-600">วันที่ {day}/{g.timeLimitS! / 86400}</span>}
          <span className="text-sm text-slate-600">{formatClock(s.sim.minuteOfDay)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onOpenLevels} className="game-chip">
            <MapIcon size={14} /> เลือกด่าน
          </button>
          <AutoPauseToggle />
          <SimControls />
        </div>
      </div>
      <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,2fr)_auto_minmax(0,1fr)] md:items-center">
        <div>
          <div className="flex justify-between text-xs text-slate-600">
            <span>เป้าหมาย: ผักทุกต้นถึง <b>{goal.targetG} g</b></span>
            <span>ต้นเล็กสุด {goal.minG.toFixed(1)} g</span>
          </div>
          <Bar ratio={goal.ratio} color="#059669" label="ความคืบหน้าเป้าหมาย" />
        </div>
        <div className="text-sm font-semibold text-slate-800">⭐ {g.score} คะแนน</div>
        {g.energyBudgetKWh !== null && (
          <div>
            <div className="flex justify-between text-xs text-slate-600">
              <span>⚡ งบไฟ</span>
              <span className={overBudget ? 'font-semibold text-rose-600' : ''}>{g.energyKWh.toFixed(1)}/{g.energyBudgetKWh} kWh</span>
            </div>
            <Bar ratio={g.energyKWh / g.energyBudgetKWh} color={overBudget ? '#e11d48' : '#f59e0b'} label="พลังงานที่ใช้เทียบงบ" />
          </div>
        )}
      </div>
      {g.canHarvest && (
        <button type="button" onClick={() => void sendCommand({ type: 'harvest' })} className="game-harvest">
          <Sprout size={18} /> ผักทุกต้นถึงเป้าแล้ว — เก็บเกี่ยว!
        </button>
      )}
    </header>
  );
}

/** 2. มาตรวัด (กดเพื่อเปิดลิ้นชัก Sensors) */
function Gauges({ s, onOpen }: { s: LabSnapshot; onOpen: () => void }) {
  const history = useLabStore((st) => st.history ?? NO_HISTORY);
  return (
    <div className="game-gauges" aria-label="มาตรวัด">
      {gauges(s, history).map((g) => (
        <button key={g.key} type="button" onClick={onOpen} className={`gauge ${STATUS_CLASS[g.status]}`} title="ดูค่าละเอียดในลิ้นชัก 🔬">
          <span className="gauge-icon">{g.icon}</span>
          <span className="gauge-label">{g.label}</span>
          <span className="gauge-value">
            {g.value} <span className="gauge-trend">{TREND[g.trend]}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/** 4. กล่องข้อความผู้ช่วย */
function HelperBox({ s }: { s: LabSnapshot }) {
  const m = helperMessage(s);
  return (
    <div className={`game-helper ${TONE_CLASS[m.tone]}`} role="status" aria-live="polite">
      <span aria-hidden>💬</span> {m.text}
    </div>
  );
}

function ActionButton({
  icon,
  label,
  sub,
  active,
  locked,
  disabled,
  onClick,
}: {
  icon: string;
  label: string;
  sub?: string;
  active?: boolean;
  locked?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || locked}
      aria-pressed={active}
      title={locked ? 'ด่านนี้ยังไม่ปลดล็อก — ผู้ช่วยฟาร์มดูแลให้' : undefined}
      className={`action-btn ${active ? 'action-on' : ''}`}
    >
      <span className="text-lg">{locked ? '🔒' : icon}</span>
      <span className="font-semibold">{label}</span>
      {sub && <span className="text-[10px] opacity-75">{sub}</span>}
    </button>
  );
}

const LED_PRESETS = [0, 50, 80, 100] as const;

/** 5. แถบปุ่มอุปกรณ์ */
function ActionBar({ s, onGuide, onDrawer }: { s: LabSnapshot; onGuide: () => void; onDrawer: () => void }) {
  const manual = s.plc.kind === 'mock' && s.plc.mode === 'manual';
  const ready = manual && !s.failsafe;
  const own = (d: PlayerDevice) => canControl(s, d);
  const dose = (d: DoseDevice) => s.doses.find((x) => x.device === d);
  const doseSub = (d: DoseDevice, effect: string) => {
    const active = dose(d);
    return active ? `เหลือ ${formatDoseRemaining(active.remainingS)}` : effect;
  };
  const bit = (key: 'fan' | 'humidifier' | 'airPump') => () => void sendCommand({ type: 'setManualBit', key, value: !s.commands[key] });

  return (
    <nav className="game-actions" aria-label="ปุ่มอุปกรณ์">
      {!ready && (
        <div className="action-note">
          {s.failsafe ? 'Fail-safe: ไม่ได้รับคำสั่งจาก PLC — ปุ่มใช้ไม่ได้ชั่วคราว' : `Mock PLC อยู่โหมด ${s.plc.mode ?? s.plc.kind} — ปุ่มใช้ได้ในโหมด Manual`}
          {s.plc.kind === 'mock' && !manual && (
            <button type="button" onClick={() => void sendCommand({ type: 'setPlcMode', mode: 'manual' })} className="game-chip ml-2">
              เปลี่ยนเป็น Manual
            </button>
          )}
        </div>
      )}
      <div className="action-group" role="group" aria-label="ไฟ LED">
        <span className="action-group-label">💡 ไฟ</span>
        {LED_PRESETS.map((v) => (
          <button
            key={v}
            type="button"
            disabled={!ready}
            aria-pressed={s.commands.ledPct === v}
            onClick={() => void sendCommand({ type: 'setManualLed', value: v })}
            className={`led-btn ${s.commands.ledPct === v ? 'led-on' : ''}`}
          >
            {v === 0 ? 'ปิด' : `${v}%`}
          </button>
        ))}
      </div>
      <ActionButton icon="🚰" label="เติมน้ำ" sub={doseSub('refill', '+10%')} active={!!dose('refill')} locked={!own('refillPump')} disabled={!ready} onClick={() => void sendCommand({ type: 'dose', device: 'refill' })} />
      <ActionButton icon="🧪" label="ใส่ปุ๋ย" sub={doseSub('nutrient', 'EC +0.15')} active={!!dose('nutrient')} locked={!own('nutrient')} disabled={!ready} onClick={() => void sendCommand({ type: 'dose', device: 'nutrient' })} />
      <ActionButton icon="⚗️" label="pH Down" sub={doseSub('phDown', 'pH −0.2')} active={!!dose('phDown')} locked={!own('phDown')} disabled={!ready} onClick={() => void sendCommand({ type: 'dose', device: 'phDown' })} />
      <ActionButton icon="🌀" label="พัดลม" sub={s.commands.fan ? 'ON' : 'OFF'} active={s.commands.fan} locked={!own('fan')} disabled={!ready} onClick={bit('fan')} />
      <ActionButton icon="🌫️" label="หมอก" sub={s.commands.humidifier ? 'ON' : 'OFF'} active={s.commands.humidifier} locked={!own('humidifier')} disabled={!ready} onClick={bit('humidifier')} />
      <ActionButton icon="🫧" label="ปั๊มลม" sub={s.commands.airPump ? 'ON' : 'OFF'} active={s.commands.airPump} locked={!own('airPump')} disabled={!ready} onClick={bit('airPump')} />
      <span className="action-spacer" />
      <button type="button" onClick={onGuide} className="action-btn">
        <BookOpen size={18} />
        <span className="font-semibold">คู่มือ</span>
      </button>
      <button type="button" onClick={onDrawer} className="action-btn" aria-label="เปิดลิ้นชักข้อมูลนักวิทยาศาสตร์">
        <FlaskConical size={18} />
        <span className="font-semibold">🔬</span>
      </button>
    </nav>
  );
}

/** หน้าจอเกม 5 ส่วน (SPEC § 4.9) — ใช้เมื่อเลือกด่าน */
export function GameScreen({
  onOpenLevels,
  onGuide,
  onDrawer,
  drawer,
}: {
  onOpenLevels: () => void;
  onGuide: () => void;
  onDrawer: (tab?: string) => void;
  drawer: ReactNode;
}) {
  const s = useLabStore((st) => st.snapshot);
  if (!s || !s.level) return null;
  return (
    <div className="game-screen">
      <TopBar s={s} onOpenLevels={onOpenLevels} />
      <Gauges s={s} onOpen={() => onDrawer('sensors')} />
      <section className="game-scene" aria-label="สวนผัก">
        <PlantView />
        <AutoPauseBanner />
        <div className="game-scene-cards">
          <ChallengeCard />
        </div>
      </section>
      <HelperBox s={s} />
      <ActionBar s={s} onGuide={onGuide} onDrawer={() => onDrawer()} />
      {drawer}
    </div>
  );
}
