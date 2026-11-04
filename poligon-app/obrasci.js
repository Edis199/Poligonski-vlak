/* =====================================================================
   obrasci.js — Generiranje službenih geodetskih obrazaca (TO.25, TO.19)
   vjerno originalnim Excel/PDF obrascima.
   ===================================================================== */

// pomoćno: broj s zarezom kao decimalnim (geodetski zapis)
function fz(x, dec) {
  if (x === null || x === undefined || isNaN(x)) return "";
  return Number(x).toFixed(dec).replace(".", ",");
}

/* --------- OBRAZAC 25: Spisak koordinata i nadmorskih visina ---------
   dateTacke = [{naziv,Y,X,H}], noveTacke = [{naziv,Y,X,H}]              */
function obrazac25(dateTacke, noveTacke, minPraznih = 12) {
  let redovi = "";

  // razmak red
  const prazanRed = `<tr>${'<td>&nbsp;</td>'.repeat(6)}</tr>`;

  redovi += prazanRed;
  // naslov sekcije DATE TAČKE
  redovi += `<tr><td></td><td></td><td colspan="3" class="sekcija crvena">DATE TAČKE</td><td></td></tr>`;
  dateTacke.forEach((t) => {
    redovi += `<tr class="crveni-tekst">
      <td class="c">${t.naziv ?? ""}</td>
      <td></td>
      <td class="d">${fz(t.Y, 3)}</td>
      <td class="d">${fz(t.X, 3)}</td>
      <td class="d">${fz(t.H, 3)}</td>
      <td></td>
    </tr>`;
  });

  redovi += prazanRed;
  redovi += `<tr><td></td><td></td><td colspan="3" class="sekcija">NOVOODREĐENE TAČKE</td><td></td></tr>`;
  noveTacke.forEach((t) => {
    redovi += `<tr>
      <td class="c">${t.naziv ?? ""}</td>
      <td></td>
      <td class="d">${fz(t.Y, 3)}</td>
      <td class="d">${fz(t.X, 3)}</td>
      <td class="d">${fz(t.H, 3)}</td>
      <td></td>
    </tr>`;
  });

  // dopuni praznim redovima
  const dodati = Math.max(0, minPraznih - noveTacke.length);
  for (let i = 0; i < dodati; i++) {
    redovi += `<tr>${'<td>&nbsp;</td>'.repeat(6)}</tr>`;
  }

  return `
  <table class="obrazac obrazac25">
    <thead>
      <tr><td colspan="6" class="naslov">SPISAK KOORDINATA I NADMORSKIH VISINA TAČAKA</td></tr>
      <tr class="zaglavlje-red">
        <th class="w-naziv">Oznaka, broj i<br>naziv tačke</th>
        <th class="w-gdje"><span class="uspravno">Gdje su sračunate<br>kote i koordinate</span></th>
        <th>Ordinata<br>Y<br>m</th>
        <th>Apcisa<br>X<br>m</th>
        <th>Nadmorska<br>visina<br>m</th>
        <th>Primjedba</th>
      </tr>
    </thead>
    <tbody>${redovi}</tbody>
  </table>`;
}

/* --------- OBRAZAC 19: Izravnanje poligonskog vlaka ---------
   r  = rezultat položajnog izravnanja (iz racun.js)
   ctx = { nazivA }
   Struktura (kao u originalu): naizmjenično red "ugao" i red "tačka".
   Svaka tačka se pojavljuje TOČNO JEDNOM.                               */
