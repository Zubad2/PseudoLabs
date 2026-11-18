const cv = (() => {
  let res = null, runId = 0, paused = false, gate = null, animating = false;
  const dir = () => $("cvdir").value;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const L = {
    py: { src: "Python", out: "Pseudocode", srcHl: (s) => hl.py(s), outHl: (s) => hl.html(s, true), conv: (s, o) => py2ps.convert(s, { exam: o }), opt: "Exam syntax only", file: "program.psc" },
    ps: { src: "Pseudocode", out: "Python", srcHl: (s) => hl.html(s), outHl: (s) => hl.py(s), conv: (s, o) => ps2py.convert(s, { short: o }), opt: "Python shortcuts (+=, elif)", file: "program.py" },
  };
  const cfg = () => L[dir()];
  const lines = (html) => html.split("\n").slice(0, -1);
  const row = (h, on) => '<div class="cvl' + (on ? " on" : "") + '">' + h + "</div>";

  function samples() {
    const list = dir() === "py"
      ? PY_SAMPLES.map(([n, , c]) => [n, c])
      : ["total", "linear", "bubble", "factorial", "vowels", "caesar", "menu"].map((id) => {
          const a = algos.find((x) => x.id === id);
          const p = Object.fromEntries(a.params.map((q) => [q.k, q.v]));
          return [a.name, a.code(p)];
        });
    $("cvsample").innerHTML = list.map((s, i) => '<option value="' + i + '">' + esc(s[0]) + "</option>").join("");
    $("cvsample").onchange = () => { setSrc(list[$("cvsample").value][1]); clear(); };
    return list;
  }
  function setDir(keepText) {
    const c = cfg(), list = samples();
    $("cvsrchead").textContent = c.src;
    $("cvouthead").textContent = c.out;
    $("cvoptl").textContent = c.opt;
    $("cvuse").hidden = dir() !== "py";
    if (!keepText) setSrc(list[0][1]);
    else sync();
    clear();
  }
  function clear() {
    stop();
    res = null;
    $("cvout").innerHTML = "";
    $("cvwarn").innerHTML = "";
    note("Press Convert for the result, or Animate to watch it being built line by line.");
  }
  function note(text, err) {
    $("cvnote").textContent = text;
    $("cvnote").className = "cvnote" + (err ? " err" : "");
  }
  function showOut(upTo, activeFrom) {
    const rows = res.steps.slice(0, upTo).flatMap((s) => s.out);
    const h = lines(cfg().outHl(rows.join("\n")));
    $("cvout").innerHTML = h.map((x, i) => row(x, activeFrom !== undefined && i >= activeFrom)).join("");
    $("cvout").scrollTop = 1e9;
  }
  function convertNow() {
    stop();
    try {
      res = cfg().conv($("cvsrc").value, $("cvopt").checked);
    } catch (e) {
      res = null;
      $("cvout").innerHTML = "";
      $("cvwarn").innerHTML = "";
      note(e.message, true);
      const at = /^Line (\d+):/.exec(e.message);
      if (at) $("cvsrc").dataset.err = at[1];
      return null;
    }
    warnings();
    return res;
  }
  function warnings() {
    $("cvwarn").innerHTML = res.warns.map((w) => "<li>" + esc(w) + "</li>").join("");
  }
  function go() {
    if (!convertNow()) return;
    showOut(res.steps.length);
    note(res.code ? "Converted " + res.code.split("\n").length + " lines." + (res.warns.length ? " See the notes below." : "") : "Nothing to convert yet.");
  }

  function sync() {
    const v = $("cvsrc").value;
    $("cvhl").innerHTML = cfg().srcHl(v);
    $("cvgut").textContent = Array.from({ length: v.split("\n").length }, (_, i) => i + 1).join("\n") + "\n";
  }
  function setSrc(v) {
    $("cvsrc").value = v;
    sync();
  }
  function ins(text) {
    const t = $("cvsrc");
    t.focus();
    if (!(document.execCommand && document.execCommand("insertText", false, text)))
      t.setRangeText(text, t.selectionStart, t.selectionEnd, "end");
    res = null;
    sync();
  }
  function del(from, to) {
    const t = $("cvsrc");
    t.setSelectionRange(from, to);
    if (!(document.execCommand && document.execCommand("delete")))
      t.setRangeText("", from, to, "end");
    res = null;
    sync();
  }
  function block(t, unit, back) {
    const v = t.value;
    const a = v.lastIndexOf("\n", t.selectionStart - 1) + 1;
    let b = v.indexOf("\n", t.selectionEnd);
    if (b < 0) b = v.length;
    const text = v.slice(a, b).split("\n").map((l) => {
      if (!back) return unit + l;
      let n = 0;
      while (n < unit.length && l[n] === " ") n++;
      return l.slice(n);
    }).join("\n");
    t.setRangeText(text, a, b, "select");
    res = null;
    sync();
  }
  const PAIRS = { "(": ")", "[": "]", "{": "}", '"': '"', "'": "'" };
  function keys(e) {
    const t = $("cvsrc"), py = dir() === "py", unit = py ? "    " : "   ";
    const v = t.value, s = t.selectionStart, en = t.selectionEnd;
    const ls = v.lastIndexOf("\n", s - 1) + 1, before = v.slice(ls, s), nextCh = v[s] || "";
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); go(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey || (s !== en && v.slice(s, en).includes("\n"))) block(t, unit, e.shiftKey);
      else ins(unit);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      let pad = before.match(/^ */)[0];
      if (py) {
        const code = before.replace(/#.*$/, "").trimEnd();
        if (code.endsWith(":")) pad += unit;
        else if (/^\s*(return|pass|break|continue|raise)\b/.test(before)) pad = pad.slice(0, Math.max(0, pad.length - 4));
      } else if (indentAfter(before)) pad += unit;
      ins("\n" + pad);
      return;
    }
    if (e.key === "Backspace" && s === en && s > 0) {
      if (PAIRS[v[s - 1]] && PAIRS[v[s - 1]] === nextCh) { e.preventDefault(); del(s - 1, s + 1); return; }
      if (py && /^ +$/.test(before)) { e.preventDefault(); del(s - (before.length % 4 || 4), s); return; }
    }
    if (e.key === ":" && py && s === en && /^\s{4,}(else|elif\b.*|except\b.*|finally)$/.test(before)) {
      e.preventDefault();
      ins(":");
      t.setRangeText("", ls, ls + 4, "preserve");
      sync();
      return;
    }
    if (s === en && Object.values(PAIRS).includes(e.key) && nextCh === e.key) { e.preventDefault(); t.setSelectionRange(s + 1, s + 1); return; }
    if (s === en && PAIRS[e.key] && !(/\w/.test(before.slice(-1)) && (e.key === '"' || e.key === "'"))) {
      e.preventDefault();
      ins(e.key + PAIRS[e.key]);
      t.setSelectionRange(s + 1, s + 1);
    }
  }

  const release = () => { if (gate) { const g = gate; gate = null; g(); } };
  const hold = () => new Promise((r) => { gate = r; });
  function ui(on) {
    animating = on;
    $("cvanim").disabled = false;
    $("cvpause").disabled = !on;
    $("cvfinish").disabled = !on;
    $("cvnext").disabled = !on;
    $("cvedit").classList.toggle("hid", on);
    $("cvview").classList.toggle("hid", !on);
    if (!on) paused = false;
    $("cvpause").textContent = "Pause";
  }
  function stop() { runId++; release(); ui(false); }
  function markSource(src) {
    const rows = $("cvview").children;
    [...rows].forEach((r) => r.classList.remove("on"));
    if (src === null || src === undefined) return;
    const [a, b] = Array.isArray(src) ? src : [src, src];
    for (let i = a; i <= b; i++) if (rows[i - 1]) rows[i - 1].classList.add("on");
    const first = rows[a - 1];
    if (first) $("cvview").scrollTop = Math.max(0, first.offsetTop - $("cvview").clientHeight / 2);
  }
  async function type(id, step, before) {
    const txt = step.out.join("\n"), chunk = Math.max(1, Math.ceil(txt.length / 40));
    for (let n = chunk; n < txt.length + chunk && runId === id; n += chunk) {
      const part = txt.slice(0, n);
      const base = res.steps.slice(0, before).flatMap((s) => s.out);
      const rows = lines(cfg().outHl(base.concat(part.split("\n")).join("\n")));
      $("cvout").innerHTML = rows.map((x, i) => row(x, i >= base.length)).join("");
      $("cvout").scrollTop = 1e9;
      await sleep(18);
    }
  }
  async function pause(id) {
    const mode = $("cvspeed").value;
    if (mode === "step") { await hold(); return; }
    for (let t = +mode; t > 0 && runId === id; t -= 50) {
      if (paused) await hold();
      await sleep(50);
    }
  }
  async function animate() {
    if (!convertNow()) return;
    const id = ++runId;
    release();
    const c = cfg();
    $("cvview").innerHTML = lines(c.srcHl($("cvsrc").value)).map((x) => row(x)).join("");
    $("cvout").innerHTML = "";
    ui(true);
    const steps = res.steps;
    for (let i = 0; i < steps.length && runId === id; i++) {
      markSource(steps[i].src);
      note(steps[i].note || "…");
      if (steps[i].out.length) await type(id, steps[i], i);
      if (runId !== id) return;
      const done = res.steps.slice(0, i + 1).flatMap((s) => s.out);
      const before = res.steps.slice(0, i).flatMap((s) => s.out).length;
      $("cvout").innerHTML = lines(c.outHl(done.join("\n"))).map((x, k) => row(x, k >= before)).join("");
      await pause(id);
    }
    if (runId !== id) return;
    finish();
  }
  function finish() {
    runId++;
    release();
    ui(false);
    if (res) {
      showOut(res.steps.length);
      note("Done. " + (res.warns.length ? "Check the notes below for anything that could not be translated." : "Press Animate to watch it again."));
    }
  }

  $("cvdir").onchange = () => setDir(false);
  $("cvgo").onclick = go;
  $("cvanim").onclick = animate;
  $("cvpause").onclick = () => {
    paused = !paused;
    $("cvpause").textContent = paused ? "Resume" : "Pause";
    if (!paused) release();
  };
  $("cvnext").onclick = release;
  $("cvfinish").onclick = finish;
  $("cvsrc").onkeydown = keys;
  $("cvsrc").oninput = () => { res = null; sync(); };
  $("cvsrc").onscroll = () => {
    $("cvhl").scrollTop = $("cvsrc").scrollTop;
    $("cvhl").scrollLeft = $("cvsrc").scrollLeft;
    $("cvgut").scrollTop = $("cvsrc").scrollTop;
  };
  $("cvfrom").onclick = () => {
    $("cvdir").value = "ps";
    setDir(true);
    setSrc(editor.value);
    go();
  };
  $("cvcopy").onclick = async () => {
    if (!res && !convertNow()) return;
    try { await navigator.clipboard.writeText(res.code); note("Copied to the clipboard."); }
    catch (e) { note("Copying was blocked by the browser – select the text and copy it by hand.", true); }
  };
  $("cvuse").onclick = () => {
    if (!res && !convertNow()) return;
    setCode(res.code, "");
    tab("c");
    setStatus("Converted code placed in the editor");
  };
  $("cvsave").onclick = () => {
    if (!res && !convertNow()) return;
    saveText(res.code + "\n", cfg().file);
  };

  setDir(false);
  return { setDir };
})();
