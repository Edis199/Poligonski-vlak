/* =====================================================================
   racun.js — Geodetski proračun izravnanja UMETNUTOG poligonskog vlaka
   Sve formule su preuzete iz originalnog Excel programa.
   Autor proračuna: prema originalnom Excelu "Izravnanje poligonskog vlaka"
   ===================================================================== */

/* ---------- Pomoćne funkcije za uglove ---------- */

// Zapis ugla u Excelu je oblik  SSS.MMSS  (npr. 237.2509 = 237°25'09")
// Pretvara taj zapis u decimalne stupnjeve.
function smsUDecimalni(sms) {
  if (sms === null || sms === undefined || sms === "") return 0;
  const broj = Number(sms);
  if (isNaN(broj)) return 0;
  // Formatiraj na 4 decimale da izvučemo minute i sekunde (kao TEXT(x,"0,0000") u Excelu)
  const neg = broj < 0;
  const aps = Math.abs(broj);
  const txt = aps.toFixed(4);                 // npr. "237.2509"
  const dio = txt.split(".");
  const stupnjevi = parseInt(dio[0], 10);
  const dec = dio[1];                          // "2509"
  const minute = parseInt(dec.substring(0, 2), 10);
  const sekunde = parseInt(dec.substring(2, 4), 10);
  const rez = stupnjevi + minute / 60 + sekunde / 3600;
  return neg ? -rez : rez;
}

// Pretvara decimalne stupnjeve natrag u string "SSS°MM'SS\""
function decimalniUSms(dec) {
  if (dec === null || dec === undefined || isNaN(dec)) return "";
  let neg = dec < 0;
  let x = Math.abs(dec);
  // normaliziraj u [0,360)
  if (x >= 360) x = x % 360;
  let stupnjevi = Math.floor(x);
  let minFloat = (x - stupnjevi) * 60;
  let minute = Math.floor(minFloat + 1e-9);
  let sekunde = Math.round((minFloat - minute) * 60);
  if (sekunde >= 60) { sekunde -= 60; minute += 1; }
  if (minute >= 60) { minute -= 60; stupnjevi += 1; }
  const pad = (n) => String(n).padStart(2, "0");
  const s = `${stupnjevi}°${pad(minute)}'${pad(sekunde)}"`;
  return neg ? "-" + s : s;
}

// Decimalne stupnjeve u radijane
function uRad(deg) { return (deg * Math.PI) / 180; }
function uDeg(rad) { return (rad * 180) / Math.PI; }

// Normalizacija ugla u raspon [0, 360)
function norm360(a) {
  a = a % 360;
  if (a < 0) a += 360;
  return a;
}

/* ---------- Direkcijski (direkcioni) ugao iz koordinata ----------
   Klasična kvadrantna formula iz Excela:
   ΔY = Yb - Ya,  ΔX = Xb - Xa
   ugao = atan(ΔY/ΔX) s korekcijom po kvadrantu                       */
function direkcijskiUgao(ya, xa, yb, xb) {
  const dY = yb - ya;
  const dX = xb - xa;
  if (dX === 0 && dY === 0) return 0;
  let a = uDeg(Math.atan(dY / dX));
  if (dY > 0 && dX > 0) return a;            // I kvadrant
  if (dY > 0 && dX < 0) return 180 + a;      // II
  if (dY < 0 && dX < 0) return 180 + a;      // III
  if (dY < 0 && dX > 0) return 360 + a;      // IV
  // na osima
  if (dX === 0 && dY > 0) return 90;
  if (dX === 0 && dY < 0) return 270;
  if (dY === 0 && dX > 0) return 0;
  if (dY === 0 && dX < 0) return 180;
  return norm360(a);
}

// Horizontalno odstojanje (dužina) iz koordinata
function odstojanje(ya, xa, yb, xb) {
  return Math.sqrt((yb - ya) ** 2 + (xb - xa) ** 2);
}

