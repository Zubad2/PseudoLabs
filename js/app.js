const editor = $("code");
const LINE_HEIGHT = 21.6;
const STORE = "pseudolab.program";
const OPENERS = /^(FOR|FOREACH|WHILE|REPEAT|CASE|PROCEDURE|FUNCTION)\b/i;

let marker = null;
let stepResolve = null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function persist() {
  try {
    localStorage.setItem(STORE, editor.value);
  } catch (e) {
    return;
  }
}

function placeMarker() {
  const el = $("curline");
  el.hidden = !marker;
  if (!marker) return;
  el.className = "curline " + marker.kind;
  el.style.top = 10 + (marker.line - 1) * LINE_HEIGHT - editor.scrollTop + "px";
}

function markLine(line, kind, quiet) {
  marker = line ? { line, kind: kind || "cur" } : null;
  if (marker && !quiet) {
    const y = (line - 1) * LINE_HEIGHT;
    if (
      y < editor.scrollTop ||
      y + LINE_HEIGHT > editor.scrollTop + editor.clientHeight - 24
    ) {
      editor.scrollTop = Math.max(0, y - 80);
    }
  }
  placeMarker();
}

let lintTimer = 0;
function lint() {
  if (running) return;
  try {
    parse(lex(editor.value));
    if (marker && (marker.kind === "warn" || marker.kind === "error")) markLine(0);
    setStatus(editor.value.trim() ? "Syntax OK" : "Ready");
  } catch (e) {
    const at = /^Line (\d+):/.exec(e.message);
    markLine(at ? +at[1] : 0, "warn", true);
    setStatus("⚠ " + e.message);
  }
}
const scheduleLint = () => {
  clearTimeout(lintTimer);
  lintTimer = setTimeout(lint, 400);
};

function syncEditor() {
  const value = editor.value;
  $("hl").innerHTML = hl.html(value);
  const count = value.split("\n").length;
  $("gutter").textContent =
    Array.from({ length: count }, (_, i) => i + 1).join("\n") + "\n";
  placeMarker();
}

function showPosition() {
  const before = editor.value.slice(0, editor.selectionStart).split("\n");
  $("pos").textContent =
    "Ln " + before.length + ", Col " + (before[before.length - 1].length + 1);
}

function setCode(code, inputs) {
  $("ex").value = "own";
  editor.value = code;
  $("auto").value = inputs || "";
  markLine(0);
  syncEditor();
  showPosition();
  persist();
  scheduleLint();
}

function setStatus(text) {
  $("status").textContent = text;
}

function tab(name) {
  document.querySelectorAll(".tabs button").forEach((b) => {
    b.classList.toggle("on", b.dataset.t === name);
    b.setAttribute("aria-selected", b.dataset.t === name);
  });
  document
    .querySelectorAll(".pane")
    .forEach((p) => p.classList.toggle("hid", p.dataset.t !== name));
}

function setBusy(on) {
  $("run").disabled = on;
  $("stop").disabled = !on;
  if (!on) $("next").disabled = true;
}

function showError(message) {
  const span = document.createElement("span");
  span.className = "err";
  span.textContent = "\n✖ " + message;
  $("out").append(span);
  const at = /^Line (\d+):/.exec(message);
  if (at) markLine(+at[1], "error");
}

function renderVars() {
  if (!G) return;
  let html = "<table><tr><th>Name</th><th>Type</th><th>Value</th></tr>";
  for (const [name, v] of G.v) {
    if (v && v.arr) {
      const items = [...v.d.entries()]
        .sort((a, b) => byKey(a[0], b[0]))
        .map(([i, x]) => i + " = " + fmt(x))
        .join("   ");
      const bounds = v.dm.map((d) => d.join(":")).join(",");
      html +=
        "<tr><td>" +
        esc(name) +
        "</td><td>" +
        esc(v.ty) +
        " array [" +
        bounds +
        "]</td><td>" +
        esc(items) +
        "</td></tr>";
    } else {
      const type = G.t.get(name) || (G.c.has(name) ? "constant" : "");
      html +=
        "<tr><td>" +
        esc(name) +
        "</td><td>" +
        esc(type) +
        "</td><td>" +
        (v === undefined ? "–" : esc(show(v))) +
        "</td></tr>";
    }
  }
  $("vars").innerHTML = html + "</table>";
}

