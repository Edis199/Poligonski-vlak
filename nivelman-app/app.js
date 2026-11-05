/* app.js — povezuje sučelje nivelmanske aplikacije s jezgrom (racun.js) */

let ucitaneDionice = null;   // iz učitanog zapisnika N.O.1
let zadnjiRezultat = null;   // rezultat izravnanja
let trenutniObrazac = "no3";

/* ---------- Navigacija kartica ---------- */
document.querySelectorAll(".kartica").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".kartica").forEach((b) => b.classList.remove("aktivna"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("vidljiv"));
    btn.classList.add("aktivna");
    document.getElementById(btn.dataset.cilj).classList.add("vidljiv");
    if (btn.dataset.cilj === "obrasci") prikaziObrazac();
  });
});
function idiNa(cilj) { document.querySelector(`.kartica[data-cilj="${cilj}"]`).click(); }

/* ---------- Pomoćne ---------- */
function parseDec(s) { return parseFloat(String(s ?? "").trim().replace(/\s/g, "").replace(",", ".")); }
function broj(id) { return parseDec(document.getElementById(id).value); }
function tekst(id) { return document.getElementById(id).value || ""; }
function postavi(id, v) { const e = document.getElementById(id); if (e) e.value = v; }

/* ---------- Preuzmi predložak ---------- */
document.getElementById("preuzmiPredlozak").addEventListener("click", () => {
  try {
    const bytes = window.XlsxGen.predlozakZapisnikXlsx();
    const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    preuzmi(blob, "nivelmanski_zapisnik_NO1.xlsx");
  } catch (e) {
    alert("Greška pri izradi predloška: " + e.message);
  }
});

/* ---------- Učitavanje zapisnika ---------- */
document.getElementById("datoteka").addEventListener("change", async (ev) => {
  const f = ev.target.files[0];
  if (!f) return;
  const status = document.getElementById("statusUcitavanja");
  status.textContent = "Učitavam…";
  status.className = "napomena";
  try {
    let dionice;
    if (/\.xlsx$/i.test(f.name)) {
      const buf = await f.arrayBuffer();
      dionice = await window.UcitavanjeNiv.ucitajXlsxDionice(buf);
    } else {
      const txt = await f.text();
      dionice = window.UcitavanjeNiv.ucitajCSV(txt);
    }
    ucitaneDionice = dionice;
    status.textContent = "✓ Učitano: " + dionice.length + " dionica.";
    status.className = "napomena uspjeh";
    prikaziSazetakUcitavanja(dionice);
    predloziRepere(dionice);
  } catch (e) {
    ucitaneDionice = null;
    status.textContent = "✗ " + e.message;
    status.className = "napomena neuspjeh";
    document.getElementById("sazetakUcitavanja").innerHTML = "";
  } finally {
    ev.target.value = "";
  }
});

function prikaziSazetakUcitavanja(dionice) {
  let h = `<div class="dionice-info"><b>Učitane dionice (${dionice.length}):</b><br>`;
  dionice.forEach((d, i) => {
    const n = d.naprijed.length, z = d.nazad.length;
    h += `${i + 1}. <b>${d.od} → ${d.do}</b> — naprijed: ${n} stanica${z ? `, nazad: ${z} stanica` : " (bez mjerenja nazad)"}<br>`;
  });
  h += `</div>`;
  document.getElementById("sazetakUcitavanja").innerHTML = h;
}

/* Prvi i zadnji reper iz dionica → ponudi kao naziv početnog i završnog repera */
function predloziRepere(dionice) {
  const poc = dionice[0]?.od;
  const kraj = dionice[dionice.length - 1]?.do;
  if (poc && !tekst("poc_naziv")) postavi("poc_naziv", poc);
  if (poc) {
    // ako je polje još na tvorničkoj vrijednosti, zamijeni nazivom iz zapisnika
    if (["R100", ""].includes(tekst("poc_naziv"))) postavi("poc_naziv", poc);
  }
  if (kraj && ["R50", ""].includes(tekst("kraj_naziv"))) postavi("kraj_naziv", kraj);
  document.getElementById("napomenaReperi").textContent =
    `Iz zapisnika: početni reper = ${poc}, završni reper = ${kraj}. Upišite njihove date nadmorske visine.`;
}

