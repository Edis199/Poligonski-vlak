/* =====================================================================
   visine.js — Visinsko (trigonometrijsko) izravnanje poligonskog vlaka
   Prema obrascima TO.28P i TO.K iz originalnog Excela.
   ---------------------------------------------------------------------
   Za svaku stranicu vlaka:
   - visinska razlika NAPRIJED:  ΔH_n = d·cot(z_naprijed) + i_a − l_b
   - visinska razlika NAZAD:     ΔH_z = d·cot(z_nazad)     + i_b − l_a
   - definitivna (sredina):      ΔH = (|ΔH_n| + |ΔH_z|)/2  sa predznakom ΔH_n
   Zatvaranje:  fh = (H_kraj − H_poč) − ΣΔH
   Dozvoljeno:  Δh_dop = (4 · (Σd_km_sr) · √n + K)/... (vidi Excel)
                konkretno Excel: (4*(L16/n)*√n + 2)/100  [m]
   Popravke:    Vi = (fh/Σodstojanja)·odstojanje(i)
   Visine:      H(i) = H(i-1) + (ΔH(i) + Vi)
   ===================================================================== */

function d100(r) { return r.duzina / 100; }
function cot(deg) { return 1 / Math.tan((deg * Math.PI) / 180); }
function round(x, n) { const f = Math.pow(10, n); return Math.round((x + Number.EPSILON) * f) / f; }

/* Ulaz:
   stranice = niz objekata po stanici (iz girusne obrade), redom B..C:
     {
       stanica, visinaInstr,
       nazPrednja, horizDuzina, zenitPrednja, visinaSignalaPrednja,     // mjerenje naprijed
       ... a mjerenje "nazad" dolazi sa SLJEDEĆE stanice (gleda unatrag)
     }
   visinaPocetna, visinaKrajnja = date nadmorske visine (B i C)
   Vraća rezultat s nizom tačaka i njihovim visinama.
   --------------------------------------------------------------------- */
