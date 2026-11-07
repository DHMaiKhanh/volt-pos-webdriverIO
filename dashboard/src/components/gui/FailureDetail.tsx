import { useEffect, useState } from 'react';
import type { Evidence, LiveResult } from '../../lib/gui';
import { evidenceUrl } from '../../lib/gui';

interface Diagnosis {
  title: string;
  hint: string;
}

/** Common failure shapes in this suite → what they usually mean, in plain words. */
const DIAGNOSES: [RegExp, Diagnosis][] = [
  [
    /invalid session id|session (is )?deleted|chrome not reachable|ECONNREFUSED|disconnected|target window already closed|no such window/i,
    {
      title: 'Mất kết nối với app (session chết / app crash / cửa sổ bị đóng)',
      hint: 'Không phải lỗi nghiệp vụ. Xem ảnh cuối: app còn mở không? Thường do app tự restart, máy ngủ, hoặc bị kill.',
    },
  ],
  [
    /STAFF_TOKEN|not signed in|signed out|\/login/i,
    {
      title: 'Thiết bị chưa đăng nhập (đã bị sign-out)',
      hint: 'Đăng nhập lại app (quét QR) rồi chạy lại. Mọi spec sau đó sẽ chết cùng lý do.',
    },
  ],
  [
    /passcode|Authentication failed|readyAnchor not ready|gate/i,
    {
      title: 'Kẹt ở màn passcode / màn chưa sẵn sàng',
      hint: 'Màn bị khoá passcode chưa được mở (unlockForRun) hoặc passcode sai. Xem ảnh: có hộp nhập passcode không?',
    },
  ],
  [
    /not clickable|click intercepted|obscured|other element would receive the click/i,
    {
      title: 'Phần tử bị che, chưa bấm được',
      hint: 'Có dialog / overlay / toast đè lên nút. Xem ảnh cuối và frame replay trước đó.',
    },
  ],
  [
    /still not (displayed|existing|enabled)|wasn't found|not found|no such element|not existing|element .* not (displayed|interactable)|waitFor\w+ .*timed? ?out/i,
    {
      title: 'Không tìm thấy phần tử trên màn hình',
      hint: 'Selector / data-testid đổi theo build mới, HOẶC app đang ở màn khác. So ảnh cuối với màn test mong đợi; mở DOM để tìm phần tử.',
    },
  ],
  [
    /Timeout of \d+ms exceeded|^Error: Timeout|timed out after/i,
    {
      title: 'Test chạy quá thời gian (bị treo)',
      hint: 'Một bước chờ mãi không xong. Xem "Các bước cuối": bước cuối cùng là chỗ bị treo.',
    },
  ],
  [
    /\b(HTTP|status( code)?)\s*[45]\d\d|\b[45]\d\d (Bad|Internal|Not Found|Unauthorized|Forbidden)/i,
    {
      title: 'API / server trả lỗi',
      hint: 'Lỗi phía backend hoặc dữ liệu test. Xem app.log để biết request nào hỏng.',
    },
  ],
  [
    /expect|Expected|Received|toBe|toEqual|toHave|AssertionError|to (equal|be|contain)/i,
    {
      title: 'Sai kết quả mong đợi (assertion)',
      hint: 'App chạy được nhưng giá trị khác mong đợi — có thể là BUG APP hoặc dữ liệu/cài đặt tiệm đã đổi. So "Expected" và "Received" bên dưới.',
    },
  ],
];

export function diagnose(r: LiveResult): Diagnosis {
  const text = `${r.message ?? r.error ?? ''}`;
  for (const [re, d] of DIAGNOSES)
    if (re.test(text))
      return r.hook
        ? {
            ...d,
            title: `Hook lỗi — ${d.title}`,
            hint: `${d.hint} Hook lỗi nên các test phía sau trong cùng nhóm bị bỏ qua.`,
          }
        : d;
  return r.hook
    ? {
        title: 'Hook (before/after) lỗi',
        hint: 'Lỗi ở bước chuẩn bị/dọn dẹp, không phải ở test. Các test phía sau trong nhóm bị bỏ qua.',
      }
    : { title: 'Lỗi khác', hint: 'Đọc thông báo lỗi + ảnh cuối + các bước cuối bên dưới.' };
}

