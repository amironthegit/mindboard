/* RTL Mindmap — افزونه‌ی Obsidian */
const { Plugin, PluginSettingTab, Setting, MarkdownRenderer, MarkdownRenderChild, Notice, Menu, setIcon } = require("obsidian");
const { Prec, RangeSetBuilder } = require("@codemirror/state");
const { keymap, ViewPlugin, Decoration } = require("@codemirror/view");

const SHAPES = { rounded: "مستطیل گوشه‌گرد", rect: "مستطیل", pill: "قرصی", circle: "دایره / بیضی", diamond: "لوزی", none: "بدون کادر" };
const LINES = { curve: "منحنی", straight: "مستقیم", elbow: "زانویی" };
const DIRS = { rtl: "راست به چپ", ltr: "چپ به راست", ttb: "بالا به پایین", btt: "پایین به بالا" };
const COLOR_MODES = {
  branch: "هر شاخه یک رنگ",
  level: "هر سطح یک رنگ",
  sibling: "به ترتیب هم‌سطح‌ها (اولی رنگ ۱، دومی رنگ ۲، ...)",
};
const BRACKETS = { curly: "آکولاد", square: "کروشه", line: "خط ساده" };
const ARROWS = {
  thin: "کشیده",
  equal: "دو خطی (⇐)",
  implies: "دو خطی پر (⟸)",
  bar: "با خط ابتدا (↤)",
  sleek: "تیز",
  dart: "تیر",
  bold: "ضخیم",
};
const ALIGNS = {
  center: "وسط‌چین",
  right: "راست‌چین",
  left: "چپ‌چین",
  justify: "تراز از دو طرف (جاستیفای)",
};
const DEFAULTS = {
  shape: "rounded", line: "curve", dir: "rtl", colorMode: "branch", bracket: "curly", arrow: "thin",
  align: "center",
  rootMaxWidth: 16,
  nodeMaxWidth: 36,
  blockMaxWidth: 34,
  marker: "::", titleMarker: "##", groupMarker: "@@", bracketLeaders: true,
};
const PALETTE = 8;
const NS = "http://www.w3.org/2000/svg";
// فقط اگر متن نشانه‌ی مارک‌داون داشت رندر کامل می‌شود؛ وگرنه متن ساده (سریع‌تر)
const SPECIAL = /[\[\]*_`$~|^\\<>#]|==/;

// فلش‌ها در viewBox ‎0 0 30 12‎ و رو به چپ کشیده شده‌اند (در حالت LTR با CSS برعکس می‌شوند)
// [مسیر، گزینه‌ها]  f: پر شده | w: ضخامت خط
const ARROW_DEFS = {
  thin: [["M28 6H4"], ["M8.5 2L4 6l4.5 4"]],
  equal: [["M27 4.4H9"], ["M27 7.6H9"], ["M10.5 1.4L4 6l6.5 4.6"]],
  implies: [["M27 4.4H10"], ["M27 7.6H10"], ["M2.5 6L10.5 1.6V10.4Z", { f: 1 }]],
  bar: [["M27 6H4"], ["M8.5 2L4 6l4.5 4"], ["M28.5 2.6V9.4"]],
  sleek: [["M27 6H9"], ["M2.5 6L10.5 2.2L8.6 6L10.5 9.8Z", { f: 1 }]],
  dart: [["M28 6L10 4.4V2.2L2.5 6L10 9.8V7.6Z", { f: 1 }]],
  bold: [["M27 6H5", { w: 2.4 }], ["M10 1.8L4.5 6l5.5 4.2", { w: 2.4 }]],
};

function renderArrow(span, type) {
  span.dataset.type = type;
  while (span.firstChild) span.removeChild(span.firstChild);
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 30 12");
  for (const [d, o] of ARROW_DEFS[type] || ARROW_DEFS.thin) {
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", d);
    if (o && o.f) p.setAttribute("class", "fill");
    if (o && o.w) p.setAttribute("stroke-width", o.w);
    svg.appendChild(p);
  }
  span.appendChild(svg);
}

function makeArrow(type) {
  const span = document.createElement("span");
  span.className = "mm-arrow";
  renderArrow(span, type);
  return span;
}

/* ---------- پارس مایندمپ ---------- */
// از یک خط: متن، عنوان (بین دو نشانه‌ی عنوان)، توضیح‌ها، و نشانه‌ی آکولاد گروهی (+ نتیجه) را جدا می‌کند
function tokenize(body, M) {
  const out = { text: "", title: "", notes: [], group: false, result: "" };
  const kinds = [["t", M.t], ["n", M.n], ["g", M.g]];
  let buf = "";
  let i = 0;
  while (i < body.length) {
    let kind = null, m = "";
    for (const [k, s] of kinds) if (s && body.startsWith(s, i)) { kind = k; m = s; break; }
    if (!kind) { buf += body[i]; i++; continue; }
    const start = i + m.length;
    const end = body.indexOf(m, start);
    let content;
    if (end < 0) { content = body.slice(start); i = body.length; }
    else { content = body.slice(start, end); i = end + m.length; }
    content = content.trim();
    if (kind === "t") { if (content) out.title = content; }
    else if (kind === "n") { if (content) out.notes.push(content); }
    else { out.group = true; if (content) out.result = content; }
  }
  out.text = buf.replace(/\s+/g, " ").trim();
  return out;
}

function parse(source, M) {
  const opts = {};
  const roots = [];
  const stack = [];
  let last = null;
  for (const raw of source.split("\n")) {
    if (!raw.trim()) continue;
    if (!roots.length) {
      const m = raw.match(/^\s*@(\w+)\s*[=:]\s*(\S+)\s*$/);
      if (m) { opts[m[1].toLowerCase()] = m[2].toLowerCase(); continue; }
    }
    const line = raw.replace(/\t/g, "    ");
    const indent = line.match(/^ */)[0].length;
    const tk = tokenize(line.trim(), M);

    // خطی که فقط عنوان/توضیح/نشانه‌ی گروه دارد -> به گره‌ی قبلی می‌چسبد
    if (!tk.text) {
      if (last) {
        if (tk.title) last.title = tk.title;
        last.notes.push(...tk.notes);
        if (tk.group) { last.group = true; if (tk.result) last.result = tk.result; }
      }
      continue;
    }
    const node = { text: tk.text, title: tk.title, notes: tk.notes, group: tk.group, result: tk.result, children: [] };
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    if (stack.length) stack[stack.length - 1].node.children.push(node);
    else roots.push(node);
    stack.push({ indent, node });
    last = node;
  }
  return { opts, roots };
}

/* ---------- پارس بلاک کروشه (درخت معکوس با تورفتگی) ----------
   خط با تورفتگی بیشتر، «نتیجه»ی همه‌ی خطوطِ منتظر با تورفتگی کمتر است.
   فقط ترتیبِ مقدار تورفتگی مهم است (بهتر است Tab باشد)؛ هم‌عرض شدن را ساختار درخت تعیین می‌کند. */
function indentWidth(raw) {
  return raw.match(/^[\t ]*/)[0].replace(/\t/g, "    ").length;
}

function parseBracket(source, M) {
  const opts = {};
  const groups = []; // هر عضو: ریشه‌ی یک درخت
  let pending = {};
  let seq = 0;
  let started = false;
  let last = null;
  const flush = () => {
    const all = [];
    for (const k of Object.keys(pending)) all.push(...pending[k]);
    all.sort((a, b) => a.seq - b.seq);
    if (all.length === 1) groups.push(all[0]);
    else if (all.length > 1) {
      const top = Math.max(...all.map((n) => n.level)) + 4;
      groups.push({ text: "", title: "", notes: [], placeholder: true, level: top, seq: seq++, children: all });
    }
    pending = {};
  };
  for (const raw of source.split("\n")) {
    if (!raw.trim()) { flush(); continue; }
    if (!started) {
      const m = raw.match(/^\s*@(\w+)\s*[=:]\s*(\S+)\s*$/);
      if (m) { opts[m[1].toLowerCase()] = m[2].toLowerCase(); continue; }
    }
    started = true;
    const level = indentWidth(raw);
    const tk = tokenize(raw.trim(), M);
    // خطی که فقط عنوان/توضیح دارد به خط قبلی می‌چسبد
    if (!tk.text) {
      if (last) { if (tk.title) last.title = tk.title; last.notes.push(...tk.notes); }
      continue;
    }
    const node = { text: tk.text, title: tk.title, notes: tk.notes, level, seq: seq++, children: [] };
    last = node;
    // نتیجه‌ی همه‌ی خطوط منتظرِ کم‌تورفتگی‌تر (به ترتیب ظاهر شدن) است
    const lower = Object.keys(pending).map(Number).filter((k) => k < level && pending[k].length);
    if (lower.length) {
      const kids = [];
      for (const k of lower) { kids.push(...pending[k]); pending[k] = []; }
      kids.sort((a, b) => a.seq - b.seq);
      node.children = kids;
    }
    (pending[level] = pending[level] || []).push(node);
  }
  flush();
  return { opts, groups };
}

function bracePath(w, h, style) {
  const x0 = 1, xm = w / 2, xt = w - 1, y = h / 2;
  if (style === "square") return `M${x0} 1H${xm}V${h - 1}H${x0}M${xm} ${y}H${xt}`;
  if (style === "line") return `M${xm} 1V${h - 1}M${xm} ${y}H${xt}`;
  const r = Math.max(0, Math.min(w / 2, (h - 2) / 4));
  return `M${x0} 1Q${xm} 1 ${xm} ${1 + r}L${xm} ${y - r}Q${xm} ${y} ${xt} ${y}` +
         `Q${xm} ${y} ${xm} ${y + r}L${xm} ${h - 1 - r}Q${xm} ${h - 1} ${x0} ${h - 1}`;
}

/* چیدمان درخت معکوس (مختصات منطقی: x از ابتدای خط، y از بالا).
   هر گره: { w, h, children }. ستون هر گره = ارتفاعش (برگ = ستون اول، راست‌چین با مقدمات)؛ هر ستون هم‌عرض می‌شود.
   فرزندان زیر هم می‌آیند؛ گره وسط بازه‌ی «جعبه‌ی فرزندان» می‌نشیند و آکولادش همان بازه را می‌گیرد. */
function layoutTree(root, gut, gapS, gapB) {
  const all = [];
  const col = new Map();
  // مقدمه‌ها (برگ‌ها) همیشه در ستون اول؛ هر نتیجه یک ستون بعد از بالاترین فرزندش
  const calc = (n) => {
    all.push(n);
    if (!n.children.length) { col.set(n, 0); return 0; }
    const m = Math.max(...n.children.map(calc));
    col.set(n, m + 1);
    return m + 1;
  };
  const D = calc(root);
  const colOf = (n) => col.get(n);
  const colW = Array(D + 1).fill(0);
  for (const n of all) { const c = colOf(n); colW[c] = Math.max(colW[c], n.w); }
  const x = [0];
  for (let i = 0; i <= D; i++) x[i + 1] = x[i] + colW[i] + gut;

  const shift = (n, dy) => {
    n.y += dy;
    if (n.span) n.span = [n.span[0] + dy, n.span[1] + dy];
    n.children.forEach((c) => shift(c, dy));
  };
  const place = (n) => {
    if (!n.children.length) { n.y = 0; return [0, n.h]; }
    let end = null, prevLeaf = false, lo = Infinity, hi = -Infinity;
    for (const c of n.children) {
      let e = place(c);
      const leaf = !c.children.length;
      const start = end === null ? 0 : end + (prevLeaf && leaf ? gapS : gapB);
      const dy = start - e[0];
      shift(c, dy);
      e = [e[0] + dy, e[1] + dy];
      end = e[1]; prevLeaf = leaf;
      lo = Math.min(lo, e[0]); hi = Math.max(hi, e[1]);
    }
    const y0 = Math.min(...n.children.map((c) => c.y));
    const y1 = Math.max(...n.children.map((c) => c.y + c.h));
    n.span = [y0, y1];
    n.y = (y0 + y1) / 2 - n.h / 2;
    return [Math.min(lo, n.y), Math.max(hi, n.y + n.h)];
  };
  place(root);
  const minY = Math.min(...all.map((n) => n.y));
  const maxY = Math.max(...all.map((n) => n.y + n.h));
  const braces = [], leaders = [];
  for (const n of all) {
    n.y -= minY;
    const c = colOf(n);
    n.x = x[c];
    n.fw = colW[c];
  }
  for (const n of all) {
    if (!n.children.length) continue;
    const cc = Math.max(...n.children.map(colOf));
    braces.push({ x: x[cc] + colW[cc], y0: n.span[0] - minY, y1: n.span[1] - minY });
    // فرزندی که در ستونی دورتر (مقدمات) نشسته با خط‌چین به آکولاد وصل می‌شود
    for (const k of n.children) {
      const ck = colOf(k);
      if (ck < cc) leaders.push({ x1: x[ck] + colW[ck], x2: x[cc] + colW[cc], y: k.y + k.h / 2 });
    }
  }
  return { braces, leaders, W: x[D] + colW[D], H: maxY - minY };
}

// گروه‌بندی آکولادهای مایندمپ: گره‌های دارای نشانه که در خروجی کنار هم‌اند (برگ‌های پشت‌سرهم)
function computeGroups(roots) {
  const groups = [];
  let idx = 0;
  const mark = (n) => {
    if (!n.children.length) { n.ext = [idx, idx]; idx++; }
    else { n.children.forEach(mark); n.ext = [n.children[0].ext[0], n.children[n.children.length - 1].ext[1]]; }
  };
  const maximal = (nodes, out) => {
    for (const n of nodes) { if (n.group) out.push(n); else maximal(n.children, out); }
    return out;
  };
  const process = (nodes) => {
    const mf = maximal(nodes, []);
    let cur = [];
    const close = () => {
      if (cur.length) groups.push({ members: cur, result: cur.map((m) => m.result).filter(Boolean).pop() || "" });
      cur = [];
    };
    for (const m of mf) {
      if (cur.length && m.ext[0] === cur[cur.length - 1].ext[1] + 1) cur.push(m);
      else { close(); cur = [m]; }
    }
    close();
    for (const m of mf) process(m.children);
  };
  for (const r of roots) { mark(r); process(r.children); }
  return groups;
}

// بدون تغییر اندازه‌ی طرح، آن را با عرض صفحه تطبیق می‌دهد (فقط کوچک می‌کند)
function fitWidth(scroll, inner) {
  inner.style.transform = "";
  scroll.style.height = "";
  const cs = getComputedStyle(scroll);
  const avail = scroll.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
  const nat = inner.offsetWidth;
  if (avail <= 0 || nat <= 0 || nat <= avail + 0.5) return 1;
  const s = avail / nat;
  inner.style.transform = `scale(${s})`;
  scroll.style.height = Math.ceil(inner.offsetHeight * s) + "px";
  return s;
}

/* ---------- ویرایشگر ---------- */
const FENCE_LANG = /^[\s>]*(?:`{3,}|~{3,})\s*(mindmap|bracket)\b/i;
const ANY_FENCE = /^[\s>]*(?:`{3,}|~{3,})/;

// اگر مکان‌نما داخل بلاک mindmap/bracket باشد، نام آن را برمی‌گرداند
function blockLang(state) {
  const doc = state.doc;
  const cur = doc.lineAt(state.selection.main.head);
  if (ANY_FENCE.test(cur.text)) return null;
  for (let n = cur.number - 1; n >= 1; n--) {
    const t = doc.line(n).text;
    if (ANY_FENCE.test(t)) {
      const m = FENCE_LANG.exec(t);
      return m ? m[1].toLowerCase() : null;
    }
  }
  return null;
}

function selectedLines(state) {
  const seen = new Set();
  const lines = [];
  for (const r of state.selection.ranges) {
    const a = state.doc.lineAt(r.from).number;
    const b = state.doc.lineAt(r.to).number;
    for (let n = a; n <= b; n++) if (!seen.has(n)) { seen.add(n); lines.push(state.doc.line(n)); }
  }
  return lines;
}

function changeIndent(view, dir) {
  const changes = [];
  for (const line of selectedLines(view.state)) {
    if (dir > 0) changes.push({ from: line.from, insert: "\t" });
    else {
      const m = /^(\t| {1,4})/.exec(line.text);
      if (m) changes.push({ from: line.from, to: line.from + m[0].length });
    }
  }
  if (changes.length) {
    const changeSet = view.state.changes(changes);
    // نگاشت مکان‌نما با جهت جلو (assoc=1) تا بعد از تب قرار گیرد و قبل از تب تایپ نشود
    const selection = view.state.selection.map(changeSet, 1);
    view.dispatch({ changes: changeSet, selection, userEvent: dir > 0 ? "input.indent" : "delete.dedent" });
  }
  return true;
}

function enterKeepIndent(view) {
  const { state } = view;
  const sel = state.selection.main;
  const line = state.doc.lineAt(sel.from);
  const indent = /^[\t ]*/.exec(line.text)[0].slice(0, sel.from - line.from);
  view.dispatch({
    changes: { from: sel.from, to: sel.to, insert: "\n" + indent },
    selection: { anchor: sel.from + 1 + indent.length },
    userEvent: "input",
  });
  return true;
}

// خطوط داخل بلاک‌های mindmap/bracket را راست‌چین می‌کند
function buildDecorations(view, plugin) {
  const b = new RangeSetBuilder();
  if (plugin.settings.dir === "ltr") return b.finish();
  const doc = view.state.doc;
  const deco = Decoration.line({ class: "mm-edit-line", attributes: { dir: "rtl" } });
  let open = null; // null | "mm" | "other"
  for (let n = 1; n <= doc.lines; n++) {
    const line = doc.line(n);
    if (ANY_FENCE.test(line.text)) {
      open = open === null ? (FENCE_LANG.test(line.text) ? "mm" : "other") : null;
      continue;
    }
    if (open === "mm") b.add(line.from, line.from, deco);
  }
  return b.finish();
}

/* ---------- رندر ---------- */
class MindmapChild extends MarkdownRenderChild {
  constructor(el, cleanup) { super(el); this.cleanup = cleanup; }
  onunload() { this.cleanup(); }
}

module.exports = class RtlMindmapPlugin extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULTS, await this.loadData());
    this.instances = new Set();
    const plugin = this;

    const rtlPlugin = ViewPlugin.fromClass(
      class {
        constructor(view) { this.decorations = buildDecorations(view, plugin); }
        update(u) { if (u.docChanged) this.decorations = buildDecorations(u.view, plugin); }
      },
      { decorations: (v) => v.decorations }
    );
    this.registerEditorExtension(rtlPlugin);
    this.registerEditorExtension(
      Prec.highest(keymap.of([
        { key: "Enter", run: (v) => (blockLang(v.state) ? enterKeepIndent(v) : false) },
        {
          key: "Tab",
          run: (v) => {
            const l = blockLang(v.state);
            return l ? changeIndent(v, 1) : false;
          },
        },
        {
          key: "Shift-Tab",
          run: (v) => {
            const l = blockLang(v.state);
            return l ? changeIndent(v, -1) : false;
          },
        },
      ]))
    );

    this.registerMarkdownCodeBlockProcessor("mindmap", (src, el, ctx) => this.render(src, el, ctx));
    this.registerMarkdownCodeBlockProcessor("bracket", (src, el, ctx) => this.renderBracket(src, el, ctx));

    const insert = (editor, lang) => {
      editor.focus();
      const sel = editor.getSelection();
      const cur = editor.getCursor("from");
      const prefix = editor.getLine(cur.line).trim() && !sel ? "\n" : "";
      editor.replaceSelection(prefix + "```" + lang + "\n" + sel + "\n```");
      if (!sel) editor.setCursor({ line: cur.line + (prefix ? 2 : 1), ch: 0 });
      editor.focus();
    };
    const withEditor = (lang) => () => {
      const ed = this.app.workspace.activeEditor?.editor;
      if (ed) insert(ed, lang);
    };
    this.addCommand({ id: "insert-mindmap", name: "درج بلاک مایندمپ (Insert mindmap)", editorCallback: (ed) => insert(ed, "mindmap") });
    this.addCommand({ id: "insert-bracket", name: "درج بلاک کروشه / نتیجه‌گیری (Insert bracket)", editorCallback: (ed) => insert(ed, "bracket") });
    this.addRibbonIcon("network", "درج مایندمپ", withEditor("mindmap"));
    this.addRibbonIcon("curly-braces", "درج کروشه / نتیجه‌گیری", withEditor("bracket"));

    this.addCommand({ id: "cycle-shape", name: "تغییر شکل گره‌ها (چرخشی)", callback: () => this.cycle("shape", SHAPES) });
    this.addCommand({ id: "cycle-line", name: "تغییر نوع خط‌ها (چرخشی)", callback: () => this.cycle("line", LINES) });
    this.addCommand({ id: "cycle-color", name: "تغییر حالت رنگ‌بندی (چرخشی)", callback: () => this.cycle("colorMode", COLOR_MODES) });
    this.addCommand({ id: "cycle-bracket", name: "تغییر نوع کروشه (چرخشی)", callback: () => this.cycle("bracket", BRACKETS) });
    this.addCommand({ id: "cycle-arrow", name: "تغییر نوع فلش عنوان (چرخشی)", callback: () => this.cycle("arrow", ARROWS) });
    this.addCommand({ id: "cycle-align", name: "تغییر تراز متن (چرخشی)", callback: () => this.cycle("align", ALIGNS) });
    this.addCommand({ id: "toggle-dir", name: "تغییر جهت (RTL / LTR)", callback: () => this.cycle("dir", DIRS) });

    this.addSettingTab(new MindmapSettingTab(this.app, this));
  }

  async cycle(key, map) {
    const keys = Object.keys(map);
    this.settings[key] = keys[(keys.indexOf(this.settings[key]) + 1) % keys.length];
    await this.saveData(this.settings);
    this.refreshAll();
    new Notice("مایندمپ: " + map[this.settings[key]]);
  }

  refreshAll() { this.instances.forEach((i) => i.refresh()); }

  markers() {
    return {
      n: this.settings.marker || "::",
      t: this.settings.titleMarker || "##",
      g: this.settings.groupMarker || "@@",
    };
  }

  // اولویت: گزینه‌ی داخل بلاک (@key=...) > متغیر CSS > تنظیمات افزونه
  resolveOpt(container, opts, optKey, cssVar, map, settingKey) {
    const o = opts[optKey];
    if (map[o]) return o;
    const c = getComputedStyle(container).getPropertyValue(cssVar).trim().replace(/["']/g, "").toLowerCase();
    if (map[c]) return c;
    return this.settings[settingKey];
  }

  // درج یا حذف تنظیمات اختصاصی در ابتدای کدبلاک با @ (پشتیبانی از چند گزینه همزمان)
  async updateBlockOptions(ctx, updates) {
    try {
      const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
      if (!file) return;
      const content = await this.app.vault.read(file);
      const sectionInfo = ctx.getSectionInfo ? ctx.getSectionInfo(ctx.el) : null;
      let startLine = 0, endLine = 0;
      const lines = content.split("\n");

      if (sectionInfo) {
        startLine = sectionInfo.lineStart;
        endLine = sectionInfo.lineEnd;
      } else {
        let inside = false;
        let s = -1, e = -1;
        for (let i = 0; i < lines.length; i++) {
          const l = lines[i];
          if (/^[\s>]*(?:`{3,}|~{3,})\s*(mindmap|bracket)\b/i.test(l)) {
            inside = true; s = i;
          } else if (inside && /^[\s>]*(?:`{3,}|~{3,})/.test(l)) {
            e = i; break;
          }
        }
        if (s !== -1 && e !== -1) { startLine = s; endLine = e; }
      }

      if (endLine <= startLine) return;

      const blockLines = lines.slice(startLine + 1, endLine);

      for (const [optKey, optValue] of Object.entries(updates)) {
        const optRegex = new RegExp(`^\\s*@${optKey}\\s*[=:]\\s*\\S+\\s*$`, "i");
        const existingIdx = blockLines.findIndex((l) => optRegex.test(l));

        if (optValue === null) {
          if (existingIdx !== -1) {
            blockLines.splice(existingIdx, 1);
          }
        } else {
          const newLine = `@${optKey}=${optValue}`;
          if (existingIdx !== -1) {
            blockLines[existingIdx] = newLine;
          } else {
            blockLines.unshift(newLine);
          }
        }
      }

      const newContent = [
        ...lines.slice(0, startLine + 1),
        ...blockLines,
        ...lines.slice(endLine)
      ].join("\n");

      await this.app.vault.modify(file, newContent);
    } catch (err) {
      console.error("خطا در به‌روزرسانی تنظیمات بلاک:", err);
    }
  }

  fillText(target, text, ctx, comp, done) {
    if (!SPECIAL.test(text)) { target.setText(text); return; }
    MarkdownRenderer.render(this.app, text, target, ctx.sourcePath, comp).then(() => {
      const ps = target.querySelectorAll(":scope > p");
      if (ps.length === 1) {
        while (ps[0].firstChild) target.insertBefore(ps[0].firstChild, ps[0]);
        ps[0].remove();
      }
      done();
    });
  }

  // نمایش پاپ‌آپ اسلایدر با قابلیت تنظیم زنده (Live) و بازنشانی به پیش‌فرض
  showMultiSliderPopup(anchorEl, title, items, onApply, onLiveChange) {
    document.querySelectorAll(".mm-slider-popover").forEach((p) => p.remove());

    const pop = document.createElement("div");
    pop.className = "mm-slider-popover";

    pop.createDiv({ cls: "mm-pop-title", text: title });

    const slidersData = [];

    for (const item of items) {
      const itemWrap = pop.createDiv({ cls: "mm-pop-item" });
      const itemHead = itemWrap.createDiv({ cls: "mm-pop-item-head" });
      itemHead.createSpan({ cls: "mm-pop-item-label", text: item.label });
      const valBadge = itemHead.createSpan({
        cls: "mm-pop-val",
        text: item.isCustom ? `${item.currentVal}em` : `پیش‌فرض (${item.defaultVal}em)`
      });

      const row = itemWrap.createDiv({ cls: "mm-pop-row" });
      const slider = row.createEl("input", {
        type: "range",
        cls: "mm-pop-slider",
        attr: {
          min: String(item.min),
          max: String(item.max),
          step: String(item.step),
          value: String(item.currentVal),
        },
      });

      const resetBtn = row.createEl("button", {
        cls: "mm-pop-btn mm-pop-btn-reset",
        text: "پیش‌فرض",
        attr: { type: "button", title: `بازنشانی به پیش‌فرض (${item.defaultVal}em)` },
      });

      let isCustom = item.isCustom;

      const updateState = (custom, val) => {
        isCustom = custom;
        if (custom) {
          slider.value = String(val);
          valBadge.setText(`${val}em`);
          valBadge.classList.remove("is-default");
        } else {
          slider.value = String(item.defaultVal);
          valBadge.setText(`پیش‌فرض (${item.defaultVal}em)`);
          valBadge.classList.add("is-default");
        }
        if (onLiveChange) {
          onLiveChange(item.key, custom ? val : null);
        }
      };

      if (!isCustom) {
        valBadge.classList.add("is-default");
      }

      slider.addEventListener("input", () => {
        updateState(true, parseFloat(slider.value));
      });

      resetBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        updateState(false, item.defaultVal);
      });

      slidersData.push({
        key: item.key,
        getVal: () => (isCustom ? parseFloat(slider.value) : null),
        initialVal: item.isCustom ? item.currentVal : null,
      });
    }

    const actions = pop.createDiv({ cls: "mm-pop-actions" });

    const btnCancel = actions.createEl("button", {
      cls: "mm-pop-btn",
      text: "لغو",
      attr: { type: "button" },
    });
    btnCancel.addEventListener("click", (e) => {
      e.stopPropagation();
      // بازگرداندن مقادیر لایو به حالت اولیه
      if (onLiveChange) {
        for (const sd of slidersData) {
          onLiveChange(sd.key, sd.initialVal);
        }
      }
      pop.remove();
    });

    const btnApply = actions.createEl("button", {
      cls: "mm-pop-btn mod-cta",
      text: "ذخیره در بلاک",
      attr: { type: "button" },
    });
    btnApply.addEventListener("click", (e) => {
      e.stopPropagation();
      const results = {};
      for (const sd of slidersData) {
        results[sd.key] = sd.getVal();
      }
      pop.remove();
      onApply(results);
    });

    const r = anchorEl.getBoundingClientRect();
    pop.style.top = `${r.bottom + 6}px`;
    pop.style.left = `${Math.max(10, r.left - 120)}px`;

    const closeHandler = (ev) => {
      if (!pop.contains(ev.target) && ev.target !== anchorEl && !anchorEl.contains(ev.target)) {
        if (onLiveChange) {
          for (const sd of slidersData) {
            onLiveChange(sd.key, sd.initialVal);
          }
        }
        pop.remove();
        document.removeEventListener("pointerdown", closeHandler);
      }
    };
    setTimeout(() => document.addEventListener("pointerdown", closeHandler), 10);

    document.body.appendChild(pop);
  }

  // دکمه‌های خروجی و روشن/خاموش کردن توضیحات (گوشه‌ی بالا-چپ نمودار) + تنظیمات اختصاصی بلاک
  addTools(container, getEl, ctx, onToggle, opts, scheduleRelayout, isBracket = false) {
    container.dataset.notes = "on";
    const bar = container.createDiv({ cls: "mm-tools" });
    const stop = (e) => e.stopPropagation();
    const mkBtn = (icon, label, onClick, cls = "") => {
      const b = bar.createEl("button", { cls: "mm-tool clickable-icon " + cls, attr: { "aria-label": label, type: "button" } });
      setIcon(b, icon);
      // کلیک روی دکمه نباید بلاک را وارد حالت ویرایش کند
      for (const ev of ["mousedown", "mouseup", "pointerdown", "pointerup", "touchstart"]) b.addEventListener(ev, stop);
      b.addEventListener("click", (e) => { e.stopPropagation(); e.preventDefault(); onClick(e, b); });
      return b;
    };
    mkBtn("download", "خروجی گرفتن (SVG / PNG / JPG)", (e) => {
      const menu = new Menu();
      for (const [fmt, title] of [["svg", "خروجی SVG"], ["png", "خروجی PNG"], ["jpg", "خروجی JPG"]]) {
        menu.addItem((it) => it.setTitle(title).setIcon("image").onClick(() => this.exportDiagram(getEl(), container, fmt, ctx.sourcePath)));
      }
      menu.showAtMouseEvent(e);
    });
    const nb = mkBtn("message-square", "نمایش / عدم نمایش توضیحات (::) در نمودار و خروجی", (e, b) => {
      const on = container.dataset.notes !== "on";
      container.dataset.notes = on ? "on" : "off";
      b.toggleClass("is-active", on);
      onToggle();
    });
    nb.addClass("is-active");

    // فاصله‌ی بصری بین دکمه‌های عمومی خروجی/توضیحات و تنظیمات اختصاصی بلاک
    const sep = bar.createDiv({ cls: "mm-tool-sep" });

    // منوی گزینه‌های اختصاصی همین بلاک — خواندن پویای وضعیت پیش‌فرض سراسری هنگام هر بار کلیک
    const addOptMenu = (icon, title, optKey, map, defKey, isFirst = false) => {
      const btn = mkBtn(icon, title, (e) => {
        const activeVal = opts[optKey];
        const hasCustom = activeVal !== undefined;
        // خواندن در لحظه‌ی تنظیمات پیش‌فرض سراسری
        const currentDefVal = this.settings[defKey] || DEFAULTS[defKey];
        const defLabel = `پیش‌فرض (${map[currentDefVal] || "پیش‌فرض"})`;

        const menu = new Menu();
        menu.addItem((it) =>
          it.setTitle(defLabel)
            .setChecked(!hasCustom)
            .onClick(() => this.updateBlockOptions(ctx, { [optKey]: null }))
        );
        menu.addSeparator();
        for (const [k, name] of Object.entries(map)) {
          menu.addItem((it) =>
            it.setTitle(name)
              .setChecked(hasCustom && activeVal === k)
              .onClick(() => this.updateBlockOptions(ctx, { [optKey]: k }))
          );
        }
        menu.showAtMouseEvent(e);
      }, (opts[optKey] !== undefined ? "is-custom " : "") + (isFirst ? "mm-opt-start " : ""));
      return btn;
    };

    // گزینه‌های مایندمپ و کروشه
    addOptMenu("shapes", "شکل گره‌ها در این بلاک", "shape", SHAPES, "shape", true);
    if (!isBracket) {
      addOptMenu("git-branch", "نوع خط‌ها در این بلاک", "line", LINES, "line");
      addOptMenu("palette", "رنگ‌بندی در این بلاک", "color", COLOR_MODES, "colorMode");
    }
    addOptMenu("arrow-left-right", "جهت نمودار در این بلاک", "dir", DIRS, "dir");
    addOptMenu("code-xml", "نوع آکولاد / کروشه در این بلاک", "bracket", BRACKETS, "bracket");
    addOptMenu("move-left", "نوع فلش عنوان در این بلاک", "arrow", ARROWS, "arrow");
    addOptMenu("align-center", "تراز متن در این بلاک", "align", ALIGNS, "align");

    // تنظیم زنده در استایل کانتینر حین حرکت اسلایدر (همگام‌سازی مستقیم با شیء opts تا در draw بازنویسی نشود)
    const applyLive = (key, val) => {
      if (val !== null && val !== undefined) {
        opts[key] = String(val);
      } else {
        delete opts[key];
      }
      this.applySizingStyles(container, opts);
      if (scheduleRelayout) scheduleRelayout();
    };

    // دکمه‌ی تجمیع‌شده‌ی تنظیم عرض با اسلایدرهای لایو
    if (!isBracket) {
      // یک دکمه واحد برای تنظیم عرض ریشه و سایر گره‌های مایندمپ
      const hasAnyWidth = opts.rootwidth !== undefined || opts.nodewidth !== undefined;
      mkBtn("maximize", "تنظیم حداکثر عرض گره‌ها در این بلاک", (e, b) => {
        // خواندن در لحظه هنگام کلیک
        const defRoot = this.settings.rootMaxWidth || DEFAULTS.rootMaxWidth;
        const defNode = this.settings.nodeMaxWidth || DEFAULTS.nodeMaxWidth;
        const curRoot = opts.rootwidth ? parseFloat(opts.rootwidth) : defRoot;
        const curNode = opts.nodewidth ? parseFloat(opts.nodewidth) : defNode;

        this.showMultiSliderPopup(
          b,
          "تنظیم حداکثر عرض گره‌های مایندمپ",
          [
            {
              key: "rootwidth",
              label: "عنوان اصلی (ریشه):",
              currentVal: curRoot,
              defaultVal: defRoot,
              min: 10, max: 60, step: 1,
              isCustom: opts.rootwidth !== undefined,
            },
            {
              key: "nodewidth",
              label: "سایر گره‌ها:",
              currentVal: curNode,
              defaultVal: defNode,
              min: 14, max: 80, step: 1,
              isCustom: opts.nodewidth !== undefined,
            },
          ],
          (results) => this.updateBlockOptions(ctx, results),
          applyLive
        );
      }, hasAnyWidth ? "is-custom" : "");
    } else {
      // یک دکمه برای تنظیم عرض خطوط کروشه
      const hasBlockWidth = opts.blockwidth !== undefined;
      mkBtn("stretch-horizontal", "تنظیم حداکثر عرض خطوط کروشه در این بلاک", (e, b) => {
        // خواندن در لحظه هنگام کلیک
        const defBlock = this.settings.blockMaxWidth || DEFAULTS.blockMaxWidth;
        const curBlock = opts.blockwidth ? parseFloat(opts.blockwidth) : defBlock;

        this.showMultiSliderPopup(
          b,
          "تنظیم حداکثر عرض خطوط کروشه",
          [
            {
              key: "blockwidth",
              label: "حداکثر عرض خطوط:",
              currentVal: curBlock,
              defaultVal: defBlock,
              min: 14, max: 80, step: 1,
              isCustom: opts.blockwidth !== undefined,
            },
          ],
          (results) => this.updateBlockOptions(ctx, results),
          applyLive
        );
      }, hasBlockWidth ? "is-custom" : "");
    }
  }

  // اعمال مقادیر حداکثر عرض و تراز بر استایل کانتینر
  applySizingStyles(container, opts) {
    const rootW = opts.rootwidth ? parseFloat(opts.rootwidth) : (this.settings.rootMaxWidth || DEFAULTS.rootMaxWidth);
    const nodeW = opts.nodewidth ? parseFloat(opts.nodewidth) : (this.settings.nodeMaxWidth || DEFAULTS.nodeMaxWidth);
    const blockW = opts.blockwidth ? parseFloat(opts.blockwidth) : (this.settings.blockMaxWidth || DEFAULTS.blockMaxWidth);
    container.style.setProperty("--mm-root-max-width", `${rootW}em`);
    container.style.setProperty("--mm-node-max-width", `${nodeW}em`);
    container.style.setProperty("--mm-block-max-width", `${blockW}em`);

    const alignVal = this.resolveOpt(container, opts, "align", "--mm-text-align", ALIGNS, "align");
    container.style.setProperty("--mm-text-align", alignVal);
  }

  // خروجی: نمودار را (با استایل‌های محاسبه‌شده) داخل یک SVG می‌گذارد و در صورت نیاز به PNG/JPG تبدیل می‌کند
  async exportDiagram(el, container, fmt, sourcePath) {
    try {
      const W = el.offsetWidth, H = el.offsetHeight;
      if (!W || !H) { new Notice("نمودار هنوز آماده نیست."); return; }
      const pad = 16;

      const inline = (src, dst) => {
        const cs = getComputedStyle(src);
        let css = "";
        for (let i = 0; i < cs.length; i++) {
          const n = cs[i];
          const v = cs.getPropertyValue(n);
          if (v) css += `${n}:${v};`;
        }
        dst.setAttribute("style", css);
        const sk = src.children, dk = dst.children;
        for (let i = 0; i < sk.length; i++) inline(sk[i], dk[i]);
      };
      const clone = el.cloneNode(true);
      inline(el, clone);
      clone.style.transform = "none";
      clone.style.margin = "0";
      clone.style.padding = getComputedStyle(el).padding;
      const xhtml = new XMLSerializer().serializeToString(clone);

      const probe = document.createElement("div");
      probe.style.backgroundColor = "var(--background-primary)";
      document.body.appendChild(probe);
      const bg = getComputedStyle(probe).backgroundColor;
      probe.remove();

      const TW = W + 2 * pad, TH = H + 2 * pad;
      const svgStr =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${TW}" height="${TH}" viewBox="0 0 ${TW} ${TH}">` +
        `<rect width="100%" height="100%" fill="${bg}"/>` +
        `<foreignObject x="${pad}" y="${pad}" width="${W}" height="${H}">${xhtml}</foreignObject></svg>`;

      let data, ext;
      if (fmt === "svg") {
        data = new TextEncoder().encode(svgStr).buffer;
        ext = "svg";
      } else {
        const img = new Image();
        await new Promise((res, rej) => {
          img.onload = res;
          img.onerror = () => rej(new Error("image load"));
          img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr);
        });
        const scale = Math.max(1, Math.min(2, 8000 / Math.max(TW, TH)));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(TW * scale);
        canvas.height = Math.round(TH * scale);
        const c2 = canvas.getContext("2d");
        c2.fillStyle = bg;
        c2.fillRect(0, 0, canvas.width, canvas.height);
        c2.drawImage(img, 0, 0, canvas.width, canvas.height);
        const mime = fmt === "jpg" ? "image/jpeg" : "image/png";
        const blob = await new Promise((res) => canvas.toBlob(res, mime, 0.95));
        if (!blob) throw new Error("toBlob");
        data = await blob.arrayBuffer();
        ext = fmt;
      }

      const d = new Date();
      const z = (n) => String(n).padStart(2, "0");
      const name = `mindmap-${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}.${ext}`;
      let path;
      try { path = await this.app.fileManager.getAvailablePathForAttachment(name, sourcePath); }
      catch (e) {
        const folder = (sourcePath || "").split("/").slice(0, -1).join("/");
        path = (folder ? folder + "/" : "") + name;
      }
      await this.app.vault.createBinary(path, data);
      new Notice("خروجی ذخیره شد: " + path);
    } catch (e) {
      console.error("RTL Mindmap export failed", e);
      new Notice("ساخت خروجی ناموفق بود" + (fmt !== "svg" ? "؛ خروجی SVG را امتحان کنید." : "."));
    }
  }

  render(source, el, ctx) {
    const { opts, roots } = parse(source, this.markers());
    const container = el.createDiv({ cls: "mm-container" });
    if (!roots.length) {
      container.createDiv({ cls: "mm-empty", text: "مایندمپ خالی است" });
      return;
    }
    const scroll = container.createDiv({ cls: "mm-scroll" });
    const tree = scroll.createDiv({ cls: "mm-tree" });
    const svg = document.createElementNS(NS, "svg");
    svg.classList.add("mm-lines");
    tree.appendChild(svg);
    const forest = tree.createDiv({ cls: "mm-forest" });
    this.addTools(container, () => tree, ctx, () => schedule(), opts, () => schedule(), false);

    const edges = [];
    const arrows = [];
    let groups = [];
    let raf = 0;

    const apply = () => {
      this.applySizingStyles(container, opts);
      container.dataset.shape = this.resolveOpt(container, opts, "shape", "--mm-shape", SHAPES, "shape");
      container.dataset.color = this.resolveOpt(container, opts, "color", "--mm-color-mode", COLOR_MODES, "colorMode");
      container.dataset.line = this.resolveOpt(container, opts, "line", "--mm-line-style", LINES, "line");
      container.dataset.bracket = this.resolveOpt(container, opts, "bracket", "--mm-bracket-style", BRACKETS, "bracket");
      const d = DIRS[opts.dir] ? opts.dir : this.settings.dir;
      container.dataset.orient = d === "ttb" || d === "btt" ? d : "h";
      container.setAttr("dir", d === "ltr" ? "ltr" : "rtl");
      const at = this.resolveOpt(container, opts, "arrow", "--mm-arrow-style", ARROWS, "arrow");
      for (const a of arrows) if (a.dataset.type !== at) renderArrow(a, at);
    };
    const inst = { refresh: () => { apply(); schedule(); } };

    // هندسه‌ی آکولادهای گروهی (مختصات محلی درخت، بدون scale)
    const measureGroups = (tr, k, fs, orient, rtl, style) => {
      const loc = (e) => {
        const r = e.getBoundingClientRect();
        return { l: (r.left - tr.left) / k, r: (r.right - tr.left) / k, t: (r.top - tr.top) / k, b: (r.bottom - tr.top) / k };
      };
      const un = (a, b) => (a ? { l: Math.min(a.l, b.l), r: Math.max(a.r, b.r), t: Math.min(a.t, b.t), b: Math.max(a.b, b.b) } : { ...b });
      const bw = fs * 1.1, gB = fs * 0.6, gR = fs * 0.5;
      const memo = new Map();
      const comp = (g) => {
        if (memo.has(g)) return memo.get(g);
        const mem = g.members.map((m) => {
          let r = loc(m.el);
          for (const h of groups) {
            const x = h.members[0].el;
            if (h !== g && x !== m.el && m.el.contains(x)) r = un(r, comp(h).overlay);
          }
          return r;
        });
        let ext = null;
        for (const r of mem) ext = un(ext, r);
        const w = g.resEl ? g.resEl.offsetWidth : 0;
        const h = g.resEl ? g.resEl.offsetHeight : 0;
        const o = { g, leads: [], res: null };
        let br; // مستطیل آکولاد
        if (orient === "h") {
          const len = ext.b - ext.t;
          o.d = bracePath(bw, len, style);
          if (rtl) {
            const bR = ext.l - gB;
            o.tf = `translate(${bR} ${ext.t}) scale(-1 1)`;
            br = { l: bR - bw, r: bR, t: ext.t, b: ext.b };
            o.res = { l: br.l - gR - w, t: (ext.t + ext.b) / 2 - h / 2, w, h };
            o.leads = mem.map((r) => ({ x1: r.l, y1: (r.t + r.b) / 2, x2: bR, y2: (r.t + r.b) / 2 }));
          } else {
            const bL = ext.r + gB;
            o.tf = `translate(${bL} ${ext.t})`;
            br = { l: bL, r: bL + bw, t: ext.t, b: ext.b };
            o.res = { l: br.r + gR, t: (ext.t + ext.b) / 2 - h / 2, w, h };
            o.leads = mem.map((r) => ({ x1: r.r, y1: (r.t + r.b) / 2, x2: bL, y2: (r.t + r.b) / 2 }));
          }
        } else {
          const len = ext.r - ext.l;
          o.d = bracePath(bw, len, style);
          if (orient === "ttb") {
            const bT = ext.b + gB;
            o.tf = `matrix(0 1 1 0 ${ext.l} ${bT})`;
            br = { l: ext.l, r: ext.r, t: bT, b: bT + bw };
            o.res = { l: (ext.l + ext.r) / 2 - w / 2, t: br.b + gR, w, h };
            o.leads = mem.map((r) => ({ x1: (r.l + r.r) / 2, y1: r.b, x2: (r.l + r.r) / 2, y2: bT }));
          } else {
            const bB = ext.t - gB;
            o.tf = `matrix(0 -1 1 0 ${ext.l} ${bB})`;
            br = { l: ext.l, r: ext.r, t: bB - bw, b: bB };
            o.res = { l: (ext.l + ext.r) / 2 - w / 2, t: br.t - gR - h, w, h };
            o.leads = mem.map((r) => ({ x1: (r.l + r.r) / 2, y1: r.t, x2: (r.l + r.r) / 2, y2: bB }));
          }
        }
        o.overlay = g.resEl ? un(br, { l: o.res.l, r: o.res.l + w, t: o.res.t, b: o.res.t + h }) : br;
        memo.set(g, o);
        return o;
      };
      return groups.map(comp);
    };

    const draw = () => {
      raf = 0;
      apply();
      const orient = container.dataset.orient;
      const rtl = container.getAttribute("dir") === "rtl";
      const style = container.dataset.bracket;
      const fs = parseFloat(getComputedStyle(container).fontSize) || 16;
      tree.style.padding = "";
      tree.style.transform = "";
      scroll.style.height = "";

      // جای کافی برای آکولاد و نتیجه (که بیرون از جریان صفحه‌اند)
      if (groups.length) {
        const tr0 = tree.getBoundingClientRect();
        if (!tr0.width) return;
        let pl = 0, pr = 0, pt = 0, pb = 0;
        for (const o of measureGroups(tr0, 1, fs, orient, rtl, style)) {
          pl = Math.max(pl, -o.overlay.l);
          pt = Math.max(pt, -o.overlay.t);
          pr = Math.max(pr, o.overlay.r - tr0.width);
          pb = Math.max(pb, o.overlay.b - tr0.height);
        }
        const c = (v) => Math.ceil(Math.max(0, v)) + "px";
        tree.style.padding = `${c(pt)} ${c(pr)} ${c(pb)} ${c(pl)}`;
      }

      const k = fitWidth(scroll, tree);
      const tr = tree.getBoundingClientRect();
      if (!tr.width) return;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      const mk = (cls, attrs) => {
        const p = document.createElementNS(NS, "path");
        p.setAttribute("class", cls);
        for (const a in attrs) p.setAttribute(a, attrs[a]);
        svg.appendChild(p);
      };

      const lineStyle = container.dataset.line;
      for (const e of edges) {
        let d;
        if (orient === "h") {
          const a = e.fromTail.getBoundingClientRect();
          const b = e.to.getBoundingClientRect();
          const ay = (a.top + a.height / 2 - tr.top) / k;
          const by = (b.top + b.height / 2 - tr.top) / k;
          let ax, bx;
          if (b.left + b.width / 2 < a.left + a.width / 2) { ax = (a.left - tr.left) / k; bx = (b.right - tr.left) / k; }
          else { ax = (a.right - tr.left) / k; bx = (b.left - tr.left) / k; }
          const mx = (ax + bx) / 2;
          if (lineStyle === "straight") d = `M${ax} ${ay} L${bx} ${by}`;
          else if (lineStyle === "elbow") d = `M${ax} ${ay} H${mx} V${by} H${bx}`;
          else d = `M${ax} ${ay} C${mx} ${ay} ${mx} ${by} ${bx} ${by}`;
        } else {
          const pbx = e.fromBox.getBoundingClientRect(), pw = e.fromWrap.getBoundingClientRect();
          const cbx = e.to.getBoundingClientRect(), cw = e.toWrap.getBoundingClientRect();
          const down = cw.top + cw.height / 2 > pw.top + pw.height / 2;
          const ax = (pbx.left + pbx.width / 2 - tr.left) / k;
          const bx = (cbx.left + cbx.width / 2 - tr.left) / k;
          const ay = ((down ? pw.bottom : pw.top) - tr.top) / k;
          const by = ((down ? cw.top : cw.bottom) - tr.top) / k;
          const my = (ay + by) / 2;
          if (lineStyle === "straight") d = `M${ax} ${ay} L${bx} ${by}`;
          else if (lineStyle === "elbow") d = `M${ax} ${ay} V${my} H${bx} V${by}`;
          else d = `M${ax} ${ay} C${ax} ${my} ${bx} ${my} ${bx} ${by}`;
        }
        mk(`mm-line mm-l${Math.min(e.level, 3)} ${e.cls}`, { d });
      }

      const showLeaders = opts.leader ? opts.leader !== "off" : this.settings.bracketLeaders;
      if (groups.length) {
        for (const o of measureGroups(tr, k, fs, orient, rtl, style)) {
          mk("mm-gpath", { d: o.d, transform: o.tf });
          for (const l of showLeaders ? o.leads : []) {
            if (Math.hypot(l.x2 - l.x1, l.y2 - l.y1) > fs * 0.8) mk("mm-leader", { d: `M${l.x1} ${l.y1} L${l.x2} ${l.y2}` });
          }
          if (o.g.resEl) {
            o.g.resEl.style.left = o.res.l + "px";
            o.g.resEl.style.top = o.res.t + "px";
            o.g.resEl.style.visibility = "visible";
          }
        }
      }
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(draw); };

    const ro = new ResizeObserver(schedule);
    const child = new MindmapChild(container, () => {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      this.instances.delete(inst);
    });
    ctx.addChild(child);
    const fill = (t, text) => this.fillText(t, text, ctx, child, schedule);

    // branchIdx: شاخه‌ی اصلی | sibIdx: ترتیب بین هم‌سطح‌ها | level: عمق
    const build = (node, parentEl, level, branchIdx, sibIdx, parent) => {
      const colorCls = level >= 1
        ? `mm-b${branchIdx % PALETTE} mm-d${(level - 1) % PALETTE} mm-s${sibIdx % PALETTE}`
        : "";
      const branch = parentEl.createDiv({ cls: `mm-branch mm-level-${level} ${colorCls}` });
      node.el = branch;
      const wrap = branch.createDiv({ cls: "mm-node-wrap" });
      const head = wrap.createDiv({ cls: "mm-head" });
      const box = head.createDiv({ cls: "mm-node" });
      fill(box, node.text);
      let tail = box;
      if (node.title) {
        const a = makeArrow(this.settings.arrow);
        arrows.push(a);
        head.appendChild(a);
        tail = head.createDiv({ cls: "mm-title" });
        fill(tail, node.title);
      }
      for (const n of node.notes) fill(wrap.createDiv({ cls: "mm-note" }), n);
      if (parent) edges.push({ fromTail: parent.tail, fromBox: parent.box, fromWrap: parent.wrap, to: box, toWrap: wrap, level, cls: colorCls });
      if (node.children.length) {
        const kids = branch.createDiv({ cls: "mm-children" });
        node.children.forEach((c, i) =>
          build(c, kids, level + 1, level === 0 ? i : branchIdx, i, { tail, box, wrap }));
      }
    };
    roots.forEach((r) => build(r, forest, 0, 0, 0, null));

    // آکولادهای گروهی: نتیجه‌ها عناصر مطلقِ داخل درخت‌اند و جای‌گذاری‌شان با draw است
    groups = computeGroups(roots);
    for (const g of groups) {
      if (!g.result) continue;
      g.resEl = tree.createDiv({ cls: "mm-node mm-result" });
      fill(g.resEl, g.result);
    }

    ro.observe(tree);
    ro.observe(scroll);
    this.instances.add(inst);
    inst.refresh();
  }

  renderBracket(source, el, ctx) {
    const { opts, groups } = parseBracket(source, this.markers());
    const container = el.createDiv({ cls: "mm-container mm-bracket-container" });
    if (!groups.length) {
      container.createDiv({ cls: "mm-empty", text: "بلاک خالی است" });
      return;
    }
    const scroll = container.createDiv({ cls: "mm-scroll" });
    const list = scroll.createDiv({ cls: "mm-groups" });
    const canv = [];
    const arrows = [];
    let raf = 0;

    const apply = () => {
      this.applySizingStyles(container, opts);
      container.dataset.shape = this.resolveOpt(container, opts, "shape", "--mm-shape", SHAPES, "shape");
      container.dataset.bracket = this.resolveOpt(container, opts, "bracket", "--mm-bracket-style", BRACKETS, "bracket");
      const d = DIRS[opts.dir] ? opts.dir : this.settings.dir;
      container.setAttr("dir", d === "ltr" ? "ltr" : "rtl");
      const at = this.resolveOpt(container, opts, "arrow", "--mm-arrow-style", ARROWS, "arrow");
      for (const a of arrows) if (a.dataset.type !== at) renderArrow(a, at);
    };
    const wOf = (e) => Math.ceil(e.getBoundingClientRect().width);
    const hOf = (e) => Math.ceil(e.getBoundingClientRect().height);

    const draw = () => {
      raf = 0;
      apply();
      list.style.transform = "";
      const fs = parseFloat(getComputedStyle(container).fontSize) || 16;
      const bw = Math.round(fs * 1.1), pad = Math.round(fs * 0.45);
      const gut = bw + 2 * pad;
      const gapS = Math.round(fs * 0.1), gapB = Math.round(fs * 0.9);
      const style = container.dataset.bracket;
      // خط‌چین راهنما: تنظیمات افزونه، یا @leader=off / @leader=on داخل بلاک
      const showLeaders = opts.leader ? opts.leader !== "off" : this.settings.bracketLeaders;
      for (const c of canv) {
        for (const n of c.nodes) n.el.style.width = "";
        for (const n of c.nodes) { n.w = wOf(n.el); n.h = hOf(n.el); }
        if (!c.root.w) return; // هنوز در صفحه چیده نشده؛ ResizeObserver دوباره صدا می‌زند
        const L = layoutTree(c.root, gut, gapS, gapB);
        for (const n of c.nodes) {
          n.el.style.insetInlineStart = n.x + "px";
          n.el.style.top = n.y + "px";
          n.el.style.width = n.fw + "px";
        }
        c.cv.style.width = L.W + "px";
        c.cv.style.height = L.H + "px";
        c.svg.setAttribute("width", L.W);
        c.svg.setAttribute("height", L.H);
        c.svg.setAttribute("viewBox", `0 0 ${L.W} ${L.H}`);
        while (c.svg.firstChild) c.svg.removeChild(c.svg.firstChild);
        for (const b of L.braces) {
          const p = document.createElementNS(NS, "path");
          p.setAttribute("class", "mm-bpath");
          p.setAttribute("d", bracePath(bw, b.y1 - b.y0, style));
          p.setAttribute("transform", `translate(${b.x + pad} ${b.y0})`);
          c.svg.appendChild(p);
        }
        for (const l of showLeaders ? L.leaders : []) {
          const x2 = l.x2 + pad;
          if (x2 - l.x1 < fs * 0.6) continue;
          const p = document.createElementNS(NS, "path");
          p.setAttribute("class", "mm-bleader");
          p.setAttribute("d", `M${l.x1} ${l.y} H${x2}`);
          c.svg.appendChild(p);
        }
      }
      fitWidth(scroll, list);
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(draw); };
    const inst = { refresh: () => { apply(); schedule(); } };
    const ro = new ResizeObserver(schedule);
    const child = new MindmapChild(container, () => {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      this.instances.delete(inst);
    });
    ctx.addChild(child);
    const fill = (t, text) => this.fillText(t, text, ctx, child, schedule);
    this.addTools(container, () => list, ctx, schedule, opts, () => schedule(), true);

    groups.forEach((root, gi) => {
      const cv = list.createDiv({ cls: `mm-bcanvas mm-b${gi % PALETTE}` });
      const svg = document.createElementNS(NS, "svg");
      svg.classList.add("mm-bsvg");
      cv.appendChild(svg);
      const nodes = [];
      const mkNode = (n, isRoot) => {
        const kind = isRoot ? "mm-conclusion mm-node" : n.children.length ? "mm-bmid" : "mm-bleaf";
        n.el = cv.createDiv({ cls: "mm-bitem " + kind });
        const head = n.el.createDiv({ cls: "mm-bhead" });
        const tx = head.createDiv({ cls: "mm-concl-line" });
        if (n.placeholder || !n.text) { tx.addClass("mm-concl-empty"); tx.setText("؟"); }
        else fill(tx, n.text);
        if (n.title) {
          const a = makeArrow(this.settings.arrow);
          arrows.push(a);
          head.appendChild(a);
          fill(head.createDiv({ cls: "mm-title" }), n.title);
        }
        for (const note of n.notes || []) fill(n.el.createDiv({ cls: "mm-note" }), note);
        ro.observe(n.el);
        nodes.push(n);
        n.children.forEach((c) => mkNode(c, false));
      };
      mkNode(root, true);
      canv.push({ cv, svg, root, nodes });
    });

    ro.observe(scroll);
    this.instances.add(inst);
    inst.refresh();
  }
};

