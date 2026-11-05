import { useState } from 'react';
import type { AppSlot, AppsStatus, EnvName, GuiRunner } from '../../lib/gui';

/** Staging = the dev build (ENV=dev): dev and staging are one environment here. */
const ENV_ORDER: EnvName[] = ['dev', 'prod'];
const ENV_LABEL: Record<EnvName, string> = { dev: 'Staging', prod: 'Production' };

interface Props {
  env: string;
  onEnv: (env: EnvName) => void;
  runner: GuiRunner;
  disabled: boolean;
}

type SlotState = 'ready' | 'signin' | 'missing';

const slotState = (s: AppSlot): SlotState => (!s.exists ? 'missing' : s.signedIn ? 'ready' : 'signin');

const STATE_LABEL: Record<SlotState, string> = {
  ready: 'Đã đăng nhập',
  signin: 'Chưa đăng nhập',
  missing: 'Chưa có bản sao',
};

const storeLabel = (apps: AppsStatus, id: string): string => {
  const store = apps.profiles[apps.env].stores.find((s) => s.id === id);
  return store?.name ? `Tiệm ${id} · ${store.name}` : `Tiệm ${id}`;
};

/**
 * Environment → how many apps → which store each app tests
 * (dashboard/server/apps.mjs). Each store owns its own copies, signed in
 * once with its QR, so switching a store here never signs anything out.
 */
export function AppsBar({ env, onEnv, runner, disabled }: Props): JSX.Element | null {
  const { apps } = runner;
  const [error, setError] = useState<string | null>(null);
  if (!apps || apps.env !== env) {
    return (
      <section className="appsbar">
        <EnvSeg env={env} onEnv={onEnv} disabled={disabled} />
        <span className="muted small">{runner.online ? 'Đang đọc danh sách app…' : 'Runner offline'}</span>
      </section>
    );
  }

  const profile = apps.profiles[apps.env];
  const cfg = apps.config[apps.env];
  // Every app on the installed app's store: copies only join a sweep of ≥ 20 spec (runner.mjs).
  const installedOnly =
    apps.slots[0]?.kind === 'installed' && apps.slots.every((s) => s.store === apps.slots[0]?.store);
  const ready = apps.slots.filter((s) => slotState(s) === 'ready').length;
  const needsCopy = apps.slots.some((s) => !s.exists);
  const wrongBuild = apps.slots.filter(
    (s) => s.kind === 'copy' && s.exists && s.buildEnv && s.buildEnv !== apps.env,
  );

  const act = async (p: Promise<string | null>): Promise<void> => {
    setError(null);
    const err = await p;
    if (err) setError(err);
  };

  const setStore = (slot: number, store: string): void => {
    const stores = [...cfg.stores];
    stores[slot - 1] = store;
    void act(runner.setApps({ stores }));
  };

  return (
    <section className={`appsbar env-${apps.env}`}>
      <EnvSeg env={env} onEnv={onEnv} disabled={disabled} />

      <div className="seg-group" title="Số app Volt POS chạy song song (mỗi app ≈ 1,3 GB RAM)">
        <span className="seg-label">Số app</span>
        <div className="seg" role="radiogroup" aria-label="Số app chạy song song">
          {[1, 2, 3].map((k) => (
            <button
              key={k}
              role="radio"
              aria-checked={cfg.count === k}
              className={cfg.count === k ? 'on' : ''}
              disabled={disabled || k > profile.max}
              onClick={() => void act(runner.setApps({ count: k }))}
              title={k > profile.max ? `Tối đa ${profile.max} app (GUI_LANES)` : `${k} app`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      <div className="app-cards">
        {apps.slots.map((s) => {
          const st = slotState(s);
          return (
            <div key={s.slot} className={`app-card ${st}`}>
              <div className="app-card-head">
                <b>App {s.slot}</b>
                <code
                  title={
                    s.kind === 'installed' ? 'App đã cài (%LOCALAPPDATA%\\Volt POS)' : `${apps.root}\\i${s.n}`
                  }
                >
                  {s.kind === 'installed' ? 'app đã cài' : `i${s.n}`}
                </code>
              </div>
              <select
                className="app-store"
                value={s.store}
                disabled={disabled}
                onChange={(e) => setStore(s.slot, e.target.value)}
                aria-label={`Tiệm của App ${s.slot}`}
              >
                {profile.stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {storeLabel(apps, store.id)}
                  </option>
                ))}
              </select>
              <div className="app-state">
                <i />
                {STATE_LABEL[st]}
                {st !== 'ready' && s.kind === 'copy' && (
                  <button
                    className="btn sm"
                    disabled={disabled || (st === 'missing' && !apps.source.matches)}
                    onClick={() => void act(runner.signInApp(s.n))}
                    title={
                      st === 'missing' && !apps.source.matches
                        ? `Bản nguồn không phải bản ${profile.label} — xem cảnh báo bên dưới`
                        : `Mở bản sao i${s.n} với màn QR. Quét bằng app GCI Business (tiệm ${s.store}), ` +
                          'đăng nhập xong thì đóng cửa sổ bản sao.'
                    }
                  >
                    {st === 'missing' ? 'Tạo & mở QR' : 'Mở QR'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <span className={`apps-sum ${ready === apps.slots.length ? 'ok' : 'warn'}`}>
        {ready}/{apps.slots.length} app sẵn sàng
        {installedOnly && apps.slots.length > 1 && (
          <span className="muted"> · song song khi chạy ≥ 20 spec</span>
        )}
      </span>

      {!apps.source.matches && (needsCopy || !installedOnly) && (
        <div className="apps-note warn">
          Bản sao {profile.label} được tạo từ <code>{apps.source.path}</code>, nhưng file này là bản{' '}
          <b>{apps.source.env ?? 'không tồn tại'}</b>
          {needsCopy ? ' — chưa tạo được bản sao mới' : ' — bản sao hiện có được giữ nguyên, không cập nhật'}.
          Cài bản {profile.label} rồi tạo lại, hoặc đặt{' '}
          <code>APP_SOURCE=&lt;volt-pos.exe bản {profile.label}&gt;</code> trong{' '}
          <code>configs/env/.env.{apps.env}</code>.
        </div>
      )}
      {wrongBuild.length > 0 && (
        <div className="apps-note bad">
          {wrongBuild.map((s) => `i${s.n}`).join(', ')} được tạo từ bản {wrongBuild[0]?.buildEnv}, không phải{' '}
          {profile.label}. Xoá thư mục bản sao rồi bấm “Tạo &amp; mở QR”.
        </div>
      )}
      {error && (
        <div className="apps-note bad">
          {error}{' '}
          <button className="btn sm" onClick={() => setError(null)}>
            ✕
          </button>
        </div>
      )}
    </section>
  );
}

function EnvSeg({
  env,
  onEnv,
  disabled,
}: {
  env: string;
  onEnv: (env: EnvName) => void;
  disabled: boolean;
}): JSX.Element {
  return (
    <div className="seg-group" title="Môi trường = bản build .exe (backend được biên dịch sẵn trong app)">
      <span className="seg-label">Môi trường</span>
      <div className="seg" role="radiogroup" aria-label="Môi trường">
        {ENV_ORDER.map((e) => (
          <button
            key={e}
            role="radio"
            aria-checked={env === e}
            className={`${env === e ? 'on' : ''} env-${e}`}
            disabled={disabled}
            onClick={() => onEnv(e)}
          >
            {ENV_LABEL[e]}
          </button>
        ))}
      </div>
    </div>
  );
}