/* ---------- Izračun ---------- */
document.getElementById("izracunaj").addEventListener("click", () => {
  if (!ucitaneDionice || !ucitaneDionice.length) {
    alert("Prvo učitajte nivelmanski zapisnik (N.O.1).");
    return;
  }
  const Hpoc = broj("poc_H");
  const Hkraj = broj("kraj_H");
  if (isNaN(Hpoc)) { alert("Unesite nadmorsku visinu H početnog repera."); return; }
  if (isNaN(Hkraj)) {
    if (!confirm("Nije unesena visina završnog repera. Za umetnuti vlak ona je obavezna (daje zatvaranje). Nastaviti bez zatvaranja?")) return;
  }

  const ulaz = {
    dionice: ucitaneDionice,
    Hpoc,
    Hkraj: isNaN(Hkraj) ? null : Hkraj,
    nazivPoc: tekst("poc_naziv") || ucitaneDionice[0].od,
    nazivKraj: tekst("kraj_naziv") || ucitaneDionice[ucitaneDionice.length - 1].do,
  };

  try {
    zadnjiRezultat = window.RacunNiv.izravnajNivelmanskiVlak(ulaz);
    prikaziRezultate(zadnjiRezultat);
    idiNa("rezultati");
  } catch (e) {
    alert("Greška u izračunu: " + e.message);
    console.error(e);
  }
});

/* ---------- Prikaz rezultata ---------- */
function prikaziRezultate(r) {
  const okKlasa = r.visinskiOK ? "ok" : "ne";
  let saz = `<h2>Sažetak izravnanja nivelmanskog vlaka</h2>
    <div class="sazetak-kartice">
      <div class="sk"><div class="oznaka">Broj dionica</div><div class="vrijednost">${r.brojDionica}</div></div>
      <div class="sk"><div class="oznaka">Ukupna dužina Σ S</div><div class="vrijednost">${r.sumaS.toFixed(3)} km</div></div>
      <div class="sk"><div class="oznaka">Σ visinskih razlika</div><div class="vrijednost">${r.sumaDh.toFixed(4)} m</div></div>`;
  if (r.imaKraj) {
    saz += `<div class="sk ${okKlasa}">
        <div class="oznaka">Zatvaranje f<sub>h</sub></div>
        <div class="vrijednost">${(r.fh * 1000).toFixed(1)} mm</div>
        <div class="napomena">dopušteno ±${(r.dopFh * 1000).toFixed(1)} mm</div>
      </div>`;
  }
  saz += `</div>`;
  document.getElementById("sazetak").innerHTML = saz;

  // status
  let statusHtml = "";
  if (r.imaKraj) {
    statusHtml = `<p>Visinsko izravnanje:
      <span class="oznaka-status ${r.visinskiOK ? 'status-ok' : 'status-ne'}">
        ${r.visinskiOK ? "U DOZVOLJENIM GRANICAMA" : "PREKORAČENO"}</span></p>`;
  }
  // provjera odstupanja po dionicama
  const prekorac = r.redoviNO2.filter((d) => !d.odstOK);
  if (prekorac.length) {
    statusHtml += `<div class="greska">⚠ Odstupanje naprijed/nazad prekoračeno na dionicama: ${
      prekorac.map((d) => d.od + "→" + d.do).join(", ")}</div>`;
  }

  // sve tri tablice obrazaca prikazujemo i u rezultatima
  const O = window.ObrasciNiv;
  document.getElementById("rezultatiSadrzaj").innerHTML =
    statusHtml +
    O.obrazacNO2(r) +
    O.obrazacNO3(r) +
    O.obrazacSpisak(r);
}

