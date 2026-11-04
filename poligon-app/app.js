/* app.js — povezuje sučelje s jezgrom izračuna (racun.js) */

let zadnjiRezultat = null;
let zadnjiRezultatVisine = null;
let zadnjiDetalji = null;
let izborGirusa = [];            // po stanici: niz true/false (koji girusi se koriste)
let zadnjiFaktorRedukcije = null; // faktor redukcije dužina korišten u zadnjem izračunu (null = bez redukcije)       // koordinate detaljnih tačaka (računaju se nakon izravnanja vlaka)
let obradjeneStanice = null;   // iz učitanog zapisnika (za visinsko izravnanje)
let ucitaneStanice = null;     // sirova mjerenja iz zapisnika (za obrazac TZ)
let lokalitet = "";            // naziv lokaliteta (opcionalno)

/* ---------- Navigacija kartica ---------- */
document.querySelectorAll(".kartica").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".kartica").forEach((b) => b.classList.remove("aktivna"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("vidljiv"));
    btn.classList.add("aktivna");
    const cilj = document.getElementById(btn.dataset.cilj);
    cilj.classList.add("vidljiv");
    if (btn.dataset.cilj === "crtez" && zadnjiRezultat) nacrtaj(zadnjiRezultat);
    if (btn.dataset.cilj === "obrasci") prikaziObrazac();
  });
});

function idiNa(cilj) {
  document.querySelector(`.kartica[data-cilj="${cilj}"]`).click();
}

/* ---------- Generiranje tabele za unos ---------- */
function generirajTabelu(brUglova, podaci) {
  const telo = document.getElementById("teloUnos");
  telo.innerHTML = "";
  for (let i = 0; i < brUglova; i++) {
    const tr = document.createElement("tr");
    let stanica;
    if (i === 0) stanica = "B (poč.)";
    else if (i === brUglova - 1) stanica = "C (kraj)";
    else stanica = `T${i}`;

    const imaDuzina = i < brUglova - 1; // dužina ima n-1
    const ugaoV = podaci && podaci.uglovi ? (podaci.uglovi[i] ?? "") : "";
    const duzV = podaci && podaci.duzine ? (podaci.duzine[i] ?? "") : "";
    const nazV = podaci && podaci.nazivi ? (podaci.nazivi[i] ?? "") : (i > 0 && i < brUglova - 1 ? `T${i}` : "");

    tr.innerHTML = `
      <td><strong>${stanica}</strong></td>
      <td><input class="in-ugao" type="text" value="${ugaoV}" placeholder="57°25'08&quot; ili 57.2508" /></td>
      <td>${imaDuzina ? `<input class="in-duzina" type="text" inputmode="decimal" value="${duzV}" placeholder="m" />` : "<span class='napomena'>—</span>"}</td>
      <td><input class="in-naziv" value="${nazV}" placeholder="${stanica}" /></td>
    `;
    telo.appendChild(tr);
  }
}

document.getElementById("generiraj").addEventListener("click", () => {
  const n = parseInt(document.getElementById("brojUglova").value, 10);
  if (n < 2 || n > 15) { alert("Broj prelomnih uglova mora biti između 2 i 15."); return; }
  generirajTabelu(n);
});

/* ---------- Učitavanje primjera iz Excela ---------- */
document.getElementById("primjer").addEventListener("click", ucitajPrimjer);

function ucitajPrimjer() {
  // Date tačke (vlak P647 -> P568, primjer o kojem smo diskutovali)
  postavi("A_naziv","P646"); postavi("A_Y","6534004.099"); postavi("A_X","4856781.708");
  postavi("B_naziv","P647"); postavi("B_Y","6534077.333"); postavi("B_X","4856802.045"); postavi("B_H","539.234");
  postavi("C_naziv","P568"); postavi("C_Y","6534219.852"); postavi("C_X","4856903.011"); postavi("C_H","540.370");
  postavi("D_naziv","G48"); postavi("D_Y","6534197.270"); postavi("D_X","4856958.416");
  alert("Učitane su date tačke i visine iz primjera (vlak P647 → P568).\nUčitajte zapisnik (CSV) za uglove, dužine i zenitne uglove.");
}

// decimalni stupnjevi -> broj oblika SSS.MMSS (npr. 135.998... -> 135.5955)
function decimalniUSmsBroj(dec){
  let x = dec;
  while (x < 0) x += 360;
  while (x >= 360) x -= 360;
  let s = Math.floor(x);
  let mF = (x - s) * 60;
  let m = Math.floor(mF + 1e-9);
  let se = Math.round((mF - m) * 60);
  if (se >= 60){ se -= 60; m++; }
  if (m >= 60){ m -= 60; s++; }
  return Number(`${s}.${String(m).padStart(2,"0")}${String(se).padStart(2,"0")}`);
}

function postavi(id, v){ const e=document.getElementById(id); if(e) e.value=v; }
// decimalni broj: prihvata i zarez i tačku (npr. 6534004,099 ili 6534004.099)
function parseDec(s){ return parseFloat(String(s ?? "").trim().replace(/\s/g,"").replace(",", ".")); }
function broj(id){ return parseDec(document.getElementById(id).value) || 0; }
function tekst(id){ return document.getElementById(id).value || ""; }

/* Početne (tvornički upisane) vrijednosti datih tačaka — da se ne zaborave stari brojevi
   kad se učita zapisnik s drugim tačkama. */
const POCETNE_DATE = {};
["A", "B", "C", "D"].forEach((k) => {
  POCETNE_DATE[k] = ["naziv", "Y", "X", "H"].map((f) => document.getElementById(k + "_" + f).value);
});
function obrisiStareDateTacke(noviNazivi) {
  ["A", "B", "C", "D"].forEach((k) => {
    const tren = ["naziv", "Y", "X", "H"].map((f) => document.getElementById(k + "_" + f).value);
    const jeTvornicko = tren.slice(1).every((v, i) => v === POCETNE_DATE[k][i + 1]);
    if (jeTvornicko && noviNazivi[k] && noviNazivi[k] !== POCETNE_DATE[k][0]) {
      ["Y", "X", "H"].forEach((f) => { document.getElementById(k + "_" + f).value = ""; });
    }
  });
}

/* ---------- Redukcija dužina: prikaz polja za ručni faktor ---------- */
function osvjeziPoljaRedukcije() {
  const nacin = document.getElementById("redukcijaNacin").value;
  document.getElementById("redukcijaFaktor").style.display = nacin === "rucno" ? "inline-block" : "none";
  document.getElementById("m0Blok").style.display = nacin === "auto" ? "inline-block" : "none";
}
document.getElementById("redukcijaNacin").addEventListener("change", osvjeziPoljaRedukcije);
osvjeziPoljaRedukcije();

