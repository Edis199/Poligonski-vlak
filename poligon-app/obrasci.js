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
    "", "<b>Σ</b>", "", "", `<b>${fz(r.sumaD,3)}</b>`,
    `<b>${fz(r.sumaDy,3)}</b>`, `<b>${fz(r.sumaDx,3)}</b>`, "", "", ""
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
      <td class="c"><b>${st.stanica ?? ""}</b></td>
      <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
    </tr>`;
    redovi += `<tr class="tz-vi">
      <td class="c">${fz(st.visinaInstr, 3)}</td>
      <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
    </tr>`;
    // redovi mjerenja
    (st.mjerenja || []).forEach((m) => {
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
        <td class="c" colspan="2" style="text-align:left">LOKALITET: ${lokalitet || ""}</td>
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
        <td class="c"><b>${gi === 0 ? st.stanica : oznaka}</b></td>
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

if (typeof window !== "undefined") {
  window.Obrasci = { obrazac25, obrazac19, obrazacTZ, obrazac1i2 };
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { obrazac25, obrazac19, obrazacTZ, obrazac1i2 };
}
