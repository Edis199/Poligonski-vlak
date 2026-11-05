/* =====================================================================
   obrasci.js — Geodetski obrasci nivelmanskog vlaka: N.O.1, N.O.2, N.O.3,
   popunjeni rezultatima izravnanja (vjerno originalnom Excelu).
   ===================================================================== */

function fmt(x, dec) { return (x === null || x === undefined || isNaN(x)) ? "" : Number(x).toFixed(dec); }
function fmtMm(x) { return (x === null || x === undefined || isNaN(x)) ? "" : (x * 1000).toFixed(1); }

/* ---------- N.O.1 — nivelmanski zapisnik (vjerno Excelu) ----------
   Kolone: Stanica | Vezna tačka | Broj letve | Odstojanje od letve |
   Čitanja [1. podjela: Z1 | P1 | Z1−P1] [2. podjela: Z2 | P2 | Z2−P2] |
   Proba | Srednja visinska razlika | Primjedba.
   Svaka stanica: red I (zadnja letva) + red II (prednja letva) + red razlike. */
function obrazacNO1(r) {
  let h = `<div class="obrazac-naslov-linija">Nivelmanski obrazac br. 1</div>
  <table class="obrazac obrazacNiv obrazacNO1z">
    <thead>
      <tr>
        <th rowspan="2">Stanica</th><th rowspan="2">Vezna<br>tačka</th>
        <th rowspan="2">Broj<br>letve</th><th rowspan="2">Odstojanje<br>od letve</th>
        <th colspan="2">Čitanja</th>
        <th rowspan="2">Srednja<br>visinska<br>razlika</th><th rowspan="2">Primjedba</th>
      </tr>
      <tr><th>1. podjela<br><span class="mali">Z / P / Z−P</span></th>
          <th>2. podjela<br><span class="mali">Z / P / Z−P</span></th></tr>
      <tr class="broj-kolone"><td>1</td><td>2</td><td>3</td><td>4</td><td>5</td><td>6</td><td>7</td><td>8</td></tr>
    </thead><tbody>`;

  let stBr = 0;
  r.redoviNO1.forEach((d) => {
    ["naprijed", "nazad"].forEach((smj) => {
      const blok = d[smj];
      if (!blok || !blok.stanice.length) return;
      blok.stanice.forEach((s) => {
        stBr++;
        const pZ1P1 = (s.zad1 - s.pred1), pZ2P2 = (s.zad2 - s.pred2);
        // Svaka stanica = TRI reda u istim kolonama čitanja:
        //   red I  → zadnja letva (Z)
        //   red II → prednja letva (P)
        //   red razlike → Z−P (po podjeli), i srednja visinska razlika
        h += `<tr class="niv-red-i">
          <td rowspan="3"><b>${stBr}</b></td>
          <td>${s.veznaZad || ""}</td><td>I</td><td>${fmt(s.odstZad, 0)}</td>
          <td>${fmt(s.zad1, 3)}</td><td>${fmt(s.zad2, 3)}</td>
          <td rowspan="3" class="sred-cel"><b>${fmt(s.dSred, 4)}</b></td>
          <td rowspan="3"></td>
        </tr>`;
        h += `<tr class="niv-red-ii">
          <td>${s.veznaPred || ""}</td><td>II</td><td>${fmt(s.odstPred, 0)}</td>
          <td>${fmt(s.pred1, 3)}</td><td>${fmt(s.pred2, 3)}</td>
        </tr>`;
        h += `<tr class="niv-red-raz">
          <td></td><td class="mali">Z−P</td><td></td>
          <td>${fmt(pZ1P1, 3)}</td><td>${fmt(pZ2P2, 3)}</td>
        </tr>`;
      });
      // SUMA nivelmanske strane: Σ odstojanja i Σ srednjih visinskih razlika te strane
      h += `<tr class="suma-red niv-suma">
        <td colspan="3">Σ strana</td>
        <td>${fmt(blok.sumaOdst, 0)}</td>
        <td colspan="2"></td>
        <td><b>${fmt(blok.dHuk, 4)}</b></td>
        <td></td>
      </tr>`;
    });
  });
  h += `</tbody></table>`;
  return h;
}