/* ---------- Obrasci ---------- */
document.querySelectorAll(".obrazac-izbor .dugme").forEach((b) => {
  b.addEventListener("click", () => { trenutniObrazac = b.dataset.obrazac; prikaziObrazac(); });
});
function prikaziObrazac() {
  const cilj = document.getElementById("obrazacSadrzaj");
  if (!zadnjiRezultat) { cilj.innerHTML = `<p class="napomena">Prvo izračunajte izravnanje (kartica 1).</p>`; return; }
  document.querySelectorAll(".obrazac-izbor .dugme").forEach((b) =>
    b.classList.toggle("odabran", b.dataset.obrazac === trenutniObrazac));
  const o = window.ObrasciNiv.OBRASCI_NIV[trenutniObrazac];
  cilj.innerHTML = o ? o.fn(zadnjiRezultat) : "";
}

document.getElementById("stampajObrazac").addEventListener("click", () => {
  if (!zadnjiRezultat) { alert("Prvo izračunajte izravnanje."); return; }
  ispisiObrasce([trenutniObrazac]);
});
document.getElementById("stampajSve").addEventListener("click", () => {
  if (!zadnjiRezultat) { alert("Prvo izračunajte izravnanje."); return; }
  ispisiObrasce(["no1", "no2", "no3", "spisak"]);
});

/* HTML jednog obrasca po kodu (bez promjene prikaza). */
function generirajObrazacHTML(kod) {
  const O = window.ObrasciNiv, r = zadnjiRezultat;
  if (!r) return "";
  if (kod === "no1") return O.obrazacNO1(r);
  if (kod === "no2") return O.obrazacNO2(r);
  if (kod === "no3") return O.obrazacNO3(r);
  if (kod === "spisak") return O.obrazacSpisak(r);
  return "";
}

/* ---------- Ispis / PDF ----------
   Složi odabrane obrasce (svaki na svoj A4), razbij duge obrasce na više A4
   stranica uz ponovljeni naslov + zaglavlje i oznaku „Strana N / M", pa štampaj. */
function ispisiObrasce(kodovi) {
  const el = document.getElementById("obrazacSadrzaj");
  const original = el.innerHTML;

  // prvo pređi na karticu (prelazak prepisuje sadržaj), pa onda ubaci obrasce
  idiNa("obrasci");

  let html = "";
  kodovi.forEach((kod) => {
    const sadrzaj = generirajObrazacHTML(kod);
    if (sadrzaj) html += `<div class="obrazac-stranica" data-kod="${kod}">${sadrzaj}</div>`;
  });
  el.innerHTML = html;
  document.body.classList.add("print-obrasci");

  // razbij svaki obrazac na A4 stranice po visini i dodaj „Strana N / M"
  paginirajObrasce(el);

  let zavrseno = false;
  const zavrsi = () => {
    if (zavrseno) return;
    zavrseno = true;
    window.removeEventListener("afterprint", zavrsi);
    el.innerHTML = original;
    document.body.classList.remove("print-obrasci");
  };
  window.addEventListener("afterprint", zavrsi);

  setTimeout(() => {
    const t0 = performance.now();
    window.print();
    if (performance.now() - t0 > 300) setTimeout(zavrsi, 400);
    else setTimeout(zavrsi, 800);
  }, 150);
}

/* Razbija svaki obrazac (tablicu) na više A4 stranica po visini,
   te na svaku fizičku stranicu stavlja naslov + zaglavlje i „Strana N / M". */
