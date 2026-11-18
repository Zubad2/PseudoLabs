function renderTrace() {
  const c = [];
  rows.forEach((r) => {
    if (r.n && !c.includes(r.n)) c.push(r.n);
  });
  let h =
    "<table><tr>" +
    c.map((x) => "<th>" + esc(x) + "</th>").join("") +
    "<th>OUTPUT</th></tr>";
  for (const r of rows)
    h +=
      "<tr>" +
      c
        .map((x) => "<td>" + (r.n === x ? esc(fmt(r.v)) : "") + "</td>")
        .join("") +
      "<td>" +
      (r.o !== undefined ? esc(r.o) : "") +
      "</td></tr>";
  $("tbl").innerHTML = rows.length
    ? h +
      "</table>" +
      (rows.length >= 600
        ? '<p class="mu">Showing the first 600 rows.</p>'
        : "")
    : "";
  $("tt").textContent =
    "Trace table" + (rows.length ? " (" + rows.length + ")" : "");
}