/* ---------- Redukcija kose dužine na horizont ----------
   Iz Excela (TZ): horizontalna = ABS(ROUND(kosa * SIN(RADIANS(zenitni)),3)) */
function horizontalnaDuzina(kosa, zenitniDec) {
  return Math.abs(round(kosa * Math.sin(uRad(zenitniDec)), 3));
}

/* ---------- Redukcija dužina na nultu plohu ----------
   Horizontalna dužina se množi faktorom
       k = m0 · (1 − Hm/R) · (1 + ym²/(2R²))
   Hm = srednja nadmorska visina (B i C), ym = udaljenost od srednjeg meridijana
   (iz Y koordinate: Y = zona·10⁶ + 500000 + y), R = poluosa Bessel elipsoida.
   Ovim faktorom se dobiju dužine iz Excel obrasca TO 18D (kolona "redukovana na nultu plohu"). */
const R_BESSEL = 6377397.155;
function faktorRedukcijeDuzina(Hb, Hc, Yb, Yc, m0) {
  if ([Hb, Hc, Yb, Yc].some((v) => v === null || v === undefined || isNaN(v))) return null;
  const Hm = (Hb + Hc) / 2;
  const ym = (((Yb + Yc) / 2) % 1000000) - 500000;
  const mjerilo = (m0 && m0 > 0) ? m0 : 1;   // m0 = mjerilo na srednjem meridijanu (npr. 0,9999)
  return mjerilo * (1 - Hm / R_BESSEL) * (1 + (ym * ym) / (2 * R_BESSEL * R_BESSEL));
}

function round(x, n) {
  const f = Math.pow(10, n);
  return Math.round((x + Number.EPSILON) * f) / f;
}

/* =====================================================================
   GLAVNI PRORAČUN — UMETNUTI POLIGONSKI VLAK
   ---------------------------------------------------------------------
   Ulaz (objekt):
   {
     datePocetne: { A:{Y,X}, B:{Y,X} }   // A = orijentacijska (pozadi), B = početna stanica
     dateKrajnje: { C:{Y,X}, D:{Y,X} }   // C = krajnja stanica, D = orijentacijska (naprijed)
     prelomniUglovi: [sms, sms, ...]     // lijevo mjereni prelomni uglovi na stanicama (B, T1..Tn, C)
     duzine: [d1, d2, ...]               // horizontalne dužine stranica vlaka
     nazivi: [...]                       // nazivi novih točaka (opcionalno)
   }
   ===================================================================== */