const clock = (t: number): string => new Date(t).toLocaleTimeString('vi-VN', { hour12: false });

/** Slideshow of the frames before the failure, ending on the final screenshot. */
function Replay({ ev }: { ev: Evidence }): JSX.Element | null {
  const slides = [
    ...ev.frames.map((f) => ({ src: evidenceUrl(ev, f.name), label: f.label, at: f.at })),
    ...(ev.shot ? [{ src: evidenceUrl(ev, ev.shot), label: '✗ Lúc lỗi', at: ev.failedAt }] : []),
  ];
  const [i, setI] = useState(slides.length - 1);
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setI((n) => {
        if (n >= slides.length - 1) {
          setPlaying(false);
          return n;
        }
        return n + 1;
      });
    }, 900);
    return () => clearInterval(id);
  }, [playing, slides.length]);

  if (slides.length === 0)
    return <p className="muted small">Không chụp được ảnh (session có thể đã chết).</p>;
  const s = slides[Math.min(i, slides.length - 1)]!;
  return (
    <div className="replay">
      <button className="replay-frame" onClick={() => setZoom(true)} title="Bấm để phóng to">
        <img src={s.src} alt={s.label} loading="lazy" />
      </button>
      <div className="replay-bar">
        {slides.length > 1 && (
          <>
            <button
              className="btn sm"
              onClick={() => {
                if (i >= slides.length - 1) setI(0);
                setPlaying(!playing);
              }}
            >
              {playing ? '⏸' : '▶'} Replay
            </button>
            <input
              type="range"
              min={0}
              max={slides.length - 1}
              value={i}
              onChange={(e) => {
                setPlaying(false);
                setI(Number(e.target.value));
              }}
            />
          </>
        )}
        <span className="replay-label">
          {i + 1}/{slides.length} · {clock(s.at)} · {s.label}
        </span>
      </div>
      {zoom && (
        <div className="lightbox" onClick={() => setZoom(false)}>
          <img src={s.src} alt={s.label} />
          <span>{s.label} — bấm để đóng</span>
        </div>
      )}
    </div>
  );
}

export function FailureDetail({ r }: { r: LiveResult }): JSX.Element {
  const d = diagnose(r);
  const ev = r.evidence;
  return (
    <div className="fail-detail">
      <div className="diag">
        <b>Nguyên nhân có thể:</b> {d.title}
        <div className="muted small">{d.hint}</div>
      </div>
      <pre className="inbox-err">{r.message ?? r.error ?? 'Không có thông báo lỗi.'}</pre>
      {ev ? (
        <div className="evidence">
          <Replay ev={ev} />
          <div className="ev-side">
            <h4>Các bước cuối trước khi lỗi</h4>
            {ev.steps.length === 0 ? (
              <p className="muted small">Không ghi được bước nào.</p>
            ) : (
              <ol className="steps">
                {ev.steps.slice(-12).map((s, k, arr) => (
                  <li key={`${s.at}-${k}`} className={k === arr.length - 1 ? 'last' : ''}>
                    <span className="muted">{clock(s.at)}</span> {s.text}
                  </li>
                ))}
              </ol>
            )}
            <div className="ev-links">
              {ev.url && (
                <span className="muted small">
                  URL: <code>{ev.url.replace(/^.*?\/\/[^/]+/, '')}</code>
                </span>
              )}
              {ev.dom && (
                <a href={evidenceUrl(ev, ev.dom)} target="_blank" rel="noreferrer">
                  DOM lúc lỗi
                </a>
              )}
              {ev.log && (
                <a href={evidenceUrl(ev, ev.log)} target="_blank" rel="noreferrer">
                  App log
                </a>
              )}
            </div>
            {r.stack && (
              <details>
                <summary className="small">Stack</summary>
                <pre className="small stack">{r.stack}</pre>
              </details>
            )}
          </div>
        </div>
      ) : (
        <p className="muted small">
          Chưa có ảnh/replay cho lỗi này (đang chụp, hoặc test chạy trước khi bật tính năng).
        </p>
      )}
    </div>
  );
}