function paginirajObrasce(kontejner) {
  const A4_VISINA_PX = Math.round(((297 - 20) / 25.4) * 96) - 70; // ≈ 977px korisne visine
  const obrasci = [...kontejner.querySelectorAll(".obrazac-stranica")];

  obrasci.forEach((obr) => {
    const tabela = obr.querySelector("table.obrazac");
    if (!tabela) return;
    const naslov = obr.querySelector(".obrazac-naslov-linija");
    const thead = tabela.querySelector("thead");
    const tbody = tabela.querySelector("tbody");
    if (!tbody) return;

    const redovi = [...tbody.children];
    const visinaNaslov = naslov ? naslov.offsetHeight + 8 : 0;
    const visinaThead = thead ? thead.offsetHeight : 0;
    const raspoloziva = A4_VISINA_PX - visinaNaslov - visinaThead - 30;

    // Grupiši redove u stranice. VAŽNO: stanica N.O.1 = 3 reda (I, II, Z−P) — ne lomi
    // ih; grupiši po „blokovima" koji počinju redom .niv-red-i (ili bilo kojim redom
    // koji nije nastavak). Za ostale obrasce svaki red je svoj blok.
    const blokovi = [];
    redovi.forEach((tr) => {
      const nastavak = tr.classList.contains("niv-red-ii") || tr.classList.contains("niv-red-raz");
      if (nastavak && blokovi.length) blokovi[blokovi.length - 1].push(tr);
      else blokovi.push([tr]);
    });

    const grupe = [[]];
    let h = 0;
    blokovi.forEach((blok) => {
      const vh = blok.reduce((a, tr) => a + (tr.offsetHeight || 24), 0);
      if (h + vh > raspoloziva && grupe[grupe.length - 1].length > 0) {
        grupe.push([]);
        h = 0;
      }
      blok.forEach((tr) => grupe[grupe.length - 1].push(tr));
      h += vh;
    });

    const ukupno = grupe.length;
    if (ukupno <= 1) { dodajOznakuStrane(obr, 1, 1); return; }

    const naslovHTML = naslov ? naslov.outerHTML : "";
    const theadHTML = thead ? thead.outerHTML : "";
    const tabelaKlase = tabela.className;
    const roditelj = obr.parentNode;
    const refNext = obr.nextSibling;

    grupe.forEach((grupa, gi) => {
      const div = document.createElement("div");
      div.className = obr.className;
      const telo = grupa.map((tr) => tr.outerHTML).join("");
      div.innerHTML = naslovHTML +
        `<table class="${tabelaKlase}">${theadHTML}<tbody>${telo}</tbody></table>`;
      dodajOznakuStrane(div, gi + 1, ukupno);
      roditelj.insertBefore(div, refNext);
    });
    obr.remove();
  });

  // prijelom strane između svih fizičkih stranica, osim poslije zadnje
  const sve = [...kontejner.querySelectorAll(".obrazac-stranica")];
  sve.forEach((s) => { s.style.pageBreakAfter = "always"; });
  if (sve.length) sve[sve.length - 1].style.pageBreakAfter = "auto";
}

function dodajOznakuStrane(obr, broj, ukupno) {
  const oznaka = document.createElement("div");
  oznaka.className = "oznaka-strane";
  oznaka.textContent = `Strana ${broj} / ${ukupno}`;
  obr.insertBefore(oznaka, obr.firstChild);
}

document.getElementById("izvozPdf").addEventListener("click", () => {
  if (!zadnjiRezultat) { alert("Prvo izračunajte izravnanje."); return; }
  // Ispis/PDF koristi istu paginaciju kao „Ispiši sve obrasce": svaki obrazac na
  // svoj A4, uredni prijelomi stranica i oznaka „Strana N / M".
  ispisiObrasce(["no1", "no2", "no3", "spisak"]);
});

/* ---------- Izvoz nadmorskih visina (TXT) ---------- */
document.getElementById("izvozVisineTxt").addEventListener("click", () => {
  if (!zadnjiRezultat) { alert("Prvo izračunajte izravnanje."); return; }
  const linije = zadnjiRezultat.visine.map((t) => `${t.naziv},${t.H.toFixed(3)}`);
  const blob = new Blob([linije.join("\n")], { type: "text/plain" });
  preuzmi(blob, "nadmorske_visine.txt");
});

/* ---------- Preuzimanje datoteke ---------- */
function preuzmi(blob, ime) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = ime;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
