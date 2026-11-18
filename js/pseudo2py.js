const ps2py = (() => {
  const GFX = new Set("CANVAS COLOUR COLOR BACKGROUND LINE RECT FILLRECT CIRCLE FILLCIRCLE TEXT WIDTH PIXEL TRIANGLE FILLTRIANGLE".split(" "));
  const PYT = { INTEGER: "int", REAL: "float", STRING: "str", CHAR: "str", BOOLEAN: "bool" };
  const DEFAULT = { INTEGER: "0", REAL: "0.0", STRING: '""', CHAR: '""', BOOLEAN: "False" };
  const lit = (v) => ({ k: "lit", v });
  const bin = (o, l, r) => ({ k: "bin", o, l, r });
  const constNum = (e) => (e.k === "lit" && typeof e.v === "number" ? e.v : e.k === "neg" && e.e.k === "lit" && typeof e.e.v === "number" ? -e.e.v : null);
  const adj = (e, d) => {
    if (!d) return e;
    const c = constNum(e);
    if (c !== null) return lit(c + d);
    if (e.k === "bin" && (e.o === "+" || e.o === "-") && e.r.k === "lit" && typeof e.r.v === "number") {
      const k = (e.o === "+" ? e.r.v : -e.r.v) + d;
      return k === 0 ? e.l : k > 0 ? bin("+", e.l, lit(k)) : bin("-", e.l, lit(-k));
    }
    return d > 0 ? bin("+", e, lit(d)) : bin("-", e, lit(-d));
  };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  function scanComments(src) {
    const out = [];
    src.split("\n").forEach((line, i) => {
      let q = null;
      for (let j = 0; j < line.length; j++) {
        const c = line[j];
        if (q) { if (c === q) q = null; continue; }
        if (c === '"' || c === "'") q = c;
        else if (c === "/" && line[j + 1] === "/") {
          out.push({ ln: i + 1, text: line.slice(j + 2).trim(), own: !line.slice(0, j).trim() });
          break;
        }
      }
    });
    return out;
  }

  function convert(src, opts = {}) {
    const short = opts.short !== false;
    const program = parse(lex(src));
    const srcLines = src.replace(/\r\n?/g, "\n").split("\n");
    const comments = scanComments(src.replace(/\r\n?/g, "\n"));
    const warns = [], steps = [], imports = new Set();
    let depth = 0, tips = [], curLn = 0;
    const warn = (ln, m) => { const w = (ln ? "Line " + ln + ": " : "") + m; if (!warns.includes(w)) warns.push(w); };
    const tip = (m) => { if (!tips.includes(m)) tips.push(m); };
    const pad = (n) => "    ".repeat(n);

    const mkScope = () => ({ types: new Map(), consts: new Set() });
    const G = mkScope(), fsc = new Map(), defs = [];
    const collect = (stmts, sc) =>
      stmts.forEach((n) => {
        switch (n.k) {
          case "decl": n.ns.forEach((nm) => sc.types.set(nm, { ty: n.ty.base, dims: n.ty.arr })); break;
          case "const": sc.consts.add(n.n); { const t = typeof n.e.v === "string" ? "STRING" : typeof n.e.v === "number" ? (Number.isInteger(n.e.v) ? "INTEGER" : "REAL") : undefined; sc.types.set(n.n, { ty: t }); } break;
          case "if": collect(n.a, sc); collect(n.b, sc); break;
          case "for": case "each": collect(n.body, sc); break;
          case "while": case "rep": collect(n.b, sc); break;
          case "case": n.br.forEach((b) => collect([b.s], sc)); if (n.ot) collect([n.ot], sc); break;
          case "def": {
            const s = mkScope();
            n.ps.forEach((p) => s.types.set(p.n, { ty: p.ty }));
            fsc.set(n, s); defs.push(n);
            collect(n.b, s);
          }
        }
      });
    collect(program, G);
    const look = (n, sc) => sc.types.get(n) || G.types.get(n);
    const isConst = (n, sc) => sc.consts.has(n) || G.consts.has(n);
    const pn = (n, sc) => names.snake(n, isConst(n, sc));
    const userDef = (name) => defs.find((d) => d.n.toUpperCase() === name.toUpperCase());

    const typeOf = (e, sc) => {
      switch (e.k) {
        case "lit": return typeof e.v === "string" ? "STRING" : typeof e.v === "boolean" ? "BOOLEAN" : Number.isInteger(e.v) ? "INTEGER" : "REAL";
        case "var": case "idx": { const d = look(e.n, sc); return d && d.ty; }
        case "neg": return typeOf(e.e, sc);
        case "not": return "BOOLEAN";
        case "bin": {
          if (["AND", "OR", "=", "<>", "<", ">", "<=", ">="].includes(e.o)) return "BOOLEAN";
          if (e.o === "&") return "STRING";
          if (e.o === "/") return "REAL";
          if (e.o === "DIV" || e.o === "MOD") return "INTEGER";
          const a = typeOf(e.l, sc), b = typeOf(e.r, sc);
          return a === "REAL" || b === "REAL" ? "REAL" : a === "INTEGER" && b === "INTEGER" ? "INTEGER" : undefined;
        }
        case "call": {
          const d = userDef(e.n);
          if (d) return d.rt;
          const u = e.n.toUpperCase();
          if (["LENGTH", "LEN", "SIZE", "ASC", "INT", "FLOOR", "CEIL", "INDEXOF", "RANDOMINT"].includes(u)) return "INTEGER";
          if (["LEFT", "RIGHT", "MID", "UCASE", "LCASE", "TO_UPPER", "TO_LOWER", "CHR"].includes(u)) return "STRING";
          if (["ROUND", "SQRT", "SIN", "COS", "PI", "RANDOM"].includes(u)) return "REAL";
          if (u === "CONTAINS") return "BOOLEAN";
          if (["ABS", "MAX", "MIN", "SUM"].includes(u)) return e.a[0] ? typeOf(e.a[0], sc) || "INTEGER" : "INTEGER";
        }
      }
    };

    const wrap = (x, min) => (x.p >= min ? x.s : "(" + x.s + ")");
    const pyq = (s) => (!s.includes('"') ? '"' + s + '"' : !s.includes("'") ? "'" + s + "'" : '"' + s.replace(/"/g, '\\"') + '"');
    const leaves = (e, acc = []) => { if (e.k === "bin" && e.o === "&") { leaves(e.l, acc); leaves(e.r, acc); } else acc.push(e); return acc; };
    const strOf = (e, sc) => (typeOf(e, sc) === "STRING" ? wrap(P(e, sc), 6) : "str(" + P(e, sc).s + ")");
    const CMP = { "=": "==", "<>": "!=", "<": "<", ">": ">", "<=": "<=", ">=": ">=" };

    function idxStr(n, idx, sc) {
      const d = look(n, sc);
      const lo = d && d.dims ? d.dims.map((x) => x[0]) : null;
      if (!lo) tip("Declare the array so the converter knows where its indexes start.");
      return idx.map((i, j) => {
        const l = lo && lo[j];
        const c = l && constNum(l);
        if (!lo || c === 0) return "[" + P(i, sc).s + "]";
        tip("Pseudocode arrays usually start at 1 but Python lists start at 0, so the index has 1 taken off.");
        return "[" + P(c !== null ? adj(i, -c) : bin("-", i, l), sc).s + "]";
      }).join("");
    }
    function P(e, sc) {
      switch (e.k) {
        case "lit":
          if (typeof e.v === "boolean") return { s: e.v ? "True" : "False", p: 9 };
          if (typeof e.v === "string") return { s: pyq(e.v), p: 9 };
          return { s: String(e.v), p: 9 };
        case "var": return { s: pn(e.n, sc), p: 9 };
        case "idx": return { s: pn(e.n, sc) + idxStr(e.n, e.i, sc), p: 9 };
        case "neg": return { s: "-" + wrap(P(e.e, sc), 7), p: 7 };
        case "not": tip("NOT becomes not."); return { s: "not " + wrap(P(e.e, sc), 3), p: 3 };
        case "call": return callP(e, sc);
        case "bin": {
          const o = e.o;
          if (o === "AND" || o === "OR") {
            const k = o === "AND" ? 2 : 1;
            tip(o + " becomes " + o.toLowerCase() + ".");
            return { s: wrap(P(e.l, sc), k) + " " + o.toLowerCase() + " " + wrap(P(e.r, sc), k + 1), p: k };
          }
          if (CMP[o]) {
            if (o === "=") tip("= (is equal to) becomes ==, because a single = assigns in Python.");
            if (o === "<>") tip("<> (not equal) becomes !=.");
            return { s: wrap(P(e.l, sc), 5) + " " + CMP[o] + " " + wrap(P(e.r, sc), 5), p: 4 };
          }
          if (o === "&") {
            tip("& joins text in pseudocode; Python uses +, and numbers must be wrapped in str().");
            return { s: leaves(e).map((x) => strOf(x, sc)).join(" + "), p: 5 };
          }
          if (o === "^") { tip("^ (power) becomes **."); return { s: wrap(P(e.l, sc), 9) + " ** " + wrap(P(e.r, sc), 7), p: 8 }; }
          const py = { DIV: "//", MOD: "%" }[o] || o;
          if (o === "DIV") tip("DIV (whole-number division) becomes //.");
          if (o === "MOD") tip("MOD (remainder) becomes %.");
          const k = o === "+" || o === "-" ? 5 : 6;
          return { s: wrap(P(e.l, sc), k) + " " + py + " " + wrap(P(e.r, sc), k + 1), p: k };
        }
      }
    }
    function callP(e, sc) {
      const U = e.n.toUpperCase(), A = e.a.map((x) => P(x, sc)), a = A.map((x) => x.s), all = a.join(", ");
      if (userDef(e.n)) return { s: pn(e.n, sc) + "(" + all + ")", p: 9 };
      const f = (nm) => ({ s: nm + "(" + all + ")", p: 9 });
      switch (U) {
        case "LENGTH": case "LEN": case "SIZE": return f("len");
        case "LEFT": return { s: wrap(A[0], 9) + "[:" + a[1] + "]", p: 9 };
        case "RIGHT": { const k = constNum(e.a[1]); return { s: wrap(A[0], 9) + (k > 0 ? "[-" + k + ":]" : "[len(" + a[0] + ") - " + wrap(A[1], 7) + ":]"), p: 9 }; }
        case "MID": {
          tip("Positions start at 1 in pseudocode but 0 in Python, so MID(text, i, n) becomes a slice text[i-1 : i-1+n].");
          const st = adj(e.a[1], -1), n = e.a[2], k = constNum(n);
          if (k === 1) return { s: wrap(A[0], 9) + "[" + P(st, sc).s + "]", p: 9 };
          const end = constNum(st) !== null && constNum(n) !== null ? lit(constNum(st) + constNum(n)) : bin("+", st, n);
          return { s: wrap(A[0], 9) + "[" + P(st, sc).s + ":" + P(end, sc).s + "]", p: 9 };
        }
        case "UCASE": case "TO_UPPER": return { s: wrap(A[0], 9) + ".upper()", p: 9 };
        case "LCASE": case "TO_LOWER": return { s: wrap(A[0], 9) + ".lower()", p: 9 };
        case "ROUND": return f("round");
        case "INT": return f("int");
        case "ABS": return f("abs");
        case "MAX": return f("max");
        case "MIN": return f("min");
        case "SUM": return f("sum");
        case "ASC": return f("ord");
        case "CHR": return f("chr");
        case "SQRT": case "SIN": case "COS": case "FLOOR": case "CEIL": imports.add("math"); return f("math." + U.toLowerCase());
        case "PI": imports.add("math"); return { s: "math.pi", p: 9 };
        case "RANDOM": imports.add("random"); return { s: "random.random()", p: 9 };
        case "RANDOMINT": imports.add("random"); return f("random.randint");
        case "CONTAINS": return { s: wrap(A[1], 5) + " in " + wrap(A[0], 5), p: 4 };
        case "INDEXOF": return { s: wrap(A[0], 9) + ".find(" + a[1] + ") + 1", p: 5 };
      }
      warn(curLn, e.n + " has no Python equivalent here.");
      return { s: pn(e.n, sc) + "(" + all + ")", p: 9 };
    }

    const flushed = new Set();
    const emit = (src, lines, base) => {
      lines = lines.slice();
      if (typeof src === "number") {
        const c = comments.find((x) => x.ln === src && !x.own && !flushed.has(x));
        if (c) { flushed.add(c); if (lines.length) lines[0] += "  # " + c.text; else lines = ["# " + c.text]; }
      }
      const note = (base || "") + (tips.length ? " " + tips.join(" ") : "");
      tips = [];
      const step = { src, out: lines.map((l) => (l ? pad(depth) + l : l)), note: note.trim() };
      steps.push(step);
      return step;
    };
    const flushComments = (upTo) =>
      comments.filter((c) => c.own && !flushed.has(c) && c.ln < upTo).forEach((c) => {
        flushed.add(c);
        steps.push({ src: c.ln, out: [pad(depth) + "# " + c.text], note: "Comments start with # in Python (// in pseudocode)." });
      });
    const nest = (k, fn) => { depth += k; try { fn(); } finally { depth -= k; } };
    const body = (stmts, sc, k, owner) => {
      if (!stmts.length) { nest(k, () => emit(null, ["pass"], "A Python block cannot be empty, so pass is added.")); return; }
      nest(k, () => stmts.forEach((s) => stmt(s, sc)));
    };
    const tgt = (t, sc) => (t.i ? pn(t.n, sc) + idxStr(t.n, t.i, sc) : pn(t.n, sc));
    const asExpr = (t) => (t.i ? { k: "idx", n: t.n, i: t.i } : { k: "var", n: t.n });

    function doIf(n, sc, kw) {
      curLn = n.ln;
      emit(n.ln, [kw + " " + P(n.c, sc).s + ":"], kw === "if" ? "IF … THEN becomes if …: The THEN line disappears and the block is shown by indentation." : "ELSEIF becomes elif.");
      body(n.a, sc, 1);
      if (short && n.b.length === 1 && n.b[0].k === "if" && !n.el) {
        flushComments(n.b[0].ln);
        return doIf(n.b[0], sc, "elif");
      }
      if (n.b.length) {
        flushComments(n.el || n.b[0].ln);
        emit(n.el || null, ["else:"], "ELSE becomes else:");
        body(n.b, sc, 1);
      }
    }
    function range(n, sc) {
      const k = n.s ? constNum(n.s) : 1;
      const a = n.a, stop = adj(n.b, k !== null && k < 0 ? -1 : 1);
      if (k === 1) return constNum(a) === 0 ? P(stop, sc).s : P(a, sc).s + ", " + P(stop, sc).s;
      if (k === null) tip("A STEP that is not a plain number only works as written when it is positive.");
      return P(a, sc).s + ", " + P(stop, sc).s + ", " + P(n.s, sc).s;
    }
    function inputLine(t, sc) {
      const d = look(t.n, sc), ty = d && d.ty;
      const base = ty === "INTEGER" ? "int(input())" : ty === "REAL" ? "float(input())" : ty === "BOOLEAN" ? 'input().upper() == "TRUE"' : "input()";
      if (!ty) tip("Declare the variable's type so the converter can add int() or float() around input().");
      else if (ty === "INTEGER" || ty === "REAL") tip("input() always returns text, so " + (ty === "INTEGER" ? "int" : "float") + "() turns it into a number (the type came from DECLARE).");
      return tgt(t, sc) + " = " + base;
    }
    function output(n, sc) {
      let items = [];
      const walk = (e) => leaves(e).forEach((x) => items.push(x));
      n.es.forEach(walk);
      if (items.length === 1) {
        tip("print(…) shows the value and starts a new line, like OUTPUT.");
        return "print(" + P(items[0], sc).s + ")";
      }
      const ex = items.map((x) => (x.k === "lit" && typeof x.v === "string" ? { t: x.v } : { e: P(x, sc).s }));
      const all = ex.map((x) => (x.t !== undefined ? x.t : x.e)).join("");
      for (const q of ['"', "'"]) {
        if (!all.includes(q) && !all.includes("\\") && ex.every((x) => x.e === undefined || !/[{}]/.test(x.e) || true)) {
          tip("OUTPUT with several items becomes one print with an f-string: text stays as it is and each value goes in {braces}.");
          return "print(f" + q + ex.map((x) => (x.t !== undefined ? x.t.replace(/[{}]/g, (c) => c + c) : "{" + x.e + "}")).join("") + q + ")";
        }
      }
      return "print(" + items.map((x) => P(x, sc).s).join(", ") + ', sep="")';
    }
    const typeName = (t) => PYT[t] || "int";
    function stmt(n, sc) {
      flushComments(n.ln);
      curLn = n.ln;
      tips = [];
      switch (n.k) {
        case "decl": {
          if (n.ty.arr) {
            const dims = n.ty.arr.map(([lo, hi]) => { const c = constNum(lo); return c !== null ? adj(hi, 1 - c) : bin("+", bin("-", hi, lo), lit(1)); });
            if (dims.length > 2) { warn(n.ln, "Arrays with more than two dimensions are not supported."); return emit(n.ln, ["# " + srcLines[n.ln - 1].trim()], "Not converted."); }
            const d = DEFAULT[n.ty.base];
            const lines = n.ns.map((nm) => pn(nm, sc) + " = " + (dims.length === 1 ? "[" + d + "] * " + wrap(P(dims[0], sc), 7) : "[[" + d + "] * " + wrap(P(dims[1], sc), 7) + " for _ in range(" + P(dims[0], sc).s + ")]"));
            return emit(n.ln, lines, "Python has no DECLARE. An array becomes a list filled with starting values. Indexes in Python start at 0, so the converter subtracts the lower bound where the array is used.");
          }
          return emit(n.ln, ["# " + n.ns.map((x) => pn(x, sc)).join(", ") + ": " + n.ty.base + " (Python needs no declaration)"], "DECLARE has no Python equivalent: a variable is created the first time you give it a value. The type is kept as a comment.");
        }
        case "const": return emit(n.ln, [pn(n.n, sc) + " = " + P(n.e, sc).s], "A CONSTANT becomes a variable written in CAPITALS, the Python habit for values that never change.");
        case "asg": {
          const t = n.tg, e = n.e;
          if (short && !t.i && e.k === "bin" && e.l.k === "var" && e.l.n === t.n && ["+", "-", "*", "/", "&", "DIV", "MOD"].includes(e.o)) {
            const op = { "&": "+", DIV: "//", MOD: "%" }[e.o] || e.o;
            const r = e.o === "&" ? strOf(e.r, sc) : P(e.r, sc).s;
            return emit(n.ln, [tgt(t, sc) + " " + op + "= " + r], "x ← x + 1 is shortened to x += 1 (both mean the same).");
          }
          return emit(n.ln, [tgt(t, sc) + " = " + P(e, sc).s], "← becomes =. In Python a single = assigns.");
        }
        case "in": {
          const lines = n.tg.map((t) => inputLine(t, sc));
          return emit(n.ln, lines, "INPUT becomes variable = input().");
        }
        case "out": return emit(n.ln, [output(n, sc)], "OUTPUT becomes print(…).");
        case "if": {
          doIf(n, sc, "if");
          flushComments(n.en);
          return emit(n.en, [], "ENDIF needs no Python line: the block ends where the indentation ends.");
        }
        case "case": {
          emit(n.ln, [], "Python has no CASE in the exam sense, so it becomes an if / elif / else chain that compares the same value each time.");
          const s = P(n.s, sc);
          n.br.forEach((b, i) => {
            curLn = b.s.ln;
            const c = b.b ? wrap(P(b.a, sc), 5) + " <= " + wrap(s, 5) + " <= " + wrap(P(b.b, sc), 5) : wrap(s, 5) + " == " + wrap(P(b.a, sc), 5);
            emit(b.s.ln, [(i ? "elif " : "if ") + c + ":"], "Each case label becomes a test.");
            body([b.s], sc, 1);
          });
          if (n.ot) { emit(n.ot.ln, ["else:"], "OTHERWISE becomes else:"); body([n.ot], sc, 1); }
          return emit(n.en, [], "ENDCASE needs no Python line.");
        }
        case "for": {
          emit(n.ln, ["for " + pn(n.v, sc) + " in range(" + range(n, sc) + "):"], "FOR … TO … counts up to and including the end value, but range(a, b) stops before b, so the end value gets + 1. FOR counts from the first value; range(a, b) too.");
          body(n.body, sc, 1);
          flushComments(n.en);
          return emit(n.en, [], "NEXT needs no Python line.");
        }
        case "each": {
          emit(n.ln, ["for " + pn(n.v, sc) + " in " + P(n.s, sc).s + ":"], "FOREACH becomes a for loop over the list.");
          body(n.body, sc, 1);
          return emit(n.en, [], "NEXT needs no Python line.");
        }
        case "while": {
          emit(n.ln, ["while " + P(n.c, sc).s + ":"], "WHILE … DO becomes while …: and the condition is checked before each pass, just like in pseudocode.");
          body(n.b, sc, 1);
          flushComments(n.en);
          return emit(n.en, [], "ENDWHILE needs no Python line.");
        }
        case "rep": {
          emit(n.ln, ["while True:"], "Python has no REPEAT … UNTIL. A loop that runs forever with a break at the bottom does the same job: the body always runs at least once.");
          nest(1, () => n.b.forEach((s) => stmt(s, sc)));
          flushComments(n.cl);
          curLn = n.cl;
          const step = emit([n.cl, n.cl], ["    if " + P(n.c, sc).s + ":", "        break"], "UNTIL condition becomes if condition: break, because REPEAT stops when the condition is TRUE.");
          return step;
        }
        case "def": {
          const s = fsc.get(n);
          const ps = n.ps.map((p) => pn(p.n, s) + ": " + typeName(p.ty)).join(", ");
          emit(n.ln, ["def " + pn(n.n, G) + "(" + ps + ")" + (n.f ? " -> " + typeName(n.rt) : "") + ":"], (n.f ? "FUNCTION … RETURNS" : "PROCEDURE") + " becomes def. The types become optional type hints." + (n.f ? "" : " A procedure returns nothing, so there is no return."));
          if (srcLines.slice(0, n.ln - 1).some((l) => !/^\s*(\/\/|$)/.test(l) && new RegExp("\\b" + n.n + "\\s*\\(", "i").test(l)))
            warn(n.ln, "Python needs a function to be defined before the line that calls it. Move this def above its first use.");
          body(n.b, s, 1);
          flushComments(n.en);
          return emit(n.en, [""], "ENDPROCEDURE / ENDFUNCTION needs no Python line.");
        }
        case "ret": return emit(n.ln, ["return " + P(n.e, sc).s], "RETURN becomes return.");
        case "swap": return emit(n.ln, [tgt(n.a, sc) + ", " + tgt(n.b, sc) + " = " + tgt(n.b, sc) + ", " + tgt(n.a, sc)], "SWAP a, b becomes a, b = b, a: Python can assign both at once.");
        case "call": {
          const U = n.n.toUpperCase();
          if (GFX.has(U)) { warn(n.ln, n.n + " draws on the Graphics canvas, which Python does not have built in (look at the turtle module). It was kept as a comment."); return emit(n.ln, ["# " + srcLines[n.ln - 1].trim()], "Not converted."); }
          if (U === "SORT" && n.a[0]) return emit(n.ln, [wrap(P(n.a[0], sc), 9) + ".sort()"], "SORT(array) becomes list.sort(), which also sorts in place.");
          return emit(n.ln, [P({ k: "call", n: n.n, a: n.a }, sc).s], "CALL name(values) becomes name(values).");
        }
      }
    }

    program.forEach((n) => stmt(n, G));
    flushComments(1e9);
    if (imports.size) steps.unshift({ src: null, out: [...imports].sort().map((m) => "import " + m).concat([""]), note: "RANDOM, SQRT and similar built-ins live in Python modules, so they must be imported first." });
    const code = steps.flatMap((s) => s.out).join("\n").replace(/\n+$/, "");
    return { code, steps, warns };
  }

  return { convert };
})();