function obrazac19(r, ctx) {
  const D = (typeof window !== "undefined" ? window.Racun : require("./racun.js")).decimalniUSms;
  const ug = (dec) => D(dec);                              // "74°28'48\""
  const vbeta = (r.popravakUgla >= 0 ? "" : "-") + ug(Math.abs(r.popravakUgla));

  const tocke = r.tocke;          // [B, nove..., C]
  const PRAZNO = 10;              // broj kolona

  let redovi = "";

  // --- Red orijentacije: naziv A + direkcioni ugao A->B (alfaPocetni) ---
  redovi += red([
    "", ctx.nazivA, "", ug(r.alfaPocetni), "", "", "", "", "", ""
  ]);

  // --- Za svaku tačku vlaka (B, T1..Tn-1, C) ---
  // n = broj prelomnih uglova = broj tačaka vlaka
  for (let i = 0; i < r.n; i++) {
    const tk = tocke[i];
    const naz = tk ? tk.naziv : "";
    // mali red popravke vβ (iznad prelomnog ugla)
    redovi += red(["", "", `<span class="mali">${vbeta}</span>`, "", "", "", "", "", "", ""], "tanko");

    // glavni red tačke
    const imaStr = (i < r.brStranica);               // stranica postoji (osim zadnje tačke)
    const dir = (i < r.alfe.length && imaStr) ? ug(r.alfe[i]) : "";
    const duz = imaStr ? fz(r.d[i], 2) : "";
    const dy  = imaStr ? fz(r.dy[i], 3) : "";
    const dx  = imaStr ? fz(r.dx[i], 3) : "";
    const Y = tk ? fz(tk.Y, 3) : "";
    const X = tk ? fz(tk.X, 3) : "";
    redovi += red([
      "", naz, ug(r.beta[i]), dir, duz, dy, dx, Y, X, naz
    ]);
  }

  // --- Σ red (sume dužina i priraštaja) ---
  redovi += red([
    "", "Σ", "", "", fz(r.sumaD,3),
    fz(r.sumaDy,3), fz(r.sumaDx,3), "", "", ""
  ], "suma-red");

  // --- Donji blok: treba / ima / fβ / vβ / Δβ / fd / Δd ---
  const fbetaStr = (r.fBeta < 0 ? "-" : "") + ug(Math.abs(r.fBeta));
  const dBetaStr = ug(r.dopustenoFbetaSek / 3600);
  redovi += red(["", "treba", formatBigAngle(r.treba), "", "", `fy=${fz(r.fy,3)}`, `fx=${fz(r.fx,3)}`, "", "", ""]);
  redovi += red(["", "ima", formatBigAngle(r.ima), "", "fd=", fz(r.fd,3), "", "", "", ""]);
  redovi += red(["", "f<sub>β</sub>=", fbetaStr, "Δβ= "+dBetaStr, "Δd=", fz(r.dopustenoFd,3), "", "", "", ""]);
  redovi += red(["", "v<sub>β</sub>=", vbeta, "", "", "", "", "", "", ""]);

  // nekoliko praznih redova
  for (let i = 0; i < 4; i++) redovi += `<tr>${'<td>&nbsp;</td>'.repeat(PRAZNO)}</tr>`;

  return `
  <div class="obrazac-naslov-linija">Trigonom. obrazac br.19</div>
  <table class="obrazac obrazac19">
    <thead>
      <tr class="zaglavlje-red">
        <th class="uspravno-col"><span class="uspravno">Broj vlaka</span></th>
        <th class="uspravno-col"><span class="uspravno">Broj tačke</span></th>
        <th>Prelomni i<br>vezni uglovi</th>
        <th>Direkcioni<br>uglovi</th>
        <th>Dužine</th>
        <th colspan="2">Koordinatne razlike</th>
        <th colspan="2">Koordinate</th>
        <th class="uspravno-col"><span class="uspravno">Broj tačke</span></th>
      </tr>
      <tr class="zaglavlje-red pod">
        <th></th><th></th><th></th><th></th><th></th>
        <th>&Delta;y</th><th>&Delta;x</th><th>Y</th><th>X</th><th></th>
      </tr>
    </thead>
    <tbody>${redovi}</tbody>
  </table>`;
}

// pomoćno: sastavi <tr> iz niza ćelija; prva, 2. i 10. su centrirane, 5-9 desno
function red(celije, klasa) {
  const poravnanje = (i) => {
    if (i === 1 || i === 2 || i === 3 || i === 9) return "c";
    if (i >= 4 && i <= 8) return "d";
    return "";
  };
  const tds = celije.map((v, i) => `<td class="${poravnanje(i)}">${v === "" ? "&nbsp;" : v}</td>`).join("");
  return `<tr${klasa ? ` class="${klasa}"` : ""}>${tds}</tr>`;
}

// veliki ugao (preko 360) prikaži kao SSS°MM'SS" bez normalizacije
function formatBigAngle(dec){
  const neg = dec < 0; let x = Math.abs(dec);
  let s = Math.floor(x); let mF=(x-s)*60; let m=Math.floor(mF+1e-9); let se=Math.round((mF-m)*60);
  if(se>=60){se-=60;m++;} if(m>=60){m-=60;s++;}
  const p=(k)=>String(k).padStart(2,"0");
  return (neg?"-":"")+`${s}°${p(m)}'${p(se)}"`;
}

/* --------- OBRAZAC TZ: Tahimetrijski zapisnik ---------
   ucitaneStanice = [{ stanica, visinaInstr, mjerenja:[{vizura,kod,horiz,zenit,kosa,visinaSignala}] }]
   Prikazuje sirova mjerenja (ista koja su učitana), s izračunatom
   horizontalnom dužinom = |kosa · sin(zenit)|.                          */
