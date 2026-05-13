import { createComponent, isServer, getRequestEvent, delegateEvents } from 'file:///home/andares/repos/andares/alice/src/chat/node_modules/solid-js/web/dist/server.js';
import { F as Ft } from '../nitro/nitro.mjs';
import { createEffect, Suspense, createSignal, onCleanup, children, createMemo, getOwner, sharedConfig, useContext, createRenderEffect, on, runWithOwner, createContext, untrack, Show, createRoot, startTransition, resetErrorBoundaries, batch, createComponent as createComponent$1 } from 'file:///home/andares/repos/andares/alice/src/chat/node_modules/solid-js/dist/server.js';
import 'file:///home/andares/repos/andares/alice/src/chat/node_modules/destr/dist/index.mjs';
import 'file:///home/andares/repos/andares/alice/src/chat/node_modules/nitropack/node_modules/h3/dist/index.mjs';
import 'file:///home/andares/repos/andares/alice/src/chat/node_modules/hookable/dist/index.mjs';
import 'file:///home/andares/repos/andares/alice/src/chat/node_modules/ofetch/dist/node.mjs';
import 'file:///home/andares/repos/andares/alice/src/chat/node_modules/node-mock-http/dist/index.mjs';
import 'file:///home/andares/repos/andares/alice/src/chat/node_modules/ufo/dist/index.mjs';
import 'file:///home/andares/repos/andares/alice/src/chat/node_modules/unstorage/dist/index.mjs';
import 'file:///home/andares/repos/andares/alice/src/chat/node_modules/unstorage/drivers/fs.mjs';
import 'file:///home/andares/repos/andares/alice/src/chat/node_modules/unstorage/drivers/fs-lite.mjs';
import 'file:///home/andares/repos/andares/alice/src/chat/node_modules/ohash/dist/index.mjs';
import 'file:///home/andares/repos/andares/alice/src/chat/node_modules/klona/dist/index.mjs';
import 'file:///home/andares/repos/andares/alice/src/chat/node_modules/defu/dist/defu.mjs';
import 'file:///home/andares/repos/andares/alice/src/chat/node_modules/scule/dist/index.mjs';
import 'node:async_hooks';
import 'file:///home/andares/repos/andares/alice/src/chat/node_modules/unctx/dist/index.mjs';
import 'file:///home/andares/repos/andares/alice/src/chat/node_modules/radix3/dist/index.mjs';
import 'file:///home/andares/repos/andares/alice/src/chat/node_modules/vinxi/lib/app-fetch.js';
import 'file:///home/andares/repos/andares/alice/src/chat/node_modules/vinxi/lib/app-manifest.js';
import 'node:fs';
import 'node:url';
import 'file:///home/andares/repos/andares/alice/src/chat/node_modules/pathe/dist/index.mjs';
import 'file:///home/andares/repos/andares/alice/src/chat/node_modules/cookie-es/dist/index.mjs';
import 'file:///home/andares/repos/andares/alice/src/chat/node_modules/solid-js/web/storage/dist/storage.js';
import 'file:///home/andares/repos/andares/alice/src/chat/node_modules/h3/dist/index.mjs';
import 'file:///home/andares/repos/andares/alice/src/chat/node_modules/seroval/dist/esm/production/index.mjs';
import 'file:///home/andares/repos/andares/alice/src/chat/node_modules/seroval-plugins/dist/esm/production/web.mjs';

