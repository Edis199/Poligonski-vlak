/* =====================================================================
   obrasci.js — Geodetski obrasci nivelmanskog vlaka: N.O.1, N.O.2, N.O.3,
   popunjeni rezultatima izravnanja (vjerno originalnom Excelu).
   ===================================================================== */

function fmt(x, dec) { return (x === null || x === undefined || isNaN(x)) ? "" : Number(x).toFixed(dec); }
function fmtMm(x) { return (x === null || x === undefined || isNaN(x)) ? "" : (x * 1000).toFixed(1); }

/* ---------- N.O.1 — čitanja i visinske razlike po stanicama ---------- */
function obrazacNO1(r) {
  let h = `<div class="obrazac-naslov-linija">Nivelmanski obrazac br. 1</div>
  <table class="obrazac obrazacNiv">
    <thead>
      <tr><th class="naslov" colspan="9">N.O.1 — Nivelmanski zapisnik (čitanja letvi)</th></tr>
      <tr class="zaglavlje-red">
        <th>Smjer</th><th>Vezna<br>zadnja</th><th>Vezna<br>prednja</th>
        <th>Odstojanje<br>(m)</th>
        <th>Zad − Pred<br>(1. podjela)</th><th>Zad − Pred<br>(2. podjela)</th>
        <th>Zad 1 / Pred 1</th><th>Zad 2 / Pred 2</th>
        <th>Srednja vis.<br>razlika (m)</th>
      </tr>
    </thead><tbody>`;

  r.redoviNO1.forEach((d) => {
    ["naprijed", "nazad"].forEach((smj) => {
      const blok = d[smj];
      if (!blok) return;
      h += `<tr class="sekcija"><td colspan="9">${smj.toUpperCase()}: ${d.od} → ${d.do}
             &nbsp;|&nbsp; Σ Δh = ${fmt(blok.dHuk, 4)} m &nbsp;|&nbsp; Σ odst. = ${fmt(blok.sumaOdst, 1)} m</td></tr>`;
      blok.stanice.forEach((s) => {
        h += `<tr>
          <td class="mali">${smj === "naprijed" ? "n" : "z"}</td>
          <td>${s.veznaZad || ""}</td>
          <td>${s.veznaPred || ""}</td>
          <td>${fmt((s.odstZad || 0) + (s.odstPred || 0), 1)}</td>
          <td>${fmt(s.d1, 4)}</td>
          <td>${fmt(s.d2, 4)}</td>
          <td class="mali">${fmt(s.zad1, 3)} / ${fmt(s.pred1, 3)}</td>
          <td class="mali">${fmt(s.zad2, 3)} / ${fmt(s.pred2, 3)}</td>
          <td><b>${fmt(s.dSred, 4)}</b></td>
        </tr>`;
      });
    });
  });
  h += `</tbody></table>`;
  return h;
}

/* ---------- N.O.2 — poređenje naprijed/nazad ---------- */
function obrazacNO2(r) {
  let h = `<div class="obrazac-naslov-linija">Nivelmanski obrazac br. 2</div>
  <table class="obrazac obrazacNiv">
    <thead>
      <tr><th class="naslov" colspan="9">N.O.2 — Poređenje nivelmana naprijed / nazad</th></tr>
      <tr class="zaglavlje-red">
        <th>OD</th><th>DO</th>
        <th>S naprijed<br>(km)</th><th>Δh'<sub>p</sub><br>naprijed (m)</th>
        <th>S nazad<br>(km)</th><th>Δh'<sub>n</sub><br>nazad (m)</th>
        <th>Odstupanje<br>Δ (mm)</th><th>Dozvoljeno<br>(mm)</th>
        <th>Srednja vis.<br>razlika (m)</th>
      </tr>
    </thead><tbody>`;
  r.redoviNO2.forEach((d) => {
    const klasa = d.odstOK ? "" : "crveni-tekst";
    h += `<tr class="${klasa}">
      <td><b>${d.od}</b></td><td><b>${d.do}</b></td>
      <td>${fmt(d.Sp, 3)}</td><td>${fmt(d.dHp, 4)}</td>
      <td>${d.dHn !== null ? fmt(d.Sn, 3) : "—"}</td>
      <td>${d.dHn !== null ? fmt(d.dHn, 4) : "—"}</td>
      <td>${d.dHn !== null ? fmt(d.odstMm, 1) : "—"}</td>
      <td>${d.dHn !== null ? "±" + fmt(d.dop, 1) : "—"}</td>
      <td><b>${fmt(d.dHsred, 4)}</b></td>
    </tr>`;
  });
  h += `<tr class="suma-red">
      <td colspan="2">Σ</td>
      <td colspan="4"></td>
      <td colspan="2"></td>
      <td><b>${fmt(r.sumaDh, 4)}</b></td>
    </tr>`;
  h += `</tbody></table>`;
  return h;
}

