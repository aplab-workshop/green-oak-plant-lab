import { useEffect, useRef, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { PASSWORD_MIN } from '@gol/shared';
import { login, playAsGuest, register } from '../store/authStore';

type Tab = 'login' | 'register';

/**
 * Modal เข้าสู่ระบบ / สมัคร (W2 / SPEC § 4.39) — สำเร็จแล้วเรียก onDone (เข้าเกม)
 */
export function AuthDialog({ close, onDone }: { close: () => void; onDone: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<Tab>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  const switchTab = (t: Tab) => {
    setTab(t);
    setError(null);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const err = tab === 'login' ? await login({ username, password }) : await register({ username, password, inviteCode });
    setBusy(false);
    if (err) setError(err);
    else onDone();
  };

  const isRegister = tab === 'register';
  return <dialog ref={ref} className="auth-dialog" aria-label="เข้าสู่ระบบหรือสมัคร" onCancel={close}
    onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
    <div className="auth-shell">
      <header className="auth-header">
        <div role="tablist" className="auth-tabs">
          {(['login', 'register'] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className="auth-tab" onClick={() => switchTab(t)}>
              {t === 'login' ? 'เข้าสู่ระบบ' : 'สมัคร'}
            </button>
          ))}
        </div>
        <button type="button" className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="ปิด" onClick={close}><X size={20} /></button>
      </header>
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <p className="text-sm text-slate-500">
          {isRegister ? 'ตั้ง ID และ Password ของคุณ แล้วกรอกรหัสเชิญที่ได้จากครู' : 'เข้าสู่ระบบก่อนเล่น เพื่อบันทึกคะแนนของคุณ'}
        </p>
        <label className="auth-field">
          <span>ID</span>
          <input autoFocus name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={20}
            value={username} onChange={(e) => setUsername(e.target.value)} required />
          {isRegister && <small>a–z, 0–9 หรือ _ ยาว 4–20 ตัว</small>}
        </label>
        <label className="auth-field">
          <span>Password</span>
          <input type="password" name="password" autoComplete={isRegister ? 'new-password' : 'current-password'} maxLength={72}
            value={password} onChange={(e) => setPassword(e.target.value)} required />
          {isRegister && <small>อย่างน้อย {PASSWORD_MIN} ตัว</small>}
        </label>
        {isRegister && <label className="auth-field">
          <span>รหัสเชิญ</span>
          <input name="inviteCode" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={64}
            value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="เช่น GO-7K3P-9QX2" required />
        </label>}
        {isRegister && <p className="text-xs text-slate-500">
          🔒 เก็บแค่ ID, Password (เข้ารหัส), รหัสเชิญ, คะแนนและ Log การเล่น — ไม่เก็บชื่อจริงหรืออีเมล ขอให้ครูลบบัญชีได้ทุกเมื่อ
        </p>}
        {error && <p role="alert" className="auth-error">{error}</p>}
        <button type="submit" className="home-btn home-btn-primary auth-submit" disabled={busy}>
          {busy ? 'กำลังส่ง…' : isRegister ? 'สมัครและเริ่มเล่น' : 'เข้าสู่ระบบและเล่น'}
        </button>
      </form>
      {/* P56: ปุ่มรอง — เล่นแบบ Guest ไม่บันทึกอะไร */}
      <div className="auth-guest">
        <button type="button" className="auth-guest-btn" onClick={() => { playAsGuest(); onDone(); }}>
          เล่นโดยไม่ Login
        </button>
        <small>ไม่บันทึกคะแนน/Log และไม่ขึ้นตารางอันดับ</small>
      </div>
    </div>
  </dialog>;
}
