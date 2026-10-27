import { useState } from 'react';

export interface NotifyPrefs {
  desktop: boolean;
  onlyOnFail: boolean;
  sound: boolean;
}

export const DEFAULT_NOTIFY: NotifyPrefs = { desktop: true, onlyOnFail: false, sound: true };

/** Short two-tone beep via WebAudio — no asset to ship. */
export function beep(ok: boolean): void {
  try {
    const ctx = new AudioContext();
    const tones = ok ? [660, 880] : [440, 330];
    tones.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      g.gain.value = 0.08;
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.18);
      o.stop(ctx.currentTime + i * 0.18 + 0.15);
    });
  } catch {
    /* audio blocked */
  }
}

export function notify(prefs: NotifyPrefs, title: string, body: string, ok: boolean): void {
  if (prefs.onlyOnFail && ok) return;
  if (prefs.sound) beep(ok);
  if (prefs.desktop && 'Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}

export function NotifyTab({ prefs, onChange }: { prefs: NotifyPrefs; onChange: (p: NotifyPrefs) => void }): JSX.Element {
  const [perm, setPerm] = useState(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  const row = (key: keyof NotifyPrefs, label: string, hint: string): JSX.Element => (
    <label className="pref">
      <input type="checkbox" checked={prefs[key]} onChange={(e) => onChange({ ...prefs, [key]: e.target.checked })} />
      <span>
        <b>{label}</b>
        <span className="muted small">{hint}</span>
      </span>
    </label>
  );
  return (
    <section className="card card-pad prefs">
      <h3 className="card-title">Thông báo khi chạy xong</h3>
      {row('desktop', 'Thông báo Windows', 'Hiện toast góc màn hình khi lần chạy kết thúc.')}
      {row('onlyOnFail', 'Chỉ báo khi có lỗi', 'Bỏ qua thông báo nếu mọi test đều đạt.')}
      {row('sound', 'Âm báo', 'Bíp hai tiếng: cao = đạt, thấp = có lỗi.')}
      <div className="form-row">
        <span className="muted small">Quyền thông báo: <b>{perm}</b></span>
        {perm !== 'granted' && perm !== 'unsupported' && (
          <button className="btn" onClick={() => void Notification.requestPermission().then(setPerm)}>
            Cho phép thông báo
          </button>
        )}
        <button className="btn" onClick={() => notify({ ...prefs, onlyOnFail: false }, 'Volt POS Test Runner', 'Thông báo thử ✓', true)}>
          Gửi thử
        </button>
      </div>
    </section>
  );
}
