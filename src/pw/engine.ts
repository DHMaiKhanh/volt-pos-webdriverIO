/**
 * The in-page half of the Playwright-compatibility layer.
 *
 * `ENGINE_SRC` is plain JavaScript (kept as a string so no TypeScript/esbuild
 * helper can leak into the page) that installs `window.__pw` once per document.
 * The Node half (`locator.ts`) sends a serialised CHAIN of steps; the engine walks
 * it from `document` and returns the matching elements in document order.
 *
 * Semantics follow Playwright where the volt-qc suite depends on them:
 * - role queries skip elements hidden for ARIA (display:none / visibility:hidden /
 *   aria-hidden="true" on self or an ancestor) — Radix marks everything outside an
 *   open modal aria-hidden, which is what makes `main.getByRole('button')` ignore
 *   the screen behind a dialog;
 * - accessible names: aria-labelledby → aria-label → label/placeholder/title for
 *   form controls → content for name-from-content roles;
 * - string matching is case-insensitive substring unless `exact`, whitespace
 *   normalised; RegExp is tested against the normalised text;
 * - getByText returns the innermost elements whose text matches.
 */

export const ENGINE_SRC = String.raw`
(function () {
  if (window.__pw && window.__pw.v === 3) return;
  var norm = function (s) { return String(s == null ? '' : s).replace(/[\u00a0\s]+/g, ' ').trim(); };
  var mkMatcher = function (m, exact) {
    if (m == null) return function () { return true; };
    if (typeof m === 'object' && m.re != null) {
      var re = new RegExp(m.re, m.flags || '');
      return function (t) { re.lastIndex = 0; return re.test(norm(t)); };
    }
    var s = norm(m.s != null ? m.s : m);
    if (exact) return function (t) { return norm(t) === s; };
    var low = s.toLowerCase();
    return function (t) { return norm(t).toLowerCase().indexOf(low) !== -1; };
  };
  var style = function (el) { try { return getComputedStyle(el); } catch (e) { return null; } };
  var isVisible = function (el) {
    if (!el || !el.isConnected) return false;
    if (el.nodeType !== 1) return false;
    var st = style(el);
    if (!st) return false;
    if (st.visibility === 'hidden' || st.visibility === 'collapse') return false;
    if (st.display === 'contents') {
      for (var c = el.firstElementChild; c; c = c.nextElementSibling) if (isVisible(c)) return true;
      return false;
    }
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  var hiddenForAria = function (el) {
    var st = style(el);
    if (st && (st.visibility === 'hidden' || st.visibility === 'collapse')) return true;
    for (var e = el; e && e.nodeType === 1; e = e.parentElement) {
      if (e.getAttribute('aria-hidden') === 'true') return true;
      if (e.hasAttribute('inert')) return true;
      var s = style(e);
      if (s && s.display === 'none') return true;
      if (e.tagName === 'TEMPLATE' || e.tagName === 'SCRIPT' || e.tagName === 'STYLE' || e.tagName === 'NOSCRIPT') return true;
    }
    return false;
  };
  var implicitRole = function (el) {
    var tag = el.tagName.toLowerCase();
    var type = (el.getAttribute('type') || '').toLowerCase();
    switch (tag) {
      case 'a': case 'area': return el.hasAttribute('href') ? 'link' : null;
      case 'button': return 'button';
      case 'input':
        if (type === 'hidden') return null;
        if (['button', 'submit', 'reset', 'image'].indexOf(type) !== -1) return 'button';
        if (type === 'checkbox') return 'checkbox';
        if (type === 'radio') return 'radio';
        if (type === 'range') return 'slider';
        if (type === 'number') return 'spinbutton';
        if (type === 'search') return el.hasAttribute('list') ? 'combobox' : 'searchbox';
        if (type === 'password') return 'textbox';
        if (['', 'text', 'email', 'tel', 'url'].indexOf(type) !== -1) return el.hasAttribute('list') ? 'combobox' : 'textbox';
        return 'textbox';
      case 'textarea': return 'textbox';
      case 'select': return (el.multiple || el.size > 1) ? 'listbox' : 'combobox';
      case 'option': return 'option';
      case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': return 'heading';
      case 'img': return el.getAttribute('alt') === '' ? 'presentation' : 'img';
      case 'ul': case 'ol': case 'menu': return 'list';
      case 'li': return 'listitem';
      case 'nav': return 'navigation';
      case 'main': return 'main';
      case 'table': return 'table';
      case 'thead': case 'tbody': case 'tfoot': return 'rowgroup';
      case 'tr': return 'row';
      case 'td': return 'cell';
      case 'th': return el.getAttribute('scope') === 'row' ? 'rowheader' : 'columnheader';
      case 'dialog': return 'dialog';
      case 'form': return 'form';
      case 'header': return 'banner';
      case 'footer': return 'contentinfo';
      case 'aside': return 'complementary';
      case 'p': return 'paragraph';
      case 'hr': return 'separator';
      case 'progress': return 'progressbar';
      case 'output': return 'status';
      case 'fieldset': case 'details': return 'group';
      case 'summary': return 'button';
      case 'article': return 'article';
      case 'section': return (el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby')) ? 'region' : null;
      case 'label': return null;
    }
    return null;
  };
  var roleOf = function (el) {
    var r = (el.getAttribute('role') || '').trim().split(/\s+/)[0];
    return r || implicitRole(el);
  };
  var NAME_FROM_CONTENT = { button: 1, link: 1, heading: 1, tab: 1, option: 1, menuitem: 1, menuitemcheckbox: 1, menuitemradio: 1,
    checkbox: 1, radio: 1, switch: 1, cell: 1, gridcell: 1, columnheader: 1, rowheader: 1, row: 1, treeitem: 1, tooltip: 1, listitem: 1, term: 1 };
  var textOf = function (node, inLabel) {
    var out = '';
    for (var c = node.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3) { out += c.data; continue; }
      if (c.nodeType !== 1) continue;
      if (hiddenForAria(c)) continue;
      var tag = c.tagName.toLowerCase();
      if (c.getAttribute('aria-label')) { out += ' ' + c.getAttribute('aria-label') + ' '; continue; }
      if (tag === 'img') { out += ' ' + (c.getAttribute('alt') || '') + ' '; continue; }
      if (tag === 'input' || tag === 'textarea') { if (inLabel) out += ' ' + (c.value || '') + ' '; continue; }
      if (tag === 'select') continue;
      var st = style(c);
      var block = st && st.display && st.display !== 'inline' && st.display.indexOf('inline') !== 0;
      out += (block ? ' ' : '') + textOf(c, inLabel) + (block ? ' ' : '');
    }
    return out;
  };
  var labelsText = function (el) {
    var parts = [];
    if (el.id) {
      try { var ls = document.querySelectorAll('label[for="' + CSS.escape(el.id) + '"]'); for (var i = 0; i < ls.length; i++) parts.push(textOf(ls[i], false)); } catch (e) {}
    }
    var p = el.closest('label');
    if (p) parts.push(textOf(p, false));
    return norm(parts.join(' '));
  };
  var accName = function (el) {
    var lb = el.getAttribute('aria-labelledby');
    if (lb) {
      var txt = lb.split(/\s+/).map(function (id) { var r = document.getElementById(id); return r ? textOf(r, false) || r.textContent : ''; }).join(' ');
      if (norm(txt)) return norm(txt);
    }
    var al = el.getAttribute('aria-label');
    if (al && norm(al)) return norm(al);
    var tag = el.tagName.toLowerCase();
    var type = (el.getAttribute('type') || '').toLowerCase();
    if (tag === 'input' && ['button', 'submit', 'reset'].indexOf(type) !== -1) return norm(el.value || (type === 'submit' ? 'Submit' : type === 'reset' ? 'Reset' : ''));
    if (tag === 'input' && type === 'image') return norm(el.getAttribute('alt') || el.getAttribute('title') || '');
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      var l = labelsText(el);
      if (l) return l;
      return norm(el.getAttribute('title') || el.getAttribute('placeholder') || '');
    }
    if (tag === 'img') return norm(el.getAttribute('alt') || el.getAttribute('title') || '');
    var role = roleOf(el);
    if (role && NAME_FROM_CONTENT[role]) {
      var t = norm(textOf(el, true));
      if (t) return t;
    }
    if (tag === 'fieldset') { var lg = el.querySelector('legend'); if (lg) return norm(textOf(lg, false)); }
    if (tag === 'table') { var cp = el.querySelector('caption'); if (cp) return norm(textOf(cp, false)); }
    return norm(el.getAttribute('title') || '');
  };
  var isDisabled = function (el) {
    for (var e = el; e && e.nodeType === 1; e = e.parentElement) {
      if (e.getAttribute('aria-disabled') === 'true') return true;
      if (e === el && 'disabled' in e && e.disabled) return true;
      if (e !== el && e.tagName === 'FIELDSET' && e.disabled) return true;
    }
    return false;
  };
  var checkedState = function (el) {
    var a = el.getAttribute('aria-checked');
    if (a === 'true') return true;
    if (a === 'false') return false;
    if (a === 'mixed') return 'mixed';
    if ('checked' in el && (el.type === 'checkbox' || el.type === 'radio')) return !!el.checked;
    var ds = el.getAttribute('data-state');
    if (ds === 'checked' || ds === 'on') return true;
    if (ds === 'unchecked' || ds === 'off') return false;
    return undefined;
  };
  var elText = function (el) {
    var tag = el.tagName;
    if (tag === 'INPUT' && ['button', 'submit', 'reset'].indexOf((el.type || '').toLowerCase()) !== -1) return el.value;
    return el.textContent || '';
  };
  var SKIP_TEXT = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, HEAD: 1, TEMPLATE: 1, TITLE: 1, META: 1, LINK: 1 };
  var descendants = function (root) {
    var all = (root.nodeType === 9 ? root.documentElement : root).querySelectorAll('*');
    return Array.prototype.slice.call(all);
  };
  var byText = function (root, m, exact) {
    var match = mkMatcher(m, exact);
    var out = [];
    var walk = function (el) {
      if (SKIP_TEXT[el.tagName]) return false;
      var anyChild = false;
      for (var c = el.firstElementChild; c; c = c.nextElementSibling) if (walk(c)) anyChild = true;
      if (anyChild) return true;
      if (match(elText(el))) { out.push(el); return true; }
      return false;
    };
    var start = root.nodeType === 9 ? root.body : root;
    if (!start) return out;
    for (var c = start.firstElementChild; c; c = c.nextElementSibling) walk(c);
    return out;
  };
  var css = function (root, sel) {
    var vis = false;
    if (/:visible/.test(sel)) { vis = true; sel = sel.replace(/:visible/g, ''); }
    var list;
    if (/^xpath=/.test(sel) || /^\/\//.test(sel) || /^\.\.?\//.test(sel) || sel === '..') {
      var xp = sel.replace(/^xpath=/, '');
      var res = document.evaluate(xp, root.nodeType === 9 ? root : root, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      list = [];
      for (var i = 0; i < res.snapshotLength; i++) { var n = res.snapshotItem(i); if (n && n.nodeType === 1) list.push(n); }
    } else {
      list = Array.prototype.slice.call((root.nodeType === 9 ? root : root).querySelectorAll(sel));
    }
    return vis ? list.filter(isVisible) : list;
  };
  var byRole = function (root, st) {
    var nameMatch = st.name != null ? mkMatcher(st.name, st.exact) : null;
    return descendants(root).filter(function (el) {
      if (roleOf(el) !== st.role) return false;
      if (!st.includeHidden && hiddenForAria(el)) return false;
      if (st.checked != null && checkedState(el) !== st.checked) return false;
      if (st.pressed != null && (el.getAttribute('aria-pressed') === 'true') !== st.pressed) return false;
      if (st.selected != null && (el.getAttribute('aria-selected') === 'true' || !!el.selected) !== st.selected) return false;
      if (st.expanded != null && (el.getAttribute('aria-expanded') === 'true') !== st.expanded) return false;
      if (st.disabled != null && isDisabled(el) !== st.disabled) return false;
      if (st.level != null) {
        var lv = Number(el.getAttribute('aria-level') || (/^H[1-6]$/.test(el.tagName) ? el.tagName.slice(1) : NaN));
        if (lv !== st.level) return false;
      }
      if (nameMatch && !nameMatch(accName(el))) return false;
      return true;
    });
  };
  var byAttr = function (root, attr, m, exact) {
    var match = mkMatcher(m, exact);
    return descendants(root).filter(function (el) { return el.hasAttribute(attr) && match(el.getAttribute(attr)); });
  };
  var byLabel = function (root, m, exact) {
    var match = mkMatcher(m, exact);
    return descendants(root).filter(function (el) {
      var al = el.getAttribute('aria-label');
      if (al && match(al)) return true;
      var lb = el.getAttribute('aria-labelledby');
      if (lb) {
        var t = lb.split(/\s+/).map(function (id) { var r = document.getElementById(id); return r ? r.textContent : ''; }).join(' ');
        if (match(t)) return true;
      }
      var tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') {
        var l = labelsText(el);
        if (l && match(l)) return true;
      }
      return false;
    });
  };
  var docOrder = function (arr) {
    var seen = new Set(); var out = [];
    arr.forEach(function (e) { if (!seen.has(e)) { seen.add(e); out.push(e); } });
    out.sort(function (a, b) { if (a === b) return 0; var p = a.compareDocumentPosition(b); return (p & 4) ? -1 : (p & 2) ? 1 : 0; });
    return out;
  };
  var run = function (chain, roots) {
    var set = roots && roots.length ? roots : [document];
    for (var i = 0; i < chain.length; i++) {
      var st = chain[i];
      var next = [];
      if (st.k === 'nth') {
        var idx = st.i < 0 ? set.length + st.i : st.i;
        set = idx >= 0 && idx < set.length ? [set[idx]] : [];
        continue;
      }
      if (st.k === 'filter') {
        set = set.filter(function (el) {
          if (st.visible != null && isVisible(el) !== st.visible) return false;
          if (st.hasText != null && !mkMatcher(st.hasText, false)(elText(el))) return false;
          if (st.hasNotText != null && mkMatcher(st.hasNotText, false)(elText(el))) return false;
          if (st.has && run(st.has, [el]).length === 0) return false;
          if (st.hasNot && run(st.hasNot, [el]).length > 0) return false;
          return true;
        });
        continue;
      }
      if (st.k === 'or') { set = docOrder(set.concat(run(st.chain, null))); continue; }
      if (st.k === 'and') { var other = new Set(run(st.chain, null)); set = set.filter(function (e) { return other.has(e); }); continue; }
      for (var j = 0; j < set.length; j++) {
        var root = set[j];
        var found;
        switch (st.k) {
          case 'css': found = css(root, st.s); break;
          case 'role': found = byRole(root, st); break;
          case 'text': found = byText(root, st.m, st.exact); break;
          case 'placeholder': found = byAttr(root, 'placeholder', st.m, st.exact); break;
          case 'title': found = byAttr(root, 'title', st.m, st.exact); break;
          case 'alt': found = byAttr(root, 'alt', st.m, st.exact); break;
          case 'testid': found = descendants(root).filter(function (el) { return el.getAttribute('data-testid') === st.s; }); break;
          case 'label': found = byLabel(root, st.m, st.exact); break;
          default: throw new Error('pw engine: unknown step ' + st.k);
        }
        for (var q = 0; q < found.length; q++) next.push(found[q]);
      }
      set = set.length > 1 ? docOrder(next) : next;
    }
    return set.filter(function (e) { return e && e.nodeType === 1; });
  };
  var info = function (el) {
    var r = el.getBoundingClientRect();
    return {
      visible: isVisible(el),
      enabled: !isDisabled(el),
      editable: !isDisabled(el) && !el.readOnly,
      checked: checkedState(el),
      box: { x: r.x, y: r.y, width: r.width, height: r.height },
    };
  };
  window.__pw = {
    v: 3,
    run: run,
    info: info,
    isVisible: isVisible,
    accName: accName,
    roleOf: roleOf,
    norm: norm,
    innerText: function (el) { return el.innerText; },
  };
})();
`;
