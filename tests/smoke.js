const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const scripts = [
  "util",
  "lexer",
  "parser",
  "interpreter",
  "builtins",
  "graphics",
  "flowchart",
  "trace",
  "highlight",
  "algorithms",
  "examples",
];
const elements = {};

global.document = {
  getElementById: (id) =>
    elements[id] ||
    (elements[id] = {
      t: "",
      append(s) {
        this.t += s.textContent !== undefined ? s.textContent : s;
      },
    }),
};

const source = scripts
  .map((f) => fs.readFileSync(path.join(root, "js", f + ".js"), "utf8"))
  .join("\n;\n");
const harness = fs.readFileSync(path.join(__dirname, "harness.js"), "utf8");
const { run, EX, algos } = vm.runInThisContext(
  source + "\n" + harness + "\n({ run, EX, algos })",
);

const defaults = (algo) =>
  Object.fromEntries(algo.params.map((q) => [q.k, q.v]));
const algo = (id) => algos.find((a) => a.id === id);
const fromAlgo = (id) => {
  const a = algo(id);
  const p = defaults(a);
  return [a.code(p), a.inputs ? a.inputs(p) : ""];
};

const expectations = [
  ["factorial", /6! = 720/],
  ["gcd", /GCD is 12/],
  ["prime", /97 is prime/],
  ["fibonacci", /21\n34/],
  ["linear", /Found at position 3/],
  ["binary", /Found at position 4/],
  ["bubble", /3\n7\n19\n42\n56\n88/],
  ["selection", /3\n7\n19\n42\n56\n88/],
  ["insertion", /3\n7\n19\n42\n56\n88/],
  ["total", /Total: 150\nAverage: 30/],
  ["extremes", /Largest: 88\nSmallest: 3/],
  ["reverse", /desserts/],
  ["palindrome", /Level is a palindrome/],
  ["vowels", /Vowels: 6/],
  ["caesar", /KHOOR ZRUOG/],
  ["grid", /5 10 15 20 25/],
];

let failed = 0;
const report = (name, pass, detail) => {
  if (!pass) failed++;
  console.log((pass ? "PASS " : "FAIL ") + name + (pass ? "" : " – " + detail));
};

(async () => {
  for (const [id, pattern] of expectations) {
    const [code, inputs] = fromAlgo(id);
    const r = await run(code, inputs);
    report(
      "algorithm " + id,
      r.ok && pattern.test(r.output),
      r.error || r.output,
    );
  }
  for (const [name, inputs, code] of EX) {
    const r = await run(code, inputs);
    const debug = name.startsWith("Debug me");
    report(
      "example " + name,
      debug ? !r.ok : r.ok,
      debug ? "expected an error" : r.error,
    );
  }
  const errors = [
    [
      "text stored in a REAL array",
      EX.find((e) => e[0].startsWith("Debug me: heights"))[2],
      /not a valid REAL/,
    ],
    [
      "index outside array",
      "DECLARE A : ARRAY[1:3] OF INTEGER\nA[4] ← 1",
      /outside A\[1:3\]/,
    ],
    ["division by zero", "OUTPUT 5 / 0", /Division by zero/],
    ["variable used before assignment", "OUTPUT Missing", /has no value yet/],
    ["error in a loop condition is reported on the loop line", "DECLARE X : INTEGER\nX ← 2\nWHILE 10 / (X - 1) > 0 DO\n   X ← X - 1\n   OUTPUT X\nENDWHILE", /^Line 3: Division by zero/],
    ["runaway recursion is stopped", "FUNCTION F(N : INTEGER) RETURNS INTEGER\n   RETURN F(N + 1)\nENDFUNCTION\nOUTPUT F(1)", /too many times/],
    ["parameter type is checked", "PROCEDURE P(N : INTEGER)\n   OUTPUT N\nENDPROCEDURE\nCALL P(\"x\")", /parameter N/],
    ["CHAR holds one character", "DECLARE C : CHAR\nC ← \"ab\"", /exactly one character/],
    ["MID start below 1", "OUTPUT MID(\"abc\", 0, 1)", /position 1/],
    ["wrong number of values", "OUTPUT LEFT(\"abc\")", /needs 2 value/],
    ["== is flagged", "IF 1 == 1 THEN\nENDIF", /single =/],
    ["Python def is flagged", "def f(x):", /PROCEDURE/],
    ["Python type name is flagged", "DECLARE X : int", /INTEGER/],
    ["unclosed IF names its own line", "OUTPUT 1\nIF 1 = 1\n   THEN\n      OUTPUT 2", /^Line 2: The IF on this line is never closed/],
    ["stray ENDIF", "OUTPUT 1\nENDIF", /no matching IF/],
    ["missing quote", "OUTPUT \"abc", /missing its closing quote/],
  ];
  for (const [name, code, pattern] of errors) {
    const r = await run(code, "Ann, 160, Bob, 152, Cy, 171");
    report(
      "error " + name,
      !r.ok && pattern.test(r.error),
      r.error || "no error",
    );
  }
  const values = [
    ["ROUND half away from zero", "OUTPUT ROUND(1.005, 2), \" \", ROUND(-2.5)", /^1\.01 -3/],
    ["FOR with a decimal STEP does not drift", "DECLARE X : REAL\nFOR X ← 0 TO 0.3 STEP 0.1\n   OUTPUT X\nNEXT X", /0\n0\.1\n0\.2\n0\.3/],
    ["numeric input rejects Infinity", "DECLARE N : REAL\nINPUT N", null],
  ];
  for (const [name, code, pattern] of values) {
    const r = await run(code, "Infinity");
    report("value " + name, pattern ? r.ok && pattern.test(r.output) : !r.ok, r.error || r.output);
  }
  console.log(failed ? failed + " failed" : "all passed");
  process.exit(failed ? 1 : 0);
})();
