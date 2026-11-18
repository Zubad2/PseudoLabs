const hl = (() => {
  const TYPES = new Set(["INTEGER", "REAL", "STRING", "CHAR", "BOOLEAN"]);
  const FLOW = new Set("IF THEN ELSE ELSEIF ENDIF CASE OF OTHERWISE ENDCASE FOR TO STEP NEXT WHILE DO ENDWHILE REPEAT UNTIL PROCEDURE ENDPROCEDURE FUNCTION ENDFUNCTION RETURNS RETURN CALL FOREACH IN SWAP".split(" "));
  const IO = new Set(["INPUT", "OUTPUT", "PRINT"]);
  const DECL = new Set(["DECLARE", "CONSTANT", "ARRAY"]);
  const LOGIC = new Set(["AND", "OR", "NOT", "DIV", "MOD"]);
  const CONST = new Set(["TRUE", "FALSE"]);
  const TOKEN =
    /(^[ \t]*\d+(?=[ \t]+[^\s:]))|(\/\/[^\n]*)|("[^"\n]*"|'[^'\n]*'|“[^”\n]*”|‘[^’\n]*’)|(["'“‘][^\n]*)|(==|!=|:=|#[^\n]*)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)|(←|<-|<>|<=|>=|[≠≤≥−–×÷]|[-+*\/]=|[-+*\/^&=<>:()\[\],])|([{};!%.?@$\\|~`])/gm;

  function html(source, lenient) {
    const user = new Set();
    source.replace(/\b(?:PROCEDURE|FUNCTION)\s+([A-Za-z_]\w*)/gi, (m, n) => user.add(n.toUpperCase()));
    let out = "", last = 0, m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(source))) {
      if (m[0] === "") { TOKEN.lastIndex++; continue; }
      out += esc(source.slice(last, m.index));
      last = TOKEN.lastIndex;
      const t = m[0], u = t.toUpperCase();
      let cls = "";
      if (m[1]) cls = "ln";
      else if (m[2]) cls = "cm";
      else if (m[3]) cls = "st";
      else if (m[4]) cls = lenient ? "st" : "bad";
      else if (m[5]) cls = "bad";
      else if (m[6]) cls = "nu";
      else if (m[7])
        cls = FLOW.has(u) ? "kw" : IO.has(u) ? "io" : DECL.has(u) ? "dc" : LOGIC.has(u) ? "lg" : CONST.has(u) ? "cn" : TYPES.has(u) ? "ty" : user.has(u) ? "ud" : Object.hasOwn(B, u) ? "fn" : "";
      else if (m[8]) cls = "op";
      else cls = "bad";
      out += cls ? '<span class="' + cls + '">' + esc(t) + "</span>" : esc(t);
    }
    return out + esc(source.slice(last)) + "\n";
  }

  const PYKW = new Set("False None True and as break class continue def elif else for from global if import in is not or pass return while".split(" "));
  const PYFN = new Set("print input len int float str range abs round max min sum ord chr".split(" "));
  const PYTOK = /(#[^\n]*)|((?:[rRbBfFuU]{1,2})?(?:"[^"\n]*"|'[^'\n]*'))|(\b\d[\d_]*(?:\.\d+)?\b)|([A-Za-z_]\w*)|([-+*\/%^&=<>!:]+)/g;
  function py(source) {
    let out = "", last = 0, m;
    PYTOK.lastIndex = 0;
    while ((m = PYTOK.exec(source))) {
      out += esc(source.slice(last, m.index));
      last = PYTOK.lastIndex;
      const t = m[0];
      const cls = m[1] ? "cm" : m[2] ? "st" : m[3] ? "nu" : m[4] ? (PYKW.has(t) ? "kw" : PYFN.has(t) ? "fn" : "") : "op";
      out += cls ? '<span class="' + cls + '">' + esc(t) + "</span>" : esc(t);
    }
    return out + esc(source.slice(last)) + "\n";
  }

  return { html, py };
})();