function obrazacTZ(ucitaneStanice, lokalitet) {
  const G = (typeof window !== "undefined" ? window.Girus : require("./girus.js"));
  // parsiraj ugao pa formatiraj natrag u °,mm'ss" (kao original)
  const ugStr = (v) => {
    const dec = G.parsirajUgao(v);
    if (dec === null) return "";
    return G.decUStr(dec);
  };
  const horiz = (kosa, zenitStr) => {
    const z = G.parsirajUgao(zenitStr);
    if (z === null || isNaN(kosa)) return "";
    const h = Math.abs(Math.round(kosa * Math.sin(z * Math.PI / 180) * 1000) / 1000);
    return fz(h, 2);
  };

  let redovi = "";
  (ucitaneStanice || []).forEach((st) => {
    // red stanice (naziv) + ispod visina instrumenta (u prvoj koloni)
    redovi += `<tr class="tz-stanica">
      <td class="c">${st.stanica ?? ""}</td>
      <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
    </tr>`;
    redovi += `<tr class="tz-vi">
      <td class="c">${fz(st.visinaInstr, 3)}</td>
      <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
    </tr>`;
    // redovi mjerenja
    (st.sviRedovi || st.mjerenja || []).forEach((m) => {
      redovi += `<tr>
        <td></td>
        <td class="c">${m.vizura ?? ""}</td>
        <td class="c">${m.kod ?? ""}</td>
        <td class="c">${ugStr(m.horiz)}</td>
        <td class="c">${ugStr(m.zenit)}</td>
        <td class="d">${fz(Number(m.kosa), 3)}</td>
        <td class="d">${horiz(Number(m.kosa), m.zenit)}</td>
        <td class="d">${fz(Number(m.visinaSignala), 3)}</td>
        <td></td>
      </tr>`;
    });
  });

  // dopuni praznim redovima do npr. 4 reda
  for (let i = 0; i < 4; i++) redovi += `<tr>${'<td>&nbsp;</td>'.repeat(9)}</tr>`;

  return `
  <table class="obrazac obrazacTZ">
    <thead>
      <tr><td colspan="9" class="naslov">TAHIMETRIJSKI ZAPISNIK</td></tr>
      <tr class="podnaslov-red">
        <td class="c" colspan="2">LOKALITET: ${lokalitet || ""}</td>
        <td colspan="7"></td>
      </tr>
      <tr class="zaglavlje-red">
        <th>Stanica i</th>
        <th>Vizura</th>
        <th>Kod</th>
        <th>Horizontalni<br>ugao</th>
        <th>Zenitni<br>ugao</th>
        <th>Kosa<br>dužina</th>
        <th>Horizontalna<br>dužina</th>
        <th>Visina<br>signala</th>
        <th>Primjedba</th>
      </tr>
    </thead>
    <tbody>${redovi}</tbody>
  </table>`;
}

/* --------- OBRAZAC TO 1 i 2: Girusno mjerenje horizontalnih pravaca ---------
   obradjeneStanice = niz iz girusne obrade (svaka ima girusDetalji, pravci...)   */
function obrazac1i2(obradjeneStanice) {
  const G = (typeof window !== "undefined" ? window.Girus : require("./girus.js"));
  const ug = (dec) => (dec === null || dec === undefined || isNaN(dec)) ? "" : G.decUStr(dec);
  const sekZnak = (s) => (s === "" || s === null || isNaN(s)) ? "" : (s > 0 ? "+" : "") + s;

  let redovi = "";
  (obradjeneStanice || []).forEach((st) => {
    if (st.greska || !st.girusDetalji) return;
    const brG = st.girusDetalji.length;

    st.girusDetalji.forEach((gd, gi) => {
      const oznaka = (gi === 0) ? "I" : (gi === 1 ? "II" : `${gi + 1}`);
      // prvi girus, prvi red = stanica naziv
      const stanNaziv = (gi === 0) ? st.stanica : oznaka;

      // red ZADNJA
      const srZadRed = (gi === 0) ? ug(0) : "";  // redukovana zadnja uvijek 0 (orijentacija)
      redovi += `<tr>
        <td class="c">${gi === 0 ? st.stanica : oznaka}</td>
        <td class="c">${gd.zadnja.vizura}</td>
        <td class="c">${ug(gd.zadnja.iPolu)}</td>
        <td class="c">${ug(gd.zadnja.iiPolu)}</td>
        <td class="c mali">${sekZnak(gd.zadnja.dvoC)}</td>
        <td class="c">${ug(gd.zadnja.sredina)}</td>
        <td class="c">${ug(0)}</td>
        <td class="c">${gi === 0 ? ug(0) : ""}</td>
      </tr>`;
      // red PREDNJA
      const redukPrednja = razlika360pub(gd.prednja.sredina, gd.zadnja.sredina);
      const srGirusa = (gi === 0) ? ug(st.prelomniUgao) : "";
      redovi += `<tr>
        <td class="c">${gi === 0 ? "I" : (gi===1?"II":"")}</td>
        <td class="c">${gd.prednja.vizura}</td>
        <td class="c">${ug(gd.prednja.iPolu)}</td>
        <td class="c">${ug(gd.prednja.iiPolu)}</td>
        <td class="c mali">${sekZnak(gd.prednja.dvoC)}</td>
        <td class="c">${ug(gd.prednja.sredina)}</td>
        <td class="c">${ug(redukPrednja)}</td>
        <td class="c">${srGirusa}</td>
      </tr>`;
      // razmak red između girusa/stanica
      redovi += `<tr class="tz-vi"><td colspan="8">&nbsp;</td></tr>`;
    });
  });

  return `
  <div class="obrazac-naslov-linija">Trigonometrijski obrazac 1 i 2</div>
  <table class="obrazac obrazac1i2">
    <thead>
      <tr class="zaglavlje-red">
        <th>Stanica<br>Girus</th>
        <th>Vizurna<br>tačka</th>
        <th>I Polugirus<br>A</th>
        <th>II Polugirus<br>B</th>
        <th>2C<br>kolim.</th>
        <th>Sredina</th>
        <th>Redukovana<br>sredina</th>
        <th>Sredina iz<br>svih girusa</th>
      </tr>
    </thead>
    <tbody>${redovi}</tbody>
  </table>`;
}