function oe() {
  let e = /* @__PURE__ */ new Set();
  function t(n) {
    return e.add(n), () => e.delete(n);
  }
  let r = false;
  function o(n, a) {
    if (r) return !(r = false);
    const s = { to: n, options: a, defaultPrevented: false, preventDefault: () => s.defaultPrevented = true };
    for (const i of e) i.listener({ ...s, from: i.location, retry: (h) => {
      h && (r = true), i.navigate(n, { ...a, resolve: false });
    } });
    return !s.defaultPrevented;
  }
  return { subscribe: t, confirm: o };
}
let M;
function z() {
  (!window.history.state || window.history.state._depth == null) && window.history.replaceState({ ...window.history.state, _depth: window.history.length - 1 }, ""), M = window.history.state._depth;
}
isServer || z();
function ke(e) {
  return { ...e, _depth: window.history.state && window.history.state._depth };
}
function qe(e, t) {
  let r = false;
  return () => {
    const o = M;
    z();
    const n = o == null ? null : M - o;
    if (r) {
      r = false;
      return;
    }
    n && t(n) ? (r = true, window.history.go(-n)) : e();
  };
}
const Be = /^(?:[a-z0-9]+:)?\/\//i, _e = /^\/+|(\/)\/+$/g, ae = "http://sr";
function _(e, t = false) {
  const r = e.replace(_e, "$1");
  return r ? t || /^[?#]/.test(r) ? r : "/" + r : "";
}
function W(e, t, r) {
  if (Be.test(t)) return;
  const o = _(e), n = r && _(r);
  let a = "";
  return !n || t.startsWith("/") ? a = o : n.toLowerCase().indexOf(o.toLowerCase()) !== 0 ? a = o + n : a = n, (a || "/") + _(t, !a);
}
function je(e, t) {
  if (e == null) throw new Error(t);
  return e;
}
function Ie(e, t) {
  return _(e).replace(/\/*(\*.*)?$/g, "") + _(t);
}
function se(e) {
  const t = {};
  return e.searchParams.forEach((r, o) => {
    o in t ? Array.isArray(t[o]) ? t[o].push(r) : t[o] = [t[o], r] : t[o] = r;
  }), t;
}
function Te(e, t, r) {
  const [o, n] = e.split("/*", 2), a = o.split("/").filter(Boolean), s = a.length;
  return (i) => {
    const h = i.split("/").filter(Boolean), c = h.length - s;
    if (c < 0 || c > 0 && n === void 0 && !t) return null;
    const d = { path: s ? "" : "/", params: {} }, y = (m) => r === void 0 ? void 0 : r[m];
    for (let m = 0; m < s; m++) {
      const g = a[m], b = g[0] === ":", u = b ? h[m] : h[m].toLowerCase(), l = b ? g.slice(1) : g.toLowerCase();
      if (b && K(u, y(l))) d.params[l] = u;
      else if (b || !K(u, l)) return null;
      d.path += `/${u}`;
    }
    if (n) {
      const m = c ? h.slice(-c).join("/") : "";
      if (K(m, y(n))) d.params[n] = m;
      else return null;
    }
    return d;
  };
}
function K(e, t) {
  const r = (o) => o === e;
  return t === void 0 ? true : typeof t == "string" ? r(t) : typeof t == "function" ? t(e) : Array.isArray(t) ? t.some(r) : t instanceof RegExp ? t.test(e) : false;
}
function We(e) {
  const [t, r] = e.pattern.split("/*", 2), o = t.split("/").filter(Boolean);
  return o.reduce((n, a) => n + (a.startsWith(":") ? 2 : 3), o.length - (r === void 0 ? 0 : 1));
}
function ie(e) {
  const t = /* @__PURE__ */ new Map(), r = getOwner();
  return new Proxy({}, { get(o, n) {
    return t.has(n) || runWithOwner(r, () => t.set(n, createMemo(() => e()[n]))), t.get(n)();
  }, getOwnPropertyDescriptor() {
    return { enumerable: true, configurable: true };
  }, ownKeys() {
    return Reflect.ownKeys(e());
  }, has(o, n) {
    return n in e();
  } });
}
function ce(e) {
  let t = /(\/?\:[^\/]+)\?/.exec(e);
  if (!t) return [e];
  let r = e.slice(0, t.index), o = e.slice(t.index + t[0].length);
  const n = [r, r += t[1]];
  for (; t = /^(\/\:[^\/]+)\?/.exec(o); ) n.push(r += t[1]), o = o.slice(t[0].length);
  return ce(o).reduce((a, s) => [...a, ...n.map((i) => i + s)], []);
}
const De = 100, ue = createContext(), le = createContext(), he = () => je(useContext(ue), "<A> and 'use' router primitives can be only used inside a Route."), $e = () => he().navigatorFactory(), Ke = () => he().location;
function Me(e, t = "") {
  const { component: r, preload: o, load: n, children: a, info: s } = e, i = !a || Array.isArray(a) && !a.length, h = { key: e, component: r, preload: o || n, info: s };
  return fe(e.path).reduce((c, d) => {
    for (const y of ce(d)) {
      const m = Ie(t, y);
      let g = i ? m : m.split("/*", 1)[0];
      g = g.split("/").map((b) => b.startsWith(":") || b.startsWith("*") ? b : encodeURIComponent(b)).join("/"), c.push({ ...h, originalPath: d, pattern: g, matcher: Te(g, !i, e.matchFilters) });
    }
    return c;
  }, []);
}
function Ne(e, t = 0) {
  return { routes: e, score: We(e[e.length - 1]) * 1e4 - t, matcher(r) {
    const o = [];
    for (let n = e.length - 1; n >= 0; n--) {
      const a = e[n], s = a.matcher(r);
      if (!s) return null;
      o.unshift({ ...s, route: a });
    }
    return o;
  } };
}
function fe(e) {
  return Array.isArray(e) ? e : [e];
}
function de(e, t = "", r = [], o = []) {
  const n = fe(e);
  for (let a = 0, s = n.length; a < s; a++) {
    const i = n[a];
    if (i && typeof i == "object") {
      i.hasOwnProperty("path") || (i.path = "");
      const h = Me(i, t);
      for (const c of h) {
        r.push(c);
        const d = Array.isArray(i.children) && i.children.length === 0;
        if (i.children && !d) de(i.children, c.pattern, r, o);
        else {
          const y = Ne([...r], o.length);
          o.push(y);
        }
        r.pop();
      }
    }
  }
  return r.length ? o : o.sort((a, s) => s.score - a.score);
}
function j(e, t) {
  for (let r = 0, o = e.length; r < o; r++) {
    const n = e[r].matcher(t);
    if (n) return n;
  }
  return [];
}
function ze(e, t, r) {
  const o = new URL(ae), n = createMemo((d) => {
    const y = e();
    try {
      return new URL(y, o);
    } catch {
      return console.error(`Invalid path ${y}`), d;
    }
  }, o, { equals: (d, y) => d.href === y.href }), a = createMemo(() => n().pathname), s = createMemo(() => n().search, true), i = createMemo(() => n().hash), h = () => "", c = on(s, () => se(n()));
  return { get pathname() {
    return a();
  }, get search() {
    return s();
  }, get hash() {
    return i();
  }, get state() {
    return t();
  }, get key() {
    return h();
  }, query: r ? r(c) : ie(c) };
}
let x;
function He() {
  return x;
}
function Ve(e, t, r, o = {}) {
  const { signal: [n, a], utils: s = {} } = e, i = s.parsePath || ((f) => f), h = s.renderPath || ((f) => f), c = s.beforeLeave || oe(), d = W("", o.base || "");
  if (d === void 0) throw new Error(`${d} is not a valid base path`);
  d && !n().value && a({ value: d, replace: true, scroll: false });
  const [y, m] = createSignal(false);
  let g;
  const b = (f, p) => {
    p.value === u() && p.state === v() || (g === void 0 && m(true), x = f, g = p, startTransition(() => {
      g === p && (l(g.value), w(g.state), resetErrorBoundaries(), isServer || E[1]((R) => R.filter((C) => C.pending)));
    }).finally(() => {
      g === p && batch(() => {
        x = void 0, f === "navigate" && ye(g), m(false), g = void 0;
      });
    }));
  }, [u, l] = createSignal(n().value), [v, w] = createSignal(n().state), A = ze(u, v, s.queryWrapper), L = [], E = createSignal(isServer ? be() : []), q = createMemo(() => typeof o.transformUrl == "function" ? j(t(), o.transformUrl(A.pathname)) : j(t(), A.pathname)), H = () => {
    const f = q(), p = {};
    for (let R = 0; R < f.length; R++) Object.assign(p, f[R].params);
    return p;
  }, pe = s.paramsWrapper ? s.paramsWrapper(H, t) : ie(H), V = { pattern: d, path: () => d, outlet: () => null, resolvePath(f) {
    return W(d, f);
  } };
  return createRenderEffect(on(n, (f) => b("native", f), { defer: true })), { base: V, location: A, params: pe, isRouting: y, renderPath: h, parsePath: i, navigatorFactory: we, matches: q, beforeLeave: c, preloadRoute: ve, singleFlight: o.singleFlight === void 0 ? true : o.singleFlight, submissions: E };
  function ge(f, p, R) {
    untrack(() => {
      if (typeof p == "number") {
        p && (s.go ? s.go(p) : console.warn("Router integration does not support relative routing"));
        return;
      }
      const C = !p || p[0] === "?", { replace: I, resolve: O, scroll: T, state: U } = { replace: false, resolve: !C, scroll: true, ...R }, F = O ? f.resolvePath(p) : W(C && A.pathname || "", p);
      if (F === void 0) throw new Error(`Path '${p}' is not a routable path`);
      if (L.length >= De) throw new Error("Too many redirects");
      const G = u();
      if (F !== G || U !== v()) if (isServer) {
        const J = getRequestEvent();
        J && (J.response = { status: 302, headers: new Headers({ Location: F }) }), a({ value: F, replace: I, scroll: T, state: U });
      } else c.confirm(F, R) && (L.push({ value: G, replace: I, scroll: T, state: v() }), b("navigate", { value: F, state: U }));
    });
  }
  function we(f) {
    return f = f || useContext(le) || V, (p, R) => ge(f, p, R);
  }
  function ye(f) {
    const p = L[0];
    p && (a({ ...f, replace: p.replace, scroll: p.scroll }), L.length = 0);
  }
  function ve(f, p) {
    const R = j(t(), f.pathname), C = x;
    x = "preload";
    for (let I in R) {
      const { route: O, params: T } = R[I];
      O.component && O.component.preload && O.component.preload();
      const { preload: U } = O;
      p && U && runWithOwner(r(), () => U({ params: T, location: { pathname: f.pathname, search: f.search, hash: f.hash, query: se(f), state: null, key: "" }, intent: "preload" }));
    }
    x = C;
  }
  function be() {
    const f = getRequestEvent();
    return f && f.router && f.router.submission ? [f.router.submission] : [];
  }
}
function Ge(e, t, r, o) {
  const { base: n, location: a, params: s } = e, { pattern: i, component: h, preload: c } = o().route, d = createMemo(() => o().path);
  h && h.preload && h.preload();
  const y = c ? c({ params: s, location: a, intent: x || "initial" }) : void 0;
  return { parent: t, pattern: i, path: d, outlet: () => h ? createComponent$1(h, { params: s, location: a, data: y, get children() {
    return r();
  } }) : r(), resolvePath(g) {
    return W(n.path(), g, d());
  } };
}
const me = (e) => (t) => {
  const { base: r } = t, o = children(() => t.children), n = createMemo(() => de(o(), t.base || ""));
  let a;
  const s = Ve(e, n, () => a, { base: r, singleFlight: t.singleFlight, transformUrl: t.transformUrl });
  return e.create && e.create(s), createComponent(ue.Provider, { value: s, get children() {
    return createComponent(Je, { routerState: s, get root() {
      return t.root;
    }, get preload() {
      return t.rootPreload || t.rootLoad;
    }, get children() {
      return [(a = getOwner()) && null, createComponent(Xe, { routerState: s, get branches() {
        return n();
      } })];
    } });
  } });
};
function Je(e) {
  const t = e.routerState.location, r = e.routerState.params, o = createMemo(() => e.preload && untrack(() => {
    e.preload({ params: r, location: t, intent: He() || "initial" });
  }));
  return createComponent(Show, { get when() {
    return e.root;
  }, keyed: true, get fallback() {
    return e.children;
  }, children: (n) => createComponent(n, { params: r, location: t, get data() {
    return o();
  }, get children() {
    return e.children;
  } }) });
}
function Xe(e) {
  if (isServer) {
    const n = getRequestEvent();
    if (n && n.router && n.router.dataOnly) {
      Qe(n, e.routerState, e.branches);
      return;
    }
    n && ((n.router || (n.router = {})).matches || (n.router.matches = e.routerState.matches().map(({ route: a, path: s, params: i }) => ({ path: a.originalPath, pattern: a.pattern, match: s, params: i, info: a.info }))));
  }
  const t = [];
  let r;
  const o = createMemo(on(e.routerState.matches, (n, a, s) => {
    let i = a && n.length === a.length;
    const h = [];
    for (let c = 0, d = n.length; c < d; c++) {
      const y = a && a[c], m = n[c];
      s && y && m.route.key === y.route.key ? h[c] = s[c] : (i = false, t[c] && t[c](), createRoot((g) => {
        t[c] = g, h[c] = Ge(e.routerState, h[c - 1] || e.routerState.base, X(() => o()[c + 1]), () => {
          var _a;
          const b = e.routerState.matches();
          return (_a = b[c]) != null ? _a : b[0];
        });
      }));
    }
    return t.splice(n.length).forEach((c) => c()), s && i ? s : (r = h[0], h);
  }));
  return X(() => o() && r)();
}
const X = (e) => () => createComponent(Show, { get when() {
  return e();
}, keyed: true, children: (t) => createComponent(le.Provider, { value: t, get children() {
  return t.outlet();
} }) });
function Qe(e, t, r) {
  const o = new URL(e.request.url), n = j(r, new URL(e.router.previousUrl || e.request.url).pathname), a = j(r, o.pathname);
  for (let s = 0; s < a.length; s++) {
    (!n[s] || a[s].route !== n[s].route) && (e.router.dataOnly = true);
    const { route: i, params: h } = a[s];
    i.preload && i.preload({ params: h, location: t.location, intent: "preload" });
  }
}
function Ye([e, t], r, o) {
  return [e, o ? (n) => t(o(n)) : t];
}
function Ze(e) {
  let t = false;
  const r = (n) => typeof n == "string" ? { value: n } : n, o = Ye(createSignal(r(e.get()), { equals: (n, a) => n.value === a.value && n.state === a.state }), void 0, (n) => (!t && e.set(n), sharedConfig.registry && !sharedConfig.done && (sharedConfig.done = true), n));
  return e.init && onCleanup(e.init((n = e.get()) => {
    t = true, o[1](r(n)), t = false;
  })), me({ signal: o, create: e.create, utils: e.utils });
}
function et(e, t, r) {
  return e.addEventListener(t, r), () => e.removeEventListener(t, r);
}
function tt(e, t) {
  const r = e && document.getElementById(e);
  r ? r.scrollIntoView() : t && window.scrollTo(0, 0);
}
function nt(e) {
  const t = new URL(e);
  return t.pathname + t.search;
}
function rt(e) {
  let t;
  const r = { value: e.url || (t = getRequestEvent()) && nt(t.request.url) || "" };
  return me({ signal: [() => r, (o) => Object.assign(r, o)] })(e);
}
const ot = /* @__PURE__ */ new Map();
function at({ preload: e = true, explicitLinks: t = false, actionBase: r = "/_server", transformUrl: o } = {}) {
  return (n) => {
    const a = n.base.path(), s = n.navigatorFactory(n.base);
    let i, h;
    function c(u) {
      return u.namespaceURI === "http://www.w3.org/2000/svg";
    }
    function d(u) {
      if (u.defaultPrevented || u.button !== 0 || u.metaKey || u.altKey || u.ctrlKey || u.shiftKey) return;
      const l = u.composedPath().find((q) => q instanceof Node && q.nodeName.toUpperCase() === "A");
      if (!l || t && !l.hasAttribute("link")) return;
      const v = c(l), w = v ? l.href.baseVal : l.href;
      if ((v ? l.target.baseVal : l.target) || !w && !l.hasAttribute("state")) return;
      const L = (l.getAttribute("rel") || "").split(/\s+/);
      if (l.hasAttribute("download") || L && L.includes("external")) return;
      const E = v ? new URL(w, document.baseURI) : new URL(w);
      if (!(E.origin !== window.location.origin || a && E.pathname && !E.pathname.toLowerCase().startsWith(a.toLowerCase()))) return [l, E];
    }
    function y(u) {
      const l = d(u);
      if (!l) return;
      const [v, w] = l, A = n.parsePath(w.pathname + w.search + w.hash), L = v.getAttribute("state");
      u.preventDefault(), s(A, { resolve: false, replace: v.hasAttribute("replace"), scroll: !v.hasAttribute("noscroll"), state: L ? JSON.parse(L) : void 0 });
    }
    function m(u) {
      const l = d(u);
      if (!l) return;
      const [v, w] = l;
      o && (w.pathname = o(w.pathname)), n.preloadRoute(w, v.getAttribute("preload") !== "false");
    }
    function g(u) {
      clearTimeout(i);
      const l = d(u);
      if (!l) return h = null;
      const [v, w] = l;
      h !== v && (o && (w.pathname = o(w.pathname)), i = setTimeout(() => {
        n.preloadRoute(w, v.getAttribute("preload") !== "false"), h = v;
      }, 20));
    }
    function b(u) {
      if (u.defaultPrevented) return;
      let l = u.submitter && u.submitter.hasAttribute("formaction") ? u.submitter.getAttribute("formaction") : u.target.getAttribute("action");
      if (!l) return;
      if (!l.startsWith("https://action/")) {
        const w = new URL(l, ae);
        if (l = n.parsePath(w.pathname + w.search), !l.startsWith(r)) return;
      }
      if (u.target.method.toUpperCase() !== "POST") throw new Error("Only POST forms are supported for Actions");
      const v = ot.get(l);
      if (v) {
        u.preventDefault();
        const w = new FormData(u.target, u.submitter);
        v.call({ r: n, f: u.target }, u.target.enctype === "multipart/form-data" ? w : new URLSearchParams(w));
      }
    }
    delegateEvents(["click", "submit"]), document.addEventListener("click", y), e && (document.addEventListener("mousemove", g, { passive: true }), document.addEventListener("focusin", m, { passive: true }), document.addEventListener("touchstart", m, { passive: true })), document.addEventListener("submit", b), onCleanup(() => {
      document.removeEventListener("click", y), e && (document.removeEventListener("mousemove", g), document.removeEventListener("focusin", m), document.removeEventListener("touchstart", m)), document.removeEventListener("submit", b);
    });
  };
}
function st(e) {
  if (isServer) return rt(e);
  const t = () => {
    const o = window.location.pathname.replace(/^\/+/, "/") + window.location.search, n = window.history.state && window.history.state._depth && Object.keys(window.history.state).length === 1 ? void 0 : window.history.state;
    return { value: o + window.location.hash, state: n };
  }, r = oe();
  return Ze({ get: t, set({ value: o, replace: n, scroll: a, state: s }) {
    n ? window.history.replaceState(ke(s), "", o) : window.history.pushState(s, "", o), tt(decodeURIComponent(window.location.hash.slice(1)), a), z();
  }, init: (o) => et(window, "popstate", qe(o, (n) => {
    if (n) return !r.confirm(n);
    {
      const a = t();
      return !r.confirm(a.value, { state: a.state });
    }
  })), create: at({ preload: e.preload, explicitLinks: e.explicitLinks, actionBase: e.actionBase, transformUrl: e.transformUrl }), utils: { go: (o) => window.history.go(o), beforeLeave: r } })(e);
}
function it(e) {
  const t = $e(), r = Ke(), o = () => r.pathname === "/login";
  return createEffect(() => {
    if (typeof document > "u" || o()) return;
    document.cookie.split(";").some((a) => a.trim().startsWith("auth_token=")) || t("/login");
  }), createComponent(Suspense, { get children() {
    return e.children;
  } });
}
function vt() {
  return createComponent(st, { root: (e) => createComponent(it, { get children() {
    return e.children;
  } }), base: "/chat", get children() {
    return createComponent(Ft, {});
  } });
}

export { vt as default };
//# sourceMappingURL=app-Bm689BGd.mjs.map
