// Photomates invites: the link that opens a booth and the QR code of that link, so mates can join by
// pointing a phone camera at the screen instead of typing the 4-letter code. Shared by the browser and
// the Node tests (qrcode.js is the vendored MIT QR encoder that does the actual codeword maths).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./qrcode.js'));
  else root.PhotomatesInvite = factory(root.qrcode);
})(typeof self !== 'undefined' ? self : this, (qrcode) => {
  // The white border the QR spec asks for around a code, in modules. Phones use it to find the code.
  const QUIET = 4;

  // The link for a booth: <page>?room=<code>, e.g. https://syntblockchain.github.io/photomates/?room=vyaj
  // Opening it joins the room (or hosts it, if you're first), so scanning it is all a mate has to do.
  // Any query or hash already on the page (like ?debug) is replaced, not appended to.
  function inviteUrl(page, code) {
    const clean = String(code || '').trim().toUpperCase();
    if (!clean) return '';
    return `${String(page).replace(/[?#].*$/, '')}?room=${encodeURIComponent(clean.toLowerCase())}`;
  }

  // The code as a square grid of modules. The version (how many modules) is picked to fit the link,
  // with medium error correction so a slightly blurry phone shot still reads.
  function qrModules(text) {
    const qr = qrcode(0, 'M');
    qr.addData(text, 'Byte');
    qr.make();
    const count = qr.getModuleCount();
    const rows = [];
    for (let r = 0; r < count; r++) {
      let row = '';
      for (let c = 0; c < count; c++) row += qr.isDark(r, c) ? '#' : '.';
      rows.push(row);
    }
    return { count, size: count + QUIET * 2, rows, rowsWithQuietZone: withQuietZone(rows) };
  }

  // The grid with the quiet zone around it, which is what gets drawn.
  function withQuietZone(rows) {
    const blank = '.'.repeat(rows.length + QUIET * 2);
    const gap = '.'.repeat(QUIET);
    const padded = rows.map((row) => gap + row + gap);
    for (let i = 0; i < QUIET; i++) {
      padded.unshift(blank);
      padded.push(blank);
    }
    return padded;
  }

  // Dark modules as one SVG path, a run of modules per row: sharp at any size, and no colours (black on
  // whatever the code sits on, which the page keeps white so scanners see enough contrast).
  function qrPath(rows) {
    let d = '';
    rows.forEach((row, r) => {
      let c = 0;
      while (c < row.length) {
        if (row[c] !== '#') { c++; continue; }
        let run = 1;
        while (c + run < row.length && row[c + run] === '#') run++;
        d += `M${c} ${r}h${run}v1h-${run}z`;
        c += run;
      }
    });
    return d;
  }

  const escapeAttr = (s) =>
    String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // A whole <svg>, ready to drop on the page. It's labelled for screen readers (they read the link out
  // instead of pretending to describe a picture of squares).
  function qrSvg(text, label = 'QR code for the booth link') {
    const { size, rowsWithQuietZone } = qrModules(text);
    const d = qrPath(rowsWithQuietZone);
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"` +
      ` role="img" aria-label="${escapeAttr(label)}"><path d="${d}" fill="#000"/></svg>`
    );
  }

  return { QUIET, inviteUrl, qrModules, qrPath, qrSvg };
});