// javna razlika360 (prednja - zadnja) svedena u [0,360)
function razlika360pub(a, b) {
  let d = a - b;
  while (d < 0) d += 360;
  while (d >= 360) d -= 360;
  return d;
}

/* --------- OBRAZAC TO 1V: Vertikalni (visinski) uglovi --------- */
function obrazac1V(obradjeneStanice) {
  const G = (typeof window !== "undefined" ? window.Girus : require("./girus.js"));
  const ug = (dec) => (dec === null || dec === undefined || isNaN(dec)) ? "" : G.decUStr(dec);

  // jedan red para (stanica->vizura): KL, KD, zbroj(2HV), dvostruki visinski, visinski ugao
  function redPara(stanNaziv, vi, p) {
    const zbroj = p.zbrojZen;                 // 2(H.V.) = K.L.+K.D. ≈ 360°
    const dvostruki = p.dvostrukiVis;         // dvostruki visinski ugao (K.L.-K.D.+360)
    const srednjiZen = p.srZenit;             // visinski ugao = dvostruki/2
    return `
      <tr>
        <td class="c">${stanNaziv}</td>
        <td class="c">${p.vizura}</td>
        <td class="c">${ug(p.zenitKL)}</td>
        <td class="c">${ug(p.zenitKD)}</td>
        <td class="c">${ug(zbroj)}</td>
        <td class="c">${ug(dvostruki)}</td>
        <td class="c">${ug(srednjiZen)}</td>
      </tr>
      <tr class="tz-vi">
        <td class="c">${vi ? fz(vi,3) : ""}</td>
        <td class="c">${fz(p.visSignala,3)}</td>
        <td colspan="5"></td>
      </tr>`;
  }

  let redovi = "";
  (obradjeneStanice || []).forEach((st) => {
    if (st.greska || !st.girusDetalji || !st.girusDetalji.length) return;
    const gd = st.girusDetalji[st.girusDetalji.length - 1]; // vertikalni uglovi — iz zadnjeg girusa (kao u Excelu)
    // red na zadnju i na prednju
    redovi += redPara(st.stanica, st.visinaInstr, gd.zadnja);
    redovi += redPara(st.stanica, st.visinaInstr, gd.prednja);
    redovi += `<tr class="razmak"><td colspan="6">&nbsp;</td></tr>`;
  });

  return `
  <div class="obrazac-naslov-linija">Trigonometrijski obrazac 1V</div>
  <table class="obrazac obrazac1v">
    <thead>
      <tr class="zaglavlje-red">
        <th>Stanica<br>(vis. instr.)</th>
        <th>Vizurna tačka<br>(vis. signala)</th>
        <th>I Krug lijevo<br>K.L.</th>
        <th>II Krug desno<br>K.D.</th>
        <th>2(H.V.)=<br>K.L.+K.D.</th>
        <th>Dvostruki<br>visinski ugao<br>2&alpha;</th>
        <th>Visinski<br>ugao</th>
      </tr>
    </thead>
    <tbody>${redovi}</tbody>
  </table>`;
}

/* --------- OBRAZAC TO 18D: Redukcija dužina ---------
   Za svaku stranicu vlaka, u dva reda (naprijed / nazad): mjerena kosa dužina,
   zenitni ugao i dužina redukovana na horizont i nultu plohu (faktor k).
   Zadnja kolona je redukovana sredina mjerenja naprijed–nazad (ona ulazi u izravnanje).
   faktor = k (npr. 0,99992279) ili null/undefined = bez redukcije.            */