/* ---------- Zatvoren vlak: C = B, D = A ---------- */
function vrstaVlaka() { return document.getElementById("vrstaVlaka").value; }
function postaviVrstu(v) { document.getElementById("vrstaVlaka").value = v; primijeniVrstu(); }
function primijeniVrstu() {
  const v = vrstaVlaka();
  ["C", "D"].forEach((k) => {
    const tr = document.getElementById(k + "_naziv").closest("tr");
    if (tr) tr.style.display = v === "slijepi" ? "none" : "";
  });
  document.getElementById("vrstaTekst").textContent = ucitaneStanice
    ? { umetnuti: "UMETNUTI (prepoznat iz zapisnika)", zatvoreni: "ZATVORENI (prepoznat iz zapisnika)", slijepi: "SLIJEPI (prepoznat iz zapisnika)" }[v]
    : "prepoznaje se automatski iz učitanog zapisnika";
  document.getElementById("napomenaVrste").textContent = v === "slijepi"
    ? "Unesite koordinate i visinu za A (orijentacija) i B (početna stanica). Nema uglovnog ni linearnog odstupanja ni popravki."
    : v === "zatvoreni" ? "Unesite koordinate i visinu za A i B (C = B, D = A)." : "";
  if (v === "slijepi") {
    document.getElementById("redukcijaNacin").value = "nema";
    osvjeziPoljaRedukcije();
  }
  sinkronizirajZatvoreni();
}
function sinkronizirajZatvoreni() {
  const zat = vrstaVlaka() === "zatvoreni";
  [["C", "B"], ["D", "A"]].forEach(([cilj, izvor]) => {
    ["naziv", "Y", "X", "H"].forEach((k) => {
      const cp = document.getElementById(cilj + "_" + k), sp = document.getElementById(izvor + "_" + k);
      cp.readOnly = zat;
      if (zat) cp.value = sp.value;
    });
  });
}
document.getElementById("vrstaVlaka").addEventListener("change", primijeniVrstu);
["A", "B"].forEach((p) => ["naziv", "Y", "X", "H"].forEach((k) => {
  document.getElementById(p + "_" + k).addEventListener("input", () => {
    if (vrstaVlaka() === "zatvoreni") sinkronizirajZatvoreni();
  });
}));

/* ---------- Izračun ---------- */
document.getElementById("izracunaj").addEventListener("click", () => {
  if (vrstaVlaka() === "slijepi") { izracunajSlijepi(); return; }
  if (!obradjeneStanice || !obradjeneStanice.length) {
    alert("Prvo učitajte tahimetrijski zapisnik (mjerenja) — uglovi i dužine se računaju iz njega.");
    return;
  }
  if (vrstaVlaka() === "zatvoreni") sinkronizirajZatvoreni();
  const uglovi = [...document.querySelectorAll(".in-ugao")].map((e) => e.value);
  const duzine = [...document.querySelectorAll(".in-duzina")].map((e) => parseDec(e.value) || 0);
  const nazivi = [...document.querySelectorAll(".in-naziv")].map((e) => e.value);

  if (uglovi.length < 2) { alert("Prvo generirajte tabelu i unesite uglove."); return; }
  if (uglovi.some((u) => u === "" || u === null)) {
    if (!confirm("Nisu svi uglovi uneseni. Nastaviti svejedno?")) return;
  }

  // Naziv u svakom redu = prednja (sljedeća) tačka te stanice.
  // Nove tačke su prednje tačke stanica od prve do pretposljednje stranice:
  // to su nazivi[0 .. brojStranica-2]. Zadnja stranica završava na krajnjoj
  // datoj tački (naziv unesen u polju C). broj stranica = broj dužina.
  const brStranicaUI = duzine.filter((d) => !isNaN(d)).length;
  const naziviNovih = nazivi.slice(0, Math.max(0, brStranicaUI - 1));

  // uglove parsiramo preko Girus.parsirajUgao (razumije i "57°25'08\"" i "57.2508")
  // pa ih vraćamo u SSS.MMSS zapis koji jezgra očekuje
  const uglDecimalni = uglovi.map((u) => {
    if (u === "" || u === null) return 0;
    const dec = window.Girus ? window.Girus.parsirajUgao(u) : Number(u);
    return dec === null ? 0 : dec;
  });
  // jezgra prima SSS.MMSS; pretvorimo decimalne natrag u taj zapis
  const prelomniSms = uglDecimalni.map(decimalniUSmsBroj);

  // --- Redukcija dužina na nultu plohu ---
  const nacinRed = document.getElementById("redukcijaNacin").value;
  let faktorRed = null;
  if (nacinRed === "auto") {
    const m0 = parseDec(document.getElementById("redukcijaM0").value);
    faktorRed = window.Racun.faktorRedukcijeDuzina(
      parseDec(document.getElementById("B_H").value), parseDec(document.getElementById("C_H").value),
      broj("B_Y"), broj("C_Y"), isNaN(m0) ? 1 : m0);
    if (faktorRed === null) alert("Redukcija dužina: unesite nadmorske visine H za tačke B i C (ili odaberite „Bez redukcije\"). Računam bez redukcije.");
  } else if (nacinRed === "rucno") {
    const f = parseDec(document.getElementById("redukcijaFaktor").value);
    faktorRed = isNaN(f) ? null : f;
  }
  zadnjiFaktorRedukcije = faktorRed;
  const duzineRed = faktorRed ? duzine.map((d) => d * faktorRed) : duzine;

  const ulaz = {
    datePocetne: { A:{Y:broj("A_Y"),X:broj("A_X")}, B:{Y:broj("B_Y"),X:broj("B_X")} },
    dateKrajnje: { C:{Y:broj("C_Y"),X:broj("C_X")}, D:{Y:broj("D_Y"),X:broj("D_X")} },
    prelomniUglovi: prelomniSms,
    duzine: duzineRed,
    nazivi: naziviNovih,
    nazivPocetne: tekst("B_naziv") || "B",
    nazivKrajnje: tekst("C_naziv") || "C",
    tolerancije: "nove",   // dozvoljena odstupanja prema obrascima 2019
  };

  try {
    const r = window.Racun.izravnajUmetnutiVlak(ulaz);
    nastaviIzracun(r, false);

  } catch (e) {
    alert("Greška u izračunu: " + e.message);
    console.error(e);
  }
});


function nastaviIzracun(r, slijepi) {
  zadnjiRezultat = r;

  // --- Visinsko izravnanje (ako ima podataka iz zapisnika i date visine) ---
  zadnjiRezultatVisine = null;
  const Hb = parseDec(document.getElementById("B_H").value);
  const Hc = parseDec(document.getElementById("C_H").value);
  if (obradjeneStanice && obradjeneStanice.length >= 2 && !isNaN(Hb) && (slijepi || !isNaN(Hc))) {
    try {
      zadnjiRezultatVisine = window.Visine.izravnajVisine(obradjeneStanice, Hb, slijepi ? null : Hc, zadnjiFaktorRedukcije, "nove", slijepi);
    } catch (ev) {
      console.warn("Visinsko izravnanje preskočeno:", ev.message);
    }
  }

  // --- Detaljne tačke (nakon izravnanja vlaka; izravnanje se ne mijenja) ---
  zadnjiDetalji = null;
  if (obradjeneStanice && obradjeneStanice.some((s) => s.detalji && s.detalji.length)) {
    try {
      const visine = zadnjiRezultatVisine ? zadnjiRezultatVisine.tocke.map((t) => t.H) : null;
      const A = { naziv: tekst("A_naziv"), Y: broj("A_Y"), X: broj("A_X") };
      zadnjiDetalji = window.Detalj.izracunajDetalje(obradjeneStanice, r.tocke, A, visine);
    } catch (ed) {
      console.warn("Računanje detalja preskočeno:", ed.message);
    }
  }

  prikaziRezultate(r, zadnjiRezultatVisine);
  idiNa("rezultati");
}

