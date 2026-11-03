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
   ctx = { nazivA, alfaPocetniStr, nazivD }                              */
function obrazac19(r, ctx) {
  const D = (typeof window !== "undefined" ? window.Racun : require("./racun.js")).decimalniUSms;
  // oznaka ugla u obliku SSS°MM'SS" sa zarezom-stilom kao PDF: "74°,28'48""
  const ug = (dec) => D(dec).replace("°", "°,");

  const popravkaStr = ug(Math.abs(r.popravakUgla)).replace("°,", "0°,").length ? "" : "";
  // popravka vβ po uglu (string, s predznakom)
  const vbeta = (r.popravakUgla >= 0 ? "" : "-") + ug(Math.abs(r.popravakUgla));

  let redovi = "";

  // Prvi red: orijentacija A -> direkcioni alfaPocetni
  redovi += `<tr>
    <td></td><td class="c">${ctx.nazivA}</td>
    <td></td>
    <td class="c">${ug(r.alfaPocetni)}</td>
    <td></td><td></td><td></td>
    <td></td><td></td><td></td>
  </tr>`;

  // Za svaku stanicu/tačku
  const tocke = r.tocke; // B, nove..., C
  for (let i = 0; i < r.n; i++) {
    const nazTacke = tocke[i] ? tocke[i].naziv : "";
    const prelomni = ug(r.beta[i]);
    const vred = vbeta; // ista popravka na svaki ugao
    // red s popravkom (iznad prelomnog) — kao u PDF-u: mali red vβ
    redovi += `<tr class="tanko">
      <td></td><td></td>
      <td class="c mali">${vred}</td>
      <td></td><td></td><td></td><td></td><td></td><td></td><td></td>
    </tr>`;
    // glavni red tačke
    const imaStr = (i < r.brStranica);
    const dir = (i < r.alfe.length) ? ug(r.alfe[i]) : "";
    const duz = imaStr ? fz(r.d[i], 2) : "";
    const dy = imaStr ? fz(r.dy[i], 3) : "";
    const dx = imaStr ? fz(r.dx[i], 3) : "";
    const tk = tocke[i];
    const Y = tk ? fz(tk.Y, 3) : "";
    const X = tk ? fz(tk.X, 3) : "";
    redovi += `<tr>
      <td></td>
      <td class="c">${nazTacke}</td>
      <td class="c">${prelomni}</td>
      <td class="c">${dir}</td>
      <td class="d">${duz}</td>
      <td class="d">${dy}</td>
      <td class="d">${dx}</td>
      <td class="d">${Y}</td>
      <td class="d">${X}</td>
      <td class="c">${nazTacke}</td>
    </tr>`;
  }
  // zadnja tačka C (krajnja) — koordinate
  const C = tocke[tocke.length - 1];
  redovi += `<tr>
    <td></td><td class="c">${C.naziv}</td>
    <td class="c mali">${vbeta}</td>
    <td></td>
    <td class="d">${fz(r.sumaD,3)}</td>
    <td class="d">${fz(r.sumaDy,3)}</td>
    <td class="d">${fz(r.sumaDx,3)}</td>
    <td class="d">${fz(C.Y,3)}</td>
    <td class="d">${fz(C.X,3)}</td>
    <td class="c">${C.naziv}</td>
  </tr>`;

  // sumarni red (Σ priraštaji / kontrola koordinata)
  const kontrolaY = fz(r.sumaDy, 3), kontrolaX = fz(r.sumaDx, 3);
  redovi += `<tr class="suma-red">
    <td></td><td></td><td></td><td></td><td></td>
    <td class="d"></td><td class="d"></td>
    <td class="d">${fz(C.Y - B_od(r), 3)}</td>
    <td class="d">${fz(C.X - B_od(r), 3)}</td>
    <td></td></tr>`;

  // donji blok: treba / ima / fβ / vβ / fd / Δd
  const trebaStr = ug(r.treba % 360 === r.treba ? r.treba : r.treba); // prikaz kao u Excelu
  const fbetaStr = (r.fBeta < 0 ? "-" : "") + ug(Math.abs(r.fBeta));
  const dBetaStr = ug(r.dopustenoFbetaSek / 3600);
  redovi += `
    <tr><td></td><td class="c">treba</td><td class="c">${formatBigAngle(r.treba)}</td><td></td><td></td>
        <td class="d">${fz(r.fy,3)}</td><td class="d">${fz(r.fx,3)}</td><td></td><td></td><td></td></tr>
    <tr><td></td><td class="c">ima</td><td class="c">${formatBigAngle(r.ima)}</td><td></td><td class="c">fd=</td>
        <td class="d">${fz(r.fd,3)}</td><td></td><td></td><td></td><td></td></tr>
    <tr><td></td><td class="c">f<sub>β</sub>=</td><td class="c">${fbetaStr}</td>
        <td class="c">Δβ= ${dBetaStr}</td><td class="c">Δd=</td>
        <td class="d">${fz(r.dopustenoFd,3)}</td><td></td><td></td><td></td><td></td></tr>
    <tr><td></td><td class="c">v<sub>β</sub>=</td><td class="c">${vbeta}</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
  `;

  // prazni redovi
  for (let i = 0; i < 6; i++) redovi += `<tr>${'<td>&nbsp;</td>'.repeat(10)}</tr>`;

  return `
  <div class="obrazac-naslov-linija">Trigonom. obrazac br.19 &nbsp;&nbsp;&nbsp; Str……..</div>
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

// početna koordinata B (za kontrolni red) — čuvamo preko r.tocke[0]
function B_od(r){ return 0; } // placeholder (koristi se gore samo za prikaz Σ)

// veliki ugao (preko 360) prikaži kao SSS°,MM'SS" bez normalizacije
function formatBigAngle(dec){
  const neg = dec < 0; let x = Math.abs(dec);
  let s = Math.floor(x); let mF=(x-s)*60; let m=Math.floor(mF+1e-9); let se=Math.round((mF-m)*60);
  if(se>=60){se-=60;m++;} if(m>=60){m-=60;s++;}
  const p=(k)=>String(k).padStart(2,"0");
  return (neg?"-":"")+`${s}°,${p(m)}'${p(se)}"`;
}

if (typeof window !== "undefined") {
  window.Obrasci = { obrazac25, obrazac19 };
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { obrazac25, obrazac19 };
}