function obrazac18D(obradjeneStanice, faktor) {
  const G = (typeof window !== "undefined" ? window.Girus : require("./girus.js"));
  const ug = (dec) => (dec === null || dec === undefined || isNaN(dec)) ? "" : G.decUStr(dec);
  const k = (faktor && faktor > 0) ? faktor : 1;
  const imaRed = k !== 1;
  const horiz = (kosa, zenitDec) => kosa * Math.sin((zenitDec * Math.PI) / 180);

  let redovi = "";
  const n = (obradjeneStanice || []).length;
  // stranice: od stanice i -> prednja (i+1). Zadnja stanica nema prednju stranicu.
  for (let i = 0; i < n - 1; i++) {
    const st = obradjeneStanice[i];
    const sljed = obradjeneStanice[i + 1];
    if (st.greska || !sljed || sljed.greska) continue;
    const kosaNap = st.kosaPrednja;          // st -> prednja tačka
    const kosaNaz = sljed.kosaZadnja;        // sljedeća stanica -> st
    const fNap = horiz(kosaNap, st.zenitPrednja) * k;
    const fNaz = horiz(kosaNaz, sljed.zenitZadnja) * k;
    const sredina = (fNap + fNaz) / 2;

    redovi += `
      <tr>
        <td class="c">${st.stanica}</td>
        <td class="d">${fz(kosaNap, 3)}</td>
        <td class="c" rowspan="2"></td>
        <td class="c">${ug(st.zenitPrednja)}</td>
        <td class="d">${fz(fNap, 3)}</td>
        <td class="d" rowspan="2">${fz(sredina, 3)}</td>
        <td rowspan="2"></td>
      </tr>
      <tr class="tz-vi">
        <td class="c">${st.nazPrednja}</td>
        <td class="d">${fz(kosaNaz, 3)}</td>
        <td class="c">${ug(sljed.zenitZadnja)}</td>
        <td class="d">${fz(fNaz, 3)}</td>
      </tr>
      <tr class="razmak"><td colspan="7">&nbsp;</td></tr>`;
  }

  const napomena = imaRed
    ? `<div class="obrazac-podnaslov">Faktor redukcije na nultu plohu: k = ${String(k.toFixed(8)).replace(".", ",")}</div>`
    : "";

  return `
  <div class="obrazac-naslov-linija">Trigon. obrazac br. 18D — Redukcija dužina</div>
  ${napomena}
  <table class="obrazac obrazac18d">
    <thead>
      <tr class="zaglavlje-red">
        <th>Od<br>Do</th>
        <th>Mjerena dužina<br>(sredina)</th>
        <th>Temperatura</th>
        <th>Vertikalni<br>ugao</th>
        <th>${imaRed ? "Dužina redukovana<br>na nultu plohu" : "Horizontalna<br>dužina"}</th>
        <th>Redukovana sredina<br>mjerenja naprijed–nazad</th>
        <th>Primjedba</th>
      </tr>
    </thead>
    <tbody>${redovi}</tbody>
  </table>`;
}

/* --------- OBRAZAC TO 8: Direkcioni uglovi i odstojanja iz koordinata ---------
   date = { A:{naziv,Y,X}, B:{...}, C:{...}, D:{...} }
   Računa orijentacijske smjerove: A->B (polazni) i C->D (dolazni).          */
function obrazac8(date) {
  const R = (typeof window !== "undefined" ? window.Racun : require("./racun.js"));
  const ug = (dec) => R.decimalniUSms(dec);

  // jedan blok: smjer od T1 prema T2
  function blok(T1, T2) {
    const dY = T2.Y - T1.Y;
    const dX = T2.X - T1.X;
    const alfa = R.direkcijskiUgao(T1.Y, T1.X, T2.Y, T2.X);
    const d = R.odstojanje(T1.Y, T1.X, T2.Y, T2.X);
    return `
      <tr>
        <td class="c">${T2.naziv}</td>
        <td class="d">${fz(T2.Y,3)}</td>
        <td class="d">${fz(T2.X,3)}</td>
        <td class="c" rowspan="2">${ug(alfa)}</td>
        <td class="d" rowspan="2">${fz(d,2)}</td>
      </tr>
      <tr>
        <td class="c">${T1.naziv}</td>
        <td class="d">${fz(T1.Y,3)}</td>
        <td class="d">${fz(T1.X,3)}</td>
      </tr>
      <tr class="tz-vi">
        <td class="c">&Delta;</td>
        <td class="d">${fz(dY,3)}</td>
        <td class="d">${fz(dX,3)}</td>
        <td colspan="2"></td>
      </tr>
      <tr class="razmak"><td colspan="5">&nbsp;</td></tr>`;
  }

  // polazni smjer A->B i dolazni C->D
  const redovi = blok(date.A, date.B) + blok(date.C, date.D);

  return `
  <div class="obrazac-naslov-linija">Trigonom. obrazac br.8 — Direkcioni uglovi i odstojanja</div>
  <table class="obrazac obrazac8">
    <thead>
      <tr class="zaglavlje-red">
        <th>Tačke<br>Tb / Ta</th>
        <th>Y<br>(&Delta;Y = Yb−Ya)</th>
        <th>X<br>(&Delta;X = Xb−Xa)</th>
        <th>Direkcioni<br>ugao</th>
        <th>Odstojanje<br>d (m)</th>
      </tr>
    </thead>
    <tbody>${redovi}</tbody>
  </table>`;
}

