alert('JS terbaca');

/* #  r tembok
. c lantai
T jebakan
E pintu
M cermin emas
G cermin ungu
R cermin retak (sudah dipakai)
B arcade
pos posisi
path (daftar kotak yang pernah diinjak)
P pantulan
g peta
sp0 titik start
ex pintu
thick (ketebalan bayangan)
hold/extra (penyesuaian posisi bayangan)
bunuh shadowDead. */

// setting state
// state ukuran peta, jumlah nyawa, jarak bayangan
var DEMO_ARCADE = false; // ganti ke true buat uji kotak (kotak muncul di lantai 1 + penanda ungu)
var boxPos = null;
var W = 31,
  H = 21,
  VW = 13,
  VH = 9; //ukuran map
var ASSET_DIR = 'aset/',
  ASSETS = [
    'tembok',
    'lantai_1',
    'lantai_2',
    'cermin_emas',
    'cermin_ungu',
    'cermin_retak',
    'jebakan',
    'pintu_keluar',
    'karakter',
    'bayangan',
    'kotak',
  ],
  IM = {},
  MIRN = { M: 'cermin_emas', G: 'cermin_ungu', R: 'cermin_retak' };
function assetUrl(n) {
  return (window.ASSET_DATA && window.ASSET_DATA[n]) || ASSET_DIR + n + '.png';
}
ASSETS.forEach(function (n) {
  var el = new Image(), // ambil elemen aset
    o = { el: el, ok: false }; // objek bungkus, el=gambar, ok=status boolean
  el.onload = function () {
    o.ok = true;
  };
  el.src = assetUrl(n);
  IM[n] = o;
}); // simpen ke image map (global)
function img(n) {
  var o = IM[n];
  return o && o.ok ? o.el : null;
} // cek IM
var P = 0,
  lvl = 3,
  hp = 3,
  thick = 0,
  inv = 0,
  flash = 0,
  boxFloor = -1,
  shadowDead = false,
  L = 3,
  longOwn,
  beku,
  fl,
  g,
  pos,
  sp0,
  ex,
  path,
  seen,
  hold,
  freeze,
  extra,
  see,
  dbl,
  over,
  dying = 0,
  mir,
  cam = { x: 0, y: 0 },
  started = false;
try {
  lvl = Math.min(5, Math.max(3, +localStorage.getItem('cermin_lvl') || 3));
} catch (e) {} //load progres floor
function $(i) {
  return document.getElementById(i);
}
//sfx
function sfx(f, d, t) {
  try {
    var a = sfx.c || (sfx.c = new (window.AudioContext || window.webkitAudioContext)());
    var o = a.createOscillator(),
      k = a.createGain();
    o.type = t || 'sine';
    o.frequency.value = f;
    k.gain.value = 0.06;
    o.connect(k);
    k.connect(a.destination);
    o.start();
    k.gain.exponentialRampToValueAtTime(0.001, a.currentTime + d);
    o.stop(a.currentTime + d);
  } catch (e) {}
}
// rumus jarak
function dist(a, b) {
  return Math.hypot(a.r - b.r, a.c - b.c);
}
function rnd(n) {
  return Math.floor(Math.random() * n);
}

