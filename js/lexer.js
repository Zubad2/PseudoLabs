const KW = new Set(
  "DECLARE CONSTANT ARRAY OF INPUT OUTPUT PRINT IF THEN ELSE ENDIF CASE OTHERWISE ENDCASE FOR TO STEP NEXT WHILE DO ENDWHILE REPEAT UNTIL PROCEDURE ENDPROCEDURE FUNCTION ENDFUNCTION RETURNS RETURN CALL AND OR NOT DIV MOD TRUE FALSE ELSEIF SWAP FOREACH IN".split(
    " ",
  ),
);
const pe = (l, m) => new Error("Line " + l + ": " + m);
let cur = 0;
const er = (m) => new Error("Line " + cur + ": " + m);

const OPMAP = {
  "<-": "←",
  "≠": "<>",
  "≤": "<=",
  "≥": ">=",
  "−": "-",
  "–": "-",
  "×": "*",
  "÷": "/",
};
const PYOPS = {
  "==": "Use a single = to compare values in pseudocode (== is Python)",
  "!=": "Use <> for “not equal” in pseudocode (!= is Python)",
  ":=": "Use ← to assign a value in pseudocode (:= is not used)",
};
const BADCHAR = {
  "#": "Comments start with //, not #",
  "{": "Curly brackets are not used in pseudocode",
  "}": "Curly brackets are not used in pseudocode",
  ";": "Pseudocode does not use semicolons – put each statement on its own line",
  "!": "Use NOT for “not”, and <> for “not equal”",
  "%": "Use MOD for the remainder (for example 9 MOD 4)",
  ".": "Dots are only used inside numbers – pseudocode has no methods like text.upper()",
};

function lex(s) {
  s = s.replace(/^[ \t]*\d+[ \t]+(?=[^\s:])/gm, "");
  const T = [];
  let i = 0,
    ln = 1;
  const R =
    /("[^"\n]*"|'[^'\n]*'|“[^”\n]*”|‘[^’\n]*’)|(\d+(?:\.\d+)?)|([A-Za-z_]\w*)|(←|<-|<>|<=|>=|==|!=|:=|[≠≤≥−–×÷]|[-+*\/]=|[-+*\/^&=<>()\[\],:])/y;
  while (i < s.length) {
    const c = s[i];
    if (c == "\n") {
      ln++;
      i++;
      continue;
    }
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c == "/" && s[i + 1] == "/") {
      while (i < s.length && s[i] != "\n") i++;
      continue;
    }
    R.lastIndex = i;
    const m = R.exec(s);
    if (!m) {
      if (/["'“‘]/.test(c))
        throw pe(ln, "This piece of text is missing its closing quote");
      throw pe(ln, BADCHAR[c] || "Unexpected character " + c);
    }
    i = R.lastIndex;
    if (m[1]) T.push({ t: "s", v: m[1].slice(1, -1), ln });
    else if (m[2]) T.push({ t: "n", v: +m[2], ln });
    else if (m[3]) {
      const u = m[3].toUpperCase();
      T.push(KW.has(u) ? { t: "k", v: u, ln } : { t: "i", v: m[3], ln });
    } else {
      if (PYOPS[m[4]]) throw pe(ln, PYOPS[m[4]]);
      T.push({ t: "o", v: OPMAP[m[4]] || m[4], ln });
    }
  }
  T.push({ t: "e", v: "EOF", ln });
  return T;
}