/* ---------- N.O.3 — izravnanje vlaka ---------- */
function obrazacNO3(r) {
  let h = `<div class="obrazac-naslov-linija">Nivelmanski obrazac br. 3</div>
  <table class="obrazac obrazacNiv">
    <thead>
      <tr><th class="naslov" colspan="8">N.O.3 — Izravnanje nivelmanskog vlaka</th></tr>
      <tr class="zaglavlje-red">
        <th>Rb.</th><th>Reper<br>OD → DO</th>
        <th>Visinska razlika<br>nivelanjem Δh'<sub>n</sub> (m)</th>
        <th>Odstojanje<br>S (km)</th>
        <th>Popravka<br>V<sub>n</sub> (mm)</th>
        <th>Definitivna vis.<br>razlika h<sub>n</sub> (m)</th>
        <th>Nadmorska<br>visina H (m)</th>
      </tr>
    </thead><tbody>`;

  // prvi reper (dati) kao polazni red
  h += `<tr class="crveni-tekst"><td></td><td><b>${r.visine[0].naziv}</b></td>
        <td colspan="4"></td><td><b>${fmt(r.visine[0].H, 3)}</b> <span class="mali">(dati)</span></td></tr>`;

  r.redoviNO3.forEach((d) => {
    h += `<tr>
      <td>${d.rb}</td>
      <td>${d.od} → ${d.do}</td>
      <td>${fmt(d.dHn, 4)}</td>
      <td>${fmt(d.S, 3)}</td>
      <td>${fmtMm(d.Vn)}</td>
      <td>${fmt(d.hDef, 4)}</td>
      <td><b>${fmt(d.Hdo, 3)}</b></td>
    </tr>`;
  });

  h += `<tr class="suma-red">
      <td colspan="2">Σ</td>
      <td>${fmt(r.sumaDh, 4)}</td>
      <td>${fmt(r.sumaS, 3)}</td>
      <td>${fmtMm(r.sumaV)}</td>
      <td colspan="2"></td>
    </tr>`;
  h += `</tbody></table>`;

  if (r.imaKraj) {
    const okKlasa = r.visinskiOK ? "status-ok" : "status-ne";
    h += `<p class="obrazac-podnaslov">
      Zatvaranje vlaka f<sub>h</sub> = ${fmtMm(r.fh)} mm &nbsp;
      (dozvoljeno ±${fmtMm(r.dopFh)} mm)
      <span class="oznaka-status ${okKlasa}">${r.visinskiOK ? "U GRANICAMA" : "PREKORAČENO"}</span></p>`;
  }
  return h;
}

/* ---------- Spisak nadmorskih visina ---------- */
function obrazacSpisak(r) {
  let h = `<div class="obrazac-naslov-linija">Spisak nadmorskih visina</div>
  <table class="obrazac obrazacNiv">
    <thead>
      <tr><th class="naslov" colspan="3">Spisak nadmorskih visina repera</th></tr>
      <tr class="zaglavlje-red"><th>Reper</th><th>Nadmorska visina H (m)</th><th>Tip</th></tr>
    </thead><tbody>`;
  r.visine.forEach((t) => {
    const klasa = (t.tip === "dati") ? "crveni-tekst" : "";
    h += `<tr class="${klasa}"><td><b>${t.naziv}</b></td><td>${fmt(t.H, 3)}</td><td>${t.tip}</td></tr>`;
  });
  h += `</tbody></table>`;
  return h;
}

const OBRASCI_NIV = {
  no1: { naziv: "N.O.1", fn: obrazacNO1 },
  no2: { naziv: "N.O.2", fn: obrazacNO2 },
  no3: { naziv: "N.O.3", fn: obrazacNO3 },
  spisak: { naziv: "Spisak visina", fn: obrazacSpisak },
};

if (typeof window !== "undefined") {
  window.ObrasciNiv = { OBRASCI_NIV, obrazacNO1, obrazacNO2, obrazacNO3, obrazacSpisak };
}