// ==== 1. MAP ACAK TIAP FLOOR ====
// Urutan: labirin pake DFS -> buka dinding agar ada putaran -> pilih awal & pintu jauh (BFS) ->
// jebakan di luar jalur terpendek -> cermin tersebar -> kotak misterius (opsional).
function gen(idx, box) {
  var m = [],
    r,
    c,
    D = [
      [0, 2],
      [0, -2],
      [2, 0],
      [-2, 0],
    ],
    N4 = [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ];
  for (r = 0; r < H; r++) m.push(new Array(W).fill('#'));
  var st = [[1, 1]];
  m[1][1] = '.';
  while (st.length) {
    var q = st[st.length - 1],
      nb = D.filter(function (d) {
        var a = q[0] + d[0],
          b = q[1] + d[1];
        return a > 0 && b > 0 && a < H - 1 && b < W - 1 && m[a][b] == '#';
      });
    if (!nb.length) {
      st.pop();
      continue;
    }
    var d = nb[rnd(nb.length)];
    m[q[0] + d[0] / 2][q[1] + d[1] / 2] = '.';
    m[q[0] + d[0]][q[1] + d[1]] = '.';
    st.push([q[0] + d[0], q[1] + d[1]]);
  } //DFS

  for (r = 1; r < H - 1; r++)
    for (c = 1; c < W - 1; c++)
      if (
        m[r][c] == '#' &&
        Math.random() < 0.2 &&
        ((r % 2 && c % 2 == 0 && m[r][c - 1] == '.' && m[r][c + 1] == '.') || //dinding vertikal
          (r % 2 == 0 && c % 2 && m[r - 1][c] == '.' && m[r + 1][c] == '.')) // horizontal
      )
        m[r][c] = '.';
  var s = { r: 1 + 2 * rnd((H - 1) / 2), c: 1 + 2 * rnd((W - 1) / 2) }, // start di sel ganjil
    dd = {},
    par = {},
    qu = [s],
    mx = 0;
  dd[s.r * W + s.c] = 0;
  while (qu.length) {
    var u = qu.shift();
    N4.forEach(function (d) {
      var a = u.r + d[0],
        b = u.c + d[1],
        k = a * W + b;
      if (m[a] && m[a][b] == '.' && dd[k] === undefined) {
        dd[k] = dd[u.r * W + u.c] + 1;
        par[k] = u;
        mx = Math.max(mx, dd[k]);
        qu.push({ r: a, c: b });
      }
    });
  }
  var far = [];
  for (var k in dd) if (dd[k] >= mx * 0.75) far.push(+k);
  var e = far[rnd(far.length)],
    E = { r: Math.floor(e / W), c: e % W };
  m[E.r][E.c] = 'E';
  var ps = {},
    u2 = E;
  while (u2) {
    ps[u2.r * W + u2.c] = 1;
    u2 = par[u2.r * W + u2.c];
  } // jalur terpendek
  var fl2 = [];
  for (r = 1; r < H - 1; r++)
    for (c = 1; c < W - 1; c++)
      if (
        m[r][c] == '.' &&
        !ps[r * W + c] &&
        dist({ r: r, c: c }, s) > 4 &&
        dist({ r: r, c: c }, E) > 3
      )
        fl2.push({ r: r, c: c }); //jebakan
  for (var i = 0; i < 5 + 3 * idx && fl2.length; i++) {
    var t = fl2.splice(rnd(fl2.length), 1)[0];
    m[t.r][t.c] = 'T';
  }
  if (box) {
    var bc = [],
      bd = [];
    for (r = 1; r < H - 1; r++)
      for (c = 1; c < W - 1; c++)
        if (m[r][c] == '.' && !ps[r * W + c] && dist({ r: r, c: c }, E) > 4) {
          var dsx = dist({ r: r, c: c }, s);
          if (DEMO_ARCADE ? dsx >= 4 && dsx <= 11 : dsx > 6) bc.push({ r: r, c: c });
          else if (dsx > 3) bd.push({ r: r, c: c });
        }
    if (!bc.length) bc = bd;
    if (bc.length) {
      var bb = bc[rnd(bc.length)];
      m[bb.r][bb.c] = 'B';
    }
  }
  var de = [];
  for (r = 1; r < H - 1; r++)
    for (c = 1; c < W - 1; c++)
      if (m[r][c] == '.' && dist({ r: r, c: c }, s) > 6 && dist({ r: r, c: c }, E) > 4) {
        var f = N4.filter(function (d) {
          return (
            m[r + d[0]][c + d[1]] != '#' &&
            m[r + d[0]][c + d[1]] != 'M' &&
            m[r + d[0]][c + d[1]] != 'G'
          );
        });
        if (f.length == 1) de.push({ r: r, c: c, o: { r: r - f[0][0], c: c - f[0][1] } });
      }
  var n = Math.min(7, 4 + idx),
    cnt = 0;
  var ms = [];
  while (cnt < n && de.length) {
    var z = de.splice(rnd(de.length), 1)[0];
    if (
      m[z.o.r] &&
      m[z.o.r][z.o.c] == '#' &&
      ms.every(function (q) {
        return dist(q, z.o) > 7;
      })
    ) {
      m[z.o.r][z.o.c] = cnt % 2 ? 'G' : 'M';
      ms.push({ r: z.o.r, c: z.o.c });
      cnt++;
    }
  }
  for (var md = 6; md >= 2 && cnt < n; md--) {
    var tries = 0;
    while (cnt < n && tries++ < 600) {
      var rr = 1 + rnd(H - 2),
        cc = 1 + rnd(W - 2);
      if (
        m[rr][cc] == '#' &&
        N4.some(function (d) {
          return m[rr + d[0]] && m[rr + d[0]][cc + d[1]] == '.';
        }) &&
        dist({ r: rr, c: cc }, s) > 5 &&
        ms.every(function (q) {
          return dist(q, { r: rr, c: cc }) > md;
        })
      ) {
        m[rr][cc] = cnt % 2 ? 'G' : 'M';
        ms.push({ r: rr, c: cc });
        cnt++;
      }
    }
  }
  return { m: m, s: s, e: E }; // map, start, pintu
}

// ==== 2. MULAI GAME & PINDAH LANTAI ====
function startGame() {
  resize();
  L = lvl;
  P = 0;
  longOwn = false; //langkah panjang off
  boxFloor = DEMO_ARCADE ? 0 : Math.random() < 0.6 ? rnd(L) : -1;
  shadowDead = false;
  beku = 0;
  fl = 0;
  dbl = false;
  over = false;
  dying = 0; //mati reset
  $('end').hidden = true; //hide ending
  loadFloor();
  if (!started) {
    started = true;
    requestAnimationFrame(loop); //mulai loop game rendering tiap frame
  }
}
// generate map → reset nyawa/bayangan/jejak → tandai area terlihat → cari arcade → tampilkan petunjuk arah exit.
function loadFloor() {
  var o = gen(fl, fl === boxFloor);
  g = o.m;
  sp0 = o.s;
  ex = o.e;
  pos = { r: o.s.r, c: o.s.c };
  path = [{ r: pos.r, c: pos.c }];
  hold = 0;
  freeze = 0;
  extra = 0;
  see = false;
  hp = 3;
  thick = 0;
  inv = 0;
  cam.x = pos.c - VW / 2;
  cam.y = pos.r - VH / 2;
  seen = [];
  for (var r = 0; r < H; r++) seen.push(new Array(W).fill(false));
  mark();
  boxPos = null;
  for (var br = 0; br < H; br++)
    for (var bq = 0; bq < W; bq++) if (g[br][bq] == 'B') boxPos = { r: br, c: bq };
  var dr = ex.r - sp0.r,
    dc = ex.c - sp0.c,
    t =
      (Math.abs(dr) > 4 ? (dr < 0 ? 'atas' : 'bawah') : '') +
      (Math.abs(dr) > 4 && Math.abs(dc) > 4 ? '-' : '') +
      (Math.abs(dc) > 4 ? (dc < 0 ? 'kiri' : 'kanan') : '');
  msg('Lantai ' + (fl + 1) + '. Pintu ada jauh di sisi ' + (t || 'dekat') + '.');
}
function msg(t) {
  $('msg').textContent = t;
}

