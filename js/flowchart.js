const flow = (() => {
  const BW = 210;
  const BH = 38;
  const GAP = 28;
  const DW = 240;
  const DH = 64;
  const MARGIN = 54;
  const INK = "#1b2a49";
  const FILL = {
    process: "#fff1bf",
    io: "#cfe4f7",
    call: "#e5d5f2",
    test: "#ffd9b0",
    end: "#cfe9cc",
  };
  const MONO = '"Courier New", monospace';
  let lines = [];
  let ctx = null;

  const src = (n) => (lines[n - 1] || "").trim();
  const clip = (s, m) => (s.length > m ? s.slice(0, m - 1) + "…" : s);
  const loopBody = (n) => (n.k === "while" ? n.b : n.body);
  const items = (b) => b.filter((n) => n.k !== "decl" && n.k !== "def");

  function label(n) {
    const t = src(n.ln);
    switch (n.k) {
      case "if":
        return (
          clip(
            t.replace(/^(IF|ELSEIF)\s+/i, "").replace(/\s+THEN.*$/i, ""),
            26,
          ) + " ?"
        );
      case "while":
        return (
          clip(t.replace(/^WHILE\s+/i, "").replace(/\s+DO.*$/i, ""), 26) + " ?"
        );
      case "rep":
        return clip(src(n.cl).replace(/^UNTIL\s+/i, ""), 26) + " ?";
      case "for":
        return clip(t.replace(/^FOR\s+/i, ""), 28);
      case "each":
        return clip(t.replace(/^FOREACH\s+/i, ""), 28);
      default:
        return clip(
          t.replace(/^CASE\s+(OF\s+)?/i, "CASE ").replace(/\s+OF\s*$/i, ""),
          28,
        );
    }
  }

  const branches = (n) =>
    n.k === "if"
      ? [
          { t: "Yes", b: items(n.a) },
          { t: "No", b: items(n.b) },
        ]
      : [
          ...n.br.map((c, i) => ({ t: "Case " + (i + 1), b: items([c.s]) })),
          ...(n.ot ? [{ t: "Other", b: items([n.ot]) }] : []),
        ];

  function blockSize(b) {
    const l = b.map(size);
    if (!l.length) return { w: 0, h: 0 };
    return {
      w: Math.max(...l.map((x) => x.w)),
      h: l.reduce((a, x) => a + x.h, 0) + GAP * (l.length - 1),
    };
  }

  function size(n) {
    if (n.k === "if" || n.k === "case") {
      const s = branches(n).map((x) => blockSize(x.b));
      const w =
        s.reduce((a, x) => a + Math.max(x.w, 40), 0) + 24 * (s.length - 1);
      return {
        w: Math.max(DW, w),
        h: DH + GAP + Math.max(...s.map((x) => x.h)) + 16,
      };
    }
    if (n.k === "while" || n.k === "for" || n.k === "each") {
      const s = blockSize(items(loopBody(n)));
      return {
        w: Math.max(s.w, DW) + 2 * MARGIN,
        h: DH + (s.h ? GAP + s.h : 0) + 40,
      };
    }
    if (n.k === "rep") {
      const s = blockSize(items(n.b));
      return {
        w: Math.max(s.w, DW) + 2 * MARGIN,
        h: (s.h ? s.h + GAP : 0) + DH,
      };
    }
    return { w: BW + 28, h: BH };
  }

  function text(cx, cy, t, px) {
    ctx.fillStyle = INK;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = px + "px " + MONO;
    ctx.fillText(t, cx, cy);
  }

  function tag(x, y, t) {
    ctx.fillStyle = INK;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = "bold 11px " + MONO;
    ctx.fillText(t, x, y);
  }

  function poly(p, head = true) {
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.moveTo(...p[0]);
    p.slice(1).forEach((q) => ctx.lineTo(...q));
    ctx.stroke();
    if (!head) return;
    const a = p[p.length - 2];
    const b = p[p.length - 1];
    const t = Math.atan2(b[1] - a[1], b[0] - a[0]);
    ctx.beginPath();
    ctx.moveTo(...b);
    ctx.lineTo(b[0] - 8 * Math.cos(t - 0.4), b[1] - 8 * Math.sin(t - 0.4));
    ctx.lineTo(b[0] - 8 * Math.cos(t + 0.4), b[1] - 8 * Math.sin(t + 0.4));
    ctx.closePath();
    ctx.fillStyle = INK;
    ctx.fill();
  }

  const arrow = (x1, y1, x2, y2) =>
    poly([
      [x1, y1],
      [x2, y2],
    ]);

  function shape(kind, trace) {
    ctx.beginPath();
    trace();
    ctx.fillStyle = FILL[kind];
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.stroke();
  }

  function pill(cx, y, t) {
    shape("end", () => {
      if (ctx.roundRect) return ctx.roundRect(cx - 65, y, 130, 34, 17);
      const x = cx - 65,
        r = 17;
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + 130, y, x + 130, y + 34, r);
      ctx.arcTo(x + 130, y + 34, x, y + 34, r);
      ctx.arcTo(x, y + 34, x, y, r);
      ctx.arcTo(x, y, x + 130, y, r);
      ctx.closePath();
    });
    text(cx, y + 17, t, 13);
  }

  function box(cx, y, t, kind) {
    const x = cx - BW / 2;
    shape(kind, () => {
      if (kind === "io") {
        ctx.moveTo(x + 16, y);
        ctx.lineTo(x + BW + 16, y);
        ctx.lineTo(x + BW - 16, y + BH);
        ctx.lineTo(x - 16, y + BH);
        ctx.closePath();
      } else {
        ctx.rect(x, y, BW, BH);
      }
    });
    if (kind === "call") {
      poly(
        [
          [x + 10, y],
          [x + 10, y + BH],
        ],
        false,
      );
      poly(
        [
          [x + BW - 10, y],
          [x + BW - 10, y + BH],
        ],
        false,
      );
    }
    text(cx, y + BH / 2, clip(t, 26), 12);
  }

  function diamond(cx, y, t) {
    shape("test", () => {
      ctx.moveTo(cx, y);
      ctx.lineTo(cx + DW / 2, y + DH / 2);
      ctx.lineTo(cx, y + DH);
      ctx.lineTo(cx - DW / 2, y + DH / 2);
      ctx.closePath();
    });
    text(cx, y + DH / 2, t, 11);
  }

  function drawBlock(b, cx, y) {
    b.forEach((n, i) => {
      if (i) {
        arrow(cx, y, cx, y + GAP);
        y += GAP;
      }
      y = drawItem(n, cx, y);
    });
    return y;
  }

  function drawFork(n, cx, y) {
    diamond(cx, y, label(n));
    const bs = branches(n);
    const sz = bs.map((x) => blockSize(x.b));
    const ws = sz.map((x) => Math.max(x.w, 40));
    const total = ws.reduce((a, b) => a + b, 0) + 24 * (bs.length - 1);
    const ty = y + DH + GAP;
    const join = ty + Math.max(...sz.map((x) => x.h)) + 16;
    let x0 = cx - total / 2;
    bs.forEach((br, i) => {
      const bx = x0 + ws[i] / 2;
      x0 += ws[i] + 24;
      const start = [
        [cx, y + DH],
        [cx, y + DH + 12],
        [bx, y + DH + 12],
      ];
      if (sz[i].h) {
        poly([...start, [bx, ty]]);
        const e = drawBlock(br.b, bx, ty);
        poly(
          [
            [bx, e],
            [bx, join],
            [cx, join],
          ],
          false,
        );
      } else {
        poly([...start, [bx, join], [cx, join]], false);
      }
      tag(bx + 5, y + DH + 9, br.t);
    });
    return join;
  }

  function drawLoop(n, cx, y) {
    diamond(cx, y, label(n));
    const body = items(loopBody(n));
    const s = blockSize(body);
    const half = Math.max(s.w, DW) / 2 + 52;
    const mid = y + DH / 2;
    let bb = y + DH;
    if (s.h) {
      arrow(cx, y + DH, cx, y + DH + GAP);
      bb = drawBlock(body, cx, y + DH + GAP);
      tag(cx + 6, y + DH + 16, "Yes");
    }
    const out = bb + 40;
    poly([
      [cx, bb],
      [cx, bb + 14],
      [cx - half, bb + 14],
      [cx - half, mid],
      [cx - DW / 2, mid],
    ]);
    poly(
      [
        [cx + DW / 2, mid],
        [cx + half, mid],
        [cx + half, out],
        [cx, out],
      ],
      false,
    );
    tag(cx + DW / 2 + 6, mid - 6, "No");
    return out;
  }

  function drawRepeat(n, cx, y) {
    const body = items(n.b);
    const s = blockSize(body);
    const half = Math.max(s.w, DW) / 2 + 52;
    let dy = y;
    if (s.h) {
      const e = drawBlock(body, cx, y);
      dy = e + GAP;
      arrow(cx, e, cx, dy);
    }
    diamond(cx, dy, label(n));
    const mid = dy + DH / 2;
    poly(
      [
        [cx - DW / 2, mid],
        [cx - half, mid],
        [cx - half, y - 12],
        [cx, y - 12],
      ],
      false,
    );
    tag(cx - DW / 2 - 24, mid - 6, "No");
    tag(cx + 6, dy + DH + 14, "Yes");
    return dy + DH;
  }

  function drawItem(n, cx, y) {
    switch (n.k) {
      case "if":
      case "case":
        return drawFork(n, cx, y);
      case "while":
      case "for":
      case "each":
        return drawLoop(n, cx, y);
      case "rep":
        return drawRepeat(n, cx, y);
      case "in":
      case "out":
        box(cx, y, src(n.ln), "io");
        return y + BH;
      case "call":
        box(cx, y, src(n.ln), "call");
        return y + BH;
      default:
        box(cx, y, src(n.ln), "process");
        return y + BH;
    }
  }

  function draw(program, source, canvas) {
    lines = source
      .split("\n")
      .map((l) => l.replace(/^[ \t]*\d+[ \t]+(?=[^\s:])/, ""));
    const body = items(program);
    const s = blockSize(body);
    const W = Math.max(s.w, DW) + 80;
    const H = s.h + 2 * 34 + 3 * GAP + 60;
    canvas.width = W;
    canvas.height = H;
    ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    ctx.lineWidth = 1.6;
    ctx.lineJoin = "round";
    const cx = W / 2;
    pill(cx, 20, "START");
    let y = 54;
    if (body.length) {
      arrow(cx, y, cx, y + GAP);
      y = drawBlock(body, cx, y + GAP);
    }
    arrow(cx, y, cx, y + GAP);
    pill(cx, y + GAP, "END");
  }

  return { draw };
})();
