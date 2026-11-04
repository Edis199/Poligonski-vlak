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
function obradiStanicu(stanica, visinaInstr, mjerenja, izbor) {
  const n = mjerenja.length;
  if (n % 4 !== 0) {
    return { greska: `Stanica ${stanica}: broj mjerenja (${n}) nije djeljiv s 4 (girus = 4 vizure).` };
  }
  const brGirusaUkupno = n / 4;

  // izbor girusa: niz true/false (koji girusi se koriste); bez izbora koriste se svi
  const koristi = (Array.isArray(izbor) && izbor.length === brGirusaUkupno && izbor.some(Boolean))
    ? izbor : Array(brGirusaUkupno).fill(true);
  const pregledGirusa = [];   // za sve girus-e (i isključene): redukovani ugao

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

  const girusDetalji = []; // detaljni međurezultati za obrazac TO 1 i 2

  for (let g = 0; g < brGirusaUkupno; g++) {
    const baza = g * 4;
    const z1 = mjerenja[baza];     // zadnja, I
    const p1 = mjerenja[baza + 1]; // prednja, I
    const p2 = mjerenja[baza + 2]; // prednja, II
    const z2 = mjerenja[baza + 3]; // zadnja, II

    nazZadnja = z1.vizura; nazPrednja = p1.vizura;

    const hz1 = parsirajUgao(z1.horiz), hp1 = parsirajUgao(p1.horiz);
    const hp2 = parsirajUgao(p2.horiz), hz2 = parsirajUgao(z2.horiz);

    const srZad = sredinaIIpolozaj(hz1, hz2);
    const srPre = sredinaIIpolozaj(hp1, hp2);
    pregledGirusa.push({ girus: g + 1, reduk: razlika360(srPre, srZad), koristi: koristi[g] });
    if (!koristi[g]) continue;      // girus isključen iz obrade
    pravciZadnja.push(srZad);
    pravciPrednja.push(srPre);

    // zenitni kutovi: K.L (I položaj) i K.D (II položaj); sredina = (KL + (360-KD))/2
    const zz1 = parsirajUgao(z1.zenit), zz2 = parsirajUgao(z2.zenit); // zadnja: KL, KD
    const zp1 = parsirajUgao(p1.zenit), zp2 = parsirajUgao(p2.zenit); // prednja: KL, KD
    const srZenZad = zenitSredina(zz1, zz2);
    const srZenPre = zenitSredina(zp1, zp2);
    zenitZadnja.push(srZenZad);
    zenitPrednja.push(srZenPre);

    // detalji za obrazce TO 1 i 2 (horizontalno) i TO 1V (vertikalno)
    // 2C = (I polugirus) - (II polugirus ∓ 180), u sekundama
    const kolim = (iPolu, iiPolu) => {
      let d = iPolu - (iiPolu - 180);
      while (d > 180) d -= 360; while (d < -180) d += 360;
      return Math.round(d * 3600); // sekunde
    };
    // dvostruki visinski ugao (Excel V = K.L. - K.D. + 360); visinski ugao = V/2
    const dvostruki = (kl, kd) => norm360(kl - kd + 360);
    girusDetalji.push({
      girus: g + 1,
      zadnja: { vizura: z1.vizura, iPolu: hz1, iiPolu: hz2, dvoC: kolim(hz1, hz2), sredina: srZad,
                visSignala: Number(z1.visinaSignala),
                zenitKL: zz1, zenitKD: zz2, zbrojZen: zz1 + zz2,
                dvostrukiVis: dvostruki(zz1, zz2), srZenit: srZenZad },
      prednja:{ vizura: p1.vizura, iPolu: hp1, iiPolu: hp2, dvoC: kolim(hp1, hp2), sredina: srPre,
                visSignala: Number(p1.visinaSignala),
                zenitKL: zp1, zenitKD: zp2, zbrojZen: zp1 + zp2,
                dvostrukiVis: dvostruki(zp1, zp2), srZenit: srZenPre },
    });

    kosaZadnja.push(prosjek([Number(z1.kosa), Number(z2.kosa)]));
    kosaPrednja.push(prosjek([Number(p1.kosa), Number(p2.kosa)]));
    visZadnja.push(Number(z1.visinaSignala));
    visPrednja.push(Number(p1.visinaSignala));
  }

  // sredina iz svih girusa (zaokružena na sekundu, kao u Excelu)
  const srZadnja = zaokruziNaSekundu(prosjekKruzni(pravciZadnja));
  const srPrednja = zaokruziNaSekundu(prosjekKruzni(pravciPrednja));

  // prelomni (lijevi) ugao: redukovani ugao se računa za SVAKI girus (prednja − zadnja),
  // zatim se uzima sredina iz svih girusa i tek na kraju zaokružuje na sekundu
  // (isti redoslijed kao u Excelu: "Redukov. sredina" po girusu → "sredina iz svih girusa").
  const redukPoGirusu = pravciPrednja.map((p, g) => razlika360(p, pravciZadnja[g]));
  const prelomni = zaokruziSekParno(prosjekKruzni(redukPoGirusu));

  // zenitni (srednji)
  // Zenitni (vertikalni) ugao uzima se iz ZADNJEG girusa (kao u Excel obrascu TO 1V);
  // kose dužine su sredina iz svih girusa (kao u TO 18D).
  // ... i zaokružuje se na cijelu sekundu (kao "Visinski ugao α" u Excelu); polusekunda → parna sekunda.
  const zadnjiG = (a) => zaokruziSekParno(a[a.length - 1]);
  const zenPrednjaSr = zadnjiG(zenitPrednja);
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
    // podaci na ZADNJU tačku (potrebni za visinsko izravnanje — mjerenje "nazad")
    zenitZadnja: zadnjiG(zenitZadnja),
    kosaZadnja: prosjek(kosaZadnja),
    visinaSignalaZadnja: prosjek(visZadnja),
    horizDuzinaZadnja: Math.abs(round(prosjek(kosaZadnja) * Math.sin((zadnjiG(zenitZadnja) * Math.PI) / 180), 3)),
    brGirusa: pravciZadnja.length, brGirusaUkupno, pregledGirusa,
    girusDetalji,
    // redukovana sredina prednje (sredina iz svih girusa prednje - zadnje), = prelomni
    reduk: { zadnja: 0, prednja: prelomni }
  };
}

