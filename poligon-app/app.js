/* app.js — povezuje sučelje s jezgrom izračuna (racun.js) */

let zadnjiRezultat = null;
let zadnjiRezultatVisine = null;
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

    // --- Visinsko izravnanje (ako ima podataka iz zapisnika i date visine) ---
    zadnjiRezultatVisine = null;
    const Hb = parseFloat(document.getElementById("B_H").value);
    const Hc = parseFloat(document.getElementById("C_H").value);
    if (obradjeneStanice && obradjeneStanice.length >= 2 && !isNaN(Hb) && !isNaN(Hc)) {
      try {
        zadnjiRezultatVisine = window.Visine.izravnajVisine(obradjeneStanice, Hb, Hc);
      } catch (ev) {
        console.warn("Visinsko izravnanje preskočeno:", ev.message);
      }
    }

    prikaziRezultate(r, zadnjiRezultatVisine);
    idiNa("rezultati");
  } catch (e) {
    alert("Greška u izračunu: " + e.message);
    console.error(e);
  }
});

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
  const kutnoKlasa = r.kutnoOK ? "ok" : "ne";
  const linKlasa = r.linearnoOK ? "ok" : "ne";
  document.getElementById("sazetak").innerHTML = `
    <h2>Sažetak izravnanja</h2>
    <div class="sazetak-kartice">
      <div class="sk ${kutnoKlasa}">
        <div class="oznaka">Uglovno odstupanje f&beta;</div>
        <div class="vrijednost">${sekMinSek(r.fBetaSek, true)}</div>
        <div class="napomena">dopušteno ±${sekMinSek(r.dopustenoFbetaSek, false)}</div>
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
      ${rv ? `
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
    <p class="napomena">Popravka na svaki ugao: ${sekMinSek(r.popravakUgla*3600, true)}</p>
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
      <p class="napomena">Zatvaranje visina f<sub>h</sub> = ${(rv.fh*1000).toFixed(0)} mm,
        dopušteno ${(rv.dopustenoFh*1000).toFixed(0)} mm.</p>
      <table class="tabela">
        <thead><tr>
          <th>Stranica</th><th>&Delta;H naprijed</th><th>&Delta;H nazad</th>
          <th>&Delta;H sredina</th><th>Popravka</th><th>&Delta;H popravljeno</th>
        </tr></thead><tbody>`;
    rv.redovi.forEach((row) => {
      tblVisine += `<tr>
        <td>${row.od} → ${row.do}</td>
        <td>${row.dHnaprijed.toFixed(2)}</td>
        <td>${row.dHnazad.toFixed(2)}</td>
        <td>${row.dHsred.toFixed(3)}</td>
        <td>${row.popravka.toFixed(3)}</td>
        <td>${row.dHpopr.toFixed(3)}</td>
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
      i unesite nadmorske visine H za početnu (B) i krajnju (C) stanicu.</div>`;
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

/* ---------- Izvoz u Excel (CSV) ---------- */
document.getElementById("izvozExcel").addEventListener("click", () => {
  if (!zadnjiRezultat) { alert("Prvo izračunajte izravnanje."); return; }
  const r = zadnjiRezultat;
  // pripremi mapu visina po nazivu tačke (ako ima visinskog izravnanja)
  const visineMap = {};
  if (zadnjiRezultatVisine) {
    zadnjiRezultatVisine.tocke.forEach((t) => { visineMap[t.naziv] = t.H; });
  }
  const imaVisine = Object.keys(visineMap).length > 0;

  let csv = imaVisine ? "Tacka;Y (m);X (m);H (m);Tip\n" : "Tacka;Y (m);X (m);Tip\n";
  r.tocke.forEach((t) => {
    if (imaVisine) {
      const H = visineMap[t.naziv] !== undefined ? visineMap[t.naziv].toFixed(3) : "";
      csv += `${t.naziv};${t.Y.toFixed(4)};${t.X.toFixed(4)};${H};${t.tip}\n`;
    } else {
      csv += `${t.naziv};${t.Y.toFixed(4)};${t.X.toFixed(4)};${t.tip}\n`;
    }
  });
  csv += `\nUglovno odstupanje fbeta;${sekMinSek(r.fBetaSek, true)}\n`;
  csv += `Dopusteno uglovno;${sekMinSek(r.dopustenoFbetaSek, false)}\n`;
  csv += `Linearno odstupanje fd (m);${r.fd.toFixed(3)}\n`;
  csv += `Dopusteno linearno (m);${r.dopustenoFd.toFixed(3)}\n`;
  csv += `Ukupna duzina (m);${r.sumaD.toFixed(2)}\n`;
  if (zadnjiRezultatVisine) {
    csv += `Visinsko odstupanje fh (mm);${(zadnjiRezultatVisine.fh*1000).toFixed(0)}\n`;
    csv += `Dopusteno visinsko (mm);${(zadnjiRezultatVisine.dopustenoFh*1000).toFixed(0)}\n`;
  }

  const bom = "\uFEFF"; // da Excel prepozna UTF-8
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  preuzmi(blob, "koordinate_poligonski_vlak.csv");
});

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

function obradiUcitaneStanice(stanice) {
  ucitaneStanice = stanice;   // sačuvaj sirova mjerenja za obrazac TZ
  const { obradjene, greske } = window.Ucitavanje.pripremiIzStanica(stanice);

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

document.getElementById("stampajSve").addEventListener("click", () => {
  if (!zadnjiRezultat) { alert("Prvo izračunajte izravnanje."); return; }
  // svi dostupni obrasci, redom (samo oni koji su napravljeni)
  ispisiObrasce(["tz", "to1i2", "to1v", "to18d", "to8", "o19", "o25"]);
});

// Složi odabrane obrasce, svaki na svoj A4 list, pa pokreni ispis.
function ispisiObrasce(lista) {
  const el = document.getElementById("obrazacSadrzaj");
  const original = el.innerHTML;         // zapamti trenutni prikaz

  // 1) složi sve obrasce
  let html = "";
  lista.forEach((kod) => {
    const sadrzaj = generirajObrazacHTML(kod);
    if (sadrzaj) html += `<div class="obrazac-stranica" data-kod="${kod}">${sadrzaj}</div>`;
  });
  el.innerHTML = html;
  document.body.classList.add("print-obrasci");

  // 2) razbij svaki obrazac na A4 stranice po visini i dodaj "Strana N / M"
  paginirajObrasce(el);

  window.print();
  setTimeout(() => {
    el.innerHTML = original;
    document.body.classList.remove("print-obrasci");
  }, 600);
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
    const visinaNaslov = naslov ? naslov.offsetHeight + 8 : 0;
    const visinaThead = thead ? thead.offsetHeight : 0;
    const raspoloziva = A4_VISINA_PX - visinaNaslov - visinaThead - 30;

    // izmjeri kumulativnu visinu redova i podijeli u grupe (stranice)
    const grupe = [[]];
    let h = 0;
    redovi.forEach((tr) => {
      const vh = tr.offsetHeight || 24;
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
      div.className = "obrazac-stranica";
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
    return obradjeneStanice ? window.Obrasci.obrazac18D(obradjeneStanice) : "";
  }
  if (kod === "to8") {
    return zadnjiRezultat ? window.Obrasci.obrazac8(dateTackeABCD()) : "";
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
      el.innerHTML = window.Obrasci.obrazac18D(obradjeneStanice);
    }
  } else if (trenutniObrazac === "to8") {
    el.innerHTML = window.Obrasci.obrazac8(dateTackeABCD());
  } else {
    // obrasci koji još nisu napravljeni
    const nazivi = { to28p:"TO 28P", tok:"TO K" };
    el.innerHTML = `<div class="info">Obrazac <b>${nazivi[trenutniObrazac] || trenutniObrazac}</b> je u pripremi — dodajemo ga uskoro.</div>`;
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
    C: { naziv: tekst("C_naziv"), Y: broj("C_Y"), X: broj("C_X") },
    D: { naziv: tekst("D_naziv"), Y: broj("D_Y"), X: broj("D_X") },
  };
}

function brojOpc(id) {
  const v = parseFloat(document.getElementById(id).value);
  return isNaN(v) ? null : v;
}