function izravnajUmetnutiVlak(ulaz) {
  const greske = [];

  // --- Direkcijski ugao početne orijentacije (A->B) i krajnje (C->D) ---
  const A = ulaz.datePocetne.A;   // orijentacijska pozadi
  const B = ulaz.datePocetne.B;   // početna stanica
  const C = ulaz.dateKrajnje.C;   // krajnja stanica
  const D = ulaz.dateKrajnje.D;   // orijentacijska naprijed

  const alfaPocetni = direkcijskiUgao(A.Y, A.X, B.Y, B.X); // smjer A->B (polazni)
  const alfaKrajnji = direkcijskiUgao(C.Y, C.X, D.Y, D.X); // smjer C->D (dolazni)

  // Prelomni uglovi u decimalne stupnjeve
  const beta = ulaz.prelomniUglovi.map(smsUDecimalni);
  const n = beta.length; // broj prelomnih (veznih) uglova

  // Dužine
  const d = ulaz.duzine.map(Number);

  if (n < 2) greske.push("Premalo prelomnih uglova.");

  /* --- KUTNO IZRAVNANJE ---
     Σβ = suma svih prelomnih i veznih uglova.

     ZATVORENI / priključni vlak (orijentacija na istu datu tačku na početku i kraju):
       Direkcioni prenos kroz vezne uglove:  ν_izračunato = αpoč + Σβ − n·180°.
       Teoretski se mora vratiti na polazni smjer:  ν_teorijsko = αpoč (mod 360°).
       Uglovno odstupanje je razlika svedena na najbliže 0 (najmanji po apsolutnoj
       vrijednosti), jer broj „poluobrta" zavisi od oblika i smjera obilaska:
         fβ = ν_teorijsko − ν_izračunato = (αpoč + m·360) − (αpoč + Σβ − n·180)
            ≡ −(Σβ − n·180) sveden na (−180°, 180°].

     UMETNUTI vlak:
       "ima"  = αpoč + Σβ ;  "treba" = αkraj + n·180 ;  fβ = treba − ima  (±360).      */
  const sumaBeta = beta.reduce((s, b) => s + b, 0);
  const zatvoreni = (ulaz.vrsta === "zatvoreni");

  let ima, treba, fBeta;
  if (zatvoreni) {
    // ν_izračunato: akumulirani direkcioni prenos kroz vezne uglove od polaznog smjera.
    //   ν = αpoč + Σβ − n·180°  (desni prelomni uglovi)
    ima = alfaPocetni + sumaBeta - n * 180;
    // ν_teorijsko: direkcioni ugao se po zatvaranju vraća na polazni smjer, s tim da se
    //   polazni i završni razlikuju tačno za 180° za neparan broj poluobrta. Zato biramo
    //   NAJBLIŽI višekratnik 180° uz αpoč — time fβ ispada najmanji po apsolutnoj vrijednosti.
    const k = Math.round((ima - alfaPocetni) / 180);
    treba = alfaPocetni + k * 180;
    fBeta = treba - ima;                 // najmanje uglovno odstupanje (±90°)
    while (fBeta > 180) fBeta -= 360;
    while (fBeta < -180) fBeta += 360;
  } else {
    ima = alfaPocetni + sumaBeta;
    treba = alfaKrajnji + n * 180;
    fBeta = treba - ima;
    // korekcija (kao u Excelu P50): dovedi u okvir ±360
    while (fBeta > 180) fBeta -= 360;
    while (fBeta < -180) fBeta += 360;
  }

  const popravakUgla = fBeta / n;             // na svaki ugao jednako

  // Dopušteno kutno odstupanje (Excel R22=0.0045 u zapisu 0°MM'SS" = 0°00'45" = 45"),
  // pomnoženo s √n:  dopušteno = 45" * √n
  // Dozvoljeno uglovno odstupanje:
  //   "stare"  (raniji Excel):  45″·√n,  n = broj prelomnih uglova
  //   "nove"   (obrasci 2019):  20″·√(n−1) = 20″·√(broj stranica)
  const novaTol = ulaz.tolerancije !== "stare";   // zadano: obrasci 2019
  const dopustenoFbetaSek = novaTol ? 20 * Math.sqrt(Math.max(1, n - 1)) : 45 * Math.sqrt(n); // u sekundama
  const fBetaSek = fBeta * 3600;               // fβ u sekundama

  // Popravljeni prelomni uglovi
  const betaPopr = beta.map((b) => b + popravakUgla);

  /* --- PRIJENOS DIREKCIJSKIH UGLOVA KROZ VLAK ---
     alfa(i) = alfa(i-1) + beta_popr(i) ± 180  (normalizirano)       */
  const alfe = [];
  let prethodni = alfaPocetni;
  for (let i = 0; i < n; i++) {
    let a = prethodni + betaPopr[i] + 180;
    a = norm360(a);
    alfe.push(a);
    prethodni = a;
  }
  // Kontrola: zadnji izračunati alfa treba ~ alfaKrajnji
  const alfaKontrola = alfe[n - 1];

  /* --- KOORDINATNE RAZLIKE (priraštaji) ---
     Δy = d * sin(alfa), Δx = d * cos(alfa)
     broj stranica vlaka = n - 1 (između B, T1..Tn-1, C)             */
  const brStranica = d.length;
  const dy = [], dx = [];
  for (let i = 0; i < brStranica; i++) {
    // direkcijski ugao stranice i je alfe[i] (smjer od stanice i prema i+1)
    const a = alfe[i] !== undefined ? alfe[i] : alfaKrajnji;
    dy.push(d[i] * Math.sin(uRad(a)));
    dx.push(d[i] * Math.cos(uRad(a)));
  }

  const sumaDy = dy.reduce((s, v) => s + v, 0);
  const sumaDx = dx.reduce((s, v) => s + v, 0);
  const sumaD = d.reduce((s, v) => s + v, 0);

  /* --- LINEARNO ODSTUPANJE ---
     fy = (Yc - Yb) - ΣΔy
     fx = (Xc - Xb) - ΣΔx
     fd = sqrt(fy² + fx²)                                            */
  const fy = (C.Y - B.Y) - sumaDy;
  const fx = (C.X - B.X) - sumaDx;
  const fd = Math.sqrt(fy * fy + fx * fx);

  // Dopušteno linearno (Excel K19): 0.0045*sqrt(Σd) + 0.0003*Σd + 0.05
  // Dozvoljeno linearno odstupanje:
  //   "stare": 0.05 + 0.0045·√Σd + 0.0003·Σd      "nove": 0.03 + 0.001·√Σd + 0.00012·Σd
  const dopustenoFd = novaTol
    ? 0.03 + 0.001 * Math.sqrt(sumaD) + 0.00012 * sumaD
    : 0.0045 * Math.sqrt(sumaD) + 0.0003 * sumaD + 0.05;

  /* --- RASPORED LINEARNIH POPRAVAKA proporcionalno dužini ---
     vy(i) = (fy/Σd) * d(i),  vx(i) = (fx/Σd) * d(i)                 */
  const vy = d.map((di) => (fy / sumaD) * di);
  const vx = d.map((di) => (fx / sumaD) * di);

  const dyPopr = dy.map((v, i) => v + vy[i]);
  const dxPopr = dx.map((v, i) => v + vx[i]);

  /* --- KONAČNE KOORDINATE ---
     Kreće od B, dodaje popravljene priraštaje                       */
  const tocke = [];
  let Y = B.Y, X = B.X;
  tocke.push({ naziv: ulaz.nazivPocetne || "B", Y: round(Y, 4), X: round(X, 4), tip: "data" });
  for (let i = 0; i < brStranica; i++) {
    Y = Y + dyPopr[i];
    X = X + dxPopr[i];
    const naziv = (ulaz.nazivi && ulaz.nazivi[i]) ? ulaz.nazivi[i] : `T${i + 1}`;
    const zadnja = (i === brStranica - 1);
    tocke.push({
      naziv: zadnja ? (ulaz.nazivKrajnje || "C") : naziv,
      Y: round(Y, 4), X: round(X, 4),
      tip: zadnja ? "data" : "nova"
    });
  }

  // Kontrola zatvaranja koordinata na C
  const odstY = round(Y - C.Y, 4);
  const odstX = round(X - C.X, 4);

  return {
    alfaPocetni, alfaKrajnji,
    beta, betaPopr, alfe,
    n, brStranica,
    sumaBeta, ima, treba,
    fBeta, fBetaSek, popravakUgla,
    dopustenoFbetaSek,
    kutnoOK: Math.abs(fBetaSek) <= dopustenoFbetaSek,
    d, dy, dx, sumaDy, sumaDx, sumaD,
    fy, fx, fd, dopustenoFd,
    linearnoOK: fd <= dopustenoFd,
    vy, vx, dyPopr, dxPopr,
    tocke,
    odstY, odstX,
    alfaKontrola,
    greske
  };
}