async function stepHook(line) {
  markLine(line);
  renderVars();
  const mode = $("speed").value;
  if (mode === "step") {
    setStatus("Paused at line " + line);
    $("next").disabled = false;
    await new Promise((r) => {
      stepResolve = r;
    });
    $("next").disabled = true;
    setStatus("Running");
  } else {
    await sleep(+mode);
  }
}

function nextStep() {
  if (!stepResolve) return;
  const resume = stepResolve;
  stepResolve = null;
  resume();
}

async function run() {
  if (running) return;
  running = true;
  halt = false;
  steps = 0;
  lines = 0;
  depth = 0;
  rows = [];
  $("out").textContent = "";
  $("inrow").hidden = true;
  const typed = $("auto").value.trim();
  auto = typed ? typed.split(",").map((s) => s.trim()) : [];
  G = mk();
  gfx.prep(480, 320);
  hook = $("speed").value === "0" ? null : stepHook;
  markLine(0);
  setBusy(true);
  setStatus("Running");
  tab("c");
  let ok = true;
  try {
    const program = parse(lex(editor.value));
    defs = {};
    program.forEach((n) => {
      if (n.k === "def") defs[n.n.toUpperCase()] = n;
    });
    await bl(program, G);
    print("\n— Program finished —");
  } catch (e) {
    ok = false;
    showError(e.message);
  }
  running = false;
  hook = null;
  pend = null;
  stepResolve = null;
  $("inrow").hidden = true;
  setBusy(false);
  if (ok) markLine(0);
  renderVars();
  renderTrace();
  setStatus(ok ? "Finished" : "Stopped with an error");
  if (ok && gfx.used) tab("g");
}

function stopRun() {
  halt = true;
  if (pend) {
    pend("");
    pend = null;
  }
  if (stepResolve) nextStep();
}

function submitInput() {
  if (!pend) return;
  const value = $("inp").value;
  $("inp").value = "";
  $("inrow").hidden = true;
  print("› " + value + "\n");
  const resolve = pend;
  pend = null;
  resolve(value);
}

let flowReady = false;

function makeFlowchart() {
  try {
    const source = editor.value;
    flow.draw(parse(lex(source)), source, $("flow"));
    flowReady = true;
    $("flowmsg").textContent = "Flowchart generated from the editor.";
  } catch (e) {
    $("flowmsg").textContent = e.message;
  }
}

function generatorParams() {
  const algo = algos[$("algo").value];
  $("algodesc").textContent = algo.desc;
  $("params").innerHTML = algo.params
    .map(
      (q) =>
        "<label>" +
        esc(q.l) +
        '<input type="number" data-k="' +
        q.k +
        '" value="' +
        q.v +
        '"></label>',
    )
    .join("");
}

function generate() {
  const algo = algos[$("algo").value];
  const p = {};
  document.querySelectorAll("#params input").forEach((i) => {
    p[i.dataset.k] = Math.floor(+i.value || 1);
  });
  setCode(algo.code(p), algo.inputs ? algo.inputs(p) : "");
}

function insertText(text) {
  if (!document.execCommand("insertText", false, text)) {
    editor.setRangeText(
      text,
      editor.selectionStart,
      editor.selectionEnd,
      "end",
    );
  }
  syncEditor();
  persist();
}

function indentAfter(line) {
  const t = line.trim();
  if (/^(IF|ELSEIF)\b/i.test(t)) return /THEN\s*$/i.test(t) || !/THEN/i.test(t);
  return /^(ELSE|THEN|OTHERWISE)$/i.test(t) || OPENERS.test(t);
}

