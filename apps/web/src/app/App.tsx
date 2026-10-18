import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Activity, BookOpen, ChartNoAxesCombined, ChevronRight, Droplets, Leaf, List, Maximize2, SlidersHorizontal, Sprout, Trophy, X } from 'lucide-react';
import { Header } from './Header';
import { SensorPanel } from '../dashboard/SensorPanel';
import { ActuatorPanel } from '../dashboard/ActuatorPanel';
import { PlantDetail, PlantSelector } from '../dashboard/PlantDetail';
import { SimControls } from '../dashboard/SimControls';
import { ScenarioPanel } from '../dashboard/ScenarioPanel';
import { TrendChart } from '../dashboard/TrendChart';
import { EventLog } from '../dashboard/EventLog';
import { GuidePanel, LevelBriefing } from '../dashboard/GuidePanel';
import { LossStoryView } from '../dashboard/LossStoryView';
import { PlantView } from '../scene/PlantView';
import { useLabStore } from '../store/labStore';
import { sendCommand } from '../store/api';

type Detail = 'sensors' | 'actuators' | 'plant' | 'scenario' | 'trends' | 'timeline' | 'score' | 'guide';
const PINNABLE: Detail[] = ['sensors', 'plant', 'actuators', 'trends'];
const ITEMS: { key: Detail; label: string; icon: ReactNode }[] = [
  { key: 'sensors', label: 'Sensors', icon: <Activity /> },
  { key: 'actuators', label: 'ควบคุม', icon: <SlidersHorizontal /> },
  { key: 'plant', label: 'ต้นผัก', icon: <Sprout /> },
  { key: 'scenario', label: 'ภารกิจ', icon: <Leaf /> },
  { key: 'trends', label: 'กราฟ', icon: <ChartNoAxesCombined /> },
  { key: 'timeline', label: 'Timeline', icon: <List /> },
  { key: 'guide', label: 'คู่มือ', icon: <BookOpen /> },
];

/** Native dialog จัดการ Focus trap และ Escape; ปิดแล้วคืน Focus ให้ปุ่มเดิม */
function DetailDialog({ title, children, close }: { title: string; children: ReactNode; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    return () => { dialog.close(); if (trigger?.isConnected) trigger.focus(); };
  }, []);
  return <dialog ref={ref} className="detail-dialog" aria-label={title} onCancel={close}
    onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
    <div className="detail-shell">
      <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <h2 className="font-semibold text-slate-800">{title}</h2>
        <button autoFocus className="rounded-full p-2 hover:bg-slate-100" aria-label="ปิดรายละเอียด" onClick={close}><X size={20} /></button>
      </header>
      <div className="detail-content">{children}</div>
    </div>
  </dialog>;
}

function ScoreDetail() {
  const game = useLabStore((s) => s.snapshot?.game);
  if (!game) return <p className="p-6">กำลังรอคะแนนจาก Server…</p>;
  return <div className="space-y-5 p-6">
    <div className="rounded-2xl bg-emerald-50 p-6 text-center">
      <Trophy className="mx-auto mb-2 text-amber-500" size={32} />
      <p className="text-sm text-emerald-800">{game.status === 'lost' || game.status === 'won' ? 'คะแนนสุดท้าย' : 'คะแนนการดูแล'}</p>
      <p className="text-5xl font-bold text-emerald-900">{game.score}<span className="text-lg font-normal"> / 1,500</span></p>
      <p className="mt-2 text-sm text-slate-600">ดูแลมา {(game.elapsedS / 86400).toFixed(2)} วันจำลอง · รอด {game.totalPlants - game.deadPlantIds.length}/{game.totalPlants} ต้น</p>
    </div>
    <div className="grid grid-cols-2 gap-3 text-sm">
      <p>สุขภาพเฉลี่ยตลอดรอบ <b className="block text-xl">{game.averageHealth.toFixed(1)}%</b></p>
      <p>ความคืบหน้าการเติบโต <b className="block text-xl">{Math.round(game.growthProgress * 100)}%</b></p>
    </div>
    <p className="text-sm leading-relaxed text-slate-600">คะแนนคิดจากสุขภาพเฉลี่ยตลอดรอบ 80% และการเติบโตสู่ระยะเก็บเกี่ยว 20% แล้วคูณสัดส่วนต้นที่ยังรอด (เต็ม 1,000) เมื่อเก็บเกี่ยวได้รับโบนัสสูงสุด 500 ตามต้นที่รอดและสุขภาพเฉลี่ย ดูแลให้สุขภาพดีต่อเนื่องและเติบโตจึงได้คะแนนสูง การ Pause ไม่เพิ่มคะแนน</p>
    <p className="rounded-xl bg-slate-50 p-4 text-sm">Best: {game.best ? `${game.best.score} คะแนน · รอบ ${(game.best.elapsedS / 86400).toFixed(2)} วัน` : 'ยังไม่มีรอบที่เข้าเกณฑ์'}<br /><span className="text-xs text-slate-500">บันทึกเมื่อจบรอบที่เล่นอย่างน้อย 24 ชั่วโมงจำลอง แยกตาม Lab/ภารกิจ เก็บจนปิด Server; ควรเทียบรอบที่มีระยะเวลาเท่ากัน</span></p>
  </div>;
}