// ==== 3. BAYANGAN = REPLAY JEJAK LANGKAHMU (ide inti game) ====
// path = daftar semua kotak yang karakter injak. Bayangan berada di path[panjang-1-lag].
// lag mengecil saat Pantulan naik, jadi bayangan makin dekat.
function lag() {
  return Math.max(2, 10 - P);
}
function sidxF() {
  return Math.floor(path.length - 1 - lag() + extra - hold);
}
function size() {
  return (P < 3 ? 0 : P < 5 ? 1 : P < 7 ? 1.5 : 2.2) + thick * 0.3;
}
function sPos() {
  if (shadowDead) return null;
  var s = sidxF();
  return s >= 0 && s < path.length - 1 ? path[s] : null;
}
function caught() {
  if (shadowDead) return false;
  var s = sidxF();
  if (s < 0) return false;
  if (s >= path.length - 1) return true;
  return dist(pos, path[s]) <= size();
}
function mark() {
  for (var r = Math.max(0, pos.r - 4); r <= Math.min(H - 1, pos.r + 4); r++)
    for (var c = Math.max(0, pos.c - 4); c <= Math.min(W - 1, pos.c + 4); c++)
      if (dist(pos, { r: r, c: c }) <= 2.9) seen[r][c] = true;
}
function wall(r, c) {
  return (
    r < 0 ||
    c < 0 ||
    r >= H ||
    c >= W ||
    g[r][c] == '#' ||
    g[r][c] == 'M' ||
    g[r][c] == 'G' ||
    g[r][c] == 'R'
  );
}

// ==== 4. GERAK karakter ====
// Tiap langkah: cek tembok -> tambah ke path -> cek jebakan, bayangan, kotak, pintu (urutan penting).
function move(dx, dy) {
  if (over) return;
  var n = dbl && longOwn ? 2 : 1, // langkah double kalau dapet kartu
    t = [],
    r = pos.r,
    c = pos.c;
  for (var k = 0; k < n; k++) {
    r += dy;
    c += dx;
    if (wall(r, c)) return; // nabrak tembok ga nambah koordinat
    t.push({ r: r, c: c });
  }
  t.forEach(function (p) {
    path.push(p);
    if (freeze > 0) {
      hold++;
      freeze--;
    }
  }); // bayangan beku = ga maju sampe freeze nya 0
  pos = t[t.length - 1];
  if (P >= 5) extra += 0.5; // pantulan nambah -> bayangan makin dekat
  sfx(200 + (path.length % 8) * 10, 0.05, 'triangle');
  mark(); // sfx
  if (g[pos.r][pos.c] == 'T') return die('trap'); // injak trap = mati
  if (inv > 0) inv--; // ngurangi kebal, kan kalau abis kena bayangan -1 nyawa trus kebal=4 nah truus dia -- tiap step
  if (!inv && caught() && hit()) return; // kena bayangan -> hit
  if (g[pos.r][pos.c] == 'B') {
    g[pos.r][pos.c] = '.';
    boxPos = null;
    return boxGacha();
  } // ngelewati arcade -> gacha 50:50
  if (g[pos.r][pos.c] == 'E') return nextFloor(); //masuk exit -> next floor
  if (inv < 3)
    msg(P >= 5 ? 'Bayangan memotong jalan.' : P >= 3 ? 'Bayanganmu kini berbentuk jelas.' : '');
  hud();
}

function nextFloor() {
  fl++; // naik floor
  if (fl >= L) return finish(P == 0 ? 'whole' : P <= 3 ? 'faint' : 'changed'); // jatah floor abis = end
  sfx(330, 0.5);
  loadFloor();
} // jatah floor masih ada -> load next floor

function die(k) {
  over = true;
  dying = performance.now();
  var iv = setInterval(function () {
    sfx(100 + rnd(900), 0.05, 'sawtooth');
  }, 60); // sfx glitch
  setTimeout(function () {
    clearInterval(iv);
    finish(k);
  }, 1500); // jeda 1.5 detik trus ending
}

// ==== 5. BAYANGAN MENEMBUS: nyawa -1, bayangan makin tebal, terlempar mundur 6 langkah, kebal sebentar ====
function hit() {
  hp--;
  thick++;
  hold += 6;
  inv = 4;
  flash = performance.now();
  sfx(120, 0.5, 'sawtooth');
  if (hp <= 0) {
    die('shadow');
    return true;
  }
  msg('Bayangan menembusmu! Nyawa tersisa ' + hp + '. Bayangan jadi lebih tebal.');
  return false;
}

// ==== 6. ARCADE: gacha 2 kartu (Bunuh Bayangan / Dibunuh Bayangan) ====
var BC = [
  { a: 'kartu_bunuh_bayangan', n: 'Bunuh Bayangan' },
  { a: 'kartu_dibunuh_bayangan', n: 'Dibunuh Bayangan' },
];

