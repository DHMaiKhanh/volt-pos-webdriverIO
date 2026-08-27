/**
 * Ambient capability declarations.
 *
 * WebdriverIO's `Capabilities` is a global interface, so the vendor namespaces
 * this suite actually sends can be merged into it here instead of being cast in
 * at every config. A cast hides a typo (`tauri:option`) — a declaration does
 * not.
 *
 * Kept as a script file (no imports, no exports) on purpose: adding either
 * turns it into a module and the merges below stop being global.
 */

declare namespace WebdriverIO {
  /**
   * tauri-driver's capability payload.
   *
   * Not part of the W3C set and not shipped by `@wdio/types` — tauri-driver is
   * a separate binary that reads this off the session request and launches the
   * application itself. `application` must be an absolute path to the built
   * `.exe`; there is no runtime switch that repoints a build at another
   * backend, so this value IS the environment under test.
   */
  interface TauriOptions {
    application: string;
    args?: string[];
  }

  interface Capabilities {
    'tauri:options'?: TauriOptions;
  }

  /**
   * The `ms:edgeOptions` fields the attach lane relies on.
   *
   * `ms:edgeOptions` is already declared on `Capabilities` by `@wdio/types` (as
   * `MicrosoftEdgeOptions extends ChromeOptions`), and re-declaring a property
   * with a narrower type on the same interface is an error — so this is a
   * standalone shape, not a merge. It documents the one field that makes the
   * lane work: with `debuggerAddress` set, msedgedriver ATTACHES to the WebView2
   * CDP endpoint of an app somebody already started, instead of launching a
   * browser of its own.
   */
  interface EdgeAttachOptions {
    /** `host:port` of the WebView2 CDP endpoint, e.g. `127.0.0.1:9222`. */
    debuggerAddress: string;
  }

  /** Capability set for the attach lane: an already-running WebView2 host, driven over CDP. */
  interface EdgeAttachCapabilities {
    browserName: 'MicrosoftEdge';
    'ms:edgeOptions': EdgeAttachOptions;
  }
}
