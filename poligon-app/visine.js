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
function izravnajVisine(stranice, visinaPocetna, visinaKrajnja) {
  const greske = [];
  // broj stranica vlaka = broj stanica - 1 (zadnja stanica je krajnja data)
  const brSt = stranice.length - 1;
  if (brSt < 1) { return { greska: "Premalo stanica za visinsko izravnanje." }; }

  const redovi = []; // po stranici
  for (let i = 0; i < brSt; i++) {
    const sNapr = stranice[i];       // stanica s koje gledamo NAPRIJED na i+1
    const sNazad = stranice[i + 1];  // sljedeća stanica gleda NAZAD na i

    const d = sNapr.horizDuzina;                 // dužina stranice (naprijed)
    // NAPRIJED: ΔH = d·cot(z_naprijed) + i_a − l_b
    const ia = sNapr.visinaInstr;
    const lb = sNapr.visinaSignalaPrednja;
    const dHnaprijed = round(d * cot(sNapr.zenitPrednja) + ia - lb, 2);

    // NAZAD: sa sljedeće stanice, zenit/dužina/signal prema PRETHODNOJ (zadnja)
    const ib = sNazad.visinaInstr;
    const la = sNazad.visinaSignalaZadnja;
    const dNazad = sNazad.horizDuzinaZadnja || d;
    const dHnazad = round(dNazad * cot(sNazad.zenitZadnja) + ib - la, 2);

    // definitivna (sredina apsolutnih, predznak od naprijed)
    const predznak = dHnaprijed >= 0 ? 1 : -1;
    const dHsred = round(predznak * (Math.abs(dHnaprijed) + Math.abs(dHnazad)) / 2, 3);

    redovi.push({
      od: sNapr.stanica, do: sNapr.nazPrednja,
      duzina: d,
      dHnaprijed, dHnazad, dHsred,
      odstojanjeKm: round(d / 100, 1),  // Excel L kolona: d/100 (u stotinama m)
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
  const sumaDH = round(redovi.reduce((s, r) => s + r.dHsred, 0), 3);
  const fh = round((visinaKrajnja - visinaPocetna) - sumaDH, 3);  // m

  // Σ odstojanja (Excel L16) i broj razlika n
  const sumaOdst = round(redovi.reduce((s, r) => s + r.odstojanjeKm, 0), 1);
  const n = redovi.length;
  // Dozvoljeno (Excel G20): (4 * (L16/n) * √n + 2) / 100   [m]
  const srOdst = sumaOdst / n;
  const dopustenoFh = round((4 * srOdst * Math.sqrt(n) + 2) / 100, 3);

  // Popravke proporcionalno odstojanju: Vi = (fh/Σodst)·odst(i)
  redovi.forEach((r) => {
    r.popravka = round((fh / sumaOdst) * r.odstojanjeKm, 3);
    r.dHpopr = round(r.dHsred + r.popravka, 3);
  });

  // Nadmorske visine
  const tocke = [];
  let H = visinaPocetna;
  tocke.push({ naziv: stranice[0].stanica, H: round(H, 3), tip: "data" });
  redovi.forEach((r, i) => {
    H = round(H + r.dHpopr, 3);
    const zadnja = (i === redovi.length - 1);
    tocke.push({
      naziv: r.do,
      H: zadnja ? round(visinaKrajnja, 3) : round(H, 3),
      tip: zadnja ? "data" : "nova"
    });
  });

  const kontrola = round(H - visinaKrajnja, 3);

  return {
    redovi, sumaDH, fh, dopustenoFh,
    visinskiOK: Math.abs(fh) <= dopustenoFh,
    sumaOdst, n, tocke, kontrola, greske
  };
}

if (typeof window !== "undefined") { window.Visine = { izravnajVisine }; }
if (typeof module !== "undefined" && module.exports) { module.exports = { izravnajVisine }; }