function flipTo(i) {
  var im = $('flipimg');
  im.style.transition = 'none';
  im.style.transform = 'scaleX(.08)'; // efek kartuflip flip
  im.src = assetUrl(BC[i].a); //ganti gambar kartu
  $('flipfb').textContent = BC[i].n;
  requestAnimationFrame(function () {
    im.style.transition = 'transform .09s';
    im.style.transform = 'scaleX(1)';
  });
}

function boxGacha() {
  var tg = Math.random() < 0.5 ? 0 : 1,
    N = 18 + rnd(4),
    i = (((tg - N) % 2) + 2) % 2,
    k = 0;
  $('boxov').hidden = false;
  $('bxtake').hidden = true;
  $('bxp').textContent = 'Dua kartu berputar. Satu akan memutuskan nasibmu.';

  (function tick() {
    i = (i + 1) % 2;
    k++;
    flipTo(i);
    sfx(380 + i * 160, 0.06, 'square'); //sfx gacha
    if (k < N)
      setTimeout(tick, 75 * Math.pow(1.13, k)); //flip --
    else {
      sfx(tg ? 80 : 700, 0.8, tg ? 'sawtooth' : 'sine'); // sfx hasil card
      $('bxp').textContent = tg
        ? 'Bayangan menunggumu di dalam kotak.'
        : 'Bayanganmu lenyap, selamanya.';
      $('bxtake').hidden = false;
      $('bxtake').onclick = function () {
        $('boxov').hidden = true;
        if (tg) {
          die('box');
        } // hasil bad -> mati
        else {
          shadowDead = true; // hasil good -> bayangannya yang mati
          msg('Bayanganmu telah dibunuh. Ia tidak akan kembali di putaran ini.');
          sfx(520, 0.8);
          hud();
        }
      };
      $('bxtake').focus();
    }
  })();
}

function adjMirror() {
  var D = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ];
  for (var i = 0; i < 4; i++) {
    var r = pos.r + D[i][0],
      c = pos.c + D[i][1];
    if (r >= 0 && c >= 0 && r < H && c < W && (g[r][c] == 'M' || g[r][c] == 'G'))
      return { r: r, c: c, t: g[r][c] };
  } //ketemu cermin
  return null;//gada cermin
} 

// ==== 7. CERMIN: emas = pilih kartu, ungu = gacha ====
function stare() {
  //natap cermin
  if (over || !$('pick').hidden) return;
  mir = adjMirror();
  if (!mir) {
    msg('Tidak ada cermin di sebelahmu.');
    return;
  }
  if (mir.t == 'M') $('pick').hidden = false;
  else gacha(); // dapet biasa milih, cermin emas gacha
}

function give(p) {
  //
  g[mir.r][mir.c] = 'R';
  P++; // cermin bekas
  if (p == 'long') longOwn = true;
  if (p == 'see') see = true;
  if (p == 'freeze') beku++;
  sfx(440, 0.6);
  msg(P >= 7 ? 'Bayanganmu menjadi nyata.' : 'Kekuatan itu milikmu. Bayanganmu mendekat.');
  if (!inv && caught() && hit()) return;
  hud(); // cek karakter caught atau ga
}

document.querySelectorAll('[data-p]').forEach(function (b) {
  b.onclick = function () {
    $('pick').hidden = true;
    if (b.dataset.p != 'no') give(b.dataset.p);
  };
});

var ITEMS = [
  ['long', 'Langkah Panjang', 'kartu_langkah_panjang'],
  ['see', 'Mata Tembus', 'kartu_mata_tembus'],
  ['freeze', 'Napas Beku', 'kartu_napas_beku'],
];

function flipG(i) {
  // animation flip gacha cermin ungu
  var im = $('gimg');
  im.style.transition = 'none';
  im.style.transform = 'scaleX(.08)';
  im.src = assetUrl(ITEMS[i][2]);
  $('gfb').textContent = ITEMS[i][1];
  requestAnimationFrame(function () {
    im.style.transition = 'transform .09s';
    im.style.transform = 'scaleX(1)';
  });
}

function gacha() {
  // sebanyak N putaran
  var tg = rnd(3),
    N = 24 + rnd(4),
    i = (((tg - N) % 3) + 3) % 3,
    k = 0;
  $('gacha').hidden = false;
  $('take').hidden = true;
  $('gtxt').textContent = 'Tiga kartu berputar. Satu akan jadi milikmu.';
  (function tick() {
    i = (i + 1) % 3;
    k++;
    flipG(i);
    sfx(420 + i * 110, 0.06, 'square');
    if (k < N) setTimeout(tick, 65 * Math.pow(1.11, k));
    else {
      $('gtxt').textContent = 'Kamu mendapat: ' + ITEMS[tg][1];
      sfx(700, 0.7);
      $('take').hidden = false;
      $('take').onclick = function () {
        $('gacha').hidden = true;
        give(ITEMS[tg][0]);
      };
      $('take').focus();
    }
  })();
}

$('stare').onclick = stare;
$('dbl').onclick = function () {
  dbl = !dbl;
  hud();
};
$('freeze').onclick = function () {
  if (beku > 0 && freeze == 0 && !over) {
    beku--;
    freeze = 5;
    sfx(900, 0.5);
    msg('Bayangan membeku selama 5 langkah.');
    hud();
  }
};
document.querySelectorAll('.pad button').forEach(function (b) {
  b.onclick = function () {
    var d = b.dataset.d.split(',');
    move(+d[0], +d[1]);
  };
}); // movement

