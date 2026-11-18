const flat = (a) => a.flatMap((x) => (x && x.arr ? [...x.d.values()] : [x]));
const byKey = (p, q) => p.localeCompare(q, undefined, { numeric: true });
const values = (a, name) => {
  const v = flat(a).map((x) => num(x));
  if (!v.length) throw er(name + " needs at least one value");
  return v;
};
const needArray = (a, name) => {
  if (!a || !a.arr) throw er(name + " needs an array");
  return a;
};

Object.assign(B, {
  LENGTH: (s) => (s && s.arr ? s.d.size : String(s).length),
  LEN: (s) => (s && s.arr ? s.d.size : String(s).length),
  SIZE: (a) => needArray(a, "SIZE").d.size,
  ABS: (x) => Math.abs(num(x)),
  SQRT: (x) => {
    if (num(x) < 0)
      throw er("Cannot take the square root of a negative number");
    return Math.sqrt(x);
  },
  MAX: (...a) => Math.max(...values(a, "MAX")),
  MIN: (...a) => Math.min(...values(a, "MIN")),
  SUM: (...a) => flat(a).reduce((t, x) => t + num(x), 0),
  SORT: (a) => {
    needArray(a, "SORT");
    const keys = [...a.d.keys()].sort(byKey);
    const vals = keys
      .map((k) => a.d.get(k))
      .sort((p, q) => (p < q ? -1 : p > q ? 1 : 0));
    keys.forEach((k, i) => a.d.set(k, vals[i]));
  },
  CONTAINS: (s, t) => String(s).includes(String(t)),
  INDEXOF: (s, t) => String(s).indexOf(String(t)) + 1,
});

const noArr = (v) => {
  if (v && v.arr)
    throw er("Cannot output a whole array – use an index such as Name[1]");
  return v;
};

Object.assign(B, {
  SIN: (x) => Math.sin(num(x)),
  COS: (x) => Math.cos(num(x)),
  PI: () => Math.PI,
  FLOOR: (x) => Math.floor(num(x)),
  CEIL: (x) => Math.ceil(num(x)),
  RANDOMINT: (a, b) => {
    if (!Number.isInteger(num(a)) || !Number.isInteger(num(b)) || a > b)
      throw er("RANDOMINT needs two whole numbers, lowest first");
    return a + Math.floor(Math.random() * (b - a + 1));
  },
  ASC: (c) => {
    if (!String(c).length) throw er("ASC needs a character, but the text is empty");
    return String(c).charCodeAt(0);
  },
  CHR: (n) => {
    if (!Number.isInteger(num(n)) || n < 0 || n > 65535)
      throw er("CHR needs a whole number from 0 to 65535");
    return String.fromCharCode(n);
  },
});
