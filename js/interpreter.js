let hook = null;
const asE = (t) => (t.i ? { k: "idx", n: t.n, i: t.i } : { k: "var", n: t.n });
let halt = false,
  pend = null,
  steps = 0,
  lines = 0,
  rows = [],
  G,
  defs,
  auto = [],
  running = false,
  depth = 0;
const MAX_DEPTH = 500;
const mk = () => ({ v: new Map(), t: new Map(), c: new Set() });
const fmt = (v) =>
  typeof v == "boolean"
    ? v
      ? "TRUE"
      : "FALSE"
    : typeof v == "number"
      ? String(+v.toPrecision(12))
      : v;
const find = (sc, n) => (sc.v.has(n) ? sc : G.v.has(n) ? G : null);
const show = (v) => (typeof v == "string" ? '"' + v + '"' : fmt(v));
const num = (v) => {
  if (typeof v != "number") throw er("Expected a number but got " + show(v));
  return v;
};
const bool = (v) => {
  if (typeof v != "boolean")
    throw er("Expected TRUE or FALSE but got " + show(v));
  return v;
};
const tr = (n, v) => {
  if (rows.length < 600) rows.push({ n, v });
};
function chkT(t, v, n) {
  const ok = {
    INTEGER: () => typeof v == "number" && Number.isInteger(v),
    REAL: () => typeof v == "number",
    STRING: () => typeof v == "string",
    CHAR: () => typeof v == "string" && v.length == 1,
    BOOLEAN: () => typeof v == "boolean",
  }[t];
  if (ok && !ok())
    throw er(
      "Cannot store " + show(v) + " in " + n + " (" + t + ")" +
        (t == "CHAR" && typeof v == "string" ? " – a CHAR holds exactly one character" : ""),
    );
  return v;
}
function print(s) {
  if (++lines > 3000) throw er("Too much output – is there an infinite loop?");
  $("out").append(s);
  $("out").scrollTop = 1e9;
}
async function tick(line) {
  if (halt) throw new Error("Program stopped.");
  if (line && hook) {
    await hook(cur);
    if (halt) throw new Error("Program stopped.");
  }
  if (++steps % 800 == 0) await new Promise((r) => setTimeout(r));
}
function getIn() {
  if (auto.length) {
    const v = auto.shift();
    print("› " + v + "\n");
    return Promise.resolve(v);
  }
  return new Promise((r) => {
    pend = r;
    $("inrow").hidden = false;
    $("inp").focus();
  });
}
function arr(sc, n) {
  const s = find(sc, n),
    a = s && s.v.get(n);
  if (!a || !a.arr) throw er(n + " is not a declared array");
  return a;
}
async function ik(a, n, sc) {
  const ix = [];
  for (const e of n.i) ix.push(await ev(e, sc));
  if (ix.length != a.dm.length)
    throw er(n.n + " needs " + a.dm.length + " index value(s)");
  ix.forEach((x, j) => {
    if (!Number.isInteger(x) || x < a.dm[j][0] || x > a.dm[j][1])
      throw er(
        "Index " +
          fmt(x) +
          " is outside " +
          n.n +
          "[" +
          a.dm.map((d) => d.join(":")).join(",") +
          "]",
      );
  });
  return ix.join(",");
}
const count = (n, name) => {
  if (!Number.isInteger(num(n)) || n < 0)
    throw er(name + " needs a whole number of characters, 0 or more");
  return n;
};
const B = {
  LENGTH: (s) => String(s).length,
  LEN: (s) => String(s).length,
  LEFT: (s, n) => String(s).slice(0, count(n, "LEFT")),
  RIGHT: (s, n) => (count(n, "RIGHT") ? String(s).slice(-n) : ""),
  MID: (s, i, n) => {
    num(i);
    if (!Number.isInteger(i) || i < 1)
      throw er("MID needs a start position of 1 or more (the first character is position 1)");
    return String(s).substr(i - 1, count(n, "MID"));
  },
  UCASE: (s) => String(s).toUpperCase(),
  LCASE: (s) => String(s).toLowerCase(),
  TO_UPPER: (s) => String(s).toUpperCase(),
  TO_LOWER: (s) => String(s).toLowerCase(),
  ROUND: (x, n = 0) => {
    num(x);
    if (!Number.isInteger(num(n)) || n < 0 || n > 15)
      throw er("ROUND needs a whole number of decimal places from 0 to 15");
    if (/e/i.test(String(x))) return Math.round(x * 10 ** n) / 10 ** n;
    return Math.sign(x) * Number(Math.round(Math.abs(x) + "e" + n) + "e-" + n);
  },
  RANDOM: () => Math.random(),
  INT: (x) => Math.trunc(num(x)),
};
async function call(n, sc, val) {
  const a = [];
  for (const e of n.a) a.push(await ev(e, sc));
  const U = n.n.toUpperCase(),
    d = defs[U];
  if (d) {
    if (val && !d.f) throw er(n.n + " is a procedure – use CALL " + n.n);
    if (a.length != d.ps.length)
      throw er(n.n + " needs " + d.ps.length + " value(s) but got " + a.length);
    if (depth >= MAX_DEPTH)
      throw er(
        n.n + " has called itself too many times – is there a stopping condition?",
      );
    const l = mk();
    d.ps.forEach((q, i) => {
      if (!(a[i] && a[i].arr)) chkT(q.ty, a[i], "parameter " + q.n);
      l.v.set(q.n, a[i]);
      l.t.set(q.n, q.ty);
    });
    const sv = cur;
    depth++;
    let r;
    try {
      r = await bl(d.b, l);
    } finally {
      depth--;
    }
    cur = sv;
    if (d.f && !r) throw er(n.n + " did not RETURN a value");
    return r && r.ret;
  }
  if (Object.hasOwn(B, U)) {
    if (a.length < B[U].length)
      throw er(n.n + " needs " + B[U].length + " value(s) but got " + a.length);
    return B[U](...a);
  }
  throw er("Unknown procedure or function " + n.n);
}
async function ev(n, sc) {
  switch (n.k) {
    case "lit":
      return n.v;
    case "var": {
      const s = find(sc, n.n),
        v = s && s.v.get(n.n);
      if (v == null)
        throw er(n.n + " has no value yet (never assigned or input)");
      return v;
    }
    case "idx": {
      const a = arr(sc, n.n),
        k = await ik(a, n, sc);
      if (!a.d.has(k)) throw er(n.n + "[" + k + "] has no value yet");
      return a.d.get(k);
    }
    case "neg":
      return -num(await ev(n.e, sc));
    case "not":
      return !bool(await ev(n.e, sc));
    case "call":
      return call(n, sc, true);
    case "bin": {
      const o = n.o;
      if (o == "AND") return bool(await ev(n.l, sc)) && bool(await ev(n.r, sc));
      if (o == "OR") return bool(await ev(n.l, sc)) || bool(await ev(n.r, sc));
      const a = await ev(n.l, sc),
        b = await ev(n.r, sc);
      switch (o) {
        case "&":
          if ((a && a.arr) || (b && b.arr))
            throw er("Cannot join a whole array – use an index such as Name[1]");
          return fmt(a) + fmt(b);
        case "=":
          return a === b;
        case "<>":
          return a !== b;
        case "<":
        case ">":
        case "<=":
        case ">=":
          if (typeof a != typeof b)
            throw er("Cannot compare " + show(a) + " with " + show(b));
          return o == "<"
            ? a < b
            : o == ">"
              ? a > b
              : o == "<="
                ? a <= b
                : a >= b;
      }
      const x = num(a),
        y = num(b);
      switch (o) {
        case "+":
          return x + y;
        case "-":
          return x - y;
        case "*":
          return x * y;
        case "^":
          return x ** y;
        default:
          if (y == 0) throw er("Division by zero");
          return o == "/" ? x / y : o == "DIV" ? Math.trunc(x / y) : x % y;
      }
    }
  }
}
async function put(t, v, sc) {
  if (t.i) {
    const a = arr(sc, t.n),
      k = await ik(a, t, sc),
      nm = t.n + "[" + k + "]";
    chkT(a.ty, v, nm);
    a.d.set(k, v);
    tr(nm, v);
  } else {
    const s = find(sc, t.n) || sc;
    if (s.c.has(t.n)) throw er(t.n + " is a constant and cannot change");
    const y = s.t.get(t.n);
    if (y) chkT(y, v, t.n);
    s.v.set(t.n, v);
    tr(t.n, v);
  }
}
function conv(r, t, sc) {
  let y;
  const s = find(sc, t.n);
  if (s) {
    const x = s.v.get(t.n);
    y = x && x.arr ? x.ty : s.t.get(t.n);
  }
  r = r.trim();
  if (y == "STRING" || y == "CHAR") return r;
  if (y == "BOOLEAN") return r.toUpperCase() == "TRUE";
  if (/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(r)) return +r;
  if (y) throw er('"' + r + '" is not a valid ' + y);
  return r;
}
async function bl(b, sc) {
  for (const s of b) {
    const r = await ex(s, sc);
    if (r) return r;
  }
}
async function ex(n, sc) {
  cur = n.ln;
  await tick(true);
  switch (n.k) {
    case "def":
      return;
    case "decl":
      for (const nm of n.ns) {
        if (n.ty.arr) {
          const dm = [];
          for (const [a, b] of n.ty.arr)
            dm.push([await ev(a, sc), await ev(b, sc)]);
          sc.v.set(nm, { arr: 1, dm, d: new Map(), ty: n.ty.base });
        } else {
          sc.v.set(nm, undefined);
          sc.t.set(nm, n.ty.base);
        }
      }
      return;
    case "const":
      sc.v.set(n.n, await ev(n.e, sc));
      sc.c.add(n.n);
      return;
    case "asg":
      await put(n.tg, await ev(n.e, sc), sc);
      return;
    case "in":
      for (const t of n.tg) {
        const raw = await getIn();
        await put(t, conv(raw, t, sc), sc);
      }
      return;
    case "out": {
      let s = "";
      for (const e of n.es) s += fmt(noArr(await ev(e, sc)));
      print(s + "\n");
      if (rows.length < 600) rows.push({ o: s });
      return;
    }
    case "if":
      return bl(bool(await ev(n.c, sc)) ? n.a : n.b, sc);
    case "case": {
      const v = await ev(n.s, sc);
      for (const b of n.br) {
        const a = await ev(b.a, sc);
        if (b.b ? v >= a && v <= (await ev(b.b, sc)) : v === a)
          return ex(b.s, sc);
      }
      if (n.ot) return ex(n.ot, sc);
      return;
    }
    case "for": {
      const a = num(await ev(n.a, sc)),
        b = num(await ev(n.b, sc)),
        st = n.s ? num(await ev(n.s, sc)) : 1;
      if (!st) throw er("STEP cannot be 0");
      const eps = Math.abs(st) * 1e-9;
      for (let k = 0, i = a; st > 0 ? i <= b + eps : i >= b - eps; k++, i = a + k * st) {
        cur = n.ln;
        await put({ n: n.v }, i, sc);
        if (k) await tick(true);
        const r = await bl(n.body, sc);
        if (r) return r;
        await tick();
      }
      return;
    }
    case "while":
      for (let first = true; ; first = false) {
        cur = n.ln;
        if (!first) await tick(true);
        if (!bool(await ev(n.c, sc))) break;
        const r = await bl(n.b, sc);
        if (r) return r;
        await tick();
      }
      return;
    case "rep":
      for (;;) {
        const r = await bl(n.b, sc);
        if (r) return r;
        await tick();
        cur = n.cl;
        await tick(true);
        if (bool(await ev(n.c, sc))) break;
      }
      return;
    case "ret":
      return { ret: await ev(n.e, sc) };
    case "swap": {
      const x = await ev(asE(n.a), sc),
        y = await ev(asE(n.b), sc);
      await put(n.a, y, sc);
      await put(n.b, x, sc);
      return;
    }
    case "each": {
      const a = await ev(n.s, sc);
      if (!a || !a.arr) throw er("FOREACH needs an array");
      const ks = [...a.d.keys()].sort((p, q) =>
        p.localeCompare(q, undefined, { numeric: true }),
      );
      for (const k of ks) {
        await put({ n: n.v }, a.d.get(k), sc);
        const r = await bl(n.body, sc);
        if (r) return r;
        await tick();
      }
      return;
    }
    case "call":
      await call(n, sc, false);
  }
}
