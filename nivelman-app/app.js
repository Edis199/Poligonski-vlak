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
  prikaziObrazac();
  ispisi(document.getElementById("obrazacSadrzaj").innerHTML);
});
document.getElementById("stampajSve").addEventListener("click", () => {
  if (!zadnjiRezultat) { alert("Prvo izračunajte izravnanje."); return; }
  const O = window.ObrasciNiv;
  const r = zadnjiRezultat;
  const stranice = [O.obrazacNO1(r), O.obrazacNO2(r), O.obrazacNO3(r), O.obrazacSpisak(r)]
    .map((h) => `<div class="obrazac-stranica">${h}</div>`).join("");
  ispisi(stranice, true);
});

/* ---------- Ispis / PDF ----------
   VAŽNO: prvo pređi na karticu „obrasci" (to pozove prikaziObrazac koji prepisuje
   #obrazacSadrzaj), pa TEK ONDA ubaci HTML za ispis — inače prelazak prepiše naš
   sadržaj i ostane samo jedan obrazac. */
function ispisi(html, sve) {
  idiNa("obrasci");
  const cilj = document.getElementById("obrazacSadrzaj");
  const staro = cilj.innerHTML;
  cilj.innerHTML = html;
  document.body.classList.add("print-obrasci");
  setTimeout(() => {
    window.print();
    setTimeout(() => {
      document.body.classList.remove("print-obrasci");
      if (sve) cilj.innerHTML = staro;
    }, 500);
  }, 300);
}

document.getElementById("izvozPdf").addEventListener("click", () => {
  if (!zadnjiRezultat) { alert("Prvo izračunajte izravnanje."); return; }
  idiNa("rezultati");
  document.body.classList.add("print-rezultati");
  setTimeout(() => {
    window.print();
    setTimeout(() => document.body.classList.remove("print-rezultati"), 500);
  }, 300);
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
