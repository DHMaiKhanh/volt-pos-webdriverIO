import fs from 'node:fs';
import path from 'node:path';
import { browser } from '@wdio/globals';
import { Paths } from '../../configs/constants/paths.js';
import { emitLive, registry, titleKey, type EvidenceInfo } from '../../configs/reporters/liveRegistry.js';
import { moduleLogger } from '../utils/logger.js';

const log = moduleLogger('evidence');

/**
 * Failure evidence the GUI can SHOW: the final screenshot, a short replay of the
 * screens before it, and the last steps the test took.
 *
 * ## Why a frame replay and not a video
 *
 * The run machine has no ffmpeg, and a screen recorder would film whatever
 * window is on top, not the WebView. WebDriver's own screenshot is what the test
 * saw. Taking one is not free (one driver round trip, ~100–300 ms), so frames
 * are only taken AFTER an action (click / type / key) and at most one per
 * {@link FRAME_INTERVAL_MS}, kept in memory, and written to disk only when the
 * test fails. A passing test leaves nothing behind. `FAIL_REPLAY=0` turns the
 * frames off entirely (the final screenshot and steps stay).
 */

const FRAME_INTERVAL_MS = Number(process.env.FAIL_REPLAY_MS) || 2000;
const MAX_FRAMES = Number(process.env.FAIL_REPLAY_FRAMES) || 10;
const MAX_STEPS = 30;
const REPLAY_ON = process.env.FAIL_REPLAY !== '0';

/** Protocol commands that change what is on screen. */
const ACTION_COMMANDS = new Set([
  'elementClick',
  'elementSendKeys',
  'elementClear',
  'performActions',
  'navigateTo',
]);

interface Frame {
  at: number;
  label: string;
  png: string;
}

const frames: Frame[] = [];
const steps: { at: number; text: string }[] = [];
let lastFrameAt = 0;
let capturing = false;
const cost = { ms: 0, n: 0 };

/** A step or action, for the "last steps before the failure" list. */
export function noteStep(text: string): void {
  steps.push({ at: Date.now(), text });
  if (steps.length > MAX_STEPS) steps.shift();
}

/** Forget the previous test's frames and steps. */
export function resetEvidence(): void {
  frames.length = 0;
  steps.length = 0;
  lastFrameAt = 0;
}

/** `afterCommand` hook: maybe keep a frame of the screen the action produced. */
export async function afterActionCommand(commandName: string): Promise<void> {
  if (!REPLAY_ON || capturing || !ACTION_COMMANDS.has(commandName)) return;
  if (Date.now() - lastFrameAt < FRAME_INTERVAL_MS) return;
  capturing = true;
  const started = Date.now();
  try {
    const png = await browser.takeScreenshot();
    frames.push({ at: Date.now(), label: steps.at(-1)?.text ?? commandName, png });
    if (frames.length > MAX_FRAMES) frames.shift();
  } catch {
    // The window may be mid-navigation or closed — a missing frame is fine.
  } finally {
    cost.ms += Date.now() - started;
    cost.n += 1;
    lastFrameAt = Date.now();
    capturing = false;
  }
}

/** What the replay cost this worker so far — logged at the end of a spec file. */
export function replayCost(): string {
  return cost.n === 0
    ? 'no replay frames taken'
    : `${String(cost.n)} replay frames, ${String(Math.round(cost.ms / 1000))}s total (${String(Math.round(cost.ms / cost.n))} ms each)`;
}

const slug = (value: string): string =>
  value
    .replace(/[^\w\d]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .toLowerCase();

const specSlug = (file: string): string =>
  slug(path.relative(Paths.TESTS, file.replace(/^file:\/\/\/?/, '')).replace(/\.spec\.[tj]s$/i, ''));

export interface FailureFiles {
  shotPath?: string;
  domPath?: string;
  logPath?: string;
  url?: string;
}

/**
 * Write the evidence folder for one failure and tell the GUI where it is.
 * `fullTitle` is the reporter's key; for a hook it is the hook title.
 */
export function writeEvidence(
  test: { file?: string; title: string; fullTitle: string; hook?: boolean },
  files: FailureFiles,
): EvidenceInfo | undefined {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rel = `${specSlug(test.file ?? 'unknown')}__${slug(test.title)}__${stamp}`;
    const dir = path.join(Paths.EVIDENCE, rel);
    fs.mkdirSync(dir, { recursive: true });

    const copy = (from: string | undefined, name: string): string | undefined => {
      if (!from || !fs.existsSync(from)) return undefined;
      fs.copyFileSync(from, path.join(dir, name));
      return name;
    };

    const written = frames.map((f, i) => {
      const name = `frame-${String(i + 1).padStart(2, '0')}.png`;
      fs.writeFileSync(path.join(dir, name), Buffer.from(f.png, 'base64'));
      return { name, at: f.at, label: f.label };
    });

    const shot = copy(files.shotPath, 'final.png');
    const dom = copy(files.domPath, 'dom.html');
    const appLog = copy(files.logPath, 'app.log');
    const info: EvidenceInfo = {
      dir: rel,
      frames: written,
      steps: [...steps],
      failedAt: Date.now(),
      ...(shot ? { shot } : {}),
      ...(dom ? { dom } : {}),
      ...(appLog ? { log: appLog } : {}),
      ...(files.url ? { url: files.url } : {}),
    };
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(info, null, 2));
    registry().evidence.set(titleKey(test.fullTitle), info);
    emitLive({
      t: 'evidence',
      file: test.file ?? '',
      fullTitle: test.fullTitle,
      hook: !!test.hook,
      evidence: info,
    });
    log.info(`Evidence: ${dir}`);
    return info;
  } catch (error) {
    log.warn(`Could not write failure evidence: ${(error as Error).message}`);
    return undefined;
  } finally {
    resetEvidence();
  }
}