/* --------- OBRAZAC TO 28P: Trigonometrijska nivelacija (visinske razlike) ---------
   rez = rezultat iz Visine.izravnajVisine(...):
     rez.redovi[] = { od, do, duzina,
                      vizuraNaprijed, zenitNaprijed, ia, lb, dHnaprijed,
                      vizuraNazad,    zenitNazad,    ib, la, dHnazad,
                      dHsred }
   Prikaz vjeran Excel obrascu 28P: svaka stranica = dva reda (od/do).       */
function obrazac28P(rez) {
  const G = (typeof window !== "undefined" ? window.Girus : require("./girus.js"));
  const ug = (dec) => (dec === null || dec === undefined || isNaN(dec)) ? "" : G.decUStr(dec);

  let redovi = "";
  (rez.redovi || []).forEach((r) => {
    // odstupanje između mjerenja naprijed i nazad (u metrima)
    const odst = Math.abs(r.dHnaprijed + r.dHnazad);
    // dozvoljeno odstupanje po stranici (u metrima; interno u cm)
    const dozv = (r.maxDozMM || 0) / 100;   // maxDozMM je u cm → m
    // gornji red: vizura + ia/ib + odstupanje i dozvoljeno odstupanje
    // donji red: zenitni ugao + lb/la + definitivna visinska razlika
    redovi += `
      <tr>
        <td class="c">${r.od}</td>
        <td class="d" rowspan="2">${fz(r.duzina, 3)}</td>
        <td class="c">${r.vizuraNaprijed || ""}</td>
        <td class="d">${fz(r.ia, 3)}</td>
        <td class="d" rowspan="2">${fz(r.dHnaprijed, 3)}</td>
        <td class="c">${r.vizuraNazad || ""}</td>
        <td class="d">${fz(r.ib, 3)}</td>
        <td class="d" rowspan="2">${fz(r.dHnazad, 3)}</td>
        <td class="d">${fz(odst, 3)}</td>
        <td class="d">${fz(dozv, 3)}</td>
      </tr>
      <tr class="tz-vi">
        <td class="c">${r.do}</td>
        <td class="c">${ug(r.zenitNaprijed)}</td>
        <td class="d">${fz(r.lb, 3)}</td>
        <td class="c">${ug(r.zenitNazad)}</td>
        <td class="d">${fz(r.la, 3)}</td>
        <td class="c" colspan="2">${fz(r.dHsred, 3)}</td>
      </tr>
      <tr class="razmak"><td colspan="10">&nbsp;</td></tr>`;
  });

  return `
  <div class="obrazac-naslov-linija">Trigonom. obrazac br.28P — Trigonometrijska nivelacija</div>
  <table class="obrazac obrazac28p">
    <thead>
      <tr class="zaglavlje-red">
        <th rowspan="2">od A<br>do B</th>
        <th rowspan="2">Dužina<br>D (m)</th>
        <th colspan="3">Mjerenje naprijed (A &ndash; B)</th>
        <th colspan="3">Mjerenje nazad (B &ndash; A)</th>
        <th colspan="2">Odstupanje / dozvoljeno<br>Definitivna visinska razlika (m)</th>
      </tr>
      <tr class="zaglavlje-red">
        <th>Vizura /<br>zenit. ugao</th>
        <th>i<sub>a</sub> / l<sub>b</sub></th>
        <th>&Delta;H (m)<br>naprijed</th>
        <th>Vizura /<br>zenit. ugao</th>
        <th>i<sub>b</sub> / l<sub>a</sub></th>
        <th>&Delta;H (m)<br>nazad</th>
        <th>Odstupanje<br>(m)</th>
        <th>Dozvoljeno<br>(m)</th>
      </tr>
    </thead>
    <tbody>${redovi}</tbody>
  </table>`;
}