/** เลือกด่าน (ขั้นต่ำ P21; หน้าเลือกด่านเต็มรูปแบบใน P24) */
function LevelSelect() {
  const level = useLabStore((s) => s.snapshot?.level);
  const levels = useLabStore((s) => s.snapshot?.levels);
  if (!levels) return null;
  return <select aria-label="เลือกด่าน" className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700"
    value={level?.id ?? 'free'} onChange={(e) => void sendCommand({ type: 'selectLevel', levelId: e.target.value as 'L1' })}>
    {levels.map((l) => <option key={l.id} value={l.id} disabled={!l.unlocked}>
      {l.unlocked ? '' : '🔒 '}ด่าน {l.id.slice(1)}: {l.title} {'⭐'.repeat(l.bestStars)}
    </option>)}
    <option value="free">Free Play (ฝึก PLC)</option>
  </select>;
}

export function App() {
  const snap = useLabStore((s) => s.snapshot);
  const selected = useLabStore((s) => s.selectedPlantId);
  const error = useLabStore((s) => s.commandError);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 1100px)').matches);
  const [panels, setPanels] = useState<Detail[]>(['actuators']);
  const [chart, setChart] = useState('growth');
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1100px)');
    const update = () => setWide(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const [seenLoss, setSeenLoss] = useState('');
  const [resetting, setResetting] = useState(false);
  const game = snap?.game;
  const plant = snap?.plants.find((p) => p.id === selected) ?? snap?.plants[0];
  const round = snap ? `${snap.labId}:${snap.runId}` : '';
  const lost = game?.status === 'lost';
  const showLoss = lost && seenLoss !== round;
  // Briefing เด้งครั้งเดียวต่อรอบตอนรอเริ่ม (ready) บอกเป้าหมาย/สิ่งที่ต้องทำ/ข้อควรระวัง
  const [seenBrief, setSeenBrief] = useState('');
  const showBrief = game?.status === 'ready' && seenBrief !== round && !showLoss;
  const closeDetail = () => setDetail(null);
  const open = (key: Detail) => setDetail(key);
  const toggle = (key: Detail) => {
    if (!wide || !PINNABLE.includes(key)) return open(key);
    setPanels((current) => current.includes(key) ? current.filter((p) => p !== key) : [...current, key]);
  };
  const content = (key: Detail) => {
    switch (key) {
      case 'sensors': return <SensorPanel />;
      case 'actuators': return <ActuatorPanel />;
      case 'plant': return <PlantDetail />;
      case 'scenario': return <ScenarioPanel />;
      case 'trends': return <TrendChart selectedChart={chart} onChartChange={setChart} />;
      case 'timeline': return <EventLog />;
      case 'score': return <ScoreDetail />;
      case 'guide': return <GuidePanel />;
    }
  };
  const pinned = (key: Detail) => panels.includes(key) && <aside className={`workspace-panel workspace-${key}`} aria-label={`แผง${ITEMS.find((i) => i.key === key)!.label}`}>
    <header className="workspace-heading"><strong>{ITEMS.find((i) => i.key === key)!.label}</strong><div>
      <button aria-label={`ขยายแผง${key}`} title="ขยายรายละเอียด" onClick={() => open(key)}><Maximize2 size={14} /></button>
      <button aria-label={`ปิดแผง${key}`} title="ปิดแผง" onClick={() => toggle(key)}><X size={15} /></button>
    </div></header>
    <div className="workspace-content">{detail !== key && content(key)}</div>
  </aside>;
  const scoreCards = <>
    <button className="hud-card score-card" onClick={() => open('score')} aria-label="ขยายคะแนนการดูแล">
      <span className="flex items-center justify-between text-xs text-emerald-800"><span className="flex items-center gap-2"><Trophy size={16} className="text-amber-500" /> CARE SCORE</span><Maximize2 size={13} /></span>
      <span className="mt-1 block text-3xl font-bold text-emerald-950">{game && game.elapsedS > 0 ? game.score : '—'} <span className="text-xs font-normal text-slate-500">/ 1,500</span></span>
      <span className="mt-1 block text-xs text-slate-600">{game ? `รอด ${game.totalPlants - game.deadPlantIds.length}/${game.totalPlants} ต้น` : 'รอ Server'} · Best {game?.best?.score ?? '—'}</span>
      {game && <span className="mt-1 block text-xs text-slate-600">
        เป้า {game.targetG} g{game.timeLimitS !== null && ` · วัน ${Math.min(game.elapsedS, game.timeLimitS) / 86400 | 0}/${game.timeLimitS / 86400}`}
        {game.energyBudgetKWh !== null && ` · ⚡ ${game.energyKWh.toFixed(1)}/${game.energyBudgetKWh} kWh`}
      </span>}
      {game?.testRun && <span className="mt-1 block text-[11px] font-semibold text-amber-700">TEST · ใช้ Auto ระหว่างรอบ ไม่นับ Best</span>}
    </button>
    {game?.canHarvest && <button className="hud-card harvest-card" onClick={() => void sendCommand({ type: 'harvest' })}>
      <span className="flex items-center gap-2 text-sm font-bold text-emerald-900"><Sprout size={18} /> ผักโตเต็มที่ — เก็บเกี่ยว!</span>
    </button>}
    {game?.status === 'won' && <button className="hud-card harvest-card" onClick={() => open('score')}>
      <span className="block text-sm font-bold text-emerald-900">🎉 เก็บเกี่ยวสำเร็จ · {game.yieldG?.toFixed(0)} g</span>
      <span className="block text-xs text-slate-600">{'⭐'.repeat(game.stars)} · คะแนน {game.score} (โบนัส +{game.harvestBonus}) · เลือกด่านถัดไปหรือ Reset</span>
    </button>}
  </>;
  const sensorCard = (
    <button className="hud-card sensor-card" onClick={() => open('sensors')} aria-label="ขยาย Sensors">
      <span className="mb-3 flex items-center justify-between text-xs font-semibold text-slate-500"><span className="flex items-center gap-2"><Droplets size={15} /> สภาพแวดล้อม</span><Maximize2 size={13} /></span>
      <span className="sensor-values">
        <span>น้ำ <b>{snap?.sensors.waterLevelPct.toFixed(0) ?? '—'}<small>%</small></b></span>
        <span>EC <b>{snap?.sensors.ecMsCm.toFixed(2) ?? '—'}<small>mS/cm</small></b></span>
        <span>pH <b>{snap?.sensors.ph.toFixed(2) ?? '—'}</b></span>
      </span>
    </button>
  );
  return <div className="game-app">
    <Header />
    <main className="game-main">
      <div className="game-topbar">
        <div><span className="text-xs font-semibold tracking-[0.15em] text-emerald-700">GREEN OAK GARDEN</span><p className="text-xs text-slate-500">ดูแลสวนของคุณให้เติบโต</p></div>
        <div className="flex flex-wrap items-center gap-3"><LevelSelect /><SimControls /></div>
      </div>
      <div className="garden-stage">
        <div className="scene-window"><PlantView /></div>
        {!wide && <div className="garden-hud">{scoreCards}{sensorCard}</div>}
        <aside className="hud-card plant-card">
          <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-emerald-800">ผักของคุณ</span><PlantSelector /></div>
          <button className="mt-3 flex w-full items-center justify-between text-left" onClick={() => open('plant')} aria-label="ขยายข้อมูลต้นผัก">
            <span><span className="block text-sm font-semibold">Plant {plant?.id ?? '—'} {plant && game?.deadPlantIds.includes(plant.id) ? '· ตายแล้ว' : ''}</span><span className="text-xs text-slate-500">Health {plant?.health.toFixed(0) ?? '—'}% · {plant?.biomassG.toFixed(1) ?? '—'} g</span></span><ChevronRight size={18} />
          </button>
        </aside>
        {/* จอกว้าง: การ์ดคะแนนและแผงซ้ายเรียงในคอลัมน์เดียว ไม่ซ้อนกันแม้การ์ดสูงขึ้น; ซ่อนการ์ดสภาพแวดล้อมเมื่อเปิดแผง Sensors (ค่าซ้ำ) */}
        {wide && <><div className="workspace-left">{scoreCards}{!panels.includes('sensors') && sensorCard}{pinned('sensors')}{pinned('plant')}</div>
          <div className="workspace-right" style={panels.includes('trends') ? undefined : { bottom: 90 }}>{pinned('actuators')}</div>{pinned('trends')}</>}
        {lost && <button className="loss-banner" onClick={() => setSeenLoss('')}>Game Over · {game.lostReason === 'timeout' ? 'หมดเวลาด่าน' : 'ต้นไม้ตายหมด'} — ดูผลรอบนี้</button>}
        <nav className="garden-dock" aria-label="รายละเอียดสวน">
          {ITEMS.map((item) => <button key={item.key} onClick={() => toggle(item.key)} aria-pressed={wide && panels.includes(item.key)} aria-label={`เปิด${item.label}`}>
            {item.icon}<span>{item.label}</span>
          </button>)}
        </nav>
        {snap?.scenario && <button className="mission-chip" onClick={() => open('scenario')}>ภารกิจ: {snap.scenario.title} <ChevronRight size={13} /></button>}
      </div>
      {error && <p role="alert" className="bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>}
      <footer className="px-3 py-1 text-[10px] text-slate-500">Educational Simulation — แบบจำลองเพื่อการเรียนการสอน ไม่ใช่โมเดลทำนายชีววิทยาที่ผ่านการตรวจสอบความแม่นยำ</footer>
    </main>
    {detail && !showLoss && <DetailDialog title={detail === 'score' ? 'คะแนนการดูแล' : detail === 'guide' ? '📖 คู่มือเกม' : ITEMS.find((x) => x.key === detail)!.label} close={closeDetail}>
      {content(detail)}
    </DetailDialog>}
    {showBrief && !detail && <DetailDialog title="🌱 ภารกิจก่อนเริ่มปลูก" close={() => setSeenBrief(round)}>
      <div className="space-y-5 p-6"><LevelBriefing />
        <div className="flex flex-wrap justify-end gap-3">
          <button className="rounded-xl border px-4 py-2 text-sm" onClick={() => { setSeenBrief(round); open('guide'); }}>📖 อ่านคู่มือเต็ม</button>
          <button className="rounded-xl bg-emerald-700 px-5 py-2 text-sm font-semibold text-white" onClick={async () => {
            setSeenBrief(round);
            await sendCommand({ type: 'startGame' });
          }}>เริ่มปลูก 🌱</button>
        </div>
      </div>
    </DetailDialog>}
    {showLoss && <DetailDialog title={game.lostReason === 'timeout' ? 'Game Over — หมดเวลา' : 'Game Over — ต้นไม้ตายหมด'} close={() => setSeenLoss(round)}>
      <div className="p-6"><h3 className="mb-4 text-center text-xl font-bold text-slate-800">📖 เกิดอะไรขึ้นกับสวนรอบนี้?</h3>
        <LossStoryView />
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button className="rounded-xl border px-4 py-2 text-sm" onClick={() => { setSeenLoss(round); open('timeline'); }}>ดูรายละเอียดใน Timeline</button>
          <button disabled={resetting} className="rounded-xl bg-emerald-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={async () => {
            setResetting(true);
            const ok = await sendCommand({ type: 'reset' });
            // Reset แล้วให้ Briefing ของด่านเด้ง ผู้เล่นทบทวนก่อนกดเริ่มปลูก
            if (ok) setDetail(null);
            setResetting(false);
          }}>{resetting ? 'กำลังเริ่ม…' : 'ปลูกใหม่'}</button>
        </div>{error && <p role="alert" className="mt-3 text-sm text-rose-600">{error}</p>}
      </div>
    </DetailDialog>}
  </div>;
}
