/* =====================================================================
   girus.js — Obrada girusnih mjerenja (girusna metoda)
   ---------------------------------------------------------------------
   Girus = 4 vizure redom:
     1) ZADNJA  (I položaj / krug lijevo)
     2) PREDNJA (I položaj)
     3) PREDNJA (II položaj / krug desno)
     4) ZADNJA  (II položaj)
   Može biti 1, 2 ili 3 girusa po stanici (4, 8 ili 12 redova).

   Rezultat po stanici: prelomni (lijevi) ugao = pravac na PREDNJU,
   kad se pravac na ZADNJU svede na 0 (orijentacija na zadnju).
   ===================================================================== */

// Pretvara razne zapise ugla u decimalne stupnjeve.
// Podržava:  "57°,25'08\"",  "57°25'08\"",  "57.2508",  57.2508
function parsirajUgao(ulaz) {
  if (ulaz === null || ulaz === undefined) return null;
  let s = String(ulaz).trim();
  if (s === "") return null;

  // Ako sadrži ° ili ' ili " → razbij na komponente
  if (/[°'"]/.test(s)) {
    // izvuci sve brojeve
    const dijelovi = s.replace(",", " ").match(/-?\d+(\.\d+)?/g);
    if (!dijelovi || dijelovi.length === 0) return null;
    const neg = s.trim().startsWith("-");
    const st = Math.abs(parseFloat(dijelovi[0] || "0"));
    const mi = parseFloat(dijelovi[1] || "0");
    const se = parseFloat(dijelovi[2] || "0");
    const r = st + mi / 60 + se / 3600;
    return neg ? -r : r;
  }

  // Inače je zapis SSS.MMSS (npr. 57.2508)
  const broj = Number(s.replace(",", "."));
  if (isNaN(broj)) return null;
  const neg = broj < 0;
  const aps = Math.abs(broj);
  const txt = aps.toFixed(4);
  const d = txt.split(".");
  const st = parseInt(d[0], 10);
  const mi = parseInt(d[1].substring(0, 2), 10);
  const se = parseInt(d[1].substring(2, 4), 10);
  const r = st + mi / 60 + se / 3600;
  return neg ? -r : r;
}

// razlika dvaju pravaca svedena u [0,360)
function razlika360(a, b) {
  let d = a - b;
  while (d < 0) d += 360;
  while (d >= 360) d -= 360;
  return d;
}

// sredina dvaju uglova koji su ~180° razmaknuti (I i II položaj)
// II položaj se svodi oduzimanjem 180° pa se uzima sredina
function sredinaIIpolozaj(ug1, ug2) {
  let b = ug2 - 180;
  // dovedi b blizu ug1
  while (b - ug1 > 180) b -= 360;
  while (b - ug1 < -180) b += 360;
  let m = (ug1 + b) / 2;
  while (m < 0) m += 360;
  while (m >= 360) m -= 360;
  return m;
}

/* Obrada jedne stanice.
   mjerenja = niz redova (po 4 vizure × broj girusa), svaki red:
     { vizura, horiz, zenit, kosa, visinaSignala }
   Vraća: { zadnja, prednja, prelomniUgao(dec), horizDuzina, ... }       */
function obradiStanicu(stanica, visinaInstr, mjerenja) {
  const n = mjerenja.length;
  if (n % 4 !== 0) {
    return { greska: `Stanica ${stanica}: broj mjerenja (${n}) nije djeljiv s 4 (girus = 4 vizure).` };
  }
  const brGirusa = n / 4;

  // skupi pravce na zadnju i prednju, po girusu i položaju
  const pravciZadnja = []; // svedeni na I položaj
  const pravciPrednja = [];
  const zenitZadnja = [];
  const zenitPrednja = [];
  const kosaZadnja = [];
  const kosaPrednja = [];
  const visZadnja = [];
  const visPrednja = [];
  let nazZadnja = null, nazPrednja = null;

  for (let g = 0; g < brGirusa; g++) {
    const baza = g * 4;
    const z1 = mjerenja[baza];     // zadnja, I
    const p1 = mjerenja[baza + 1]; // prednja, I
    const p2 = mjerenja[baza + 2]; // prednja, II
    const z2 = mjerenja[baza + 3]; // zadnja, II

    nazZadnja = z1.vizura; nazPrednja = p1.vizura;

    const hz1 = parsirajUgao(z1.horiz), hp1 = parsirajUgao(p1.horiz);
    const hp2 = parsirajUgao(p2.horiz), hz2 = parsirajUgao(z2.horiz);

    pravciZadnja.push(sredinaIIpolozaj(hz1, hz2));
    pravciPrednja.push(sredinaIIpolozaj(hp1, hp2));

    // zenitni: II položaj = 360 - z (pa sredina)
    const zz1 = parsirajUgao(z1.zenit), zz2 = parsirajUgao(z2.zenit);
    const zp1 = parsirajUgao(p1.zenit), zp2 = parsirajUgao(p2.zenit);
    zenitZadnja.push(zenitSredina(zz1, zz2));
    zenitPrednja.push(zenitSredina(zp1, zp2));

    kosaZadnja.push(prosjek([Number(z1.kosa), Number(z2.kosa)]));
    kosaPrednja.push(prosjek([Number(p1.kosa), Number(p2.kosa)]));
    visZadnja.push(Number(z1.visinaSignala));
    visPrednja.push(Number(p1.visinaSignala));
  }

  // sredina iz svih girusa (zaokružena na sekundu, kao u Excelu)
  const srZadnja = zaokruziNaSekundu(prosjekKruzni(pravciZadnja));
  const srPrednja = zaokruziNaSekundu(prosjekKruzni(pravciPrednja));

  // prelomni (lijevi) ugao = (pravac prednja) - (pravac zadnja), sveden u [0,360)
  const prelomni = razlika360(srPrednja, srZadnja);

  // zenitni (srednji)
  const zenPrednjaSr = prosjek(zenitPrednja);
  const kosaPrednjaSr = prosjek(kosaPrednja);
  const horizDuzina = Math.abs(round(kosaPrednjaSr * Math.sin((zenPrednjaSr * Math.PI) / 180), 3));

  return {
    stanica, visinaInstr: Number(visinaInstr),
    nazZadnja, nazPrednja,
    pravacZadnja: srZadnja, pravacPrednja: srPrednja,
    prelomniUgao: prelomni,
    zenitPrednja: zenPrednjaSr,
    kosaPrednja: kosaPrednjaSr,
    horizDuzina,
    visinaSignalaPrednja: prosjek(visPrednja),
    brGirusa
  };
}

// zenitni kut: II položaj = 360 - z2 ; sredina s z1
function zenitSredina(z1, z2) {
  const z2c = 360 - z2;
  return (z1 + z2c) / 2;
}

function prosjek(a) {
  const v = a.filter((x) => !isNaN(x));
  if (!v.length) return 0;
  return v.reduce((s, x) => s + x, 0) / v.length;
}

// kružni prosjek pravaca (pazi na prijelaz 360/0)
function prosjekKruzni(uglovi) {
  if (!uglovi.length) return 0;
  const ref = uglovi[0];
  let suma = 0;
  for (const u of uglovi) {
    let d = u - ref;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    suma += d;
  }
  let m = ref + suma / uglovi.length;
  while (m < 0) m += 360;
  while (m >= 360) m -= 360;
  return m;
}

function round(x, n) {
  const f = Math.pow(10, n);
  return Math.round((x + Number.EPSILON) * f) / f;
}

// zaokruži ugao (u decimalnim stupnjevima) na cijelu sekundu
function zaokruziNaSekundu(dec) {
  let x = dec;
  while (x < 0) x += 360;
  while (x >= 360) x -= 360;
  const ukSek = Math.round(x * 3600);   // ukupno sekundi, zaokruženo
  return ukSek / 3600;
}

// decimalni -> "SSS°MM'SS\""
function decUStr(dec) {
  let x = dec;
  while (x < 0) x += 360;
  while (x >= 360) x -= 360;
  let s = Math.floor(x);
  let mF = (x - s) * 60;
  let m = Math.floor(mF + 1e-9);
  let se = Math.round((mF - m) * 60);
  if (se >= 60) { se -= 60; m++; }
  if (m >= 60) { m -= 60; s++; }
  const pad = (k) => String(k).padStart(2, "0");
  return `${s}°${pad(m)}'${pad(se)}"`;
}

if (typeof window !== "undefined") {
  window.Girus = { parsirajUgao, obradiStanicu, decUStr };
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { parsirajUgao, obradiStanicu, decUStr, sredinaIIpolozaj, prosjekKruzni };
}
