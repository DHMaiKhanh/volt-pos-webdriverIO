/**
 * Component barrel.
 *
 * Convenience for SPECS and page objects, which routinely need the passcode
 * guard, a confirmation and the toast reader in the same flow. Components
 * themselves keep importing `./BaseComponent.js` directly — going through the
 * barrel would make every component load every other one.
 *
 * ## Why singletons
 *
 * A component here owns a locator chain and nothing else: state lives in the app,
 * and every call re-resolves against the live DOM. One instance per worker is
 * therefore enough, and sharing it keeps specs free of `new` noise for objects
 * that have no identity.
 *
 * {@link NumericKeypad} is the exception and is exported as a class: it has to be
 * told WHICH keypad it drives (and, when two can be mounted at once, which
 * subtree to look in), so there is no single sensible instance to hand out.
 */

export { BaseComponent } from './BaseComponent.js';

/**
 * Header + sidebar chrome. Not a `BaseComponent` — it spans two subtrees that
 * are not nested (the sidebar is portalled); see the note in its own file.
 */
export { AppNav, appNav, hasHeaderNav } from './nav/AppNav.js';

export { KEYPAD_PREFIXES, NumericKeypad } from './keypad/NumericKeypad.js';
export type { KeypadPrefix } from './keypad/NumericKeypad.js';

export { ConfirmDialog, confirmDialog } from './modal/ConfirmDialog.js';
export type { ConfirmDialogOptions } from './modal/ConfirmDialog.js';

export { PasscodeDialog, passcodeDialog } from './modal/PasscodeDialog.js';
export type { PasscodeEntryOptions } from './modal/PasscodeDialog.js';

export { ToastMessage, toastMessage } from './toast/ToastMessage.js';

/**
 * The turn board.
 *
 * A component and not a page, because the app has no turn route: the dialog is
 * mounted app-wide in `_app.tsx` and reached only from the floating quick-view
 * on `/home`, `/order-pending` or `/order-history`.
 */
export { TurnBoardDialog, turnBoardDialog } from './modal/TurnBoardDialog.js';
export type { TurnRow, TurnSort } from './modal/TurnBoardDialog.js';