/* --------- OBRAZAC "K": Izravnanje visina (nadmorske visine) ---------
   rez = rezultat iz Visine.izravnajVisine(...):
     rez.redovi[] = { od, do, prvoMjerenje, drugoMjerenje, dHsred,
                      razlikaDvostruko, maxDozMM, popravka, dHpopr, odstojanjeKm }
     rez.tocke[]  = { naziv, H }
   Prikaz vjeran Excel "Obrazac K".                                         */
function obrazacK(rez) {
  // visinska mapa po nazivu tačke
  const Hmap = {};
  (rez.tocke || []).forEach((t) => { Hmap[t.naziv] = t.H; });

  let redovi = "";
  const red = rez.redovi || [];
  red.forEach((r, i) => {
    const Hod = Hmap[r.od];
    redovi += `
      <tr>
        <td class="c tz-stanica2">${r.od}</td>
        <td class="c"></td>
        <td class="d"></td><td class="d"></td><td class="d"></td>
        <td class="d"></td><td class="d"></td><td class="d"></td><td class="d"></td>
        <td class="d">${fz(Hod, 3)}</td>
      </tr>
      <tr class="tz-vi">
        <td class="c"></td>
        <td class="c">K&#8209;1 / TO&nbsp;28P</td>
        <td class="d">${fz(r.prvoMjerenje, 3)}</td>
        <td class="d">${fz(r.drugoMjerenje, 3)}</td>
        <td class="d">${fz(r.dHsred, 3)}</td>
        <td class="d">${r.razlikaDvostruko}</td>
        <td class="d">${r.maxDozMM}</td>
        <td class="d">${fz(r.popravka, 3)}</td>
        <td class="d">${fz(r.dHpopr, 3)}</td>
        <td class="d"></td>
      </tr>`;
  });
  // zadnja tačka (krajnja) — samo visina
  const zadnja = red.length ? red[red.length - 1].do : null;
  if (zadnja) {
    redovi += `
      <tr>
        <td class="c tz-stanica2">${zadnja}</td>
        <td class="c"></td>
        <td class="d"></td><td class="d"></td><td class="d"></td>
        <td class="d"></td><td class="d"></td><td class="d"></td><td class="d"></td>
        <td class="d">${fz(Hmap[zadnja], 3)}</td>
      </tr>`;
  }

  // suma red
  const sPrvo = rez.redovi.reduce((s, r) => s + r.prvoMjerenje, 0);
  const sDrugo = rez.redovi.reduce((s, r) => s + r.drugoMjerenje, 0);
  const sSred = rez.sumaDH;
  const sPopr = rez.redovi.reduce((s, r) => s + r.popravka, 0);
  const sDHpopr = rez.redovi.reduce((s, r) => s + r.dHpopr, 0);
  const fhMM = Math.round(rez.fh * 1000);
  const dopMM = Math.round(rez.dopustenoFh * 1000);
  const ok = rez.visinskiOK ? "zadovoljava" : "NE zadovoljava";

  const suma = `
    <tr class="tz-sum">
      <td class="c" colspan="2">&Sigma;</td>
      <td class="d">${fz(sPrvo, 3)}</td>
      <td class="d">${fz(sDrugo, 3)}</td>
      <td class="d">${fz(sSred, 3)}</td>
      <td class="d"></td>
      <td class="d"></td>
      <td class="d">${fz(sPopr, 3)}</td>
      <td class="d">${fz(sDHpopr, 3)}</td>
      <td class="d"></td>
    </tr>
    <tr class="tz-sum">
      <td colspan="10">
        f<sub>h</sub> = ${fhMM} mm &nbsp;&nbsp;|&nbsp;&nbsp;
        dozvoljeno &Delta;h = &plusmn;${dopMM} mm &nbsp;(${ok})
      </td>
    </tr>`;

  return `
  <div class="obrazac-naslov-linija">Obrazac „K" — Izravnanje visina</div>
  <table class="obrazac obrazacK">
    <thead>
      <tr class="zaglavlje-red">
        <th rowspan="2">Brojevi<br>tačaka</th>
        <th rowspan="2">Podaci<br>uzeti</th>
        <th colspan="3">Visinske razlike (m)</th>
        <th rowspan="2">Razlike<br>dvostr.<br>mjer. (cm)</th>
        <th rowspan="2">Maks.<br>dozvolj.<br>(cm)</th>
        <th rowspan="2">Popravke<br>V<sub>i</sub> (m)</th>
        <th rowspan="2">Poprav-<br>ljene<br>&Delta;H (m)</th>
        <th rowspan="2">Nadmor.<br>visine<br>(m)</th>
      </tr>
      <tr class="zaglavlje-red">
        <th>Prvo<br>mjer.</th>
        <th>Drugo<br>mjer.</th>
        <th>Sredina<br>(&Delta;H)</th>
      </tr>
    </thead>
    <tbody>${redovi}${suma}</tbody>
  </table>`;
}