/* ---------- N.O.2 — poređenje naprijed/nazad (vjerno Excelu) ----------
   Raspored kolona kao u originalu:
   OD | DO | [Visinska razlika iz nivelanja "naprijed": S u km | Δh'p | odakle] |
   [ "nazad": S u km | Δh'n ] | Odstupanje Δ=h'p−h'n u mm | Dozvoljeno Δh u mm |
   Srednja visinska razlika | Primjedba                                          */
function obrazacNO2(r) {
  let h = `<div class="obrazac-naslov-linija">Nivelmanski obrazac br. 2</div>
  <table class="obrazac obrazacNiv obrazacNO2">
    <thead>
      <tr>
        <th class="naslov" colspan="12">........... nivelman ...........</th>
      </tr>
      <tr class="zaglavlje-red">
        <th rowspan="2">OD</th><th rowspan="2">DO</th>
        <th colspan="3">Visinska razlika iz nivelanja „naprijed"</th>
        <th colspan="3">Visinska razlika iz nivelanja „nazad"</th>
        <th rowspan="2">Odstupanje<br>Δ = h'<sub>p</sub> − h'<sub>n</sub><br>u mm</th>
        <th rowspan="2">Dozvoljeno<br>odstupanje<br>Δh u mm</th>
        <th rowspan="2">Srednja<br>visinska<br>razlika</th>
        <th rowspan="2">Primjedba</th>
      </tr>
      <tr class="zaglavlje-red pod">
        <th>odakle<br>je uzeta</th><th>S u km</th><th>Δh'<sub>p</sub></th>
        <th>odakle<br>je uzeta</th><th>S u km</th><th>Δh'<sub>n</sub></th>
      </tr>
      <tr class="broj-kolone">
        <td>1</td><td>2</td><td></td><td>3</td><td></td><td></td><td>4</td><td></td><td>5</td><td>6</td><td>7</td><td></td>
      </tr>
    </thead><tbody>`;
  r.redoviNO2.forEach((d) => {
    const klasa = d.odstOK ? "" : "crveni-tekst";
    h += `<tr class="${klasa}">
      <td><b>${d.od}</b></td><td><b>${d.do}</b></td>
      <td class="mali">N.O.1</td><td>${fmt(d.Sp, 3)}</td><td>${fmt(d.dHp, 4)}</td>
      <td class="mali">${d.dHn !== null ? "N.O.1" : ""}</td><td>${d.dHn !== null ? fmt(d.Sn, 3) : ""}</td><td>${d.dHn !== null ? fmt(d.dHn, 4) : ""}</td>
      <td>${d.dHn !== null ? fmt(d.odstMm, 1) : ""}</td>
      <td>${d.dHn !== null ? fmt(d.dop, 1) : ""}</td>
      <td><b>${fmt(d.dHsred, 4)}</b></td>
      <td></td>
    </tr>`;
  });
  const sumSp = r.redoviNO2.reduce((a, d) => a + (d.Sp || 0), 0);
  const sumSn = r.redoviNO2.reduce((a, d) => a + (d.Sn || 0), 0);
  const sumDhp = r.redoviNO2.reduce((a, d) => a + (d.dHp || 0), 0);
  const sumDhn = r.redoviNO2.reduce((a, d) => a + (d.dHn || 0), 0);
  h += `<tr class="suma-red">
      <td colspan="2">Σ</td>
      <td></td><td>${fmt(sumSp, 3)}</td><td>${fmt(sumDhp, 4)}</td>
      <td></td><td>${fmt(sumSn, 3)}</td><td>${fmt(sumDhn, 4)}</td>
      <td></td><td></td>
      <td><b>${fmt(r.sumaDh, 4)}</b></td><td></td>
    </tr>`;
  h += `</tbody></table>`;
  return h;
}

