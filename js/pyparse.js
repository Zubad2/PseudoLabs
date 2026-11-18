const pyp = (() => {
  const KWS = new Set(
    "False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield".split(
      " ",
    ),
  );
  const OPS3 = ["**=", "//=", ">>=", "<<="];
  const OPS2 = ["==", "!=", "<=", ">=", "+=", "-=", "*=", "/=", "%=", "**", "//", "->", ":=", "<<", ">>"];
  const ONE = "+-*/%<>=()[]{},:.;@&|^~";
  const NAME = /[A-Za-z_]\w*/y;
  const NUM = /(?:\d[\d_]*(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/y;
  const PREFIX = /^(?:[rRbBfFuU]|[rR][bBfF]|[bBfF][rR])$/;
  const ESC = { n: "\n", t: "\t", "\\": "\\", "'": "'", '"': '"' };
  const unesc = (s) => s.replace(/\\(.)/g, (m, c) => (c in ESC ? ESC[c] : m));

  function lex(src) {
    src = src.replace(/\r\n?/g, "\n");
    const T = [],
      trail = {},
      stack = [0];
    let i = 0,
      ln = 1,
      depth = 0,
      bol = true;
    const push = (t, v, s, extra) =>
      T.push(Object.assign({ t, v, ln, s, e: i }, extra));

    const readString = (prefix, start) => {
      const q = src[i],
        triple = src.substr(i, 3) === q.repeat(3),
        ln0 = ln,
        raw = /r/i.test(prefix),
        isF = /f/i.test(prefix);
      i += triple ? 3 : 1;
      let body = "";
      for (;;) {
        if (i >= src.length)
          throw pe(ln0, "This text is never closed – it needs a closing " + q);
        const ch = src[i];
        if (ch === "\\" && i + 1 < src.length) {
          body += ch + src[i + 1];
          if (src[i + 1] === "\n") ln++;
          i += 2;
          continue;
        }
        if (triple ? src.substr(i, 3) === q.repeat(3) : ch === q) {
          i += triple ? 3 : 1;
          break;
        }
        if (ch === "\n") {
          if (!triple)
            throw pe(ln0, "This text is never closed – it needs a closing " + q);
          ln++;
        }
        body += ch;
        i++;
      }
      T.push({
        t: isF ? "fstr" : "str",
        v: isF || raw ? body : unesc(body),
        raw,
        ln: ln0,
        s: start,
        e: i,
      });
    };

    while (i < src.length) {
      if (bol && depth === 0) {
        let j = i,
          w = 0;
        while (src[j] === " " || src[j] === "\t") w += src[j++] === "\t" ? 4 : 1;
        if (j >= src.length) {
          i = j;
          break;
        }
        if (src[j] === "\n") {
          i = j + 1;
          ln++;
          continue;
        }
        if (src[j] === "#") {
          let k = j;
          while (k < src.length && src[k] !== "\n") k++;
          T.push({ t: "comment", v: src.slice(j + 1, k).trim(), ln, s: j, e: k });
          i = k;
          continue;
        }
        bol = false;
        i = j;
        const top = stack[stack.length - 1];
        if (w > top) {
          stack.push(w);
          push("indent");
        } else if (w < top) {
          while (w < stack[stack.length - 1]) {
            stack.pop();
            push("dedent");
          }
          if (w !== stack[stack.length - 1])
            throw pe(ln, "The indentation does not line up with any earlier line");
        }
      }
      const c = src[i];
      if (c === "\n") {
        if (depth === 0) {
          push("nl");
          bol = true;
        }
        ln++;
        i++;
        continue;
      }
      if (c === " " || c === "\t") {
        i++;
        continue;
      }
      if (c === "\\" && src[i + 1] === "\n") {
        i += 2;
        ln++;
        continue;
      }
      if (c === "#") {
        let k = i;
        while (k < src.length && src[k] !== "\n") k++;
        trail[ln] = src.slice(i + 1, k).trim();
        i = k;
        continue;
      }
      if (c === '"' || c === "'") {
        readString("", i);
        continue;
      }
      const s = i;
      NAME.lastIndex = i;
      let m = NAME.exec(src);
      if (m) {
        i = NAME.lastIndex;
        if (PREFIX.test(m[0]) && (src[i] === '"' || src[i] === "'")) {
          readString(m[0], s);
          continue;
        }
        push("name", m[0], s);
        continue;
      }
      if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] || ""))) {
        NUM.lastIndex = i;
        m = NUM.exec(src);
        i = NUM.lastIndex;
        const txt = m[0].replace(/_/g, "");
        push("num", Number(txt), s, { f: /[.eE]/.test(txt) });
        continue;
      }
      const o =
        OPS3.find((x) => src.startsWith(x, i)) ||
        OPS2.find((x) => src.startsWith(x, i));
      if (o) {
        i += o.length;
        push("op", o, s);
        continue;
      }
      if (ONE.includes(c)) {
        i++;
        if ("([{".includes(c)) depth++;
        else if (")]}".includes(c)) depth = Math.max(0, depth - 1);
        push("op", c, s);
        continue;
      }
      throw pe(ln, "Unexpected character " + c);
    }
    if (T.length && T[T.length - 1].t !== "nl") push("nl");
    while (stack.length > 1) {
      stack.pop();
      push("dedent");
    }
    push("eof");
    return { T, trail };
  }

  const show = (t) =>
    t.t === "eof" ? "the end of the program" : t.t === "nl" ? "the end of the line" : t.t === "str" ? '"' + t.v + '"' : String(t.v);
  const NOPE = {
    try: "error handling (try/except)",
    class: "classes",
    with: "with blocks",
    async: "async code",
    del: "del",
    assert: "assert",
    raise: "raise",
    yield: "yield",
    nonlocal: "nonlocal",
    lambda: "lambda functions",
  };

  function mk(T, trail) {
    let p = 0,
      last = 1;
    const isOp = (v) => T[p].t === "op" && T[p].v === v;
    const isKw = (v) => T[p].t === "name" && T[p].v === v;
    const next = () => {
      const t = T[p++];
      if (t.t !== "nl" && t.t !== "indent" && t.t !== "dedent" && t.t !== "eof") last = t.ln;
      return t;
    };
    const err = (m, ln) => {
      throw pe(ln || T[p].ln, m);
    };
    const eatOp = (v) => isOp(v) && next();
    const needOp = (v, why) => {
      if (!eatOp(v)) err("Expected " + v + (why ? " " + why : "") + " but found " + show(T[p]));
    };
    const ident = () => {
      if (T[p].t !== "name" || KWS.has(T[p].v)) err("Expected a name but found " + show(T[p]));
      return next().v;
    };

    const expr = () => ternary();
    function ternary() {
      const a = orTest();
      if (isKw("if")) {
        next();
        const c = orTest();
        if (!isKw("else")) err("Expected else in this one-line if … else … expression");
        next();
        return { t: "ifexp", c, a, b: ternary() };
      }
      return a;
    }
    function orTest() {
      let l = andTest();
      while (isKw("or")) {
        next();
        l = { t: "or", l, r: andTest() };
      }
      return l;
    }
    function andTest() {
      let l = notTest();
      while (isKw("and")) {
        next();
        l = { t: "and", l, r: notTest() };
      }
      return l;
    }
    function notTest() {
      if (isKw("not")) {
        next();
        return { t: "not", e: notTest() };
      }
      return cmp();
    }
    const CMP = ["<", ">", "<=", ">=", "==", "!="];
    function cmp() {
      const ex = [arith()],
        ops = [];
      for (;;) {
        let op;
        if (T[p].t === "op" && CMP.includes(T[p].v)) op = next().v;
        else if (isKw("in")) {
          next();
          op = "in";
        } else if (isKw("not") && T[p + 1].t === "name" && T[p + 1].v === "in") {
          next();
          next();
          op = "not in";
        } else if (isKw("is")) {
          next();
          if (isKw("not")) {
            next();
            op = "is not";
          } else op = "is";
        } else break;
        ops.push(op);
        ex.push(arith());
      }
      return ops.length ? { t: "cmp", ops, ex } : ex[0];
    }
    function arith() {
      let l = term();
      while (T[p].t === "op" && (T[p].v === "+" || T[p].v === "-")) {
        const op = next().v;
        l = { t: "bin", op, l, r: term() };
      }
      return l;
    }
    function term() {
      let l = factor();
      while (T[p].t === "op" && ["*", "/", "//", "%"].includes(T[p].v)) {
        const op = next().v;
        l = { t: "bin", op, l, r: factor() };
      }
      return l;
    }
    function factor() {
      if (T[p].t === "op" && (T[p].v === "-" || T[p].v === "+")) {
        const op = next().v;
        const e = factor();
        return op === "-" ? { t: "neg", e } : e;
      }
      const b = postfix();
      if (isOp("**")) {
        next();
        return { t: "bin", op: "**", l: b, r: factor() };
      }
      return b;
    }
    function postfix() {
      let e = atom();
      for (;;) {
        if (isOp("(")) {
          next();
          e = Object.assign({ t: "call", f: e }, callArgs());
        } else if (isOp("[")) {
          next();
          e = subscript(e);
        } else if (isOp(".")) {
          next();
          if (T[p].t !== "name") err("Expected a name after the dot");
          e = { t: "attr", o: e, n: next().v };
        } else break;
      }
      return e;
    }
    function callArgs() {
      const args = [],
        kw = {};
      while (!isOp(")")) {
        if (isOp("*") || isOp("**")) err("Argument unpacking (*args) is not supported");
        if (T[p].t === "name" && T[p + 1].t === "op" && T[p + 1].v === "=") {
          const k = next().v;
          next();
          kw[k] = expr();
        } else {
          args.push(expr());
          if (isKw("for")) err("Generator expressions are not supported – write a loop instead");
        }
        if (!eatOp(",")) break;
      }
      needOp(")");
      return { args, kw };
    }
    function subscript(o) {
      let a = null,
        b = null,
        sl = false;
      if (!isOp(":")) a = expr();
      if (isOp(":")) {
        next();
        sl = true;
        if (!isOp("]") && !isOp(":")) b = expr();
        if (isOp(":")) err("Slices with a step are not supported");
      }
      if (isOp(",")) err("Write a[i][j] for a 2D list, not a[i, j]");
      needOp("]");
      return sl ? { t: "slice", o, a, b } : { t: "sub", o, i: a };
    }
    function fstring(t) {
      const s = t.v,
        parts = [];
      let lit = "",
        i = 0;
      const flush = () => {
        if (lit) parts.push({ s: t.raw ? lit : unesc(lit) });
        lit = "";
      };
      while (i < s.length) {
        const c = s[i];
        if (c === "{" && s[i + 1] === "{") {
          lit += "{";
          i += 2;
        } else if (c === "}" && s[i + 1] === "}") {
          lit += "}";
          i += 2;
        } else if (c === "{") {
          flush();
          let d = 0,
            j = i + 1,
            q = null,
            spec = -1,
            end = -1;
          for (; j < s.length; j++) {
            const ch = s[j];
            if (q) {
              if (ch === q) q = null;
            } else if (ch === '"' || ch === "'") q = ch;
            else if ("([{".includes(ch)) d++;
            else if (")]".includes(ch)) d--;
            else if (ch === "}") {
              if (d === 0) {
                end = j;
                break;
              }
              d--;
            } else if (ch === ":" && d === 0 && spec < 0) spec = j;
          }
          if (end < 0) err("This f-string has a { without a matching }", t.ln);
          const exprText = (spec >= 0 ? s.slice(i + 1, spec) : s.slice(i + 1, end)).replace(/![rsa]$/, "").trim();
          if (!exprText) err("This f-string has an empty { }", t.ln);
          parts.push({
            e: parseExprText(exprText, t.ln),
            spec: spec >= 0 ? s.slice(spec + 1, end) : "",
          });
          i = end + 1;
        } else {
          lit += c;
          i++;
        }
      }
      flush();
      return { t: "fstr", parts };
    }
    function atom() {
      const t = T[p];
      if (t.t === "num") {
        next();
        return { t: "num", v: t.v, f: t.f };
      }
      if (t.t === "str") {
        next();
        let s = t.v;
        while (T[p].t === "str") s += next().v;
        return { t: "str", v: s };
      }
      if (t.t === "fstr") {
        next();
        return fstring(t);
      }
      if (t.t === "name") {
        if (t.v === "True" || t.v === "False") {
          next();
          return { t: "bool", v: t.v === "True" };
        }
        if (t.v === "None") {
          next();
          return { t: "none" };
        }
        if (NOPE[t.v]) err("Python’s " + NOPE[t.v] + " is not supported by this converter");
        if (!KWS.has(t.v)) {
          next();
          return { t: "name", n: t.v };
        }
      }
      if (isOp("(")) {
        next();
        if (eatOp(")")) return { t: "tuple", items: [] };
        const first = expr();
        if (isKw("for")) err("Generator expressions are not supported – write a loop instead");
        if (isOp(",")) {
          const items = [first];
          while (eatOp(",")) {
            if (isOp(")")) break;
            items.push(expr());
          }
          needOp(")");
          return { t: "tuple", items };
        }
        needOp(")");
        return first;
      }
      if (isOp("[")) {
        next();
        const items = [];
        while (!isOp("]")) {
          items.push(expr());
          if (isKw("for")) err("List comprehensions are not supported – write a loop instead");
          if (!eatOp(",")) break;
        }
        needOp("]");
        return { t: "list", items };
      }
      if (isOp("{")) err("Dictionaries and sets are not supported");
      err("Expected a value but found " + show(t));
    }
    const exprList = () => {
      const first = expr();
      if (!isOp(",")) return first;
      const items = [first];
      while (eatOp(",")) {
        if (T[p].t === "nl" || isOp("=")) break;
        items.push(expr());
      }
      return { t: "tuple", items };
    };

    const annName = (e) => (e.t === "name" ? e.n : e.t === "sub" && e.o.t === "name" ? e.o.n : null);
    function comment() {
      const t = next();
      return { k: "comment", ln: t.ln, text: t.v };
    }
    function block() {
      if (T[p].t === "nl") {
        next();
        const body = [];
        while (T[p].t === "comment") body.push(comment());
        if (T[p].t !== "indent") err("Expected an indented block here");
        next();
        while (T[p].t !== "dedent" && T[p].t !== "eof") body.push(...stmt());
        if (T[p].t === "dedent") next();
        return body;
      }
      return simpleLine();
    }
    function ifStmt() {
      const ln = next().ln;
      const c = expr();
      needOp(":", "after the condition");
      const node = { k: "if", ln, c, body: block(), orelse: [], eln: null };
      if (isKw("elif")) {
        const e = ifStmt();
        e.elif = true;
        node.orelse = [e];
      } else if (isKw("else")) {
        node.eln = T[p].ln;
        next();
        needOp(":");
        node.orelse = block();
      }
      node.end = last;
      return node;
    }
    function targets() {
      const first = postfix();
      if (!isOp(",")) return first;
      const items = [first];
      while (eatOp(",")) items.push(postfix());
      return { t: "tuple", items };
    }
    function stmt() {
      const t = T[p];
      if (t.t === "comment") return [comment()];
      if (t.t === "nl") {
        next();
        return [];
      }
      if (t.t === "indent") err("Unexpected indentation");
      if (t.t === "name") {
        const ln = t.ln;
        if (t.v === "if") return [ifStmt()];
        if (t.v === "while") {
          next();
          const c = expr();
          needOp(":", "after the condition");
          const body = block();
          if (isKw("else")) err("while … else is not supported");
          return [{ k: "while", ln, c, body, end: last }];
        }
        if (t.v === "for") {
          next();
          const target = targets();
          if (!isKw("in")) err("Expected in but found " + show(T[p]));
          next();
          const iter = exprList();
          needOp(":", "after the loop header");
          const body = block();
          if (isKw("else")) err("for … else is not supported");
          return [{ k: "for", ln, target, iter, body, end: last }];
        }
        if (t.v === "def") {
          next();
          const n = ident(),
            ps = [];
          needOp("(");
          while (!isOp(")")) {
            if (isOp("*") || isOp("**")) err("*args and **kwargs are not supported");
            const pn = ident();
            let ann = null,
              def = null;
            if (eatOp(":")) ann = annName(expr());
            if (eatOp("=")) def = expr();
            ps.push({ n: pn, ann, def });
            if (!eatOp(",")) break;
          }
          needOp(")");
          let ret = null;
          if (eatOp("->")) ret = annName(expr());
          needOp(":");
          const body = block();
          return [{ k: "def", ln, n, ps, ret, body, end: last }];
        }
        if (NOPE[t.v] && t.v !== "lambda")
          err("Python’s " + NOPE[t.v] + " is not supported by this converter");
      }
      return simpleLine();
    }
    function simpleLine() {
      const out = [];
      for (;;) {
        out.push(simple());
        if (!eatOp(";")) break;
        if (T[p].t === "nl") break;
      }
      if (T[p].t === "nl") next();
      else if (T[p].t !== "eof") err("Unexpected " + show(T[p]));
      out.forEach((n) => (n.end = last));
      return out;
    }
    const dotted = () => {
      let s = ident();
      while (eatOp(".")) s += "." + ident();
      return s;
    };
    function simple() {
      const t = T[p],
        ln = t.ln;
      if (t.t === "name") {
        switch (t.v) {
          case "pass":
            next();
            return { k: "pass", ln };
          case "break":
          case "continue":
            next();
            return { k: t.v, ln };
          case "return": {
            next();
            const e = T[p].t === "nl" || isOp(";") || T[p].t === "eof" ? null : exprList();
            return { k: "return", ln, e };
          }
          case "import": {
            next();
            const mods = [];
            do {
              mods.push(dotted());
              if (isKw("as")) {
                next();
                ident();
              }
            } while (eatOp(","));
            return { k: "import", ln, mods };
          }
          case "from": {
            next();
            const mods = [dotted()];
            if (!isKw("import")) err("Expected import but found " + show(T[p]));
            next();
            do {
              if (isOp("*")) next();
              else ident();
              if (isKw("as")) {
                next();
                ident();
              }
            } while (eatOp(","));
            return { k: "import", ln, mods };
          }
          case "global": {
            next();
            const ns = [ident()];
            while (eatOp(",")) ns.push(ident());
            return { k: "global", ln, ns };
          }
        }
        if (NOPE[t.v]) err("Python’s " + NOPE[t.v] + " is not supported by this converter");
      }
      const first = exprList();
      if (isOp(":")) {
        next();
        const ann = annName(expr());
        const value = eatOp("=") ? exprList() : null;
        return { k: "assign", ln, targets: [first], value, ann };
      }
      if (T[p].t === "op" && /^(\+|-|\*|\/|\/\/|%|\*\*)=$/.test(T[p].v)) {
        const op = next().v.slice(0, -1);
        return { k: "aug", ln, target: first, op, value: exprList() };
      }
      if (isOp("=")) {
        const tg = [first];
        let value = null;
        while (eatOp("=")) {
          value = exprList();
          if (isOp("=")) tg.push(value);
        }
        return { k: "assign", ln, targets: tg, value };
      }
      return { k: "expr", ln, e: first };
    }
    function program() {
      const body = [];
      while (T[p].t !== "eof") body.push(...stmt());
      return body;
    }
    return { program, expr };
  }

  function parseExprText(text, ln) {
    const { T } = lex(text);
    T.forEach((x) => (x.ln = ln));
    return mk(T, {}).expr();
  }

  function parse(src) {
    const { T, trail } = lex(src);
    return { body: mk(T, trail).program(), trail };
  }

  return { parse, lex };
})();
