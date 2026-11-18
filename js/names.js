const names = (() => {
  const PY_RESERVED = new Set(
    ("False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield " +
      "abs all any bool chr dict float input int len list map math max min ord print random range round set sorted str sum type").split(" "),
  );
  const PS_TYPES = ["INTEGER", "REAL", "STRING", "CHAR", "BOOLEAN"];

  const snake = (n, isConst) => {
    const s = n
      .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
      .toLowerCase();
    if (isConst) return s.toUpperCase();
    return PY_RESERVED.has(s) ? s + "_" : s;
  };

  const pascal = (n) => {
    const allCaps = /^[A-Z0-9_]+$/.test(n);
    const words = n.split("_").filter(Boolean);
    let s =
      words
        .map((w) => (allCaps ? w.toLowerCase() : w))
        .map((w) => w[0].toUpperCase() + w.slice(1))
        .join("") || "Unused";
    if (/^\d/.test(s)) s = "N" + s;
    const u = s.toUpperCase();
    if (KW.has(u) || Object.hasOwn(B, u) || PS_TYPES.includes(u)) s += "Value";
    return s;
  };

  return { snake, pascal };
})();
