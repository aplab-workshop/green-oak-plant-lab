import { useState } from 'react';
import { BookOpen, Play } from 'lucide-react';
import { PlantView } from '../scene/PlantView';
import { GuidePanel } from '../dashboard/GuidePanel';
import { DEMO } from '../demo/mode';
import { DetailDialog } from './DetailDialog';

/**
 * หน้า Home / Main Menu (P52 / SPEC § 4.35) — Overlay บนฉาก 3D เดิมแบบไม่มี HUD
 * Play → เข้า HUD ปกติ · คู่มือการปลูก → Modal คู่มือเกม ปิดแล้วกลับมาที่นี่
 */
export function HomeScreen({ onPlay }: { onPlay: () => void }) {
  const [guide, setGuide] = useState(false);
  return <div className="home-screen">
    <div className="home-scene" aria-hidden="true"><PlantView home /></div>
    <div className="home-shade" />
    <section className="home-menu" aria-label="เมนูหลัก">
      <header className="home-title">
        <h1>GREEN OAK<br />VIRTUAL PLANT LAB</h1>
        <p>ดูแลสวนของคุณให้เติบโต</p>
      </header>
      <div className="home-actions">
        <div className="home-buttons">
          <button type="button" autoFocus className="home-btn home-btn-primary" onClick={onPlay}>
            <Play size={26} fill="currentColor" /> Play
          </button>
          <button type="button" className="home-btn home-btn-secondary" onClick={() => setGuide(true)}>
            <BookOpen size={24} /> คู่มือการปลูก
          </button>
        </div>
        {/* P54: Mascot โบกมือ เด้งแบบ Idle (DOM + CSS ไม่ใช่วัตถุในฉาก 3D) */}
        <figure className="home-mascot" aria-hidden="true">
          <img src={`${import.meta.env.BASE_URL}mascot/wave.png`} alt="" draggable={false} />
          <span className="home-mascot-shadow" />
        </figure>
      </div>
      {DEMO && <p className="home-note">🧪 Demo — Simulation ในเบราว์เซอร์ (Mock PLC)</p>}
    </section>
    {guide && <DetailDialog title="📖 คู่มือการปลูก" close={() => setGuide(false)}>
      <GuidePanel initialTab="routine" />
    </DetailDialog>}
  </div>;
}