function izravnajVisine(stranice, visinaPocetna, visinaKrajnja, faktorRedukcije, tolerancije) {
  const greske = [];
  // broj stranica vlaka = broj stanica - 1 (zadnja stanica je krajnja data)
  const brSt = stranice.length - 1;
  if (brSt < 1) { return { greska: "Premalo stanica za visinsko izravnanje." }; }

  // Način računa: s redukcijom dužina (novi Excel) → bez međuzaokruživanja (6 decimala);
  // bez redukcije → kao stari Excel (visinske razlike na cm, dužine u stotinama metara).
  const tacno = !!(faktorRedukcije && faktorRedukcije > 0);
  const pDH = tacno ? 6 : 2;   // preciznost visinskih razlika
  const pM = tacno ? 6 : 3;    // preciznost popravki, visina i ostalog

  const redovi = []; // po stranici
  for (let i = 0; i < brSt; i++) {
    const sNapr = stranice[i];       // stanica s koje gledamo NAPRIJED na i+1
    const sNazad = stranice[i + 1];  // sljedeća stanica gleda NAZAD na i

    // Dužina stranice: ako je uključena redukcija na nultu plohu, koristi se REDUKOVANA SREDINA
    // dužine naprijed i nazad (TO 18D), ista za oba smjera; inače dužina mjerena naprijed.
    const reduk = faktorRedukcije && faktorRedukcije > 0;
    const dSred = reduk ? ((sNapr.horizDuzina + sNazad.horizDuzinaZadnja) / 2) * faktorRedukcije : null;
    const d = reduk ? dSred : sNapr.horizDuzina; // dužina stranice (naprijed)
    // NAPRIJED: ΔH = d·cot(z_naprijed) + i_a − l_b
    const ia = sNapr.visinaInstr;
    const lb = sNapr.visinaSignalaPrednja;
    const dHnaprijed = round(d * cot(sNapr.zenitPrednja) + ia - lb, pDH);

    // NAZAD: sa sljedeće stanice, zenit/dužina/signal prema PRETHODNOJ (zadnja)
    const ib = sNazad.visinaInstr;
    const la = sNazad.visinaSignalaZadnja;
    const dNazad = reduk ? dSred : (sNazad.horizDuzinaZadnja || d);
    const dHnazad = round(dNazad * cot(sNazad.zenitZadnja) + ib - la, pDH);

    // definitivna (sredina apsolutnih, predznak od naprijed)
    const predznak = dHnaprijed >= 0 ? 1 : -1;
    const dHsred = round(predznak * (Math.abs(dHnaprijed) + Math.abs(dHnazad)) / 2, pM);

    redovi.push({
      od: sNapr.stanica, do: sNapr.nazPrednja,
      duzina: d,
      dHnaprijed, dHnazad, dHsred,
      odstojanjeKm: tacno ? d / 100 : round(d / 100, 1),  // Excel L kolona: d/100 (u stotinama m)
      // --- podaci za obrazac TO 28P (prikaz) ---
      vizuraNaprijed: sNapr.nazPrednja,   // na koju tačku gledamo naprijed
      zenitNaprijed: sNapr.zenitPrednja,  // zenitni ugao naprijed (dec°)
      ia,                                 // visina instrumenta na stanici "od"
      lb,                                 // visina signala na tački "do" (naprijed)
      vizuraNazad: sNazad.nazZadnja,      // nazad gledamo na "od" sa stanice "do"
      zenitNazad: sNazad.zenitZadnja,     // zenitni ugao nazad (dec°)
      ib,                                 // visina instrumenta na stanici "do"
      la                                  // visina signala na tački "od" (nazad)
    });
  }

  // Zatvaranje
  const sumaDH = round(redovi.reduce((s, r) => s + r.dHsred, 0), pM);
  const fh = round((visinaKrajnja - visinaPocetna) - sumaDH, pM);  // m

  // Σ odstojanja (Excel L16) i broj razlika n
  const sumaOdst = tacno ? redovi.reduce((s, r) => s + r.odstojanjeKm, 0) : round(redovi.reduce((s, r) => s + r.odstojanjeKm, 0), 1);
  const n = redovi.length;
  // Dozvoljeno (Excel G20): (4 * (L16/n) * √n + 2) / 100   [m]
  //   "nove" (obrasci 2019): n' = broj stranica − 1, Σ bez zaokruživanja: (4·Σ/√n' + 2)/100
  const novaTol = tolerancije === "nove";
  let dopustenoFh;
  if (novaTol) {
    const sumaT = redovi.reduce((s, r) => s + d100(r), 0);
    const nn = Math.max(1, n - 1);
    dopustenoFh = round((4 * (sumaT / nn) * Math.sqrt(nn) + 2) / 100, 3);
  } else {
    const srOdst = sumaOdst / n;
    dopustenoFh = round((4 * srOdst * Math.sqrt(n) + 2) / 100, 3);
  }

  // Popravke proporcionalno odstojanju: Vi = (fh/Σodst)·odst(i)
  redovi.forEach((r) => {
    r.popravka = round((fh / sumaOdst) * r.odstojanjeKm, pM);
    r.dHpopr = round(r.dHsred + r.popravka, pM);

    // --- dodatni podaci za Obrazac "K" (izravnanje visina) ---
    // Prvo mjerenje = ΔH naprijed; Drugo mjerenje = ΔH nazad sa predznakom prvog
    r.prvoMjerenje = round(r.dHnaprijed, pM);
    const predznak = r.dHnaprijed < 0 ? -1 : 1;
    r.drugoMjerenje = round(predznak * Math.abs(r.dHnazad), pM);
    // Razlike dvostrukog mjerenja (Excel: (Drugo − Prvo)·100, u mm)
    r.razlikaDvostruko = round((r.drugoMjerenje - r.prvoMjerenje) * 100, 0);
    // Maksimalno dozvoljeno po stranici: 0.00075·(1+cot²(z))·D  [m] -> ·100 [mm]
    const c = cot(r.zenitNaprijed);
    // "stare": 0.00075·(1+cot²z)·D ; "nove": 0.02 + 0.0004·D   [m] -> ·100
    r.maxDozMM = novaTol
      ? round((0.02 + 0.0004 * r.duzina) * 100, 0)
      : round(0.00075 * (1 + c * c) * r.duzina * 100, 0);
  });

  // Nadmorske visine
  const tocke = [];
  let H = visinaPocetna;
  tocke.push({ naziv: stranice[0].stanica, H: round(H, pM), tip: "data" });
  redovi.forEach((r, i) => {
    H = round(H + r.dHpopr, pM);
    const zadnja = (i === redovi.length - 1);
    tocke.push({
      naziv: r.do,
      H: zadnja ? round(visinaKrajnja, pM) : round(H, pM),
      tip: zadnja ? "data" : "nova"
    });
  });

  const kontrola = round(H - visinaKrajnja, pM);

  return {
    redovi, sumaDH, fh, dopustenoFh,
    visinskiOK: Math.abs(fh) <= dopustenoFh,
    sumaOdst, n, tocke, kontrola, greske
  };
}

if (typeof window !== "undefined") { window.Visine = { izravnajVisine }; }
if (typeof module !== "undefined" && module.exports) { module.exports = { izravnajVisine }; }