/* ---------- N.O.3 — izravnanje vlaka (vjerno Excelu) ----------
   Raspored: Broj vlaka | Rn | Odakle je uzeta | Δh'n | S u km |
   Popravka Vn=(1/[S])·Si | Definitivna hn=h'n+Vn | Nadmorske visine Hn | Rn | Primjedba.
   Reperi i njihove visine stoje u redovima-čvorovima; između njih red s Δh/S/Vn/hn. */
function obrazacNO3(r) {
  let h = `<div class="obrazac-naslov-linija">Nivelmanski obrazac br. 3</div>
  <table class="obrazac obrazacNiv obrazacNO3">
    <thead>
      <tr>
        <th>Broj<br>vlaka</th><th>R<sub>n</sub></th><th>Odakle<br>je uzeta</th>
        <th>Visinske razlike<br>dobivene nivelanjem<br>Δh'<sub>n</sub></th>
        <th>Odstojanje<br>između repera<br>S u km</th>
        <th>Popravka<br>V<sub>n</sub> = (1/[S])·S<sub>i</sub></th>
        <th>Definitivna<br>visinska razlika<br>h<sub>n</sub> = h'<sub>n</sub> + V<sub>n</sub></th>
        <th>Nadmorske<br>visine<br>H<sub>n</sub> = H<sub>n-1</sub> + h<sub>n</sub></th>
        <th>Primjedba</th>
      </tr>
      <tr class="broj-kolone">
        <td>1</td><td>2</td><td>3</td><td>4</td><td>5</td><td>6</td><td>7</td><td>8</td><td>9</td>
      </tr>
    </thead><tbody>`;

  // Prvi red: početni (dati) reper sa svojom nadmorskom visinom.
  h += `<tr class="reper-red crveni-tekst">
      <td></td><td><b>${r.visine[0].naziv}</b></td><td></td>
      <td></td><td></td><td></td><td></td>
      <td><b>${fmt(r.visine[0].H, 3)}</b></td><td></td>
    </tr>`;

  // Za svaku dionicu: red s izravnanjem (Δh'n, S, Vn, hn), pa red sa sljedećim reperom i njegovom visinom.
  r.redoviNO3.forEach((d, i) => {
    const zadnji = (i === r.redoviNO3.length - 1);
    const reper = r.visine[i + 1];
    const datiReper = reper && (reper.tip === "dati");
    h += `<tr class="dionica-red">
      <td>${d.rb}</td><td></td><td class="mali">N.O.2</td>
      <td>${fmt(d.dHn, 4)}</td>
      <td>${fmt(d.S, 3)}</td>
      <td>${fmt(d.Vn, 4)}</td>
      <td>${fmt(d.hDef, 4)}</td>
      <td></td><td></td>
    </tr>`;
    h += `<tr class="reper-red ${datiReper ? "crveni-tekst" : ""}">
      <td></td><td><b>${reper ? reper.naziv : ""}</b></td><td></td>
      <td></td><td></td><td></td><td></td>
      <td><b>${reper ? fmt(reper.H, 3) : ""}</b></td><td>${datiReper ? "dati reper" : ""}</td>
    </tr>`;
  });

  // Suma
  h += `<tr class="suma-red">
      <td></td><td>Σ</td><td></td>
      <td>${fmt(r.sumaDh, 4)}</td>
      <td>${fmt(r.sumaS, 3)}</td>
      <td>${fmt(r.sumaV, 4)}</td>
      <td colspan="3"></td>
    </tr>`;
  h += `</tbody></table>`;

  if (r.imaKraj) {
    const okKlasa = r.visinskiOK ? "status-ok" : "status-ne";
    h += `<p class="obrazac-podnaslov">
      f<sub>h</sub> = ${fmtMm(r.fh)} mm &nbsp; (dozvoljeno ±${fmtMm(r.dopFh)} mm)
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