class MindmapSettingTab extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    const p = this.plugin;
    const save = async () => { await p.saveData(p.settings); p.refreshAll(); };

    const dd = (name, desc, key, map, extra) => {
      const s = new Setting(containerEl).setName(name).setDesc(desc);
      const prev = extra ? extra.create(s) : null;
      s.addDropdown((d) => {
        Object.entries(map).forEach(([k, v]) => d.addOption(k, v));
        d.setValue(p.settings[key]).onChange(async (v) => {
          p.settings[key] = v;
          if (prev) extra.update(prev, v);
          await save();
        });
      });
    };

    dd("شکل گره‌ها", "در بلاک: @shape=pill | در CSS: --mm-shape: pill", "shape", SHAPES);
    dd("نوع خط‌ها", "در بلاک: @line=elbow | در CSS: --mm-line-style: elbow", "line", LINES);
    dd("رنگ‌بندی", "در بلاک: @color=level | در CSS: --mm-color-mode: level", "colorMode", COLOR_MODES);
    dd("نوع آکولاد / کروشه", "در بلاک: @bracket=square | در CSS: --mm-bracket-style: square", "bracket", BRACKETS);
    dd("نوع فلش عنوان", "در بلاک: @arrow=curve | در CSS: --mm-arrow-style: curve", "arrow", ARROWS, {
      create: (s) => {
        const sp = s.controlEl.createSpan({ cls: "mm-arrow" });
        sp.style.color = "var(--interactive-accent)";
        sp.style.marginInlineEnd = "0.7em";
        renderArrow(sp, p.settings.arrow);
        return sp;
      },
      update: (sp, v) => renderArrow(sp, v),
    });
    dd("تراز متن داخل گره‌ها", "در بلاک: @align=center | در CSS: --mm-text-align: center", "align", ALIGNS);

    new Setting(containerEl)
      .setName("حداکثر عرض عنوان اصلی (ریشه) مایندمپ")
      .setDesc("بر حسب em — در CSS: --mm-root-max-width")
      .addSlider((slider) =>
        slider
          .setLimits(10, 60, 1)
          .setValue(p.settings.rootMaxWidth || DEFAULTS.rootMaxWidth)
          .setDynamicTooltip()
          .onChange(async (val) => {
            p.settings.rootMaxWidth = val;
            await save();
          })
      );

    new Setting(containerEl)
      .setName("حداکثر عرض سایر گره‌های مایندمپ")
      .setDesc("بر حسب em — در CSS: --mm-node-max-width")
      .addSlider((slider) =>
        slider
          .setLimits(14, 80, 1)
          .setValue(p.settings.nodeMaxWidth || DEFAULTS.nodeMaxWidth)
          .setDynamicTooltip()
          .onChange(async (val) => {
            p.settings.nodeMaxWidth = val;
            await save();
          })
      );

    new Setting(containerEl)
      .setName("حداکثر عرض خطوط در بلاک کروشه")
      .setDesc("بر حسب em — در CSS: --mm-block-max-width")
      .addSlider((slider) =>
        slider
          .setLimits(14, 80, 1)
          .setValue(p.settings.blockMaxWidth || DEFAULTS.blockMaxWidth)
          .setDynamicTooltip()
          .onChange(async (val) => {
            p.settings.blockMaxWidth = val;
            await save();
          })
      );

    new Setting(containerEl)
      .setName("خط‌چین راهنما")
      .setDesc("اتصال آیتم‌ها به آکولاد با خط‌چین کمرنگ (در مایندمپ و کروشه). در بلاک: @leader=off")
      .addToggle((t) => t.setValue(p.settings.bracketLeaders).onChange(async (v) => { p.settings.bracketLeaders = v; await save(); }));
    dd("جهت کلی نمودار", "راست‌به‌چپ، چپ‌به‌راست، بالا‌به‌پایین یا پایین‌به‌بالا. در بلاک: @dir=ttb (در بلاک کروشه، بالا/پایین مثل راست‌به‌چپ است)", "dir", DIRS);

    const txt = (name, desc, key, def) =>
      new Setting(containerEl).setName(name).setDesc(desc).addText((t) =>
        t.setValue(p.settings[key]).onChange(async (v) => { p.settings[key] = v.trim() || def; await save(); }));
    txt("نشانه‌ی توضیح کمرنگ", "متن بین دو نشانه، کمرنگ زیر گره می‌آید.", "marker", "::");
    txt("نشانه‌ی عنوان", "متن بین دو نشانه، با فلش جلوی گره می‌آید.", "titleMarker", "##");
    txt("نشانه‌ی آکولاد گروهی", "آخر چند قسمی که در خروجی کنار هم‌اند (هم‌سطح یا غیرهم‌سطح) بگذارید؛ متن بعد از آن، نتیجه‌ی آکولاد است. بلاک‌های باز را یک‌بار ببندید و باز کنید.", "groupMarker", "@@");
    containerEl.createEl("p", {
      cls: "setting-item-description",
      text: "اگر در CSS یکی از متغیرهای بالا را تعیین کنید، بر تنظیم سراسری اولویت دارد (اما @... داخل بلاک از همه بالاتر است).",
    });
  }
}
