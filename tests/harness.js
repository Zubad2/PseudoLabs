const stubContext = () =>
  new Proxy(
    {},
    {
      get: (target, key) => (key in target ? target[key] : () => {}),
      set: (target, key, value) => {
        target[key] = value;
        return true;
      },
    },
  );

async function run(source, inputs) {
  const out = $("out");
  out.t = "";
  halt = false;
  hook = null;
  steps = 0;
  lines = 0;
  rows = [];
  pend = null;
  depth = 0;
  auto = inputs
    ? inputs
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  G = mk();
  gfx.canvas = { width: 0, height: 0 };
  gfx.ctx = stubContext();
  gfx.prep(480, 320);
  try {
    const program = parse(lex(source));
    defs = {};
    program.forEach((n) => {
      if (n.k === "def") defs[n.n.toUpperCase()] = n;
    });
    const timeout = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("timed out or waiting for input")),
        2000,
      ),
    );
    await Promise.race([bl(program, G), timeout]);
    flow.draw(program, source, {
      width: 0,
      height: 0,
      getContext: stubContext,
    });
    hl.html(source);
    return { ok: true, output: out.t };
  } catch (e) {
    return { ok: false, error: e.message, output: out.t };
  }
}