/* Zadnja stanica SLIJEPOG vlaka: nema girusa, samo vizura unazad na prethodnu tačku
   (jedan položaj, ili I i II položaj) — služi za orijentaciju detalja i za dužinu/visinsku razliku nazad. */
function obradiOrijentaciju(stanica, visinaInstr, redovi) {
  const r1 = redovi[0], r2 = redovi[1];
  let h1 = parsirajUgao(r1.horiz), z1 = parsirajUgao(r1.zenit);
  if (h1 === null || z1 === null) return { greska: `Stanica ${stanica}: nedostaje pravac ili zenitni ugao na ${r1.vizura}.` };
  let pravac, zenit, kosa;
  if (r2) {
    pravac = sredinaIIpolozaj(h1, parsirajUgao(r2.horiz));
    zenit = zenitSredina(z1, parsirajUgao(r2.zenit));
    kosa = prosjek([Number(r1.kosa), Number(r2.kosa)]);
  } else {
    if (z1 > 180) { z1 = 360 - z1; h1 = (h1 + 180) % 360; }   // mjereno u II položaju
    pravac = h1; zenit = z1; kosa = Number(r1.kosa);
  }
  pravac = zaokruziNaSekundu(pravac);
  zenit = zaokruziSekParno(zenit);
  const horizZadnja = Math.abs(round(kosa * Math.sin((zenit * Math.PI) / 180), 3));
  return {
    stanica, visinaInstr: Number(visinaInstr),
    nazZadnja: r1.vizura, nazPrednja: null,
    pravacZadnja: pravac, pravacPrednja: null,
    prelomniUgao: null,
    zenitPrednja: null, kosaPrednja: null, horizDuzina: null, visinaSignalaPrednja: null,
    zenitZadnja: zenit, kosaZadnja: kosa, visinaSignalaZadnja: Number(r1.visinaSignala),
    horizDuzinaZadnja: horizZadnja,
    brGirusa: 0, brGirusaUkupno: 0, pregledGirusa: [], girusDetalji: [],
    samoOrijentacija: true,
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

// zaokruži ugao na cijelu sekundu; kad je tačno pola sekunde, ide na PARNU sekundu (kao u Excelu)
function zaokruziSekParno(dec) {
  const s = dec * 3600;
  const f = Math.floor(s + 1e-9);
  const ostatak = s - f;
  let r;
  if (Math.abs(ostatak - 0.5) < 1e-6) r = (f % 2 === 0) ? f : f + 1;
  else r = Math.round(s);
  return r / 3600;
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
  window.Girus = { parsirajUgao, obradiStanicu, obradiOrijentaciju, decUStr };
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { parsirajUgao, obradiStanicu, obradiOrijentaciju, decUStr, sredinaIIpolozaj, prosjekKruzni };
}
