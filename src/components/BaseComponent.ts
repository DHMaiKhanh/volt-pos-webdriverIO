import { Timeouts } from '../../configs/constants/timeouts.js';
import type { FindOptions } from '../support/UiObject.js';
import type { Locator } from '../helpers/selectors.js';
import { UiObject } from '../support/UiObject.js';

/**
 * A component owns a SUBTREE of the page — a dialog, a sidebar, a table.
 *
 * Every lookup is scoped under {@link root}. That is not tidiness: this UI
 * keeps closed Radix dialogs mounted and reuses the same testids across the
 * order list, the split-order sheet and the receipt preview. An unscoped `$()`
 * happily returns the copy inside the *hidden* dialog, and the resulting
 * failure ("element not interactable") points nowhere near the cause.
 */
export abstract class BaseComponent extends UiObject {
  /** Name used in logs and failure messages. */
  abstract readonly name: string;

  /** The subtree this component owns. */
  protected abstract readonly root: Locator;

  /** Resolve the component's root element. */
  protected async rootEl(timeout: number = Timeouts.MEDIUM): Promise<WebdriverIO.Element> {
    return this.find(this.root, { timeout, visible: true });
  }

  /** Scoped `find` — every subclass lookup should go through this. */
  protected async inside(loc: Locator, opts: FindOptions = {}): Promise<WebdriverIO.Element> {
    return this.find(loc, { ...opts, within: opts.within ?? (await this.rootEl(opts.timeout)) });
  }

  /** Scoped `findAll`. */
  protected async insideAll(loc: Locator, opts: FindOptions = {}): Promise<WebdriverIO.Element[]> {
    return this.findAll(loc, { ...opts, within: opts.within ?? (await this.rootEl(opts.timeout)) });
  }

  /** Is the component mounted AND visible? */
  async isOpen(timeout: number = Timeouts.SHORT): Promise<boolean> {
    return this.isVisible(this.root, timeout);
  }

  /** Block until the component is on screen. */
  async waitOpen(timeout: number = Timeouts.MEDIUM): Promise<this> {
    await this.find(this.root, { timeout, visible: true });
    this.log.debug(`${this.name} open`);
    return this;
  }

  /** Block until the component is gone — a dialog's exit animation included. */
  async waitClosed(timeout: number = Timeouts.MEDIUM): Promise<void> {
    await this.waitGone(this.root, timeout);
    this.log.debug(`${this.name} closed`);
  }
}