/* =====================================================================
   SLIJEPI POLIGONSKI VLAK
   Počinje na poznatoj tački B (s orijentacijom na poznatu A), a ne završava na poznatoj tački.
   Nema uglovnog ni linearnog odstupanja, pa nema ni popravki: direkcioni uglovi se nižu iz
   izmjerenih uglova, a koordinate iz (po potrebi redukovanih) dužina.
   Ulaz: { datePocetne:{A,B}, prelomniUglovi:[sms…] (jedan po stanici s girusom),
           duzine:[…] (jedna po stranici — isti broj kao uglova), nazivi:[…] (nove tačke),
           nazivPocetne }
   Rezultat ima isti oblik kao kod umetnutog vlaka (fβ, fd… su 0 / null).
   ===================================================================== */
function izracunajSlijepiVlak(ulaz) {
  const greske = [];
  const A = ulaz.datePocetne.A, B = ulaz.datePocetne.B;
  const alfaPocetni = direkcijskiUgao(A.Y, A.X, B.Y, B.X);
  const beta = ulaz.prelomniUglovi.map(smsUDecimalni);
  const d = ulaz.duzine.map(Number);
  const n = beta.length;
  if (n < 1) greske.push("Slijepi vlak mora imati bar jedan prelomni ugao.");
  if (d.length !== n) greske.push("Broj dužina mora biti jednak broju uglova (jedna dužina po stranici).");

  const alfe = [];
  let prethodni = alfaPocetni;
  for (let i = 0; i < n; i++) {
    const a = norm360(prethodni + beta[i] + 180);   // bez popravke ugla
    alfe.push(a);
    prethodni = a;
  }

  const dy = d.map((di, i) => di * Math.sin(uRad(alfe[i])));
  const dx = d.map((di, i) => di * Math.cos(uRad(alfe[i])));
  const sumaDy = dy.reduce((s, v) => s + v, 0);
  const sumaDx = dx.reduce((s, v) => s + v, 0);
  const sumaD = d.reduce((s, v) => s + v, 0);
  const sumaBeta = beta.reduce((s, b) => s + b, 0);

  const tocke = [{ naziv: ulaz.nazivPocetne || "B", Y: round(B.Y, 4), X: round(B.X, 4), tip: "data" }];
  let Y = B.Y, X = B.X;
  for (let i = 0; i < n; i++) {
    Y += dy[i]; X += dx[i];
    tocke.push({ naziv: (ulaz.nazivi && ulaz.nazivi[i]) ? ulaz.nazivi[i] : `T${i + 1}`,
                 Y: round(Y, 4), X: round(X, 4), tip: "nova" });
  }
  const nule = d.map(() => 0);
  return {
    slijepi: true,
    alfaPocetni, alfaKrajnji: null,
    beta, betaPopr: beta, alfe,
    n, brStranica: n,
    sumaBeta, ima: null, treba: null,
    fBeta: 0, fBetaSek: 0, popravakUgla: 0,
    dopustenoFbetaSek: null, kutnoOK: null,
    d, dy, dx, sumaDy, sumaDx, sumaD,
    fy: 0, fx: 0, fd: 0, dopustenoFd: null, linearnoOK: null,
    vy: nule, vx: nule, dyPopr: dy, dxPopr: dx,
    tocke, odstY: 0, odstX: 0,
    alfaKontrola: null,
    alfaZadnjeUnazad: n ? norm360(alfe[n - 1] + 180) : null,   // smjer zadnja tačka → prethodna
    greske
  };
}

// Export za korištenje u pregledniku
if (typeof window !== "undefined") {
  window.Racun = {
    smsUDecimalni, decimalniUSms, direkcijskiUgao, odstojanje,
    horizontalnaDuzina, izravnajUmetnutiVlak, izracunajSlijepiVlak, norm360, round, faktorRedukcijeDuzina
  };
}
// Export za Node (test)
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    smsUDecimalni, decimalniUSms, direkcijskiUgao, odstojanje,
    horizontalnaDuzina, izravnajUmetnutiVlak, izracunajSlijepiVlak, norm360, round, faktorRedukcijeDuzina
  };
}
