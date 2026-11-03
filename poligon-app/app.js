/* app.js — povezuje sučelje s jezgrom izračuna (racun.js) */

let zadnjiRezultat = null;

/* ---------- Navigacija kartica ---------- */
document.querySelectorAll(".kartica").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".kartica").forEach((b) => b.classList.remove("aktivna"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("vidljiv"));
    btn.classList.add("aktivna");
    const cilj = document.getElementById(btn.dataset.cilj);
    cilj.classList.add("vidljiv");
    if (btn.dataset.cilj === "crtez" && zadnjiRezultat) nacrtaj(zadnjiRezultat);
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
      <td>${imaDuzina ? `<input class="in-duzina" type="number" step="0.001" value="${duzV}" placeholder="m" />` : "<span class='napomena'>—</span>"}</td>
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
  // Date tačke (iz Excela)
  postavi("A_naziv","P2585"); postavi("A_Y","6525657.407"); postavi("A_X","4864001.469");
  postavi("B_naziv","P2586"); postavi("B_Y","6525579.270"); postavi("B_X","4863951.535");
  postavi("C_naziv","P2582"); postavi("C_Y","6525881.407"); postavi("C_X","4863893.674");
  postavi("D_naziv","P2581"); postavi("D_Y","6525982.753"); postavi("D_X","4863728.072");
  document.getElementById("brojUglova").value = 4;
  // Primjer vrijednosti (ilustrativne — korisnik unosi svoje stvarne)
  generirajTabelu(4, {
    uglovi: [135.5955, 209.3627, 91.2024, 148.3206],
    duzine: [116.767, 46.673, 72.058],
    nazivi: ["", "1", "2", ""]
  });
  alert("Učitan je primjer s datim tačkama iz Excela.\nUglovi i dužine su ilustrativni — zamijenite ih svojim mjerenjima.");
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
function broj(id){ return parseFloat(document.getElementById(id).value) || 0; }
function tekst(id){ return document.getElementById(id).value || ""; }

/* ---------- Izračun ---------- */
document.getElementById("izracunaj").addEventListener("click", () => {
  const uglovi = [...document.querySelectorAll(".in-ugao")].map((e) => e.value);
  const duzine = [...document.querySelectorAll(".in-duzina")].map((e) => parseFloat(e.value) || 0);
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

  const ulaz = {
    datePocetne: { A:{Y:broj("A_Y"),X:broj("A_X")}, B:{Y:broj("B_Y"),X:broj("B_X")} },
    dateKrajnje: { C:{Y:broj("C_Y"),X:broj("C_X")}, D:{Y:broj("D_Y"),X:broj("D_X")} },
    prelomniUglovi: prelomniSms,
    duzine,
    nazivi: naziviNovih,
    nazivPocetne: tekst("B_naziv") || "B",
    nazivKrajnje: tekst("C_naziv") || "C",
  };

  try {
    const r = window.Racun.izravnajUmetnutiVlak(ulaz);
    zadnjiRezultat = r;
    prikaziRezultate(r);
    idiNa("rezultati");
  } catch (e) {
    alert("Greška u izračunu: " + e.message);
    console.error(e);
  }
});

/* ---------- Prikaz rezultata ---------- */
function prikaziRezultate(r) {
  const D = window.Racun.decimalniUSms;
  const sek = (x) => (x >= 0 ? "+" : "") + x.toFixed(1) + "\"";

  // sažetak kartice
  const kutnoKlasa = r.kutnoOK ? "ok" : "ne";
  const linKlasa = r.linearnoOK ? "ok" : "ne";
  document.getElementById("sazetak").innerHTML = `
    <h2>Sažetak izravnanja</h2>
    <div class="sazetak-kartice">
      <div class="sk ${kutnoKlasa}">
        <div class="oznaka">Kutno odstupanje f&beta;</div>
        <div class="vrijednost">${sek(r.fBetaSek)}</div>
        <div class="napomena">dopušteno ±${r.dopustenoFbetaSek.toFixed(1)}"</div>
      </div>
      <div class="sk ${linKlasa}">
        <div class="oznaka">Linearno odstupanje f<sub>d</sub></div>
        <div class="vrijednost">${r.fd.toFixed(3)} m</div>
        <div class="napomena">dopušteno ${r.dopustenoFd.toFixed(3)} m</div>
      </div>
      <div class="sk">
        <div class="oznaka">Broj prelomnih uglova</div>
        <div class="vrijednost">${r.n}</div>
      </div>
      <div class="sk">
        <div class="oznaka">Ukupna dužina vlaka</div>
        <div class="vrijednost">${r.sumaD.toFixed(2)} m</div>
      </div>
    </div>
  `;

  // tabela direkcijskih uglova
  let tblAlfe = `
    <h2>Direkcijski uglovi i priraštaji</h2>
    <table class="tabela">
      <thead><tr>
        <th>Stranica</th><th>Direkcijski ugao &alpha;</th>
        <th>Dužina d (m)</th><th>&Delta;y</th><th>&Delta;x</th>
        <th>Popravka v<sub>y</sub></th><th>Popravka v<sub>x</sub></th>
      </tr></thead><tbody>`;
  for (let i = 0; i < r.brStranica; i++) {
    tblAlfe += `<tr>
      <td>${i + 1}</td>
      <td>${D(r.alfe[i])}</td>
      <td>${r.d[i].toFixed(3)}</td>
      <td>${r.dy[i].toFixed(4)}</td>
      <td>${r.dx[i].toFixed(4)}</td>
      <td>${r.vy[i].toFixed(4)}</td>
      <td>${r.vx[i].toFixed(4)}</td>
    </tr>`;
  }
  tblAlfe += `<tr style="font-weight:700;background:#eef4fb">
      <td colspan="2">Σ</td>
      <td>${r.sumaD.toFixed(3)}</td>
      <td>${r.sumaDy.toFixed(4)}</td>
      <td>${r.sumaDx.toFixed(4)}</td>
      <td colspan="2"></td></tr>`;
  tblAlfe += `</tbody></table>`;

  // tabela prelomnih uglova (mjereni i popravljeni)
  let tblBeta = `
    <h2>Prelomni uglovi</h2>
    <p class="napomena">Popravka na svaki ugao: ${sek(r.popravakUgla*3600)}</p>
    <table class="tabela">
      <thead><tr><th>#</th><th>Mjereni ugao</th><th>Popravljeni ugao</th></tr></thead><tbody>`;
  for (let i = 0; i < r.n; i++) {
    tblBeta += `<tr><td>${i+1}</td><td>${D(r.beta[i])}</td><td>${D(r.betaPopr[i])}</td></tr>`;
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
  tblKoord += `<p class="napomena">Kontrola zatvaranja na krajnjoj tački: &Delta;Y=${r.odstY} m, &Delta;X=${r.odstX} m</p>`;

  // status kontrola
  const statusHtml = `
    <h2>Kontrola dopuštenih odstupanja</h2>
    <p>Kutno izravnanje:
      <span class="oznaka-status ${r.kutnoOK?'status-ok':'status-ne'}">
        ${r.kutnoOK ? "U DOZVOLJENIM GRANICAMA" : "PREKORAČENO"}</span></p>
    <p>Linearno izravnanje:
      <span class="oznaka-status ${r.linearnoOK?'status-ok':'status-ne'}">
        ${r.linearnoOK ? "U DOZVOLJENIM GRANICAMA" : "PREKORAČENO"}</span></p>
  `;

  const greskeHtml = r.greske.length
    ? `<div class="greska">⚠ ${r.greske.join("<br>")}</div>` : "";

  document.getElementById("rezultatiSadrzaj").innerHTML =
    statusHtml + greskeHtml + tblBeta + tblAlfe + tblKoord;
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

/* ---------- Izvoz u Excel (CSV) ---------- */
document.getElementById("izvozExcel").addEventListener("click", () => {
  if (!zadnjiRezultat) { alert("Prvo izračunajte izravnanje."); return; }
  const r = zadnjiRezultat;
  let csv = "Tacka;Y (m);X (m);Tip\n";
  r.tocke.forEach((t) => {
    csv += `${t.naziv};${t.Y.toFixed(4)};${t.X.toFixed(4)};${t.tip}\n`;
  });
  csv += `\nKutno odstupanje fbeta (sek);${r.fBetaSek.toFixed(1)}\n`;
  csv += `Dopusteno kutno (sek);${r.dopustenoFbetaSek.toFixed(1)}\n`;
  csv += `Linearno odstupanje fd (m);${r.fd.toFixed(3)}\n`;
  csv += `Dopusteno linearno (m);${r.dopustenoFd.toFixed(3)}\n`;
  csv += `Ukupna duzina (m);${r.sumaD.toFixed(2)}\n`;

  const bom = "\uFEFF"; // da Excel prepozna UTF-8
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  preuzmi(blob, "koordinate_poligonski_vlak.csv");
});

/* ---------- Izvoz u PDF (preko ispisa) ---------- */
document.getElementById("izvozPdf").addEventListener("click", () => {
  if (!zadnjiRezultat) { alert("Prvo izračunajte izravnanje."); return; }
  idiNa("rezultati");
  setTimeout(() => window.print(), 300);
});

function preuzmi(blob, ime) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = ime;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/* ---------- Početno stanje ---------- */
generirajTabelu(4, {
  uglovi: ["", "", "", ""],
  duzine: ["", "", ""],
  nazivi: ["", "1", "2", ""]
});

/* =====================================================================
   UČITAVANJE IZ TAHIMETRIJSKOG ZAPISNIKA (CSV)
   ===================================================================== */

// Predložak za preuzimanje (isti raspored koji aplikacija čita)
const PREDLOZAK_CSV =
`Stanica;VisinaInstrumenta;Vizura;Kod;HorizontalniUgao;ZenitniUgao;KosaDuzina;VisinaSignala
P2586;1.658;P2585;;57°25'08";90°49'44";92.750;1.671
;;1;;193°25'01";89°46'31";116.768;1.455
;;1;;13°25'11";270°13'13";116.768;1.455
;;P2585;;237°25'15";269°10'09";92.750;1.671
;;P2585;;57°25'12";90°49'41";92.750;1.671
;;1;;193°25'04";89°46'35";116.768;1.455
;;1;;13°25'12";270°13'17";116.768;1.455
;;P2585;;237°25'15";269°10'10";92.750;1.671
`;

document.getElementById("preuzmiPredlozak").addEventListener("click", () => {
  const bom = "\uFEFF";
  const blob = new Blob([bom + PREDLOZAK_CSV], { type: "text/csv;charset=utf-8;" });
  preuzmi(blob, "predlozak_tahimetrijski_zapisnik.csv");
});

document.getElementById("datotekaCSV").addEventListener("change", (ev) => {
  const f = ev.target.files && ev.target.files[0];
  if (!f) return;
  const citac = new FileReader();
  citac.onload = () => {
    try {
      obradiUcitaniCSV(String(citac.result));
    } catch (e) {
      postaviStatus("Greška: " + e.message, false);
    }
  };
  citac.readAsText(f, "UTF-8");
  // resetiraj da se može ponovno učitati ista datoteka
  ev.target.value = "";
});

function postaviStatus(poruka, uspjeh) {
  const el = document.getElementById("statusUcitavanja");
  el.textContent = poruka;
  el.className = "napomena " + (uspjeh ? "uspjeh" : "neuspjeh");
}

function obradiUcitaniCSV(tekst) {
  const stanice = window.Ucitavanje.ucitajCSV(tekst);
  const { obradjene, greske } = window.Ucitavanje.pripremiIzStanica(stanice);

  const validne = obradjene.filter((o) => !o.greska);
  if (!validne.length) {
    postaviStatus("Nijedna stanica nije ispravno obrađena. " + (greske[0] || ""), false);
    return;
  }

  // Popuni tabelu prelomnih uglova i dužina
  const n = validne.length;                 // broj prelomnih uglova = broj stanica
  document.getElementById("brojUglova").value = n;
  generirajTabelu(n);

  const uglInputi = document.querySelectorAll(".in-ugao");
  const duzInputi = document.querySelectorAll(".in-duzina");
  const nazInputi = document.querySelectorAll(".in-naziv");

  validne.forEach((o, i) => {
    // prelomni ugao upisujemo u čitljivom zapisu SSS°MM'SS" (jezgra ga razumije preko parsiranja)
    if (uglInputi[i]) uglInputi[i].value = window.Girus.decUStr(o.prelomniUgao);
    // dužina (ima je svaka stanica osim zadnje)
    if (duzInputi[i]) duzInputi[i].value = o.horizDuzina.toFixed(3);
    // naziv prednje tačke (nova tačka)
    if (nazInputi[i]) nazInputi[i].value = o.nazPrednja || "";
  });

  postaviStatus(`Učitano ${n} stanica. Provjerite date tačke pa kliknite „Izračunaj".`, true);
  if (greske.length) {
    alert("Napomena:\n" + greske.join("\n"));
  }
}
