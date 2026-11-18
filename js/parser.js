const TYPE_NAMES = ["INTEGER", "REAL", "STRING", "CHAR", "BOOLEAN"];
const TYPE_HINT = {
  INT: "INTEGER",
  FLOAT: "REAL",
  DOUBLE: "REAL",
  STR: "STRING",
  TEXT: "STRING",
  BOOL: "BOOLEAN",
  LIST: "ARRAY[1:10] OF INTEGER",
};
const CLOSERS = {
  ENDIF: "IF",
  ELSE: "IF",
  ELSEIF: "IF",
  THEN: "IF",
  ENDWHILE: "WHILE",
  NEXT: "FOR or FOREACH",
  UNTIL: "REPEAT",
  ENDCASE: "CASE",
  ENDPROCEDURE: "PROCEDURE",
  ENDFUNCTION: "FUNCTION",
};
const PYISM = {
  def: "use PROCEDURE … ENDPROCEDURE, or FUNCTION … ENDFUNCTION",
  elif: "use ELSEIF, or a nested IF inside ELSE",
  import: "nothing needs importing – the built-in functions are always available",
  from: "nothing needs importing – the built-in functions are always available",
  class: "classes are not part of IGCSE pseudocode",
  pass: "just leave the block empty",
  break: "there is no BREAK – change the loop condition instead",
  continue: "there is no CONTINUE – wrap the rest of the loop body in an IF",
  try: "error handling is not part of IGCSE pseudocode",
  lambda: "lambda is not part of IGCSE pseudocode – write a FUNCTION",
};

