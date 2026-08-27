import { browser } from '@wdio/globals';
import { Timeouts } from '../../configs/constants/timeouts.js';
import { pathOf } from '../constants/routes.js';
import { moduleLogger } from '../utils/logger.js';

const log = moduleLogger('navigate');

/**
 * Move between screens without reloading the app.
 *
 * ## Why `browser.url()` is the wrong tool here
 *
 * On the web a URL change costs a page load. In a packaged Tauri app it costs
 * the whole application: the document is served from the custom protocol
 * (`http://tauri.localhost`), so navigating to one re-runs `main.tsx` — the
 * splash screen, the SQLCipher opens, the migrations and the first sync
 * handshake. That is the `Timeouts.APP_BOOT` budget (90s, ~50s cold) paid again
 * for what should be an instant route change, and it also throws away
 * everything the session was holding: the language the spec just switched to,
 * an in-progress order, and the passcode grant's effect on the current screen.
 *
 * TanStack Router publishes itself on `window.__TSR_ROUTER__` whenever a
 * document exists (`@tanstack/router-core/dist/esm/router.js:994`, guarded only
 * by `typeof document !== "undefined"`), so it is present in dev and packaged
 * builds alike. Driving that is a real client-side navigation — the same one a
 * tap on the sidebar performs.
 *
 * ## When to use the sidebar instead
 *
 * Whenever the NAVIGATION is what is under test. This helper is for getting to
 * a screen so the spec can test something else; a spec asserting that the
 * sidebar highlights the active item must click the sidebar, or it proves
 * nothing.
 */
interface TsrRouter {
  navigate: (opts: {
    to: string;
    search?: Record<string, unknown>;
    replace?: boolean;
  }) => Promise<void> | void;
  state?: { location?: { pathname?: string } };
}

/**
 * Search params for a route that takes them.
 *
 * The income reports are the reason this exists. Their date range lives in the
 * URL (`from`/`to` as unix SECONDS — `dateToUnix` is date-fns `getUnixTime`,
 * see `volt-pos/src/routes/_app/incomes/income-daily/-shared/income-daily.schema.ts`),
 * and driving the calendar popover instead is a bad trade: its DOM changes shape
 * month to month, so a spec that clicks through it breaks in November for
 * reasons that have nothing to do with the report. The route validates these
 * with zod either way, so a wrong value fails loudly rather than silently
 * showing the wrong day.
 */
export type SearchParams = Record<string, string | number | boolean | undefined>;

/** Is the client-side router reachable? False on the splash screen, before the app mounts. */
export async function routerReady(): Promise<boolean> {
  return (
    (await browser.execute(function () {
      const router = (window as unknown as Record<string, unknown>)['__TSR_ROUTER__'] as
        TsrRouter | undefined;
      return typeof router?.navigate === 'function';
    })) === true
  );
}

/**
 * Navigate client-side and wait for the router to land.
 *
 * Falls back to a hard `browser.url()` when the router is not published — the
 * app is still on the splash screen, or a spec called this before the first
 * screen mounted. The fallback logs at WARN because it is a real cost, not a
 * silent equivalent.
 */
export async function goTo(
  route: string,
  options: { search?: SearchParams; timeout?: number } = {},
): Promise<void> {
  const timeout = options.timeout ?? Timeouts.NAVIGATION;
  // `undefined` members are dropped so a caller can pass an optional param
  // without it arriving as the literal string "undefined" and failing zod.
  const search = Object.fromEntries(
    Object.entries(options.search ?? {}).filter(([, value]) => value !== undefined),
  );

  if (!(await routerReady())) {
    log.warn(
      `__TSR_ROUTER__ not published; falling back to a full load for ${route}. ` +
        `This reboots the app (splash + DB open + sync) — expect it to take seconds, not ms.`,
    );
    const query = new URLSearchParams(
      Object.entries(search).map(([key, value]) => [key, String(value)]),
    ).toString();
    await browser.url(query ? `${route}?${query}` : route);
  } else {
    log.debug(`navigate → ${route}${Object.keys(search).length ? ` ${JSON.stringify(search)}` : ''}`);
    const failure = await browser.executeAsync(
      function (to: string, params: Record<string, unknown>, done: (value: string | null) => void) {
        const router = (window as unknown as Record<string, unknown>)['__TSR_ROUTER__'] as
          TsrRouter | undefined;
        if (!router) {
          done('the router disappeared between the readiness check and the call');
          return;
        }
        try {
          // `navigate` may return void (older cores) or a promise; `resolve`
          // normalises both without this having to know which.
          Promise.resolve(
            Object.keys(params).length > 0
              ? router.navigate({ to, search: params })
              : router.navigate({ to }),
          ).then(
            function () {
              done(null);
            },
            function (error: unknown) {
              done(String(error));
            },
          );
        } catch (error) {
          done(String(error));
        }
      },
      route,
      search,
    );

    if (typeof failure === 'string') {
      throw new Error(
        `Client-side navigation to "${route}" was rejected: ${failure}\n` +
          `A route with a zod \`validateSearch\` throws here when a param is the wrong type — ` +
          `the income reports take \`from\`/\`to\` as unix SECONDS, not milliseconds.`,
      );
    }
  }

  await browser.waitUntil(
    async () => {
      const current = pathOf(await browser.getUrl());
      return current === route || current.startsWith(`${route}/`);
    },
    {
      timeout,
      interval: 150,
      timeoutMsg:
        `Router never reached "${route}" (still on ${pathOf(await browser.getUrl())}). ` +
        `A gated route that rejects the passcode stays on its fallback path — check ` +
        `whether a passcode grant is active before blaming the navigation.`,
    },
  );
}

/** The path the router currently believes it is on. Cheaper than a driver round trip. */
export async function currentRoutePath(): Promise<string> {
  const fromRouter = await browser.execute(function () {
    const router = (window as unknown as Record<string, unknown>)['__TSR_ROUTER__'] as TsrRouter | undefined;
    return router?.state?.location?.pathname ?? null;
  });
  if (typeof fromRouter === 'string') return fromRouter;
  return pathOf(await browser.getUrl());
}