// kontrol wasd di move, shift = double langkah di o, spasi atau E =strare
document.addEventListener('keydown', function (e) {
  if (
    !$('intro').hidden ||
    !$('pick').hidden ||
    !$('gacha').hidden ||
    !$('boxov').hidden ||
    !$('end').hidden
  )
    return;
  var k = e.key.toLowerCase(),
    m = {
      arrowup: [0, -1],
      w: [0, -1],
      arrowdown: [0, 1],
      s: [0, 1],
      arrowleft: [-1, 0],
      a: [-1, 0],
      arrowright: [1, 0],
      d: [1, 0],
    };
  if (m[k]) {
    e.preventDefault();
    var o = dbl;
    if (e.shiftKey) dbl = true;
    move(m[k][0], m[k][1]);
    dbl = o;
    hud();
  } else if (k == ' ' || k == 'e') {
    e.preventDefault();
    stare();
  }
});

// ini buat mgecek arcade, harus aktifin demo_arcade dulu
function hud() {
  hud0();
  if (DEMO_ARCADE && boxPos) {
    var dr = boxPos.r - pos.r,
      dc = boxPos.c - pos.c,
      t =
        (dr ? (dr < 0 ? 'atas' : 'bawah') : '') +
        (dr && dc ? '-' : '') +
        (dc ? (dc < 0 ? 'kiri' : 'kanan') : '');
    $('pw').textContent +=
      '  |  Kotak misterius: ke arah ' +
      t +
      ', sekitar ' +
      Math.round(Math.hypot(dr, dc)) +
      ' kotak';
  }
}
function hud0() {
  $('fl').textContent = fl + 1 + '/' + L;
  $('pa').textContent = P;
  $('hp').textContent = '♥'.repeat(Math.max(0, hp)) + '♡'.repeat(Math.max(0, 3 - hp));
  var s = sidxF();
  $('sh').textContent = shadowDead
    ? 'mati'
    : s >= 0
      ? path.length - 1 - s + ' langkah'
      : 'belum muncul';
  $('dbl').hidden = !longOwn;
  $('dbl').textContent = 'Langkah \u00d72: ' + (dbl ? 'hidup' : 'mati');
  $('freeze').hidden = beku < 1 && freeze == 0;
  $('freeze').textContent = 'Napas Beku (' + beku + ')';
  $('freeze').disabled = freeze > 0 || beku < 1;
  $('stare').disabled = over;
  $('pw').textContent =
    'Kekuatan: ' +
      [
        longOwn ? 'Langkah Panjang' : '',
        see ? 'Mata Tembus' : '',
        beku ? 'Napas Beku \u00d7' + beku : '',
      ]
        .filter(Boolean)
        .join(' \u00b7 ') || 'Kekuatan: belum ada';
}

// ==== 8. RENDER: kamera, kegelapan, gambar PNG (dengan cadangan bentuk kotak) ====
function resize() {
  var cv = $('cv'),
    w = cv.clientWidth,
    h = cv.clientHeight, // sset ukuran canvas
    d = Math.min(2, window.devicePixelRatio || 1),
    tt = Math.max(38, Math.min(56, Math.round(w / 14)));
  if (!w || !h) return;
  cv.width = Math.round(w * d);
  cv.height = Math.round(h * d);
  VW = w / tt;
  VH = h / tt;
}
window.addEventListener('resize', resize);

function loop(t) {
  draw(t);
  hud();
  requestAnimationFrame(loop);
} //loop game= draw -> hud -> frame