function izracunajSlijepi() {
  const ob = obradjeneStanice;
  const m = ob.length - 1;
  if (m < 1 || !ob[m].samoOrijentacija) {
    alert("Za slijepi vlak zadnja stanica u zapisniku treba imati samo vizuru unazad (bez girusa).");
    return;
  }
  const faktorRed = null;   // slijepi vlak: bez redukcije dužina (kao u primjeru), osim ručno unesenog faktora
  const nacin = document.getElementById("redukcijaNacin").value;
  let k = null;
  if (nacin === "auto") {
    const m0 = parseDec(document.getElementById("redukcijaM0").value);
    const Hb = parseDec(document.getElementById("B_H").value);
    k = window.Racun.faktorRedukcijeDuzina(Hb, Hb, broj("B_Y"), broj("B_Y"), isNaN(m0) ? 1 : m0);
  } else if (nacin === "rucno") {
    const f = parseDec(document.getElementById("redukcijaFaktor").value);
    k = isNaN(f) ? null : f;
  }
  zadnjiFaktorRedukcije = k || faktorRed;
  const f = k || 1;
  const prelomni = ob.slice(0, m).map((o) => decimalniUSmsBroj(o.prelomniUgao));
  const duzine = ob.slice(0, m).map((o, i) => (o.horizDuzina + ob[i + 1].horizDuzinaZadnja) / 2 * f);
  const ulaz = {
    datePocetne: { A: { Y: broj("A_Y"), X: broj("A_X") }, B: { Y: broj("B_Y"), X: broj("B_X") } },
    prelomniUglovi: prelomni,
    duzine,
    nazivi: ob.slice(0, m).map((o) => o.nazPrednja),
    nazivPocetne: tekst("B_naziv") || "B",
  };
  try {
    const r = window.Racun.izracunajSlijepiVlak(ulaz);
    nastaviIzracun(r, true);
  } catch (e) {
    alert("Greška u izračunu: " + e.message);
    console.error(e);
  }
}

/* ---------- Prikaz rezultata ---------- */
// Prikaz ugla iz sekundi u obliku  M'SS"  (ili samo SS" ako < 60").
// predznak=true dodaje + ili - ispred.
function sekMinSek(ukupnoSek, predznak) {
  const neg = ukupnoSek < 0;
  let s = Math.abs(ukupnoSek);
  const min = Math.floor(s / 60);
  const sek = s - min * 60;
  let txt;
  if (min > 0) {
    txt = `${min}'${sek.toFixed(1).padStart(4, "0")}"`;
  } else {
    txt = `${sek.toFixed(1)}"`;
  }
  if (predznak) txt = (neg ? "-" : "+") + txt;
  else if (neg) txt = "-" + txt;
  return txt;
}

function prikaziRezultate(r, rv) {
  const D = window.Racun.decimalniUSms;
  const sek = (x) => (x >= 0 ? "+" : "") + x.toFixed(1) + "\"";

  // sažetak kartice
  const SL = !!r.slijepi;
  const kutnoKlasa = r.kutnoOK ? "ok" : "ne";
  const linKlasa = r.linearnoOK ? "ok" : "ne";
  document.getElementById("sazetak").innerHTML = `
    <h2>Sažetak izravnanja${SL ? " — slijepi vlak (bez odstupanja i popravki)" : ""}</h2>
    <div class="sazetak-kartice">
      ${SL ? "" : `<div class="sk ${kutnoKlasa}">
        <div class="oznaka">Uglovno odstupanje f&beta;</div>
        <div class="vrijednost">${sekMinSek(r.fBetaSek, true)}</div>
        <div class="napomena">dopušteno ±${sekMinSek(r.dopustenoFbetaSek, false)}</div>
      </div>
      <div class="sk ${linKlasa}">
        <div class="oznaka">Linearno odstupanje f<sub>d</sub></div>
        <div class="vrijednost">${r.fd.toFixed(3)} m</div>
        <div class="napomena">dopušteno ${r.dopustenoFd.toFixed(3)} m</div>
      </div>`}
      <div class="sk">
        <div class="oznaka">Broj prelomnih uglova</div>
        <div class="vrijednost">${r.n}</div>
      </div>
      <div class="sk">
        <div class="oznaka">Ukupna dužina vlaka</div>
        <div class="vrijednost">${r.sumaD.toFixed(2)} m</div>
        <div class="napomena">${zadnjiFaktorRedukcije ? "redukovana na nultu plohu, k = " + zadnjiFaktorRedukcije.toFixed(8).replace(".", ",") : "bez redukcije"}</div>
      </div>
      ${rv && !SL ? `
      <div class="sk ${rv.visinskiOK ? "ok" : "ne"}">
        <div class="oznaka">Visinsko odstupanje f<sub>h</sub></div>
        <div class="vrijednost">${(rv.fh*1000).toFixed(0)} mm</div>
        <div class="napomena">dopušteno ${(rv.dopustenoFh*1000).toFixed(0)} mm</div>
      </div>` : ""}
    </div>
  `;

  // tabela direkcionih uglova
  let tblAlfe = `
    <h2>Direkcioni uglovi i priraštaji</h2>
    <table class="tabela">
      <thead><tr>
        <th>Stranica</th><th>Direkcioni ugao &alpha;</th>
        <th>Dužina d (m)</th><th>&Delta;y</th><th>&Delta;x</th>
        ${SL ? "" : "<th>Popravka v<sub>y</sub></th><th>Popravka v<sub>x</sub></th>"}
      </tr></thead><tbody>`;
  for (let i = 0; i < r.brStranica; i++) {
    tblAlfe += `<tr>
      <td>${i + 1}</td>
      <td>${D(r.alfe[i])}</td>
      <td>${r.d[i].toFixed(3)}</td>
      <td>${r.dy[i].toFixed(4)}</td>
      <td>${r.dx[i].toFixed(4)}</td>
      ${SL ? "" : `<td>${r.vy[i].toFixed(4)}</td><td>${r.vx[i].toFixed(4)}</td>`}
    </tr>`;
  }
  tblAlfe += `<tr style="font-weight:700;background:#eef4fb">
      <td colspan="2">Σ</td>
      <td>${r.sumaD.toFixed(3)}</td>
      <td>${r.sumaDy.toFixed(4)}</td>
      <td>${r.sumaDx.toFixed(4)}</td>
      ${SL ? "" : '<td colspan="2"></td>'}</tr>`;
  tblAlfe += `</tbody></table>`;

  // tabela prelomnih uglova (mjereni i popravljeni)
  let tblBeta = `
    <h2>Prelomni uglovi</h2>
    ${SL ? "" : `<p class="napomena">Popravka na svaki ugao: ${sekMinSek(r.popravakUgla*3600, true)}</p>`}
    <table class="tabela">
      <thead><tr><th>#</th><th>Mjereni ugao</th>${SL ? "" : "<th>Popravljeni ugao</th>"}</tr></thead><tbody>`;
  for (let i = 0; i < r.n; i++) {
    tblBeta += `<tr><td>${i+1}</td><td>${D(r.beta[i])}</td>${SL ? "" : `<td>${D(r.betaPopr[i])}</td>`}</tr>`;
  }
  tblBeta += `</tbody></table>`;

  // tabela koordinata
  let tblKoord = `
    <h2>Konačne koordinate tačaka</h2>
    <table class="tabela" id="tabKoord">
      <thead><tr><th>Tačka</th><th>Y (m)</th><th>X (m)</th><th>Tip</th></tr></thead><tbody>`;
  r.tocke.forEach((t) => {
    tblKoord += `<tr>
      <td><strong>${t.naziv}</strong></td>
      <td>${t.Y.toFixed(4)}</td>
      <td>${t.X.toFixed(4)}</td>
      <td>${t.tip === "data" ? "data" : "nova"}</td>
    </tr>`;
  });
  tblKoord += `</tbody></table>`;
  if (!SL) tblKoord += `<p class="napomena">Kontrola zatvaranja na krajnjoj tački: &Delta;Y=${r.odstY} m, &Delta;X=${r.odstX} m</p>`;

  // status kontrola
  const statusHtml = SL ? "" : `
    <h2>Kontrola dopuštenih odstupanja</h2>
    <p>Uglovno izravnanje:
      <span class="oznaka-status ${r.kutnoOK?'status-ok':'status-ne'}">
        ${r.kutnoOK ? "U DOZVOLJENIM GRANICAMA" : "PREKORAČENO"}</span></p>
    <p>Linearno izravnanje:
      <span class="oznaka-status ${r.linearnoOK?'status-ok':'status-ne'}">
        ${r.linearnoOK ? "U DOZVOLJENIM GRANICAMA" : "PREKORAČENO"}</span></p>
    ${rv ? `<p>Visinsko izravnanje:
      <span class="oznaka-status ${rv.visinskiOK?'status-ok':'status-ne'}">
        ${rv.visinskiOK ? "U DOZVOLJENIM GRANICAMA" : "PREKORAČENO"}</span></p>` : ""}
  `;

  const greskeHtml = r.greske.length
    ? `<div class="greska">⚠ ${r.greske.join("<br>")}</div>` : "";

  // --- Tablica visinskog izravnanja ---
  let tblVisine = "";
  if (rv) {
    tblVisine = `
      <h2>Visinsko izravnanje</h2>
      ${SL ? "" : `<p class="napomena">Zatvaranje visina f<sub>h</sub> = ${(rv.fh*1000).toFixed(0)} mm,
        dopušteno ${(rv.dopustenoFh*1000).toFixed(0)} mm.</p>`}
      <table class="tabela">
        <thead><tr>
          <th>Stranica</th><th>&Delta;H naprijed</th><th>&Delta;H nazad</th>
          <th>&Delta;H sredina</th>${SL ? "" : "<th>Popravka</th><th>&Delta;H popravljeno</th>"}
        </tr></thead><tbody>`;
    rv.redovi.forEach((row) => {
      tblVisine += `<tr>
        <td>${row.od} → ${row.do}</td>
        <td>${row.dHnaprijed.toFixed(2)}</td>
        <td>${row.dHnazad.toFixed(2)}</td>
        <td>${row.dHsred.toFixed(3)}</td>
        ${SL ? "" : `<td>${row.popravka.toFixed(3)}</td><td>${row.dHpopr.toFixed(3)}</td>`}
      </tr>`;
    });
    tblVisine += `</tbody></table>
      <h2>Nadmorske visine tačaka</h2>
      <table class="tabela"><thead><tr><th>Tačka</th><th>H (m)</th><th>Tip</th></tr></thead><tbody>`;
    rv.tocke.forEach((t) => {
      tblVisine += `<tr><td><strong>${t.naziv}</strong></td><td>${t.H.toFixed(3)}</td><td>${t.tip}</td></tr>`;
    });
    tblVisine += `</tbody></table>`;
  } else {
    tblVisine = `<div class="info" style="margin-top:20px">
      <b>Visinsko izravnanje</b> nije izračunato. Za visine: učitajte zapisnik (sadrži zenitne uglove)
      i unesite nadmorske visine H za početnu (B)${SL ? "" : " i krajnju (C)"} stanicu.</div>`;
  }

  document.getElementById("rezultatiSadrzaj").innerHTML =
    statusHtml + greskeHtml + tblBeta + tblAlfe + tblKoord + tblVisine;
}