/* --------- OBRAZAC: Računanje koordinata detaljnih tačaka ---------
   rez = rezultat iz Detalj.izracunajDetalje(...)
   Raspored kao u Excelu "Računanje detalja": za svaku stanicu red sa stanicom
   i njenim koordinatama, red orijentacije (zadnja tačka), pa detaljne tačke.   */
function obrazacDetalji(rez) {
  const G = (typeof window !== "undefined" ? window.Girus : require("./girus.js"));
  const ug = (dec) => (dec === null || dec === undefined || isNaN(dec)) ? "" : G.decUStr(dec);
  const prazno = (n) => "<td></td>".repeat(n);

  let redovi = "";
  (rez.stanice || []).forEach((s) => {
    if (!s.tacke.length) return;          // stanice bez detalja se ne prikazuju
    const o = s.orijentacija;
    // red stanice: naziv + koordinate stanice
    redovi += `
      <tr class="tz-stanica">
        <td class="c">${s.stanica}</td><td></td>${prazno(6)}
        <td class="d">${fz(s.Y, 3)}</td><td class="d">${fz(s.X, 3)}</td>
        <td class="d">${fz(s.H, 3)}</td><td></td>
      </tr>`;
    // red orijentacije: visina instrumenta, zadnja tačka, pravac, zenit, kosa, horiz.
    redovi += `
      <tr class="tz-vi">
        <td class="c">${fz(s.visinaInstr, 3)}</td>
        <td class="c">${o.naziv || ""}</td>
        <td class="c">${ug(o.pravac)}</td>
        <td class="c">${ug(o.zenit)}</td>
        <td class="d">${o.kosa > 0 ? fz(o.kosa, 3) : ""}</td>
        <td class="d">${o.horizDuzina > 0 ? fz(o.horizDuzina, 3) : ""}</td>
        <td></td><td></td>
        <td class="d">${fz(o.Y, 3)}</td><td class="d">${fz(o.X, 3)}</td>
        <td></td>
        <td class="d">${o.visinaSignala > 0 ? fz(o.visinaSignala, 2) : ""}</td>
      </tr>`;
    // detaljne tačke
    s.tacke.forEach((t) => {
      redovi += `
      <tr>
        <td></td>
        <td class="c">${t.naziv}</td>
        <td class="c">${ug(t.pravac)}</td>
        <td class="c">${ug(t.zenit)}</td>
        <td class="d">${fz(t.kosa, 2)}</td>
        <td class="d">${fz(t.horizDuzina, 3)}</td>
        <td class="d">${fz(t.dy, 3)}</td>
        <td class="d">${fz(t.dx, 3)}</td>
        <td class="d">${fz(t.Y, 3)}</td>
        <td class="d">${fz(t.X, 3)}</td>
        <td class="d">${fz(t.H, 3)}</td>
        <td class="d">${fz(t.visinaSignala, 2)}</td>
      </tr>`;
    });
    redovi += `<tr class="razmak"><td colspan="12">&nbsp;</td></tr>`;
  });

  return `
  <div class="obrazac-naslov-linija">Računanje koordinata detaljnih tačaka</div>
  <table class="obrazac obrazacDetalji">
    <thead>
      <tr class="zaglavlje-red">
        <th rowspan="2">Stanica<br>(vis. instr.)</th>
        <th rowspan="2">Vizura</th>
        <th rowspan="2">Pravac na<br>tačku</th>
        <th rowspan="2">Zenitni<br>ugao</th>
        <th rowspan="2">Kosa<br>dužina<br>(m)</th>
        <th rowspan="2">Horiz.<br>dužina<br>(m)</th>
        <th colspan="2">Koordinatne razlike</th>
        <th colspan="3">Koordinate tačaka</th>
        <th rowspan="2">Visina<br>signala<br>(m)</th>
      </tr>
      <tr class="zaglavlje-red">
        <th>&Delta;y</th><th>&Delta;x</th>
        <th>Y</th><th>X</th><th>H</th>
      </tr>
    </thead>
    <tbody>${redovi}</tbody>
  </table>`;
}

if (typeof window !== "undefined") {
  window.Obrasci = { obrazac25, obrazac19, obrazacTZ, obrazac1i2, obrazac1V, obrazac18D, obrazac8, obrazac28P, obrazacK, obrazacDetalji };
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { obrazac25, obrazac19, obrazacTZ, obrazac1i2, obrazac1V, obrazac18D, obrazac8, obrazac28P, obrazacK, obrazacDetalji };
}