function draw(t) {
  var cv = $('cv'),
    x = cv.getContext('2d'),
    T = cv.width / VW,
    d0 = dying ? t - dying : 0;
  var tx = Math.max(0, Math.min(W - VW, pos.c - VW / 2 + 0.5)),
    ty = Math.max(0, Math.min(H - VH, pos.r - VH / 2 + 0.5)); // cam ngikutin lokasi karakter
  cam.x += (tx - cam.x) * 0.18;
  cam.y += (ty - cam.y) * 0.18;
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.globalAlpha = 1;
  x.fillStyle = '#000';
  x.fillRect(0, 0, cv.width, cv.height);
  var sp2 = [];
  x.imageSmoothingEnabled = false; // ini mata nembus di save di sp2, trus animation kalau mati
  if (d0) x.translate((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);

  //loop tile format nya png
  for (var r = Math.max(0, Math.floor(cam.y) - 1); r <= Math.min(H - 1, Math.ceil(cam.y + VH)); r++)
    for (
      var c = Math.max(0, Math.floor(cam.x) - 1);
      c <= Math.min(W - 1, Math.ceil(cam.x + VW));
      c++
    ) {
      var ch = g[r][c],
        dd = dist(pos, { r: r, c: c }),
        vis = dd <= 2.9,
        sn = seen[r][c],
        px = (c - cam.x) * T,
        py = (r - cam.y) * T;
      if (!sn && !(see && (ch == 'E' || ch == 'T'))) continue;
      if (see && !vis && (ch == 'E' || ch == 'T')) {
        sp2.push([r, c]);
        continue;
      }
      x.globalAlpha = vis ? 1 : 0.12;
      if (ch == '#' && img('tembok')) {
        x.drawImage(img('tembok'), px, py, T, T);
      } else if (ch == '#') {
        x.fillStyle = '#040508';
        x.fillRect(px, py, T, T);
        x.strokeStyle = '#39414f';
        x.lineWidth = 1;
        x.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1);
      } else if ((ch == 'M' || ch == 'G' || ch == 'R') && img(MIRN[ch])) {
        if (img('tembok')) x.drawImage(img('tembok'), px, py, T, T);
        x.drawImage(img(MIRN[ch]), px, py, T, T);
      } else if (ch == 'R') {
        x.fillStyle = '#040508';
        x.fillRect(px, py, T, T);
        x.strokeStyle = '#555';
        x.lineWidth = 3;
        x.strokeRect(px + 6, py + 4, T - 12, T - 8);
      } else if (ch == 'M' || ch == 'G') {
        var fc = ch == 'M' ? '#b8924a' : '#b07ad8';
        x.fillStyle = '#040508';
        x.fillRect(px, py, T, T);
        x.strokeStyle = fc;
        x.lineWidth = 3;
        x.strokeRect(px + 6, py + 4, T - 12, T - 8);
        x.fillStyle = ch == 'M' ? '#9fc4d4' : '#6a4a8c';
        x.fillRect(px + 9, py + 7, T - 18, T - 14);
      } else {
        var fi = img((r * 31 + c * 17) % 5 < 1 ? 'lantai_2' : 'lantai_1');
        if (fi) x.drawImage(fi, px, py, T, T);
        else {
          x.fillStyle = '#4a5c6f';
          x.fillRect(px, py, T, T);
          x.fillStyle = '#6a8095';
          x.fillRect(px + 2, py + 2, T - 4, T - 4);
        }
        if (ch == 'B') {
          if (img('kotak')) x.drawImage(img('kotak'), px, py, T, T);
          else {
            x.fillStyle = '#704a26';
            x.fillRect(px + T * 0.2, py + T * 0.3, T * 0.6, T * 0.5);
            x.fillStyle = '#e6c27a';
            x.fillRect(px + T * 0.45, py + T * 0.5, T * 0.1, T * 0.15);
          }
        }
        if (ch == 'E') {
          if (img('pintu_keluar')) x.drawImage(img('pintu_keluar'), px, py, T, T);
          else {
            x.fillStyle = '#d9b26a';
            x.fillRect(px + T * 0.2, py + T * 0.1, T * 0.6, T * 0.8);
          }
        }
        if (ch == 'T' && (see || dd <= 1.5) && img('jebakan')) {
          x.drawImage(img('jebakan'), px, py, T, T);
        } else if (ch == 'T' && (see || dd <= 1.5)) {
          x.strokeStyle = '#a3202b';
          x.lineWidth = 2;
          x.beginPath();
          x.moveTo(px + T * 0.15, py + T * 0.2);
          x.lineTo(px + T / 2, py + T / 2);
          x.lineTo(px + T * 0.85, py + T * 0.85);
          x.moveTo(px + T / 2, py + T / 2);
          x.lineTo(px + T * 0.8, py + T * 0.2);
          x.stroke();
        }
      }
    }

  // cahaya center ke karakter makin jauh makih gelap
  x.globalAlpha = 1;
  var lx = (pos.c - cam.x + 0.5) * T,
    ly = (pos.r - cam.y + 0.5) * T,
    lgd = x.createRadialGradient(lx, ly, T * 0.5, lx, ly, T * 3.1);
  lgd.addColorStop(0, 'rgba(0,0,0,0)');
  lgd.addColorStop(0.55, 'rgba(0,0,0,.45)');
  lgd.addColorStop(1, 'rgba(0,0,0,.97)');
  x.fillStyle = lgd;
  x.fillRect(-40, -40, cv.width + 80, cv.height + 80);
  var wgd = x.createRadialGradient(lx, ly, 0, lx, ly, T * 2.4);
  wgd.addColorStop(0, 'rgba(255,190,110,.18)');
  wgd.addColorStop(1, 'rgba(255,190,110,0)');
  x.fillStyle = wgd;
  x.fillRect(lx - T * 3, ly - T * 3, T * 6, T * 6);
  sp2.forEach(function (q) {
    var px = (q[1] - cam.x) * T,
      py = (q[0] - cam.y) * T,
      ch = g[q[0]][q[1]];
    x.globalAlpha = 0.85;
    x.fillStyle = '#2a3340';
    x.fillRect(px, py, T, T);
    if (ch == 'E') {
      if (img('pintu_keluar')) x.drawImage(img('pintu_keluar'), px, py, T, T);
      else {
        x.fillStyle = '#d9b26a';
        x.fillRect(px + T * 0.2, py + T * 0.1, T * 0.6, T * 0.8);
      }
    } else if (img('jebakan')) {
      x.drawImage(img('jebakan'), px, py, T, T);
    } else {
      x.strokeStyle = '#a3202b';
      x.lineWidth = 3;
      x.beginPath();
      x.moveTo(px + T * 0.15, py + T * 0.2);
      x.lineTo(px + T / 2, py + T / 2);
      x.lineTo(px + T * 0.85, py + T * 0.85);
      x.moveTo(px + T / 2, py + T / 2);
      x.lineTo(px + T * 0.8, py + T * 0.2);
      x.stroke();
    }
  }); //sp2 on = exit sama jebakan keliatan meskipun diluar radius cahaya
  x.globalAlpha = 1;
  if (P >= 3) {
    x.fillStyle = 'rgba(127,176,196,.25)';
    path.forEach(function (p) {
      x.fillRect((p.c - cam.x) * T + T * 0.4, (p.r - cam.y) * T + T * 0.4, T * 0.2, T * 0.2);
    });
  } //footprint muncul kalau p>= 3
  var ed = dist(pos, ex),
    exS = (ex.c - cam.x + 0.5) * T,
    eyS = (ex.r - cam.y + 0.5) * T; // panah ke exiut
  if (!over && (exS < 0 || eyS < 0 || exS > cv.width || eyS > cv.height)) {
    var an = Math.atan2(ex.r - pos.r, ex.c - pos.c),
      stp = ed > 25 ? Math.PI / 2 : ed > 14 ? Math.PI / 4 : ed > 7 ? Math.PI / 8 : 0;
    if (stp) an = Math.round(an / stp) * stp;
    var hx = cv.width / 2,
      hy = cv.height / 2,
      co = Math.abs(Math.cos(an)) || 1e-6,
      si = Math.abs(Math.sin(an)) || 1e-6,
      sc = Math.min((hx - T * 0.7) / co, (hy - T * 0.7) / si),
      ix = hx + Math.cos(an) * sc,
      iy = hy + Math.sin(an) * sc,
      pu = 1 + 0.15 * Math.sin(t / (80 + ed * 8)),
      al = 0.5 + 0.5 * (1 - Math.min(ed, 30) / 30);
    x.save();
    x.translate(ix, iy);
    x.rotate(an);
    x.scale(T / 50, T / 50);
    x.globalAlpha = al;
    x.fillStyle = '#e6c27a';
    x.shadowColor = '#ffd27a';
    x.shadowBlur = 18;
    x.beginPath();
    x.moveTo(18 * pu, 0);
    x.lineTo(-10 * pu, -13 * pu);
    x.lineTo(-3 * pu, 0);
    x.lineTo(-10 * pu, 13 * pu);
    x.closePath();
    x.fill();
    x.restore();
  }
  if (DEMO_ARCADE && boxPos && !over) {
    //cek arcade, arcade = on ada panah menuju arcade
    var bxs = (boxPos.c - cam.x + 0.5) * T,
      bys = (boxPos.r - cam.y + 0.5) * T;
    if (bxs < 0 || bys < 0 || bxs > cv.width || bys > cv.height) {
      var ba = Math.atan2(boxPos.r - pos.r, boxPos.c - pos.c),
        bco = Math.abs(Math.cos(ba)) || 1e-6,
        bsi = Math.abs(Math.sin(ba)) || 1e-6,
        bsc = Math.min((cv.width / 2 - T * 0.7) / bco, (cv.height / 2 - T * 0.7) / bsi),
        bix = cv.width / 2 + Math.cos(ba) * bsc,
        biy = cv.height / 2 + Math.sin(ba) * bsc,
        bp = 1 + 0.15 * Math.sin(t / 200);
      x.save();
      x.translate(bix, biy);
      x.rotate(ba);
      x.scale(T / 50, T / 50);
      x.fillStyle = '#c58cff';
      x.shadowColor = '#c58cff';
      x.shadowBlur = 18;
      x.beginPath();
      x.moveTo(18 * bp, 0);
      x.lineTo(-10 * bp, -13 * bp);
      x.lineTo(-3 * bp, 0);
      x.lineTo(-10 * bp, 13 * bp);
      x.closePath();
      x.fill();
      x.restore();
    } else {
      x.save();
      x.strokeStyle = 'rgba(197,140,255,' + (0.5 + 0.4 * Math.sin(t / 200)) + ')';
      x.lineWidth = 4;
      x.shadowColor = '#c58cff';
      x.shadowBlur = 20;
      x.beginPath();
      x.arc(bxs, bys, T * (0.55 + 0.08 * Math.sin(t / 200)), 0, 7);
      x.stroke();
      x.restore();
    }
  }
  // animation sama efek
  var sp = sPos(),
    pcx = (pos.c - cam.x + 0.5) * T,
    pcy = (pos.r - cam.y + 0.5) * T,
    scx,
    scy;
  if (sp && (dist(pos, sp) <= 4.5 || P >= 3)) {
    scx = (sp.c - cam.x + 0.5) * T;
    scy = (sp.r - cam.y + 0.5) * T;
    var rad = T * (0.38 + size() * 0.55) * (1 + 0.06 * Math.sin(t / 180) + thick * 0.1);
    if (P < 3 && !thick) {
      x.strokeStyle = 'rgba(127,176,196,.3)';
      x.lineWidth = 2;
      x.beginPath();
      x.arc(scx, scy, rad, 0, 7);
      x.stroke();
    } else if (img('bayangan')) {
      x.globalAlpha = Math.min(1, (P >= 3 ? 0.85 : 0.35) + thick * 0.25);
      var bs = rad * 2.3;
      x.drawImage(img('bayangan'), scx - bs / 2, scy - bs / 2, bs, bs);
      x.globalAlpha = 1;
    } else {
      x.globalAlpha = Math.min(1, (P >= 3 ? 0.8 : 0.3) + thick * 0.25);
      var gr = x.createRadialGradient(scx, scy, rad * 0.2, scx, scy, rad);
      gr.addColorStop(0, 'rgba(8,0,18,1)');
      gr.addColorStop(0.75, 'rgba(30,10,50,.95)');
      gr.addColorStop(1, 'rgba(127,176,196,.55)');
      x.fillStyle = gr;
      x.beginPath();
      x.arc(scx, scy, rad, 0, 7);
      x.fill();
      x.fillStyle = P >= 5 ? '#ff3b4d' : '#7fb0c4';
      var es = 3 + size() * 3;
      x.fillRect(scx - rad * 0.35, scy - es, es * 1.3, es);
      x.fillRect(scx + rad * 0.35 - es * 1.3, scy - es, es * 1.3, es);
      x.globalAlpha = 1;
    }
  }
  if (d0) {
    if (img('karakter') && d0 < 1000)
      for (var q = 0; q < 3; q++)
        x.drawImage(
          img('karakter'),
          pcx - T / 2 + (Math.random() - 0.5) * 24,
          pcy - T / 2 + (Math.random() - 0.5) * 24,
          T,
          T,
        );
    x.lineWidth = 3;
    for (var i = 0; i < 3; i++) {
      x.strokeStyle = ['#7fe8ff', '#ff4fd8', '#fff'][i];
      x.beginPath();
      var ax = scx !== undefined ? scx : pcx,
        ay = scy !== undefined ? scy : pcy;
      x.moveTo(ax, ay);
      for (var j = 1; j < 6; j++)
        x.lineTo(
          ax + ((pcx - ax) * j) / 6 + (Math.random() - 0.5) * 40,
          ay + ((pcy - ay) * j) / 6 + (Math.random() - 0.5) * 40,
        );
      x.lineTo(pcx, pcy);
      x.stroke();
    }
    for (i = 0; i < 4; i++) {
      x.fillStyle = ['#7fe8ff', '#ff4fd8', '#fff', '#fff'][i];
      x.fillRect(
        pcx - 14 + (Math.random() - 0.5) * 34,
        pcy - 14 + (Math.random() - 0.5) * 34,
        28,
        Math.random() * 10 + 3,
      );
    }
    for (i = 0; i < 7; i++) {
      x.fillStyle = 'rgba(255,255,255,' + Math.random() * 0.25 + ')';
      x.fillRect(0, Math.random() * cv.height, cv.width, 2 + Math.random() * 5);
    }
    if (d0 > 1000) {
      x.fillStyle = 'rgba(0,0,0,' + Math.min(1, (d0 - 1000) / 500) + ')';
      x.fillRect(-20, -20, cv.width + 40, cv.height + 40);
    }
  } else if (img('karakter')) {
    x.drawImage(img('karakter'), pcx - T * 0.5, pcy - T * 0.5, T, T);
  } else {
    x.fillStyle = '#e8eef2';
    x.beginPath();
    x.arc(pcx, pcy, T * 0.3, 0, 7);
    x.fill();
  }
  if (freeze > 0 && !d0) {
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.strokeStyle = '#bfe8ff';
    x.lineWidth = 3;
    x.strokeRect(2, 2, cv.width - 4, cv.height - 4);
  }
  if (t - flash < 450) {
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.fillStyle = 'rgba(255,40,70,' + 0.35 * (1 - (t - flash) / 450) + ')';
    x.fillRect(0, 0, cv.width, cv.height);
  }
}

