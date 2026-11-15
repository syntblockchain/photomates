const test = require('node:test');
const assert = require('node:assert/strict');
const { QUIET, inviteUrl, qrModules, qrPath, qrSvg } = require('../public/invite.js');

const PAGE = 'https://syntblockchain.github.io/photomates/';

test('the invite link opens the booth in this room, ready to scan', () => {
  assert.equal(inviteUrl(PAGE, 'VYAJ'), 'https://syntblockchain.github.io/photomates/?room=vyaj');
  assert.equal(inviteUrl(PAGE, 'vyaj'), 'https://syntblockchain.github.io/photomates/?room=vyaj');
  assert.equal(inviteUrl('http://localhost:3000/', 'abcd'), 'http://localhost:3000/?room=abcd');
  // The link is the room, so any page state already in the address bar is replaced, not added to.
  assert.equal(inviteUrl(PAGE + '?debug', 'VYAJ'), 'https://syntblockchain.github.io/photomates/?room=vyaj');
  assert.equal(inviteUrl(PAGE + '#result', 'VYAJ'), 'https://syntblockchain.github.io/photomates/?room=vyaj');
  // Nothing to invite anyone to until the host has given us a room.
  assert.equal(inviteUrl(PAGE, ''), '');
  assert.equal(inviteUrl(PAGE, null), '');
});

test('the QR code is a square module grid with the quiet zone scanners look for', () => {
  const rows = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  for (let i = 0; i < rows.length; i++) {
    const code = rows[i].repeat(4).toLowerCase();
    const { count, size, rowsWithQuietZone } = qrModules(inviteUrl(PAGE, code));
    // A QR code is 21 modules across at its smallest (version 1), 4 more for each version after.
    assert.ok(count >= 21 && count <= 177 && (count - 21) % 4 === 0, `${code}: ${count} modules`);
    assert.equal(size, count + QUIET * 2);
    assert.equal(rowsWithQuietZone.length, size);
    rowsWithQuietZone.forEach((row) => assert.equal(row.length, size));
    // The quiet zone is blank all the way round, and the code itself is the only thing in the middle.
    for (let i = 0; i < QUIET; i++) {
      assert.match(rowsWithQuietZone[i], /^\.+$/);
      assert.match(rowsWithQuietZone[size - 1 - i], /^\.+$/);
    }
    rowsWithQuietZone.forEach((row) => {
      assert.match(row.slice(0, QUIET), /^\.+$/);
      assert.match(row.slice(-QUIET), /^\.+$/);
    });
    assert.match(rowsWithQuietZone[QUIET], /^\.{4}#/);
  }
});

test('every QR code is a real one: three finder squares, in the right corners', () => {
  const { rowsWithQuietZone, count } = qrModules(inviteUrl(PAGE, 'vyaj'));
  const finder = [
    '#######',
    '#.....#',
    '#.###.#',
    '#.###.#',
    '#.###.#',
    '#.....#',
    '#######',
  ];
  // Finder patterns sit in the top-left, top-right and bottom-left corners (never bottom-right).
  const corners = [
    [QUIET, QUIET],
    [QUIET, count + QUIET - 7],
    [count + QUIET - 7, QUIET],
  ];
  corners.forEach(([top, left]) => {
    const found = rowsWithQuietZone
      .slice(top, top + 7)
      .map((row) => row.slice(left, left + 7));
    assert.deepEqual(found, finder);
  });
  const bottomRight = rowsWithQuietZone
    .slice(count + QUIET - 7, count + QUIET)
    .map((row) => row.slice(count + QUIET - 7, count + QUIET));
  assert.notDeepEqual(bottomRight, finder, 'the bottom-right corner is data, not a finder pattern');
});

test('the same link always makes the same QR code, and a different link a different one', () => {
  const url = inviteUrl(PAGE, 'vyaj');
  assert.equal(qrSvg(url), qrSvg(url));
  assert.notEqual(qrSvg(url), qrSvg(inviteUrl(PAGE, 'wxyz')));
  // The board's page is part of the link, so a booth hosted elsewhere doesn't point here.
  assert.notEqual(qrSvg(inviteUrl(PAGE, 'vyaj')), qrSvg(inviteUrl('http://localhost:3000/', 'vyaj')));
});

test('the SVG is a black-on-nothing path sized to the grid, so it scans at any size', () => {
  const url = inviteUrl(PAGE, 'vyaj');
  const { size, rowsWithQuietZone } = qrModules(url);
  const svg = qrSvg(url);
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 \d+ \d+"/);
  assert.match(svg, /shape-rendering="crispEdges"/, 'no anti-aliased gap between modules');
  assert.match(svg, /<path d="[^"]+" fill="#000"\/><\/svg>$/);
  assert.ok(svg.includes(`viewBox="0 0 ${size} ${size}"`));
  // Every dark module is covered once by a horizontal run, and only dark modules are drawn.
  const covered = new Set();
  const d = /<path d="([^"]+)"/.exec(svg)[1];
  assert.equal(d, qrPath(rowsWithQuietZone));
  for (const [, x, y, w] of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
    for (let i = 0; i < Number(w); i++) {
      const key = `${Number(x) + i},${y}`;
      assert.equal(covered.has(key), false, `module ${key} drawn twice`);
      covered.add(key);
    }
  }
  let dark = 0;
  rowsWithQuietZone.forEach((row) => { dark += [...row].filter((m) => m === '#').length; });
  assert.equal(covered.size, dark);
});

test('the label names the room, and text that needs escaping is escaped', () => {
  assert.match(qrSvg(inviteUrl(PAGE, 'vyaj'), 'QR code for the booth link, room VYAJ'), /aria-label="QR code for the booth link, room VYAJ"/);
  assert.match(qrSvg('https://example.com/?room=vyaj', 'a "quoted" <label> & more'), /aria-label="a &quot;quoted&quot; &lt;label&gt; &amp; more"/);
});