function newLine() {
  const upto = editor.value.slice(0, editor.selectionStart);
  const line = upto.slice(upto.lastIndexOf("\n") + 1);
  const pad = line.match(/^ */)[0] + (indentAfter(line) ? "   " : "");
  insertText("\n" + pad);
}

const saveFile = () => saveText(editor.value, "program.psc");

function openFile() {
  const file = $("file").files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => setCode(String(reader.result), "");
  reader.readAsText(file);
  $("file").value = "";
}

$("run").onclick = run;
$("stop").onclick = stopRun;
$("next").onclick = nextStep;
$("go").onclick = submitInput;
$("inp").onkeydown = (e) => {
  if (e.key === "Enter") submitInput();
};
$("arrow").onclick = () => {
  editor.focus();
  insertText("←");
};
$("new").onclick = () => {
  setCode("", "");
  $("out").textContent = "";
  rows = [];
  renderTrace();
  editor.focus();
};
$("save").onclick = saveFile;
$("open").onclick = () => $("file").click();
$("file").onchange = openFile;
editor.oninput = () => {
  $("ex").value = "own";
  if (marker && marker.kind === "error") markLine(0);
  syncEditor();
  persist();
  scheduleLint();
};
editor.onclick = showPosition;
editor.onkeyup = showPosition;
editor.onscroll = () => {
  $("hl").scrollTop = editor.scrollTop;
  $("hl").scrollLeft = editor.scrollLeft;
  $("gutter").scrollTop = editor.scrollTop;
  placeMarker();
};
editor.onkeydown = (e) => {
  if (e.key === "Tab") {
    e.preventDefault();
    insertText("   ");
  } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    run();
  } else if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    newLine();
  }
};
document.onkeydown = (e) => {
  if (e.key === "F10") {
    e.preventDefault();
    nextStep();
  }
};
document.querySelectorAll(".tabs button").forEach((b) => {
  b.onclick = () => tab(b.dataset.t);
});
$("mkflow").onclick = makeFlowchart;
$("dlflow").onclick = () => {
  if (!flowReady) {
    $("flowmsg").textContent = "Generate a flowchart first.";
    return;
  }
  download($("flow"), "pseudolab-flowchart.png", { Title: "Flowchart" });
};
$("dlgfx").onclick = () =>
  download($("gfx"), "pseudolab-graphic.png", { Title: "Graphics canvas" });
$("algo").onchange = generatorParams;
$("gen").onclick = () => {
  generate();
  tab("c");
};
$("genrun").onclick = () => {
  generate();
  run();
};
$("ex").innerHTML =
  '<option value="own">Own code</option>' +
  EX.map((e, i) => '<option value="' + i + '">' + esc(e[0]) + "</option>").join("");
$("ex").onchange = () => {
  const pick = $("ex").value;
  if (pick === "own") return;
  const e = EX[pick];
  setCode(e[2], e[1]);
  $("ex").value = pick;
  $("out").textContent = "";
  rows = [];
  renderTrace();
};
$("algo").innerHTML = algos
  .map((a, i) => '<option value="' + i + '">' + esc(a.name) + "</option>")
  .join("");
$("pg").innerHTML = DOC.map(
  (d) =>
    "<section><h3>" +
    esc(d[0]) +
    "</h3><p>" +
    esc(d[1]) +
    "</p>" +
    (d[2] ? "<pre>" + esc(d[2]) + "</pre>" : "") +
    "</section>",
).join("");

gfx.init($("gfx"));
generatorParams();
let saved = null;
try {
  saved = localStorage.getItem(STORE);
} catch (e) {
  saved = null;
}
if (saved) setCode(saved, "");
else {
  setCode(EX[0][2], EX[0][1]);
  $("ex").value = "0";
}
