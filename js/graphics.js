const gfx = {
  canvas: null,
  ctx: null,
  used: false,
  colour: "#1b2a49",
  init(el) {
    this.canvas = el;
    this.ctx = el.getContext("2d");
    this.prep(480, 320);
  },
  prep(w, h) {
    const c = this.ctx;
    this.canvas.width = w;
    this.canvas.height = h;
    c.fillStyle = "#fffdf5";
    c.fillRect(0, 0, w, h);
    c.lineWidth = 2;
    c.font = '14px "Courier New", monospace';
    c.textBaseline = "top";
    this.colour = "#1b2a49";
    this.used = false;
  },
  use(fn) {
    this.used = true;
    this.ctx.strokeStyle = this.colour;
    this.ctx.fillStyle = this.colour;
    fn(this.ctx);
  },
};

const nums = (...a) => a.map((v) => num(v));
const setColour = (c) => {
  gfx.colour = String(c);
};

Object.assign(B, {
  CANVAS: (w, h) =>
    gfx.prep(
      Math.max(1, Math.min(Math.round(num(w)), 1200)),
      Math.max(1, Math.min(Math.round(num(h)), 900)),
    ),
  COLOUR: setColour,
  COLOR: setColour,
  BACKGROUND: (c) =>
    gfx.use((x) => {
      x.fillStyle = String(c);
      x.fillRect(0, 0, gfx.canvas.width, gfx.canvas.height);
    }),
  LINE: (a, b, c, d) =>
    gfx.use((x) => {
      const [x1, y1, x2, y2] = nums(a, b, c, d);
      x.beginPath();
      x.moveTo(x1, y1);
      x.lineTo(x2, y2);
      x.stroke();
    }),
  RECT: (a, b, c, d) => gfx.use((x) => x.strokeRect(...nums(a, b, c, d))),
  FILLRECT: (a, b, c, d) => gfx.use((x) => x.fillRect(...nums(a, b, c, d))),
  CIRCLE: (a, b, r) =>
    gfx.use((x) => {
      x.beginPath();
      x.arc(...nums(a, b, r), 0, Math.PI * 2);
      x.stroke();
    }),
  FILLCIRCLE: (a, b, r) =>
    gfx.use((x) => {
      x.beginPath();
      x.arc(...nums(a, b, r), 0, Math.PI * 2);
      x.fill();
    }),
  TEXT: (a, b, s) => gfx.use((x) => x.fillText(fmt(s), num(a), num(b))),
});

const triangle = (x, a) => {
  const [x1, y1, x2, y2, x3, y3] = nums(...a);
  x.beginPath();
  x.moveTo(x1, y1);
  x.lineTo(x2, y2);
  x.lineTo(x3, y3);
  x.closePath();
};

Object.assign(B, {
  WIDTH: (w) => {
    gfx.ctx.lineWidth = num(w);
  },
  PIXEL: (a, b) => gfx.use((x) => x.fillRect(num(a), num(b), 1, 1)),
  TRIANGLE: (...a) =>
    gfx.use((x) => {
      if (a.length != 6) throw er("TRIANGLE needs 6 values: x1, y1, x2, y2, x3, y3");
      triangle(x, a);
      x.stroke();
    }),
  FILLTRIANGLE: (...a) =>
    gfx.use((x) => {
      if (a.length != 6) throw er("FILLTRIANGLE needs 6 values: x1, y1, x2, y2, x3, y3");
      triangle(x, a);
      x.fill();
    }),
});