/* ---------- Grafički prikaz (Canvas) ---------- */
function nacrtaj(r) {
  const c = document.getElementById("platno");
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);

  const tocke = r.tocke;
  if (!tocke || !tocke.length) return;

  const ys = tocke.map((t) => t.Y);
  const xs = tocke.map((t) => t.X);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const pad = 60;
  const sirina = c.width - 2 * pad;
  const visina = c.height - 2 * pad;
  const rasponY = (maxY - minY) || 1;
  const rasponX = (maxX - minX) || 1;
  const skala = Math.min(sirina / rasponY, visina / rasponX);

  // Y vodoravno (desno +), X okomito (gore +, pa obrćemo)
  const px = (Y) => pad + (Y - minY) * skala;
  const py = (X) => c.height - pad - (X - minX) * skala;

  // linije vlaka
  ctx.strokeStyle = "#1e5aa8";
  ctx.lineWidth = 2;
  ctx.beginPath();
  tocke.forEach((t, i) => {
    const x = px(t.Y), y = py(t.X);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // tačke i oznake
  tocke.forEach((t) => {
    const x = px(t.Y), y = py(t.X);
    ctx.fillStyle = t.tip === "data" ? "#d64545" : "#1f9d55";
    if (t.tip === "data") {
      // trokut za date tačke
      ctx.beginPath();
      ctx.moveTo(x, y - 7); ctx.lineTo(x - 6, y + 5); ctx.lineTo(x + 6, y + 5);
      ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(x, y, 5, 0, 2 * Math.PI); ctx.fill();
    }
    ctx.fillStyle = "#1e293b";
    ctx.font = "13px Segoe UI";
    ctx.fillText(t.naziv, x + 9, y - 6);
  });

  // legenda — crtamo oblike pa tekst (ne ovisi o fontu)
  ctx.font = "12px Segoe UI";
  // trokut
  ctx.fillStyle = "#d64545";
  ctx.beginPath();
  ctx.moveTo(pad, 26); ctx.lineTo(pad - 6, 36); ctx.lineTo(pad + 6, 36);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#1e293b"; ctx.fillText("date tačke", pad + 12, 35);
  // kružić
  ctx.fillStyle = "#1f9d55";
  ctx.beginPath(); ctx.arc(pad + 120, 31, 5, 0, 2 * Math.PI); ctx.fill();
  ctx.fillStyle = "#1e293b"; ctx.fillText("nove tačke", pad + 132, 35);
}

/* ---------- Izvoz u PDF (preko ispisa) ---------- */
document.getElementById("izvozPdf").addEventListener("click", () => {
  if (!zadnjiRezultat) { alert("Prvo izračunajte izravnanje."); return; }
  idiNa("rezultati");
  document.body.classList.add("print-rezultati");
  setTimeout(() => {
    window.print();
    setTimeout(() => document.body.classList.remove("print-rezultati"), 500);
  }, 300);
});

function preuzmi(blob, ime) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = ime;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/* ---------- Lijepljenje poznatih tačaka iz Excela ----------
   Zalijepljeni blok (redovi = tačke, kolone razdvojene tabom) raspoređuje se
   po ćelijama počevši od ćelije u koju se lijepi: kolone Broj tačke, Y, X, H;
   redovi A, B, C, D. Radi i s ; kao razdvajačem.                          */
(function () {
  const REDOVI = ["A", "B", "C", "D"];
  const KOLONE = ["naziv", "Y", "X", "H"];
  const tabela = document.getElementById("tabelaDate");
  if (!tabela) return;
  tabela.addEventListener("paste", (ev) => {
    const cilj = ev.target;
    if (!cilj || !cilj.dataset || cilj.dataset.red === undefined) return;
    const tekstCB = (ev.clipboardData || window.clipboardData).getData("text");
    if (!tekstCB) return;
    const linije = tekstCB.replace(/\r/g, "").split("\n").filter((l) => l.trim() !== "");
    // jedna jednostavna vrijednost: pusti uobičajeno lijepljenje u tu ćeliju
    const imaViseCelija = linije.length > 1 || /[\t;]/.test(linije[0] || "");
    if (!imaViseCelija) return;
    ev.preventDefault();
    const r0 = REDOVI.indexOf(cilj.dataset.red);
    const k0 = parseInt(cilj.dataset.kol, 10);
    linije.forEach((linija, ri) => {
      const celije = linija.includes("\t") ? linija.split("\t") : linija.split(";");
      celije.forEach((v, ci) => {
        const r = r0 + ri, k = k0 + ci;
        if (r >= REDOVI.length || k >= KOLONE.length) return;
        const polje = document.getElementById(REDOVI[r] + "_" + KOLONE[k]);
        if (polje && !polje.readOnly) polje.value = v.trim();
      });
    });
    if (vrstaVlaka() === "zatvoreni") sinkronizirajZatvoreni();
  });
})();

/* ---------- Početno stanje ---------- */
generirajTabelu(4, {
  uglovi: ["", "", "", ""],
  duzine: ["", "", ""],
  nazivi: ["", "1", "2", ""]
});

/* =====================================================================
   UČITAVANJE IZ TAHIMETRIJSKOG ZAPISNIKA (CSV)
   ===================================================================== */

// Predložak za preuzimanje — isti raspored kolona kao tahimetrijski zapisnik.
// Stanica i visina instrumenta se upisuju SAMO u prvom redu stanice.
// Kolona "Horizontalna dužina" se ostavlja prazna — aplikacija je sama računa.
// Uglovi se mogu upisati kao  254°28'48"  ILI kao decimalni  254.2848
const PREDLOZAK_CSV =
`Stanica i;Vizura;Kod;Horizontalni ugao;Zenitni ugao;Kosa dužina;Horizontalna dužina;Visina signala;Primjedba;Visina instrumenta
P647;P646;;254°28'48";89°19'50";76.019;;1.649;;1.694
;83;;347°37'52";90°09'14";68.084;;1.608;;
;83;;167°38'01";269°50'40";68.084;;1.608;;
;P646;;74°28'46";270°40'11";76.019;;1.649;;
;P646;;254°28'50";89°19'47";76.019;;1.649;;
;83;;347°37'56";90°09'12";68.084;;1.608;;
;83;;167°38'01";269°50'40";68.084;;1.608;;
;P646;;74°28'48";270°40'11";76.019;;1.649;;
`;

document.getElementById("preuzmiPredlozak").addEventListener("click", () => {
  try {
    // Excel predložak (uredna tablica s okvirima i zaglavljem)
    const bytes = window.XlsxGen.predlozakZapisnikXlsx();
    const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    preuzmi(blob, "predlozak_tahimetrijski_zapisnik.xlsx");
  } catch (e) {
    // rezerva: CSV ako generiranje Excela ne uspije
    const bom = "\uFEFF";
    const blob = new Blob([bom + PREDLOZAK_CSV], { type: "text/csv;charset=utf-8;" });
    preuzmi(blob, "predlozak_tahimetrijski_zapisnik.csv");
  }
});

document.getElementById("datotekaCSV").addEventListener("change", (ev) => {
  const f = ev.target.files && ev.target.files[0];
  if (!f) return;
  const jeXlsx = /\.xlsx$/i.test(f.name);
  const citac = new FileReader();
  citac.onload = async () => {
    try {
      if (jeXlsx) {
        const stanice = await window.Ucitavanje.ucitajXlsxStanice(citac.result);
        obradiUcitaneStanice(stanice);
      } else {
        obradiUcitaniCSV(String(citac.result));
      }
    } catch (e) {
      postaviStatus("Greška: " + e.message, false);
    }
  };
  if (jeXlsx) citac.readAsArrayBuffer(f);
  else citac.readAsText(f, "UTF-8");
  ev.target.value = "";
});

function postaviStatus(poruka, uspjeh) {
  const el = document.getElementById("statusUcitavanja");
  el.textContent = poruka;
  el.className = "napomena " + (uspjeh ? "uspjeh" : "neuspjeh");
}

function obradiUcitaniCSV(tekst) {
  const stanice = window.Ucitavanje.ucitajCSV(tekst);
  obradiUcitaneStanice(stanice);
}

/* Kontrola girusa: tablica s redukovanim uglom svakog girusa i kvačicama za izbor. */
function prikaziPanelGirusa(obradjene) {
  const okvir = document.getElementById("girusPanelOkvir");
  const maxG = Math.max(0, ...obradjene.map((o) => (o.pregledGirusa || []).length));
  if (!maxG) { okvir.style.display = "none"; return; }
  okvir.style.display = "block";
  let html = `<table><thead><tr><th>Stanica</th>`;
  for (let g = 1; g <= maxG; g++) html += `<th>Girus ${g}</th>`;
  html += `<th>Sredina</th><th>Rasipanje</th></tr></thead><tbody>`;
  obradjene.forEach((o, i) => {
    const pg = o.pregledGirusa || [];
    const koristeni = pg.filter((p) => p.koristi).map((p) => p.reduk);
    const raspon = koristeni.length > 1 ? Math.round((Math.max(...koristeni) - Math.min(...koristeni)) * 3600) : 0;
    html += `<tr class="${pg.length >= 3 ? "tri-girusa" : ""}"><td>${o.stanica}</td>`;
    for (let g = 0; g < maxG; g++) {
      const p = pg[g];
      html += p
        ? `<td class="${p.koristi ? "" : "isklj"}"><label><input type="checkbox" data-stan="${i}" data-g="${g}" ${p.koristi ? "checked" : ""} /> ${window.Girus.decUStr(p.reduk)}</label></td>`
        : `<td></td>`;
    }
    html += `<td>${window.Girus.decUStr(o.prelomniUgao)}</td><td>${raspon ? raspon + "″" : "—"}</td></tr>`;
  });
  html += `</tbody></table>`;
  const panel = document.getElementById("girusPanel");
  panel.innerHTML = html;
  panel.querySelectorAll("input[type=checkbox]").forEach((cb) => {
    cb.addEventListener("change", () => {
      const i = parseInt(cb.dataset.stan, 10), g = parseInt(cb.dataset.g, 10);
      izborGirusa[i][g] = cb.checked;
      if (!izborGirusa[i].some(Boolean)) {
        izborGirusa[i][g] = true;
        alert("Na svakoj stanici mora ostati bar jedan girus.");
      }
      obradiUcitaneStanice(ucitaneStanice, true);
    });
  });
}

function obradiUcitaneStanice(stanice, ponovo) {
  ucitaneStanice = stanice;   // sačuvaj sirova mjerenja za obrazac TZ
  if (!ponovo) izborGirusa = stanice.map((s) => Array(Math.floor(s.mjerenja.length / 4)).fill(true));
  const { obradjene, greske } = window.Ucitavanje.pripremiIzStanica(stanice, izborGirusa);

  const validne = obradjene.filter((o) => !o.greska);
  if (!validne.length) {
    postaviStatus("Nijedna stanica nije ispravno obrađena. " + (greske[0] || ""), false);
    return;
  }

  // sačuvaj obrađene stanice (trebaju za visinsko izravnanje)
  obradjeneStanice = validne;

  // Popuni tabelu prelomnih uglova i dužina
  const n = validne.length;                 // broj prelomnih uglova = broj stanica
  document.getElementById("brojUglova").value = n;
  generirajTabelu(n);

  const uglInputi = document.querySelectorAll(".in-ugao");
  const duzInputi = document.querySelectorAll(".in-duzina");
  const nazInputi = document.querySelectorAll(".in-naziv");

  const slijepi = validne.length >= 2 && !!validne[validne.length - 1].samoOrijentacija;
  validne.forEach((o, i) => {
    if (o.samoOrijentacija) return;   // slijepi vlak: zadnja stanica nema prelomni ugao
    // prelomni ugao upisujemo u čitljivom zapisu SSS°MM'SS" (jezgra ga razumije preko parsiranja)
    if (uglInputi[i]) uglInputi[i].value = window.Girus.decUStr(o.prelomniUgao);
    // dužina (ima je svaka stanica osim zadnje): sredina horizontalne dužine naprijed i nazad
    if (duzInputi[i]) {
      const sljed = validne[i + 1];
      const d = sljed ? (o.horizDuzina + sljed.horizDuzinaZadnja) / 2 : o.horizDuzina;
      duzInputi[i].value = d.toFixed(4);
    }
    // naziv prednje tačke (nova tačka)
    if (nazInputi[i]) nazInputi[i].value = o.nazPrednja || "";
  });

  prikaziPanelGirusa(validne);
  if (ponovo) {
    postaviStatus("Izbor girusa promijenjen — uglovi i dužine su ažurirani. Kliknite Izračunaj.", true);
    return;
  }

  if (slijepi) {
    postaviVrstu("slijepi");
    obrisiStareDateTacke({ A: validne[0].nazZadnja, B: validne[0].stanica });
    document.getElementById("A_naziv").value = validne[0].nazZadnja || document.getElementById("A_naziv").value;
    document.getElementById("B_naziv").value = validne[0].stanica;
    postaviStatus(`Učitano ${n} stanica — prepoznat SLIJEPI vlak (zadnja stanica ${validne[n - 1].stanica} nema girus, samo orijentaciju unazad). Upišite koordinate (Y, X) i visine (H) za ${document.getElementById("A_naziv").value} i ${document.getElementById("B_naziv").value}, zatim kliknite Izračunaj.`, true);
    if (greske.length) alert("Napomena:\n" + greske.join("\n"));
    return;
  }

  // zapisnik s mjerenjima: dužine se redukuju na nultu plohu (kao u Excel obrascu TO 18D)
  document.getElementById("redukcijaNacin").value = "auto";
  osvjeziPoljaRedukcije();

  // zatvoren vlak: prva i zadnja stanica su ista tačka (npr. T809 … T809)
  const zatvoren = n >= 3 && String(validne[0].stanica).trim() === String(validne[n - 1].stanica).trim();
  postaviVrstu(zatvoren ? "zatvoreni" : "umetnuti");
  
  obrisiStareDateTacke(zatvoren
    ? { A: validne[0].nazZadnja, B: validne[0].stanica, C: validne[0].stanica, D: validne[0].nazZadnja }
    : { A: validne[0].nazZadnja, B: validne[0].stanica, C: validne[n - 1].stanica, D: validne[n - 1].nazPrednja });
  if (zatvoren) {
    document.getElementById("B_naziv").value = validne[0].stanica;
    document.getElementById("A_naziv").value = validne[0].nazZadnja || document.getElementById("A_naziv").value;
  } else {
    // umetnuti vlak: nazivi date tačaka iz zapisnika (koordinate upisuje korisnik)
    document.getElementById("A_naziv").value = validne[0].nazZadnja || document.getElementById("A_naziv").value;
    document.getElementById("B_naziv").value = validne[0].stanica;
    document.getElementById("C_naziv").value = validne[n - 1].stanica;
    document.getElementById("D_naziv").value = validne[n - 1].nazPrednja || document.getElementById("D_naziv").value;
  }
  sinkronizirajZatvoreni();

  postaviStatus(`Učitano ${n} stanica${zatvoren ? " — prepoznat ZATVOREN vlak (C = B, D = A)" : ""}. ${zatvoren ? "Upišite koordinate i visinu za " + document.getElementById("A_naziv").value + " i " + document.getElementById("B_naziv").value : "Upišite koordinate (Y, X) i visine (H) za date tačke " + ["A","B","C","D"].map((k) => document.getElementById(k + "_naziv").value).join(", ")}, zatim kliknite Izračunaj.`, true);
  if (greske.length) {
    alert("Napomena:\n" + greske.join("\n"));
  }
}

/* =====================================================================
   GEODETSKI OBRASCI (kartica 4)
   ===================================================================== */
let trenutniObrazac = "tz";

document.querySelectorAll("[data-obrazac]").forEach((btn) => {
  btn.addEventListener("click", () => {
    trenutniObrazac = btn.dataset.obrazac;
    prikaziObrazac();
  });
});

document.getElementById("stampajObrazac").addEventListener("click", () => {
  if (trenutniObrazac === "tz" && !ucitaneStanice) { alert("Učitajte zapisnik."); return; }
  if (trenutniObrazac !== "tz" && !zadnjiRezultat) { alert("Prvo izračunajte izravnanje."); return; }
  // ispiši samo trenutni obrazac (jedan A4)
  ispisiObrasce([trenutniObrazac]);
});

document.getElementById("izvozVlakTxt").addEventListener("click", () => {
  if (!zadnjiRezultat) { alert("Prvo izračunajte izravnanje."); return; }
  const visine = zadnjiRezultatVisine ? zadnjiRezultatVisine.tocke.map((t) => t.H) : null;
  const blob = new Blob([window.Detalj.tackeVlakaUTxt(zadnjiRezultat, visine)], { type: "text/plain;charset=utf-8" });
  preuzmi(blob, "tacke_vlaka.txt");
});

document.getElementById("izvozDetaljiTxt").addEventListener("click", () => {
  if (!zadnjiDetalji || !zadnjiDetalji.ukupno) { alert("Nema izračunatih detaljnih tačaka. Učitajte zapisnik s detaljem i kliknite Izračunaj izravnanje."); return; }
  const blob = new Blob([window.Detalj.detaljiUTxt(zadnjiDetalji)], { type: "text/plain;charset=utf-8" });
  preuzmi(blob, "detaljne_tacke.txt");
});

document.getElementById("stampajSve").addEventListener("click", () => {
  if (!zadnjiRezultat) { alert("Prvo izračunajte izravnanje."); return; }
  // svi dostupni obrasci, redom (samo oni koji su napravljeni)
  ispisiObrasce(["tz", "to1i2", "to1v", "to18d", "to8", "o19", "to28p", "tok", "det", "o25"]);
});

// Obrasci koji se ispisuju na A4 LANDSCAPE (ostali su uspravni).
const LANDSCAPE_OBRASCI = [];   // trenutno nijedan (svi obrasci su uspravni; "det" je kratki obrazac)

/* Složi odabrane obrasce, svaki na svoj A4 list, pa pokreni ispis.
   Preglednici (Chrome/Edge) ne podržavaju uspravne i landscape strane u JEDNOM ispisu
   (veličina prve strane vrijedi za sve), pa se obrasci ispisuju u zasebnim dokumentima
   po orijentaciji: prvo uspravni, zatim landscape. */
async function ispisiObrasce(lista) {
  const uspravni = lista.filter((k) => !LANDSCAPE_OBRASCI.includes(k));
  const landscape = lista.filter((k) => LANDSCAPE_OBRASCI.includes(k));

  if (uspravni.length && landscape.length) {
    const ok = confirm(
      "Obrasci se ispisuju u DVA dokumenta jer imaju različitu orijentaciju:\n" +
      "  1) uspravni obrasci (A4 portrait)\n" +
      "  2) Detaljne tačke (A4 landscape)\n\nNastaviti?");
    if (!ok) return;
  }

  if (uspravni.length) await ispisiGrupu(uspravni);

  if (landscape.length) {
    if (uspravni.length && !confirm("Sada slijedi ispis obrasca Detaljne tačke (A4 landscape). Nastaviti?")) return;
    await ispisiGrupu(landscape);
  }
}

// Ispis jedne grupe obrazaca iste orijentacije; vraća Promise kad je ispis završen.
function ispisiGrupu(kodovi) {
  return new Promise((resolve) => {
    const el = document.getElementById("obrazacSadrzaj");
    const original = el.innerHTML;         // zapamti trenutni prikaz

    // 1) složi obrasce
    let html = "";
    kodovi.forEach((kod) => {
      const sadrzaj = generirajObrazacHTML(kod);
      if (sadrzaj) html += `<div class="obrazac-stranica${LANDSCAPE_OBRASCI.includes(kod) ? " ls" : ""}" data-kod="${kod}">${sadrzaj}</div>`;
    });
    el.innerHTML = html;
    document.body.classList.add("print-obrasci");

    // 2) razbij svaki obrazac na A4 stranice po visini i dodaj "Strana N / M"
    paginirajObrasce(el);

    let zavrseno = false;
    const zavrsi = () => {
      if (zavrseno) return;
      zavrseno = true;
      window.removeEventListener("afterprint", zavrsi);
      el.innerHTML = original;
      document.body.classList.remove("print-obrasci");
      resolve();
    };
    window.addEventListener("afterprint", zavrsi);

    const t0 = performance.now();
    window.print();
    // Chrome/Edge: print() blokira dok je dijalog otvoren — kad se vrati, ispis je gotov.
    // Ostali preglednici vraćaju odmah; tada se čeka događaj "afterprint".
    if (performance.now() - t0 > 300) setTimeout(zavrsi, 400);
  });
}

/* Razbija svaki obrazac (tablicu) na više A4 stranica po visini,
   te na svaku fizičku stranicu stavlja oznaku "Strana N / M". */
function paginirajObrasce(kontejner) {
  // visina korisnog dijela A4 portrait (297mm - margine) u px (~96dpi).
  // Uzimamo rezervu (umanjeno) da sadržaj sigurno stane unutar jedne fizičke strane.
  const A4_VISINA_PX = Math.round(((297 - 20) / 25.4) * 96) - 70; // ≈ 977px
  const obrasci = [...kontejner.querySelectorAll(".obrazac-stranica")];

  obrasci.forEach((obr) => {
    const tabela = obr.querySelector("table.obrazac");
    if (!tabela) return;
    const naslov = obr.querySelector(".obrazac-naslov-linija");
    const thead = tabela.querySelector("thead");
    const tbody = tabela.querySelector("tbody");
    if (!tbody) return;

    const redovi = [...tbody.children];
    // procijeni koliko redova stane po stranici
    const jeLs = obr.classList.contains("ls");
    // landscape: niža stranica (210mm); mjerenje je na ekranu (font 14px), a ispis je 11px → ×0,88
    const faktor = jeLs ? 0.88 : 1;
    const visStranice = jeLs ? Math.round(((210 - 20) / 25.4) * 96) - 40 : A4_VISINA_PX;
    const visinaNaslov = (naslov ? naslov.offsetHeight + 8 : 0) * faktor;
    const visinaThead = (thead ? thead.offsetHeight : 0) * faktor;
    const raspoloziva = visStranice - visinaNaslov - visinaThead - 30;

    // izmjeri kumulativnu visinu redova i podijeli u grupe (stranice)
    const grupe = [[]];
    let h = 0;
    redovi.forEach((tr) => {
      const vh = (tr.offsetHeight || 24) * faktor;
      if (h + vh > raspoloziva && grupe[grupe.length - 1].length > 0) {
        grupe.push([]);
        h = 0;
      }
      grupe[grupe.length - 1].push(tr);
      h += vh;
    });

    const ukupno = grupe.length;
    if (ukupno <= 1) {
      // stane na jednu stranicu — samo dodaj oznaku strane
      dodajOznakuStrane(obr, 1, 1);
      return;
    }

    // više stranica: napravi zasebni .obrazac-stranica za svaku grupu
    const naslovHTML = naslov ? naslov.outerHTML : "";
    const theadHTML = thead ? thead.outerHTML : "";
    const tabelaKlase = tabela.className;
    const roditelj = obr.parentNode;
    const refNext = obr.nextSibling;

    grupe.forEach((grupa, gi) => {
      const div = document.createElement("div");
      div.className = obr.className;   // zadrži i klasu "ls" (landscape)
      const telo = grupa.map((tr) => tr.outerHTML).join("");
      div.innerHTML = naslovHTML +
        `<table class="${tabelaKlase}">${theadHTML}<tbody>${telo}</tbody></table>`;
      dodajOznakuStrane(div, gi + 1, ukupno);
      roditelj.insertBefore(div, refNext);
    });
    obr.remove();
  });

  // zadnjoj fizičkoj stranici makni prijelom (da ne nastane prazna strana na kraju)
  const sve = [...kontejner.querySelectorAll(".obrazac-stranica")];
  if (sve.length) {
    sve.forEach((s) => s.style.pageBreakAfter = "always");
    sve[sve.length - 1].style.pageBreakAfter = "auto";
  }
}

function dodajOznakuStrane(obr, broj, ukupno) {
  const oznaka = document.createElement("div");
  oznaka.className = "oznaka-strane";
  oznaka.textContent = `Strana ${broj} / ${ukupno}`;
  obr.insertBefore(oznaka, obr.firstChild);
}

// Vrati HTML jednog obrasca po kodu (bez promjene prikaza).
function generirajObrazacHTML(kod) {
  if (kod === "tz") {
    return ucitaneStanice ? window.Obrasci.obrazacTZ(ucitaneStanice, lokalitet) : "";
  }
  if (kod === "to1i2") {
    return obradjeneStanice ? window.Obrasci.obrazac1i2(obradjeneStanice) : "";
  }
  if (kod === "to1v") {
    return obradjeneStanice ? window.Obrasci.obrazac1V(obradjeneStanice) : "";
  }
  if (kod === "to18d") {
    return obradjeneStanice ? window.Obrasci.obrazac18D(obradjeneStanice, zadnjiFaktorRedukcije) : "";
  }
  if (kod === "to8") {
    return zadnjiRezultat ? window.Obrasci.obrazac8(dateTackeABCD()) : "";
  }
  if (kod === "to28p") {
    return zadnjiRezultatVisine && !zadnjiRezultatVisine.greska
      ? window.Obrasci.obrazac28P(zadnjiRezultatVisine) : "";
  }
  if (kod === "det") {
    return zadnjiDetalji ? window.Obrasci.obrazacDetalji(zadnjiDetalji) : "";
  }
  if (kod === "tok") {
    return zadnjiRezultatVisine && !zadnjiRezultatVisine.greska
      ? window.Obrasci.obrazacK(zadnjiRezultatVisine) : "";
  }
  if (kod === "o19") {
    return zadnjiRezultat ? window.Obrasci.obrazac19(zadnjiRezultat, { nazivA: tekst("A_naziv") }) : "";
  }
  if (kod === "o25") {
    return zadnjiRezultat ? sloziObrazac25() : "";
  }
  return "";
}

// kad se otvori kartica Obrasci, osvježi prikaz
function osvjeziObrasceAkoTreba(cilj) {
  if (cilj === "obrasci") prikaziObrazac();
}

function prikaziObrazac() {
  const el = document.getElementById("obrazacSadrzaj");
  // TZ se može prikazati i bez izračuna (dovoljno je učitati zapisnik)
  if (trenutniObrazac === "tz") {
    if (!ucitaneStanice) {
      el.innerHTML = `<div class="info">Učitajte tahimetrijski zapisnik (CSV) na kartici 1 da se prikaže ovaj obrazac.</div>`;
      return;
    }
    el.innerHTML = window.Obrasci.obrazacTZ(ucitaneStanice, lokalitet);
    oznaciAktivniObrazac();
    return;
  }

  if (!zadnjiRezultat) {
    el.innerHTML = `<div class="info">Prvo unesite podatke i kliknite „Izračunaj izravnanje" na kartici 1.</div>`;
    return;
  }
  if (trenutniObrazac === "o25") {
    el.innerHTML = sloziObrazac25();
  } else if (trenutniObrazac === "o19") {
    el.innerHTML = window.Obrasci.obrazac19(zadnjiRezultat, { nazivA: tekst("A_naziv") });
  } else if (trenutniObrazac === "to1i2") {
    if (!obradjeneStanice) {
      el.innerHTML = `<div class="info">Učitajte zapisnik (CSV/Excel) da se prikaže ovaj obrazac.</div>`;
    } else {
      el.innerHTML = window.Obrasci.obrazac1i2(obradjeneStanice);
    }
  } else if (trenutniObrazac === "to1v") {
    if (!obradjeneStanice) {
      el.innerHTML = `<div class="info">Učitajte zapisnik (CSV/Excel) da se prikaže ovaj obrazac.</div>`;
    } else {
      el.innerHTML = window.Obrasci.obrazac1V(obradjeneStanice);
    }
  } else if (trenutniObrazac === "to18d") {
    if (!obradjeneStanice) {
      el.innerHTML = `<div class="info">Učitajte zapisnik (CSV/Excel) da se prikaže ovaj obrazac.</div>`;
    } else {
      el.innerHTML = window.Obrasci.obrazac18D(obradjeneStanice, zadnjiFaktorRedukcije);
    }
  } else if (trenutniObrazac === "to8") {
    el.innerHTML = window.Obrasci.obrazac8(dateTackeABCD());
  } else if (trenutniObrazac === "to28p") {
    if (!zadnjiRezultatVisine || zadnjiRezultatVisine.greska) {
      el.innerHTML = `<div class="info">Za ovaj obrazac učitajte tahimetrijski zapisnik (mjerenja) i unesite nadmorske visine H za tačke B i C, pa kliknite „Izračunaj izravnanje".</div>`;
    } else {
      el.innerHTML = window.Obrasci.obrazac28P(zadnjiRezultatVisine);
    }
  } else if (trenutniObrazac === "det") {
    if (!zadnjiDetalji) {
      el.innerHTML = `<div class="info">Za ovaj obrazac učitajte tahimetrijski zapisnik koji sadrži i detaljne tačke (npr. 1, 2, 3…), pa kliknite „Izračunaj izravnanje".</div>`;
    } else {
      el.innerHTML = window.Obrasci.obrazacDetalji(zadnjiDetalji);
    }
  } else if (trenutniObrazac === "tok") {
    if (!zadnjiRezultatVisine || zadnjiRezultatVisine.greska) {
      el.innerHTML = `<div class="info">Za ovaj obrazac učitajte tahimetrijski zapisnik (mjerenja) i unesite nadmorske visine H za tačke B i C, pa kliknite „Izračunaj izravnanje".</div>`;
    } else {
      el.innerHTML = window.Obrasci.obrazacK(zadnjiRezultatVisine);
    }
  } else {
    el.innerHTML = `<div class="info">Obrazac <b>${trenutniObrazac}</b> je u pripremi.</div>`;
  }
  oznaciAktivniObrazac();
}

// vizualno označi koji je obrazac odabran
function oznaciAktivniObrazac() {
  document.querySelectorAll("[data-obrazac]").forEach((b) => {
    b.classList.toggle("odabran", b.dataset.obrazac === trenutniObrazac);
  });
}

function sloziObrazac25() {
  const r = zadnjiRezultat;
  const rv = zadnjiRezultatVisine;
  // mapa visina po nazivu
  const visMap = {};
  if (rv) rv.tocke.forEach((t) => { visMap[t.naziv] = t.H; });

  // date tačke: A, B, C, D (s visinama iz polja)
  const dateTacke = [
    { naziv: tekst("A_naziv"), Y: broj("A_Y"), X: broj("A_X"), H: brojOpc("A_H") },
    { naziv: tekst("B_naziv"), Y: broj("B_Y"), X: broj("B_X"), H: brojOpc("B_H") },
    { naziv: tekst("C_naziv"), Y: broj("C_Y"), X: broj("C_X"), H: brojOpc("C_H") },
    { naziv: tekst("D_naziv"), Y: broj("D_Y"), X: broj("D_X"), H: brojOpc("D_H") },
  ];
  if (r.slijepi) dateTacke.length = 2;

  // nove tačke: iz rezultata (tip "nova")
  const noveTacke = r.tocke
    .filter((t) => t.tip === "nova")
    .map((t) => ({ naziv: t.naziv, Y: t.Y, X: t.X, H: visMap[t.naziv] }));

  return window.Obrasci.obrazac25(dateTacke, noveTacke);
}

// Date tačke A, B, C, D iz polja na kartici 1 (za TO 8 — direkcioni uglovi)
function dateTackeABCD() {
  return {
    A: { naziv: tekst("A_naziv"), Y: broj("A_Y"), X: broj("A_X") },
    B: { naziv: tekst("B_naziv"), Y: broj("B_Y"), X: broj("B_X") },
    C: vrstaVlaka() === "slijepi" ? null : { naziv: tekst("C_naziv"), Y: broj("C_Y"), X: broj("C_X") },
    D: vrstaVlaka() === "slijepi" ? null : { naziv: tekst("D_naziv"), Y: broj("D_Y"), X: broj("D_X") },
  };
}

function brojOpc(id) {
  const v = parseDec(document.getElementById(id).value);
  return isNaN(v) ? null : v;
}