// ==== 9. ENDING & PROGRES 3 -> 4 -> 5 -> 3 lantai (disimpan di localStorage) ====
function finish(k) {
  var win = k == 'whole' || k == 'faint' || k == 'changed',
    nx = lvl >= 5 ? 3 : lvl + 1;
  var E = {
    whole: [
      'Dirimu Utuh',
      'Kamu keluar tanpa menatap satu cermin pun. Tidak ada yang mengikutimu. Ending terbaik.',
    ],
    faint: [
      'Pantulan Samar',
      'Kamu selamat. Hanya saja, di kaca jendela, bayanganmu sesekali menoleh terlambat.',
    ],
    changed: [
      'Yang Berganti',
      'Kamu keluar. Orang-orang menyapa dengan nama yang bukan milikmu, dan kamu menjawabnya.',
    ],
    shadow: [
      'Yang Tertinggal',
      'Bayanganmu menyentuhmu dan kamu pecah menjadi statis. Kini dialah yang berjalan keluar.',
    ],
    trap: [
      'Yang Tertinggal',
      'Lantai retak. Di bawahnya hanya cermin tanpa dasar, dan wajahmu menatap balik dari sana.',
    ],
    box: [
      'Taruhan Terakhir',
      'Kartu itu terbalik dan memperlihatkan wajahmu sendiri. Bayangan keluar dari kotak, dan tidak ada yang tersisa.',
    ],
  }[k];
  if (win) {
    lvl = nx;
    try {
      localStorage.setItem('cermin_lvl', lvl);
    } catch (e) {}
  }
  $('eT').textContent = E[0];
  $('eP').textContent =
    E[1] +
    (win
      ? nx == 3
        ? ' Putaran selesai. Kembali ke 3 lantai.'
        : ' Putaran berikutnya: ' + nx + ' lantai.'
      : '');
  $('again').textContent = win ? 'Lanjut (' + lvl + ' lantai)' : 'Coba lagi (' + lvl + ' lantai)';
  $('end').hidden = false;
  $('again').focus();
}
$('lv').textContent = 'Putaran ini: ' + lvl + ' lantai.';
$('go').onclick = function () {
  $('intro').hidden = true;
  startGame();
};
$('again').onclick = startGame;
document.querySelectorAll('img[data-asset]').forEach(function (i) {
  i.src = assetUrl(i.dataset.asset);
});