function parse(T) {
  let p = 0;
  const describe = (t) =>
    t.t == "e" ? "the end of the program" : t.t == "s" ? '"' + t.v + '"' : String(t.v);
  const hint = (want, t) => {
    if (t.t == "o" && t.v == ":" && want != ":")
      return " (pseudocode has no colon here – use THEN after IF and DO after WHILE)";
    if (t.t == "k" && t.v == "IN" && want == "←")
      return " (write FOR Counter ← 1 TO 10, or FOREACH Item IN List to loop over an array)";
    if (t.t == "o" && t.v == "(" && want == "a name")
      return " (write INPUT Name, with no brackets)";
    return "";
  };
  const K = (v) => T[p].t == "k" && T[p].v == v,
    O = (v) => T[p].t == "o" && T[p].v == v,
    eK = (v) => K(v) && ++p,
    eO = (v) => O(v) && ++p,
    bad = (v) => {
      throw pe(
        T[p].ln,
        "Expected " + v + " but found " + describe(T[p]) + hint(v, T[p]),
      );
    },
    nK = (v) => {
      if (!eK(v)) bad(v);
    },
    nO = (v) => {
      if (!eO(v)) bad(v);
    },
    id = () => {
      if (T[p].t != "i") bad("a name");
      return T[p++].v;
    },
    asg = () => {
      if (!(eO("←") || eO("="))) bad("←");
    };
  const bin = (nx, ops) => () => {
    let l = nx();
    while ((T[p].t == "o" || T[p].t == "k") && ops.includes(T[p].v)) {
      const o = T[p++].v;
      l = { k: "bin", o, l, r: nx() };
    }
    return l;
  };
  const args = () => {
    const a = [];
    if (eO("(") && !eO(")")) {
      do a.push(expr());
      while (eO(","));
      nO(")");
    }
    return a;
  };
  const idx = () => {
    const i = [];
    do i.push(expr());
    while (eO(","));
    nO("]");
    return i;
  };
  const expr = () => orE();
  const prim = () => {
    const t = T[p];
    if (t.t == "n" || t.t == "s") {
      p++;
      return { k: "lit", v: t.v };
    }
    if (eK("TRUE")) return { k: "lit", v: true };
    if (eK("FALSE")) return { k: "lit", v: false };
    if (eO("(")) {
      const e = expr();
      nO(")");
      return e;
    }
    if (t.t == "i") {
      p++;
      if (O("(")) return { k: "call", n: t.v, a: args() };
      if (eO("[")) return { k: "idx", n: t.v, i: idx() };
      return { k: "var", n: t.v };
    }
    bad("a value");
  };
  const un = () => (eO("-") ? { k: "neg", e: un() } : prim());
  const pw = bin(un, ["^"]),
    mu = bin(pw, ["*", "/", "DIV", "MOD"]),
    ad = bin(mu, ["+", "-", "&"]),
    cm = bin(ad, ["=", "<>", "<", ">", "<=", ">="]),
    nt = () => (eK("NOT") ? { k: "not", e: nt() } : cm()),
    an = bin(nt, ["AND"]),
    orE = bin(an, ["OR"]);
  const lv = () => {
    const n = id();
    return eO("[") ? { n, i: idx() } : { n };
  };
  const ex1 = (t) =>
    t.i ? { k: "idx", n: t.n, i: t.i } : { k: "var", n: t.n };
  const baseType = () => {
    const t = T[p];
    const u = String(t.v).toUpperCase();
    if (t.t != "i" || !TYPE_NAMES.includes(u))
      throw pe(
        t.ln,
        "Unknown data type " +
          describe(t) +
          " – use INTEGER, REAL, STRING, CHAR or BOOLEAN" +
          (TYPE_HINT[u] ? " (Python’s " + t.v + " is " + TYPE_HINT[u] + " here)" : ""),
      );
    p++;
    return u;
  };
  const ty = () => {
    if (eK("ARRAY")) {
      nO("[");
      const d = [];
      do {
        const a = expr();
        nO(":");
        d.push([a, expr()]);
      } while (eO(","));
      nO("]");
      nK("OF");
      return { arr: d, base: baseType() };
    }
    return { base: baseType() };
  };
  const blk = (open, ...e) => {
    const b = [];
    while (!(T[p].t == "k" && e.includes(T[p].v))) {
      if (T[p].t == "e")
        throw pe(
          open.ln,
          "The " + open.w + " on this line is never closed – expected " + e[e.length - 1],
        );
      b.push(stmt());
    }
    return b;
  };
  const closeNamed = (v) => {
    if (
      T[p].t == "i" &&
      T[p].v == v &&
      !(T[p + 1].t == "o" && ["←", "=", "[", "("].includes(T[p + 1].v))
    )
      p++;
  };
  const ifs = (ln) => {
    const c = expr();
    nK("THEN");
    const a = blk({ ln, w: "IF" }, "ELSE", "ELSEIF", "ENDIF");
    let b = [],
      el = 0,
      en;
    if (eK("ELSEIF")) {
      b = [ifs(T[p - 1].ln)];
      en = b[0].en;
    } else {
      if (eK("ELSE")) {
        el = T[p - 1].ln;
        b = blk({ ln, w: "IF" }, "ENDIF");
      }
      nK("ENDIF");
      en = T[p - 1].ln;
    }
    return { k: "if", ln, c, a, b, el, en };
  };
  const stmt = () => {
    const t = T[p],
      ln = t.ln;
    if (t.t == "i") {
      const nx = T[p + 1];
      const assigning =
        nx.t == "o" && ["←", "=", "[", "+=", "-=", "*=", "/="].includes(nx.v);
      if (PYISM[t.v.toLowerCase()] && !assigning)
        throw pe(ln, "“" + t.v + "” is Python – " + PYISM[t.v.toLowerCase()]);
      if (nx.t == "o" && nx.v == "(") {
        p++;
        return { k: "call", ln, n: t.v, a: args() };
      }
      const tg = lv();
      if (T[p].t == "o" && /^[-+*\/]=$/.test(T[p].v)) {
        const o = T[p++].v[0];
        return { k: "asg", ln, tg, e: { k: "bin", o, l: ex1(tg), r: expr() } };
      }
      asg();
      return { k: "asg", ln, tg, e: expr() };
    }
    if (t.t != "k") bad("a statement");
    if (CLOSERS[t.v])
      throw pe(
        ln,
        t.v +
          " has no matching " +
          CLOSERS[t.v] +
          " above it – check that every block is closed, in the right order",
      );
    p++;
    switch (t.v) {
      case "DECLARE": {
        const ns = [id()];
        while (eO(",")) ns.push(id());
        nO(":");
        return { k: "decl", ln, ns, ty: ty() };
      }
      case "CONSTANT": {
        const n = id();
        asg();
        return { k: "const", ln, n, e: expr() };
      }
      case "INPUT": {
        const tg = [lv()];
        while (eO(",")) tg.push(lv());
        return { k: "in", ln, tg };
      }
      case "OUTPUT":
      case "PRINT": {
        const es = [expr()];
        while (eO(",")) es.push(expr());
        return { k: "out", ln, es };
      }
      case "IF":
        return ifs(ln);
      case "CASE": {
        eK("OF");
        const s = expr();
        eK("OF");
        const br = [];
        let ot = null;
        while (!K("ENDCASE")) {
          if (T[p].t == "e")
            throw pe(ln, "The CASE on this line is never closed – expected ENDCASE");
          if (eK("OTHERWISE")) {
            ot = stmt();
            continue;
          }
          const a = expr();
          let b;
          if (eK("TO")) b = expr();
          nO(":");
          br.push({ a, b, s: stmt() });
        }
        const en = T[p++].ln;
        return { k: "case", ln, s, br, ot, en };
      }
      case "FOR": {
        const v = id();
        asg();
        const a = expr();
        nK("TO");
        const b = expr();
        const s = eK("STEP") ? expr() : null;
        const body = blk({ ln, w: "FOR" }, "NEXT");
        const en = T[p++].ln;
        closeNamed(v);
        return { k: "for", ln, v, a, b, s, body, en };
      }
      case "WHILE": {
        const c = expr();
        eK("DO");
        const b = blk({ ln, w: "WHILE" }, "ENDWHILE");
        const en = T[p++].ln;
        return { k: "while", ln, c, b, en };
      }
      case "REPEAT": {
        const b = blk({ ln, w: "REPEAT" }, "UNTIL"),
          cl = T[p].ln;
        p++;
        return { k: "rep", ln, cl, b, c: expr(), en: cl };
      }
      case "PROCEDURE":
      case "FUNCTION": {
        const n = id(),
          ps = [];
        if (eO("(") && !eO(")")) {
          do {
            if (T[p].t == "i" && /^BY(REF|VAL)$/i.test(T[p].v)) p++;
            const a = id();
            nO(":");
            ps.push({ n: a, ty: ty().base });
          } while (eO(","));
          nO(")");
        }
        let rt = null;
        if (t.v == "FUNCTION") {
          nK("RETURNS");
          rt = ty().base;
        }
        const b = blk({ ln, w: t.v }, "END" + t.v);
        const en = T[p++].ln;
        return { k: "def", ln, n, ps, b, f: t.v == "FUNCTION", rt, en };
      }
      case "SWAP": {
        const a = lv();
        nO(",");
        return { k: "swap", ln, a, b: lv() };
      }
      case "FOREACH": {
        const v = id();
        nK("IN");
        const s = expr();
        const body = blk({ ln, w: "FOREACH" }, "NEXT");
        const en = T[p++].ln;
        closeNamed(v);
        return { k: "each", ln, v, s, body, en };
      }
      case "RETURN":
        return { k: "ret", ln, e: expr() };
      case "CALL": {
        const n = id();
        return { k: "call", ln, n, a: args() };
      }
    }
    p--;
    bad("a statement");
  };
  const P = [];
  while (T[p].t != "e") P.push(stmt());
  return P;
}
