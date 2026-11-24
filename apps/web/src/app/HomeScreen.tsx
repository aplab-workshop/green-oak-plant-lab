import { useEffect, useState } from 'react';
import { BookOpen, LogOut, Play, Trophy, UserRound } from 'lucide-react';
import { PlantView } from '../scene/PlantView';
import { GuidePanel } from '../dashboard/GuidePanel';
import { DEMO } from '../demo/mode';
import { initAuth, logout, useAuthStore } from '../store/authStore';
import { AuthDialog } from './AuthDialog';
import { LeaderboardPanel } from '../game/Leaderboard';
import { DetailDialog } from './DetailDialog';

/**
 * หน้า Home / Main Menu (P52 / SPEC § 4.35) — Overlay บนฉาก 3D เดิมแบบไม่มี HUD
 * Play → เข้า HUD ปกติ · คู่มือการปลูก → Modal คู่มือเกม ปิดแล้วกลับมาที่นี่
 * W2 (SPEC § 4.39): ระบบบัญชีเปิด → ต้อง Login ก่อน Play
 */
export function HomeScreen({ onPlay }: { onPlay: () => void }) {
  const [guide, setGuide] = useState(false);
  const [auth, setAuth] = useState(false);
  const [board, setBoard] = useState(false);
  const status = useAuthStore((s) => s.status);
  const player = useAuthStore((s) => s.player);
  const message = useAuthStore((s) => s.message);

  useEffect(() => {
    if (useAuthStore.getState().status === 'checking') void initAuth();
  }, []);
  // W7: Server ฟรีบน Cloud หลับเมื่อไม่มีคนใช้ — เชื่อมต่อนานเกิน 4 s บอกให้รอ
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (status !== 'checking') return setSlow(false);
    const t = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(t);
  }, [status]);

  const play = () => {
    if (status === 'off' || status === 'signedIn') onPlay();
    else if (status === 'signedOut') setAuth(true);
  };

  return <div className="home-screen">
    <div className="home-scene" aria-hidden="true"><PlantView home /></div>
    <div className="home-shade" />
    {status === 'signedIn' && player && <div className="home-account">
      <span className="home-account-name"><UserRound size={16} /> {player.username}</span>
      <button type="button" className="home-account-logout" onClick={logout}><LogOut size={15} /> ออกจากระบบ</button>
    </div>}
    <section className="home-menu" aria-label="เมนูหลัก">
      <header className="home-title">
        <h1>GREEN OAK<br />VIRTUAL PLANT LAB</h1>
        <p>ดูแลสวนของคุณให้เติบโต</p>
      </header>
      <div className="home-actions">
        <div className="home-buttons">
          <button type="button" autoFocus className="home-btn home-btn-primary" onClick={play} disabled={status === 'checking' || status === 'error'}>
            <Play size={26} fill="currentColor" /> {status === 'checking' ? 'กำลังเชื่อมต่อ…' : 'Play'}
          </button>
          <button type="button" className="home-btn home-btn-secondary" onClick={() => setGuide(true)}>
            <BookOpen size={24} /> คู่มือการปลูก
          </button>
          {status === 'signedIn' && <button type="button" className="home-btn home-btn-secondary" onClick={() => setBoard(true)}>
            <Trophy size={24} /> ตารางอันดับ
          </button>}
          {status === 'checking' && slow && <p role="status" className="home-auth-error">
            ⏳ Server กำลังตื่น (แพ็กเกจฟรีหลับเมื่อไม่มีคนใช้) อาจใช้เวลาถึง 1 นาที
          </p>}
          {status === 'error' && <p role="alert" className="home-auth-error">
            {message} <button type="button" className="underline" onClick={() => void initAuth()}>ลองใหม่</button>
          </p>}
        </div>
        {/* P54: Mascot โบกมือ เด้งแบบ Idle (DOM + CSS ไม่ใช่วัตถุในฉาก 3D) */}
        <figure className="home-mascot" aria-hidden="true">
          <img src={`${import.meta.env.BASE_URL}mascot/wave.png`} alt="" draggable={false} />
          <span className="home-mascot-shadow" />
        </figure>
      </div>
      {DEMO && <p className="home-note">🧪 Demo — Simulation ในเบราว์เซอร์ (Mock PLC)</p>}
    </section>
    {/* W8b: ทางเข้าหน้าครู (แท็บใหม่) — แสดงเมื่อระบบบัญชีเปิด; เข้าใช้ได้ต้องมี ADMIN_KEY */}
    {status !== 'off' && status !== 'checking' && (
      <a className="home-admin-link" href={`${window.location.pathname}?admin`} target="_blank" rel="noopener">
        🧑‍🏫 สำหรับครู
      </a>
    )}
    {guide && <DetailDialog title="📖 คู่มือการปลูก" close={() => setGuide(false)}>
      <GuidePanel initialTab="routine" />
    </DetailDialog>}
    {board && <DetailDialog title="🏆 ตารางอันดับ" close={() => setBoard(false)}>
      <LeaderboardPanel />
    </DetailDialog>}
    {auth && <AuthDialog close={() => setAuth(false)} onDone={() => { setAuth(false); onPlay(); }} />}
  </div>;
}
