/**
 * Helper barrel.
 *
 * Convenience for SPECS, which routinely need three or four of these at once.
 * Framework internals — page objects, components, services — keep importing the
 * individual modules directly: `src/support/services/AppLifecycleService.ts`
 * pulling in the barrel would drag `window.ts` and `wait.ts` into a file that
 * runs before a session exists, for no benefit.
 */
export * from './selectors.js';
export * from './steps.js';
export * from './updater.js';
export * from './wait.js';
export * from './window.js';
