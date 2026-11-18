const py2ps = (() => {
  const INT = "INTEGER", REAL = "REAL", STR = "STRING", BOOL = "BOOLEAN";
  const isNum = (t) => t === INT || t === REAL;
  const isArr = (t) => t && t.arr;
  const merge = (a, b) => {
    if (!a) return b;
    if (!b) return a;
    if (a === "MIXED" || b === "MIXED") return "MIXED";
    if (isArr(a) || isArr(b))
      return isArr(a) && isArr(b) ? { arr: 1, base: merge(a.base, b.base), dims: a.dims || b.dims } : "MIXED";
    if (a === b) return a;
    return isNum(a) && isNum(b) ? REAL : "MIXED";
  };
  const ANN = { int: INT, float: REAL, str: STR, bool: BOOL };
  const BT = {
    len: INT, int: INT, float: REAL, str: STR, input: STR, ord: INT, chr: STR,
    "random.randint": INT, "random.random": REAL, "math.sqrt": REAL, "math.floor": INT,
    "math.ceil": INT, "math.sin": REAL, "math.cos": REAL, ".upper": STR, ".lower": STR, ".find": INT,
  };
  const num = (v) => ({ t: "num", v });
  const isNumLit = (e) => e.t === "num" || (e.t === "neg" && e.e.t === "num");
  const litVal = (e) => (e.t === "num" ? e.v : -e.e.v);
  const bin = (op, l, r) => ({ t: "bin", op, l, r });
  const adj = (e, d) => {
    if (!d) return e;
    if (isNumLit(e)) return num(litVal(e) + d);
    if (e.t === "bin" && (e.op === "+" || e.op === "-") && e.r.t === "num") {
      const k = (e.op === "+" ? e.r.v : -e.r.v) + d;
      return k === 0 ? e.l : k > 0 ? bin("+", e.l, num(k)) : bin("-", e.l, num(-k));
    }
    return d > 0 ? bin("+", e, num(d)) : bin("-", e, num(-d));
  };
  const kids = (e) => {
    switch (e.t) {
      case "bin": case "and": case "or": return [e.l, e.r];
      case "neg": case "not": return [e.e];
      case "cmp": return e.ex;
      case "call": return [e.f, ...e.args, ...Object.values(e.kw || {})];
      case "attr": return [e.o];
      case "sub": return [e.o, e.i];
      case "slice": return [e.o, e.a, e.b].filter(Boolean);
      case "list": case "tuple": return e.items;
      case "ifexp": return [e.c, e.a, e.b];
      case "fstr": return e.parts.filter((x) => x.e).map((x) => x.e);
    }
    return [];
  };
  const refs = (e, n) => (e.t === "name" && e.n === n) || kids(e).some((k) => refs(k, n));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const rootName = (t) => (t.t === "sub" ? rootName(t.o) : t.t === "name" ? t.n : null);

  function convert(src, opts = {}) {
    const exam = !!opts.exam;
    const { body: program, trail } = pyp.parse(src);
    const srcLines = src.replace(/\r\n?/g, "\n").split("\n");
    const warns = [], steps = [], usedTrail = {};
    let depth = 0, tips = [];
    const warn = (ln, m) => {
      const w = (ln ? "Line " + ln + ": " : "") + m;
      if (!warns.includes(w)) warns.push(w);
    };
    const tip = (m) => { if (!tips.includes(m)) tips.push(m); };
    const G = { types: new Map(), locals: null };
    const funcs = new Map();
    const pad = (n) => "   ".repeat(n);

    const assigned = (stmts, set, glob) =>
      stmts.forEach((n) => {
        const add = (t) => { if (t.t === "name") set.add(t.n); else if (t.t === "tuple") t.items.forEach(add); };
        if (n.k === "assign") n.targets.forEach(add);
        else if (n.k === "aug") add(n.target);
        else if (n.k === "for") { add(n.target); assigned(n.body, set, glob); }
        else if (n.k === "global") n.ns.forEach((x) => glob.add(x));
        else if (n.k === "if") { assigned(n.body, set, glob); assigned(n.orelse, set, glob); }
        else if (n.k === "while") assigned(n.body, set, glob);
      });
    program.forEach((n) => {
      if (n.k !== "def") return;
      const set = new Set(n.ps.map((p) => p.n)), glob = new Set();
      assigned(n.body, set, glob);
      glob.forEach((g) => set.delete(g));
      funcs.set(n.n, { node: n, ptypes: n.ps.map((p) => ANN[p.ann]), ret: n.ret ? ANN[n.ret] : undefined, sc: { types: new Map(), locals: set } });
    });
    const lookup = (sc, n) => (sc.locals && !sc.locals.has(n) ? G : sc).types.get(n);
    const setType = (sc, n, t) => {
      const s = sc.locals && !sc.locals.has(n) ? G : sc;
      s.types.set(n, merge(s.types.get(n), t));
    };
    const callName = (e) =>
      e.f.t === "name" ? e.f.n
        : e.f.t === "attr" && e.f.o.t === "name" && (e.f.o.n === "math" || e.f.o.n === "random") ? e.f.o.n + "." + e.f.n
        : e.f.t === "attr" ? "." + e.f.n : "";

    function typeOf(e, sc) {
      switch (e.t) {
        case "num": return e.f ? REAL : INT;
        case "str": case "fstr": return STR;
        case "bool": case "not": case "and": case "or": case "cmp": return BOOL;
        case "name": return lookup(sc, e.n);
        case "neg": return typeOf(e.e, sc);
        case "ifexp": return merge(typeOf(e.a, sc), typeOf(e.b, sc));
        case "list": {
          if (!e.items.length) return { arr: 1, base: undefined, dims: [num(0)] };
          const its = e.items.map((x) => typeOf(x, sc));
          if (isArr(its[0])) return { arr: 1, base: its.reduce((t, x) => merge(t, isArr(x) ? x.base : x), undefined), dims: [num(e.items.length), ...(its[0].dims || [])] };
          return { arr: 1, base: its.reduce((t, x) => merge(t, x), undefined), dims: [num(e.items.length)] };
        }
        case "bin": {
          if (e.op === "*" && (e.l.t === "list" || e.r.t === "list")) {
            const L = e.l.t === "list" ? e.l : e.r, n = L === e.l ? e.r : e.l, it = typeOf(L, sc);
            return { arr: 1, base: it.base, dims: [n, ...it.dims.slice(1)] };
          }
          const a = typeOf(e.l, sc), b = typeOf(e.r, sc);
          if (e.op === "/") return REAL;
          if (e.op === "+" && (a === STR || b === STR)) return STR;
          return isNum(a) && isNum(b) ? merge(a, b) : a || b;
        }
        case "call": {
          const n = callName(e);
          if (n === "abs") return typeOf(e.args[0], sc);
          if (n === "round") return e.args.length > 1 ? REAL : INT;
          if (n === "max" || n === "min" || n === "sum") {
            const ts = e.args.map((a) => typeOf(a, sc));
            return ts.length === 1 && isArr(ts[0]) ? ts[0].base : ts.reduce((t, x) => merge(t, x), undefined);
          }
          if (funcs.has(n)) return funcs.get(n).ret;
          return BT[n];
        }
        case "sub": {
          const o = typeOf(e.o, sc);
          if (isArr(o)) return o.dims && o.dims.length > 1 ? { arr: 1, base: o.base, dims: o.dims.slice(1) } : o.base;
          return o === STR ? STR : undefined;
        }
        case "slice": return STR;
        case "attr": return e.o.t === "name" && e.o.n === "math" && e.n === "pi" ? REAL : undefined;
      }
    }
    const scanCalls = (e, sc) => {
      if (e.t === "call" && funcs.has(callName(e))) {
        const f = funcs.get(callName(e));
        e.args.forEach((a, i) => {
          const t = typeOf(a, sc), p = f.node.ps[i];
          if (t && p && !ANN[p.ann]) f.ptypes[i] = merge(f.ptypes[i], t);
        });
      }
      kids(e).forEach((k) => scanCalls(k, sc));
    };
    const assignType = (t, v, sc) => {
      if (t.t === "name") setType(sc, t.n, typeOf(v, sc));
      else if (t.t === "tuple" && v.t === "tuple" && t.items.length === v.items.length)
        t.items.forEach((x, i) => assignType(x, v.items[i], sc));
      else if (t.t === "sub") {
        const r = rootName(t);
        if (r) setType(sc, r, { arr: 1, base: typeOf(v, sc) });
      }
    };
    const infer = (stmts, sc, fn) =>
      stmts.forEach((n) => {
        switch (n.k) {
          case "assign":
            if (n.value) { scanCalls(n.value, sc); n.targets.forEach((t) => assignType(t, n.value, sc)); }
            if (n.ann && ANN[n.ann] && n.targets[0].t === "name") setType(sc, n.targets[0].n, ANN[n.ann]);
            break;
          case "aug":
            scanCalls(n.value, sc);
            if (n.target.t === "name") setType(sc, n.target.n, typeOf(bin(n.op, n.target, n.value), sc));
            break;
          case "for": {
            scanCalls(n.iter, sc);
            let t;
            if (n.iter.t === "call" && callName(n.iter) === "range") t = INT;
            else {
              const it = typeOf(n.iter, sc);
              t = isArr(it) ? (it.dims && it.dims.length > 1 ? undefined : it.base) : it === STR ? STR : undefined;
            }
            if (n.target.t === "name") setType(sc, n.target.n, t);
            infer(n.body, sc, fn);
            break;
          }
          case "if": scanCalls(n.c, sc); infer(n.body, sc, fn); infer(n.orelse, sc, fn); break;
          case "while": scanCalls(n.c, sc); infer(n.body, sc, fn); break;
          case "expr": scanCalls(n.e, sc); break;
          case "return":
            if (n.e) { scanCalls(n.e, sc); if (fn) fn.ret = merge(fn.ret, typeOf(n.e, sc)); }
            break;
        }
      });
    for (let pass = 0; pass < 3; pass++) {
      infer(program, G, null);
      funcs.forEach((f) => {
        f.node.ps.forEach((p, i) => { if (f.ptypes[i]) f.sc.types.set(p.n, f.ptypes[i]); });
        infer(f.node.body, f.sc, f);
      });
    }
    const scalar = (t) => typeof t === "string" && t !== "MIXED";
    [G, ...[...funcs.values()].map((f) => f.sc)].forEach((sc) =>
      sc.types.forEach((t, n) => { if (t === "MIXED") warn(0, names.pascal(n) + " holds different kinds of value (for example numbers and text). Pseudocode needs one type per variable, so it was left undeclared."); }));

    const vn = (n) => names.pascal(n);
    const quote = (s) => {
      if (/[\r\n\t]/.test(s)) { tip("Pseudocode text has no \\n or \\t escapes: OUTPUT always starts a new line by itself."); s = s.replace(/[\r\n\t]+/g, " "); }
      if (!s.includes('"')) return '"' + s + '"';
      if (!s.includes("'")) return "'" + s + "'";
      return '"' + s.replace(/"/g, "'") + '"';
    };
    const numStr = (v) => (/e/i.test(String(v)) ? v.toFixed(20).replace(/\.?0+$/, "") : String(v));
    const wrap = (x, min) => (x.p >= min ? x.s : "(" + x.s + ")");
    const NOT_SUP = (ln, what) => { warn(ln, what + " has no pseudocode equivalent here."); return { s: 'NOTSUPPORTED("' + what.replace(/"/g, "'") + '")', p: 9 }; };
    let curLn = 0;

    const itemsOf = (e, sc) => {
      if (e.t === "str") return [{ lit: e.v }];
      if (e.t === "fstr") {
        tip("An f-string becomes separate OUTPUT items: the text parts stay in quotes and each {…} becomes the plain expression.");
        return e.parts.flatMap((pt) => (pt.s !== undefined ? [{ lit: pt.s }] : [{ ex: fpart(pt, sc) }]));
      }
      if (e.t === "bin" && e.op === "+" && typeOf(e, sc) === STR)
        return itemsOf(e.l, sc).concat(itemsOf(e.r, sc));
      if (e.t === "call" && e.f.t === "name" && e.f.n === "str" && e.args.length === 1) {
        tip("str(x) is not needed: OUTPUT and & turn numbers into text automatically.");
        return itemsOf(e.args[0], sc);
      }
      return [{ ex: X(e, sc) }];
    };
    const fpart = (pt, sc) => {
      const x = X(pt.e, sc), m = /^\.(\d+)f$/.exec(pt.spec);
      if (m) { tip("{x:.2f} becomes ROUND(x, 2). Note ROUND drops trailing zeros."); return { s: "ROUND(" + x.s + ", " + m[1] + ")", p: 9 }; }
      return x;
    };
    const mergeLits = (items) => {
      const out = [];
      items.forEach((i) => {
        const l = out[out.length - 1];
        if (i.lit !== undefined && l && l.lit !== undefined) l.lit += i.lit;
        else out.push({ ...i });
      });
      return out;
    };

    function X(e, sc) {
      switch (e.t) {
        case "num": return { s: numStr(e.v), p: e.v < 0 ? 8 : 9 };
        case "str": return { s: quote(e.v), p: 9 };
        case "bool": return { s: e.v ? "TRUE" : "FALSE", p: 9 };
        case "none": return NOT_SUP(curLn, "None");
        case "name": return { s: vn(e.n), p: 9 };
        case "neg": { const x = X(e.e, sc); return { s: "-" + wrap(x, 9), p: 8 }; }
        case "not": { tip("not becomes NOT."); return { s: "NOT " + wrap(X(e.e, sc), 9), p: 3 }; }
        case "and": case "or": {
          const o = e.t === "and" ? 2 : 1;
          tip(e.t + " becomes " + e.t.toUpperCase() + ".");
          return { s: wrap(X(e.l, sc), o) + " " + e.t.toUpperCase() + " " + wrap(X(e.r, sc), o + 1), p: o };
        }
        case "cmp": {
          const parts = e.ops.map((op, i) => {
            const a = e.ex[i], b = e.ex[i + 1];
            if (op === "in" || op === "not in") {
              if (typeOf(b, sc) !== STR) return NOT_SUP(curLn, "“in” on a list").s;
              tip("“x in text” becomes CONTAINS(text, x).");
              return (op === "in" ? "" : "NOT ") + "CONTAINS(" + X(b, sc).s + ", " + X(a, sc).s + ")";
            }
            const o = { "==": "=", "!=": "<>", is: "=", "is not": "<>" }[op] || op;
            if (op === "==") tip("== (is equal to) is written as a single = in pseudocode.");
            if (op === "!=") tip("!= (not equal) is written <> in pseudocode.");
            return wrap(X(a, sc), 5) + " " + o + " " + wrap(X(b, sc), 5);
          });
          if (parts.length > 1) tip("A chained comparison like a < b < c becomes two comparisons joined by AND.");
          return { s: parts.join(" AND "), p: parts.length > 1 ? 2 : 4 };
        }
        case "bin": {
          if (e.op === "+" && typeOf(e, sc) === STR) {
            tip("+ joins text in Python; pseudocode joins text with &.");
            const it = mergeLits(itemsOf(e, sc));
            return { s: it.map((i) => (i.lit !== undefined ? quote(i.lit) : wrap(i.ex, 6))).join(" & "), p: 5 };
          }
          if (e.op === "*" && (typeOf(e.l, sc) === STR || typeOf(e.r, sc) === STR || e.l.t === "list" || e.r.t === "list")) return NOT_SUP(curLn, "Repeating text or lists with *");
          const o = { "//": "DIV", "%": "MOD", "**": "^" }[e.op] || e.op;
          if (e.op === "//") tip("// (whole-number division) is DIV.");
          if (e.op === "%") tip("% (remainder) is MOD.");
          if (e.op === "**") tip("** (power) is ^.");
          const pr = o === "^" ? 7 : "+-".includes(o) ? 5 : 6;
          if (o === "^") return { s: wrap(X(e.l, sc), 8) + " ^ " + wrap(X(e.r, sc), 8), p: 7 };
          return { s: wrap(X(e.l, sc), pr) + " " + o + " " + wrap(X(e.r, sc), pr + 1), p: pr };
        }
        case "call": return callX(e, sc);
        case "attr":
          if (e.o.t === "name" && e.o.n === "math" && e.n === "pi") return { s: "PI()", p: 9 };
          return NOT_SUP(curLn, "." + e.n);
        case "sub": {
          const idx = [];
          let o = e;
          while (o.t === "sub") { idx.unshift(o.i); o = o.o; }
          const ot = typeOf(o, sc);
          if (o.t === "name" && isArr(ot)) {
            return { s: vn(o.n) + "[" + idx.map((i) => {
              if (i.t === "neg" && i.e.t === "num") { tip("Python’s negative index counts from the end; here that is SIZE(list) - n."); return "SIZE(" + vn(o.n) + ") - " + i.e.v; }
              return X(i, sc).s;
            }).join(", ") + "]", p: 9 };
          }
          if (idx.length === 1 && typeOf(o, sc) === STR) {
            const i = idx[0];
            tip("Text positions start at 1 in pseudocode (0 in Python), so MID(text, position, 1) gets one character.");
            if (i.t === "neg" && i.e.t === "num" && i.e.v === 1) return { s: "RIGHT(" + X(o, sc).s + ", 1)", p: 9 };
            return { s: "MID(" + X(o, sc).s + ", " + X(adj(i, 1), sc).s + ", 1)", p: 9 };
          }
          return NOT_SUP(curLn, "This indexing");
        }
        case "slice": {
          if (typeOf(e.o, sc) !== STR) return NOT_SUP(curLn, "Slicing a list");
          tip("A slice becomes LEFT or MID: positions start at 1 in pseudocode.");
          const s = X(e.o, sc).s;
          if (!e.a && e.b) return { s: "LEFT(" + s + ", " + X(e.b, sc).s + ")", p: 9 };
          const a = e.a || num(0);
          const len = e.b ? (isNumLit(a) && isNumLit(e.b) ? num(litVal(e.b) - litVal(a)) : bin("-", e.b, a)) : bin("-", { t: "call", f: { t: "name", n: "len" }, args: [e.o], kw: {} }, a);
          return { s: "MID(" + s + ", " + X(adj(a, 1), sc).s + ", " + X(len, sc).s + ")", p: 9 };
        }
        case "fstr": {
          const it = mergeLits(itemsOf(e, sc));
          if (!it.length) return { s: '""', p: 9 };
          const parts = it.map((i) => (i.lit !== undefined ? quote(i.lit) : wrap(i.ex, 6)));
          if (it.length === 1 && it[0].ex) parts.push('""');
          return { s: parts.join(" & "), p: 5 };
        }
        case "ifexp": return NOT_SUP(curLn, "A one-line if … else expression here (it works as a whole assignment)");
        case "list": case "tuple": return NOT_SUP(curLn, "A list written inside an expression");
      }
      return NOT_SUP(curLn, "This expression");
    }

    function callX(e, sc) {
      const n = callName(e), a = e.args, A = () => a.map((x) => X(x, sc).s).join(", ");
      const one = (nm) => ({ s: nm + "(" + A() + ")", p: 9 });
      const recv = e.f.t === "attr" ? e.f.o : null;
      if (funcs.has(n)) return { s: vn(n) + "(" + A() + ")", p: 9 };
      switch (n) {
        case "len": return { s: (isArr(typeOf(a[0], sc)) ? "SIZE(" : "LENGTH(") + A() + ")", p: 9 };
        case "int": tip("int(x) becomes INT(x), which drops the decimals."); return one("INT");
        case "float": tip("float(x) is not needed: a REAL variable already holds decimals."); return X(a[0], sc);
        case "str": return { s: wrap(X(a[0], sc), 6) + ' & ""', p: 5 };
        case "abs": return one("ABS");
        case "round": return one("ROUND");
        case "max": return one("MAX");
        case "min": return one("MIN");
        case "sum": return one("SUM");
        case "ord": return one("ASC");
        case "chr": return one("CHR");
        case "math.sqrt": return one("SQRT");
        case "math.floor": return one("FLOOR");
        case "math.ceil": return one("CEIL");
        case "math.sin": return one("SIN");
        case "math.cos": return one("COS");
        case "random.randint": return one("RANDOMINT");
        case "random.random": return { s: "RANDOM()", p: 9 };
        case ".upper": return { s: "UCASE(" + X(recv, sc).s + ")", p: 9 };
        case ".lower": return { s: "LCASE(" + X(recv, sc).s + ")", p: 9 };
        case ".find": return { s: "INDEXOF(" + X(recv, sc).s + ", " + A() + ") - 1", p: 5 };
        case "input": return NOT_SUP(curLn, "input() inside an expression (store it in a variable first)");
      }
      return NOT_SUP(curLn, (n || "This call") + "(…)");
    }

    const emit = (src, lines, base) => {
      lines = lines.slice();
      const key = typeof src === "number" ? src : null;
      if (key && trail[key] && !usedTrail[key]) {
        usedTrail[key] = 1;
        if (lines.length) lines[0] += "  // " + trail[key];
        else lines = ["// " + trail[key]];
      }
      const note = (base || "") + (tips.length ? " " + tips.join(" ") : "");
      tips = [];
      const step = { src, out: lines.map((l) => (l ? pad(depth) + l : l)), note: note.trim() };
      steps.push(step);
      return step;
    };
    const nest = (k, fn) => { depth += k; try { fn(); } finally { depth -= k; } };
    const body = (stmts, sc, k) => nest(k, () => stmts.forEach((s) => stmt(s, sc)));
    const need = (sc, name, t) => setType(sc, name, t);

    function target(t, sc) {
      if (t.t === "name") return vn(t.n);
      if (t.t === "sub") {
        const idx = [];
        let o = t;
        while (o.t === "sub") { idx.unshift(o.i); o = o.o; }
        if (o.t === "name") return vn(o.n) + "[" + idx.map((i) => X(i, sc).s).join(", ") + "]";
      }
      warn(curLn, "This assignment target has no pseudocode equivalent.");
      return "NOTSUPPORTED";
    }
    const inputOf = (v) => {
      let c = v, conv = null;
      if (c.t === "call" && c.f.t === "name" && ["int", "float", "str"].includes(c.f.n) && c.args.length === 1) { conv = c.f.n; c = c.args[0]; }
      return c.t === "call" && c.f.t === "name" && c.f.n === "input" ? { prompt: c.args[0] || null, conv } : null;
    };

    function arrayLines(name, v, ty, sc) {
      const dims = ty.dims || [num(1)];
      let base = ty.base;
      if (!base) { base = INT; warn(curLn, "The type of the items in " + name + " could not be worked out, so INTEGER was used."); }
      const nm = vn(name);
      const decl = "DECLARE " + nm + " : ARRAY[" + dims.map((d) => "0:" + X(adj(d, -1), sc).s).join(",") + "] OF " + base;
      if (dims.length > 2) { warn(curLn, "Lists nested more than two deep are not supported."); return [decl]; }
      if (!dims[0] || (dims[0].t === "num" && dims[0].v === 0)) { warn(curLn, "An empty list has no fixed size. Declare the array with the size you need."); return ["// " + srcLines[curLn - 1].trim()]; }
      const out = [decl];
      if (v.t === "list") {
        v.items.forEach((it, i) => {
          if (it.t === "list") it.items.forEach((x, j) => out.push(nm + "[" + i + ", " + j + "] ← " + X(x, sc).s));
          else out.push(nm + "[" + i + "] ← " + X(it, sc).s);
        });
        return out;
      }
      const L = v.l.t === "list" ? v.l : v.r;
      const first = L.items[0];
      need(sc, "Index", INT);
      if (dims.length === 1) {
        out.push("FOR Index ← 0 TO " + X(adj(dims[0], -1), sc).s, "   " + nm + "[Index] ← " + X(first, sc).s, "NEXT Index");
      } else {
        need(sc, "Index2", INT);
        const cell = first.t === "list" ? first.items[0] : first;
        out.push("FOR Index ← 0 TO " + X(adj(dims[0], -1), sc).s, "   FOR Index2 ← 0 TO " + X(adj(dims[1], -1), sc).s, "      " + nm + "[Index, Index2] ← " + X(cell, sc).s, "   NEXT Index2", "NEXT Index");
      }
      tip("A Python list [0] * n becomes a DECLAREd array plus a loop that gives every cell its starting value.");
      return out;
    }

    function assign(n, sc) {
      const v = n.value;
      if (!v) return emit(n.ln, [], "A type hint such as x: int only names the type. Pseudocode does that with DECLARE.");
      if (n.targets.length > 1)
        return emit(n.ln, n.targets.map((t) => target(t, sc) + " ← " + X(v, sc).s), "Chained assignment (a = b = 0) becomes one assignment per variable.");
      const t = n.targets[0];
      if (t.t === "tuple") return tuple(n, sc);
      const vt = typeOf(v, sc);
      if (t.t === "name" && isArr(vt) && (v.t === "list" || v.t === "bin"))
        return emit(n.ln, arrayLines(t.n, v, vt, sc), "Pseudocode arrays have a fixed size and must be DECLAREd. Here they start at index 0 so the numbers match your Python.");
      const inp = inputOf(v);
      if (inp) {
        const lines = [];
        if (inp.prompt) lines.push("OUTPUT " + X(inp.prompt, sc).s);
        lines.push("INPUT " + target(t, sc));
        if (inp.conv) tip("int()/float() are not needed: the variable's declared type decides how INPUT reads the value.");
        return emit(n.ln, lines, "input(prompt) becomes OUTPUT for the prompt followed by INPUT, which stores what the user types. (OUTPUT ends the line, so the typed answer appears on the next line.)");
      }
      if (v.t === "ifexp") {
        const tg = target(t, sc);
        const lines = ["IF " + X(v.c, sc).s, "   THEN " + tg + " ← " + X(v.a, sc).s, "   ELSE " + tg + " ← " + X(v.b, sc).s, "ENDIF"];
        return emit(n.ln, lines, "Pseudocode has no one-line “a if c else b”, so it becomes an IF with two assignments.");
      }
      emit(n.ln, [target(t, sc) + " ← " + X(v, sc).s], "Assignment uses ← instead of =.");
    }

    function tuple(n, sc) {
      const ts = n.targets[0].items, vs = n.value.t === "tuple" ? n.value.items : null;
      if (!vs || vs.length !== ts.length) return emit(n.ln, ["// " + srcLines[n.ln - 1].trim()], warn(n.ln, "This multiple assignment could not be split up.") || "");
      if (!exam && ts.length === 2 && same(ts[0], vs[1]) && same(ts[1], vs[0]))
        return emit(n.ln, ["SWAP " + target(ts[0], sc) + ", " + target(ts[1], sc)], "Swapping two values is SWAP a, b (a shortcut beyond the exam syllabus).");
      const conflict = vs.some((x, j) => ts.slice(0, j).some((t) => refs(x, rootName(t))));
      let lines;
      if (!conflict) lines = ts.map((t, j) => target(t, sc) + " ← " + X(vs[j], sc).s);
      else {
        lines = vs.map((x, j) => { need(sc, "Temp" + (j + 1), typeOf(x, sc)); return "Temp" + (j + 1) + " ← " + X(x, sc).s; });
        lines.push(...ts.map((t, j) => target(t, sc) + " ← Temp" + (j + 1)));
      }
      emit(n.ln, lines, conflict ? "Python assigns all the right-hand values at once. Pseudocode goes one line at a time, so Temp variables hold the new values until every variable has been updated." : "A multiple assignment becomes one assignment per variable.");
    }

    function printStmt(e, ln, sc) {
      const sep = e.kw.sep ? (e.kw.sep.t === "str" ? e.kw.sep.v : " ") : " ";
      if (e.kw.end) tip("end=… has no equivalent: every OUTPUT starts a new line.");
      let seq = [];
      e.args.forEach((a, i) => { if (i && sep) seq.push({ lit: sep }); seq.push(...itemsOf(a, sc)); });
      if (e.args.length > 1 && sep === " ") tip("print puts a space between items; OUTPUT adds nothing, so the space moves into the text.");
      seq = mergeLits(seq);
      if (!seq.length) seq = [{ lit: "" }];
      emit(ln, ["OUTPUT " + seq.map((i) => (i.lit !== undefined ? quote(i.lit) : i.ex.s)).join(", ")], "print(…) becomes OUTPUT. Items are separated by commas.");
    }

    function exprStmt(n, sc) {
      const e = n.e;
      if (e.t === "str") return emit(n.ln, e.v.split("\n").map((l) => "// " + l.trim()), "A text on its own line is a docstring. Pseudocode uses // comments.");
      if (e.t === "call") {
        const nm = callName(e);
        if (nm === "print") return printStmt(e, n.ln, sc);
        if (funcs.has(nm)) return emit(n.ln, ["CALL " + vn(nm) + "(" + e.args.map((x) => X(x, sc).s).join(", ") + ")"], "A procedure is run with CALL, followed by its name and values.");
        if (nm === ".sort" && e.f.o.t === "name") return emit(n.ln, ["SORT(" + vn(e.f.o.n) + ")"], "list.sort() becomes SORT(array), which sorts in place.");
      }
      warn(n.ln, "This statement has no pseudocode equivalent and was kept as a comment.");
      emit(n.ln, ["// Python: " + srcLines[n.ln - 1].trim()], "Not translated.");
    }

    const hoist = (sc, skip) => {
      const g = new Map();
      sc.types.forEach((t, n) => { if (scalar(t) && !skip.has(n)) (g.get(t) || g.set(t, []).get(t)).push(vn(n)); });
      return [...g].map(([t, ns]) => "DECLARE " + ns.join(", ") + " : " + t);
    };
    const hasValueReturn = (stmts) => stmts.some((s) => (s.k === "return" && s.e) || (s.k === "if" && (hasValueReturn(s.body) || hasValueReturn(s.orelse))) || ((s.k === "while" || s.k === "for") && hasValueReturn(s.body)));
    const countBreaks = (stmts) => stmts.reduce((c, s) => c + (s.k === "break" ? 1 : s.k === "if" ? countBreaks(s.body) + countBreaks(s.orelse) : 0), 0);
    const tn = (t, ln, who) => { if (scalar(t)) return t; if (isArr(t) && t.base) return t.base; warn(ln, "The type of " + who + " could not be worked out, so INTEGER was used."); return INT; };

    function doIf(n, sc, outer) {
      const cond = (x) => X(x, sc).s;
      curLn = n.ln;
      emit(n.ln, ["IF " + cond(n.c), "   THEN"], "Pseudocode IF puts THEN on its own line, drops the colon, and ends with ENDIF. Indentation is for readability only.");
      body(n.body, sc, 2);
      let c = n;
      while (c.orelse.length === 1 && c.orelse[0].elif) {
        const e = c.orelse[0];
        curLn = e.ln;
        if (exam) {
          emit(e.ln, ["   ELSE"], "elif has no exam-syllabus equivalent, so it becomes ELSE containing a new IF.");
          nest(2, () => doIf(e, sc, true));
          if (outer) emit(n.end, ["ENDIF"], "ENDIF closes the IF. Python used indentation instead.");
          return;
        }
        emit(e.ln, ["   ELSEIF " + cond(e.c), "      THEN"], "elif becomes ELSEIF (a shortcut beyond the syllabus; the exam style nests IFs instead).");
        body(e.body, sc, 3);
        c = e;
      }
      if (c.orelse.length) {
        emit(c.eln, ["   ELSE"], "else becomes ELSE.");
        body(c.orelse, sc, 2);
      }
      emit(n.end, ["ENDIF"], "ENDIF closes the IF. Python used indentation instead.");
    }

    function loopFor(n, sc) {
      const it = n.iter;
      const tg = n.target.t === "name" ? vn(n.target.n) : null;
      if (!tg) { warn(n.ln, "Loops that unpack several variables are not supported."); return emit(n.ln, ["// Python: " + srcLines[n.ln - 1].trim()], "Not translated."); }
      if (it.t === "call" && callName(it) === "range") {
        const a = it.args;
        let start = a.length > 1 ? a[0] : num(0), stop = a.length > 1 ? a[1] : a[0], step = a[2];
        let stepTxt = "", end;
        if (step && isNumLit(step)) {
          const k = litVal(step);
          end = adj(stop, k < 0 ? 1 : -1);
          if (k !== 1) stepTxt = " STEP " + X(step, sc).s;
        } else {
          end = adj(stop, -1);
          if (step) { stepTxt = " STEP " + X(step, sc).s; warn(n.ln, "A STEP that is not a plain number only works when it is positive."); }
        }
        emit(n.ln, ["FOR " + tg + " ← " + X(start, sc).s + " TO " + X(end, sc).s + stepTxt],
          "range(a, b) stops before b, but a FOR loop includes its last value, so the end becomes b - 1. FOR … NEXT counts up by 1 unless you add STEP.");
        body(n.body, sc, 1);
        return emit(n.end, ["NEXT " + tg], "NEXT marks the end of the loop and names the counter.");
      }
      const t = typeOf(it, sc);
      if (isArr(t) && (!t.dims || t.dims.length === 1) && !exam) {
        emit(n.ln, ["FOREACH " + tg + " IN " + X(it, sc).s], "Looping over a list becomes FOREACH (a shortcut beyond the syllabus; use Exam syntax for a FOR loop with an index).");
        body(n.body, sc, 1);
        return emit(n.end, ["NEXT " + tg], "NEXT ends the loop.");
      }
      if (isArr(t) || t === STR) {
        need(sc, "Index", INT);
        const src = X(it, sc).s;
        const cnt = t === STR ? "LENGTH(" + src + ")" : "SIZE(" + src + ") - 1";
        const first = t === STR ? 1 : 0;
        const get = t === STR ? "MID(" + src + ", Index, 1)" : src + "[Index]";
        emit(n.ln, ["FOR Index ← " + first + " TO " + cnt, "   " + tg + " ← " + get],
          "Pseudocode has no “for each item” in the exam syllabus, so a counter steps through the " + (t === STR ? "characters (position 1 is the first)" : "items (index 0 is the first)") + " and copies each one into " + tg + ".");
        body(n.body, sc, 1);
        return emit(n.end, ["NEXT Index"], "NEXT ends the loop.");
      }
      warn(n.ln, "What this loop steps through could not be worked out, so FOREACH was used.");
      emit(n.ln, ["FOREACH " + tg + " IN " + X(it, sc).s], "FOREACH visits every item of an array.");
      body(n.body, sc, 1);
      emit(n.end, ["NEXT " + tg], "NEXT ends the loop.");
    }

    function loopWhile(n, sc) {
      const lastS = n.body[n.body.length - 1];
      const isTrue = n.c.t === "bool" && n.c.v;
      if (isTrue && lastS && lastS.k === "if" && !lastS.orelse.length && lastS.body.length === 1 && lastS.body[0].k === "break" && countBreaks(n.body) === 1) {
        emit(n.ln, ["REPEAT"], "while True: with a break at the bottom is exactly REPEAT … UNTIL: the body runs at least once and stops when the UNTIL condition is TRUE.");
        body(n.body.slice(0, -1), sc, 1);
        return emit([lastS.ln, lastS.end], ["UNTIL " + X(lastS.c, sc).s], "The if … break line becomes UNTIL condition.");
      }
      emit(n.ln, ["WHILE " + X(n.c, sc).s + " DO"], "while becomes WHILE … DO and ends with ENDWHILE. The condition is checked before every pass.");
      body(n.body, sc, 1);
      emit(n.end, ["ENDWHILE"], "ENDWHILE closes the loop.");
    }

    function defn(n) {
      const f = funcs.get(n.n);
      if (!f) { warn(n.ln, "Functions defined inside other blocks are not supported."); return; }
      const isFn = hasValueReturn(n.body);
      const ps = n.ps.map((p, i) => {
        if (p.def) warn(n.ln, "Default values for parameters are not supported (" + p.n + ").");
        return vn(p.n) + " : " + tn(f.ptypes[i], n.ln, "parameter " + p.n);
      });
      const hdr = (isFn ? "FUNCTION " : "PROCEDURE ") + vn(n.n) + "(" + ps.join(", ") + ")" + (isFn ? " RETURNS " + tn(f.ret, n.ln, "the result of " + n.n) : "");
      const step = emit(n.ln, [hdr], "def becomes " + (isFn ? "FUNCTION … RETURNS type (it gives a value back)" : "PROCEDURE (it does not return a value)") + ". Pseudocode parameters need a type, worked out here from how the function is called.");
      body(n.body, f.sc, 1);
      step.out.push(...hoist(f.sc, new Set(n.ps.map((p) => p.n))).map((l) => pad(depth + 1) + l));
      emit(n.end, [isFn ? "ENDFUNCTION" : "ENDPROCEDURE", ""], "The end of the function is marked with " + (isFn ? "ENDFUNCTION" : "ENDPROCEDURE") + ".");
    }

    function stmt(n, sc) {
      curLn = n.ln;
      tips = [];
      switch (n.k) {
        case "comment": return emit(n.ln, ["// " + n.text], "Comments start with // in pseudocode (# in Python).");
        case "pass": return emit(n.ln, [], "pass does nothing, so pseudocode simply leaves the block empty.");
        case "import": return emit(n.ln, [], "Nothing to import: SQRT, RANDOMINT and the other helpers are always available.");
        case "global": return emit(n.ln, [], "global is not needed: pseudocode procedures can already read and change variables declared outside them.");
        case "assign": return assign(n, sc);
        case "aug": {
          const tg = target(n.target, sc), v = n.value;
          if (!exam && n.target.t === "name" && "+-*/".includes(n.op) && typeOf(n.target, sc) !== STR)
            return emit(n.ln, [tg + " " + n.op + "= " + X(v, sc).s], "x += 1 is kept as a shortcut (beyond the syllabus). The exam way is x ← x + 1.");
          const full = X(bin(n.op, n.target, v), sc).s;
          return emit(n.ln, [tg + " ← " + full], "x += 1 is short for x = x + 1, so pseudocode writes it out in full.");
        }
        case "expr": return exprStmt(n, sc);
        case "if":
          if (n.c.t === "cmp" && n.c.ops[0] === "==" && n.c.ex[0].t === "name" && n.c.ex[0].n === "__name__")
            { emit(n.ln, [], "if __name__ == \"__main__\": only matters in Python files, so the code inside is written directly."); return body(n.body, sc, 0); }
          return doIf(n, sc, true);
        case "while": return loopWhile(n, sc);
        case "for": return loopFor(n, sc);
        case "def": return defn(n);
        case "return":
          if (!n.e) { warn(n.ln, "A bare return has no pseudocode equivalent; structure the procedure so it ends naturally."); return emit(n.ln, ["// return"], "Not translated."); }
          if (n.e.t === "tuple") { warn(n.ln, "Returning several values is not supported."); return emit(n.ln, ["// Python: " + srcLines[n.ln - 1].trim()], "Not translated."); }
          return emit(n.ln, ["RETURN " + X(n.e, sc).s], "return becomes RETURN.");
        case "break": case "continue":
          warn(n.ln, n.k + " has no pseudocode equivalent. Change the loop condition (for example with a Boolean flag) instead.");
          return emit(n.ln, ["// " + n.k], "Pseudocode has no " + n.k.toUpperCase() + ". Use a Boolean variable in the loop condition instead.");
      }
    }

    const pre = { src: null, out: [], note: "" };
    steps.push(pre);
    program.forEach((n) => stmt(n, G));
    pre.out = hoist(G, new Set());
    pre.note = "Pseudocode programs normally begin by declaring every variable with its type. Python works types out by itself, so they were worked out for you from how each variable is used.";
    if (!pre.out.length) steps.shift();
    const code = steps.flatMap((s) => s.out).join("\n").replace(/\n+$/, "");
    return { code, steps, warns };
  }

  return { convert };
})();
