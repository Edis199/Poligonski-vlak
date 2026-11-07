/* poslovi.js — poslovi (projekti) za poligonsku aplikaciju
   ---------------------------------------------------------------------
   Posao = imenovani snimak svega što korisnik unese (zapisnik, date tačke,
   ispravljeni uglovi i dužine, izbor girusa, vrsta vlaka, redukcija).
   Rezultat izravnanja se NE čuva — računa se ponovo pri otvaranju, pa stari
   poslovi uvijek idu kroz najnoviju formulu.

   Čuvanje: localStorage (ovaj preglednik, ovaj uređaj) + izvoz/uvoz .json.
   Aktivan posao pamti se samo za tekuću sesiju (sessionStorage): pri novom
   ulasku u aplikaciju prikazuje se izbor posla, zadnji se ne otvara sam.
   ===================================================================== */
(function () {
  const PREFIKS = "poligon.posao.";
  const AKTIVAN = "poligon.aktivniPosao";
  const FORMAT = "geodetske-mreze-posao";

  let aktivanId = null;
  try { aktivanId = sessionStorage.getItem(AKTIVAN); } catch (e) { /* privatni način */ }
  let ucitavam = false;          // true dok se posao vraća — tada se ništa ne snima
  let zadnjiSnimak = "";
  let urediId = null;            // posao čiji se podaci trenutno uređuju u obrascu

  /* ---------- pomoćne ---------- */
  const novaId = () => "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const replacer = (k, v) => (typeof v === "number" && isNaN(v) ? "__NaN__" : v);
  const reviver = (k, v) => (v === "__NaN__" ? NaN : v);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const dvije = (n) => String(n).padStart(2, "0");
  function datumBs(iso) {            // 2026-03-12 -> 12.03.2026
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
  }
  function vrijemeBs(ms) {
    const d = new Date(ms);
    return `${dvije(d.getDate())}.${dvije(d.getMonth() + 1)}.${d.getFullYear()} ${dvije(d.getHours())}:${dvije(d.getMinutes())}`;
  }
  const el = (id) => document.getElementById(id);

  /* ---------- pohrana ---------- */
  function citaj(id) {
    try { return JSON.parse(localStorage.getItem(PREFIKS + id), reviver); } catch (e) { return null; }
  }
  function upisi(posao) {
    try {
      localStorage.setItem(PREFIKS + posao.id, JSON.stringify(posao, replacer));
      return true;
    } catch (e) {
      alert("Posao nije moguće sačuvati u pregledniku (memorija je puna ili je čuvanje blokirano).\n" +
            "Izvezite posao u .json datoteku (Poslovi → Izvezi) da ne izgubite podatke.");
      return false;
    }
  }
  function sviPoslovi() {
    const lista = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIKS)) {
          const p = citaj(k.slice(PREFIKS.length));
          if (p && p.id) lista.push(p);
        }
      }
    } catch (e) { /* ignoriši */ }
    return lista.sort((a, b) => (b.izmijenjen || 0) - (a.izmijenjen || 0));
  }

  /* ---------- snimak i vraćanje stanja aplikacije ---------- */
  function snimiStanje() {
    const val = (id) => { const e = el(id); return e ? e.value : ""; };
    const date = {};
    ["A", "B", "C", "D"].forEach((k) => {
      date[k] = {};
      ["naziv", "Y", "X", "H"].forEach((f) => { date[k][f] = val(k + "_" + f); });
    });
    const vrijednosti = (sel) => [...document.querySelectorAll(sel)].map((e) => e.value);
    return {
      stanice: ucitaneStanice,
      izborGirusa: izborGirusa,
      uglovi: vrijednosti(".in-ugao"),
      duzine: vrijednosti(".in-duzina"),
      nazivi: vrijednosti(".in-naziv"),
      date,
      vrsta: val("vrstaVlaka"),
      redukcijaNacin: val("redukcijaNacin"),
      redukcijaFaktor: val("redukcijaFaktor"),
      redukcijaM0: val("redukcijaM0"),
      izracunato: !!(zadnjiRezultat || zadnjiDetalji),
    };
  }

  function vratiStanje(p) {
    if (!p) return;
    const postavi = (id, v) => { const e = el(id); if (e && v !== undefined && v !== null) e.value = v; };
    const popuni = (sel, niz) => {
      const polja = document.querySelectorAll(sel);
      (niz || []).forEach((v, i) => { if (polja[i]) polja[i].value = v; });
    };

    if (p.stanice && p.stanice.length) {
      izborGirusa = (p.izborGirusa && p.izborGirusa.length === p.stanice.length)
        ? p.izborGirusa
        : p.stanice.map((s) => Array(Math.floor(s.mjerenja.length / 4)).fill(true));
      obradiUcitaneStanice(p.stanice, true);   // ponovo napravi tabelu i panel girusa
    } else if (p.uglovi && p.uglovi.length) {
      document.getElementById("brojUglova").value = p.uglovi.length;
      generirajTabelu(p.uglovi.length);
    }

    if (p.vrsta) postaviVrstu(p.vrsta);

    ["A", "B", "C", "D"].forEach((k) => {
      if (!p.date || !p.date[k]) return;
      ["naziv", "Y", "X", "H"].forEach((f) => postavi(k + "_" + f, p.date[k][f]));
    });
    if (typeof sinkronizirajZatvoreni === "function") sinkronizirajZatvoreni();

    // ručno ispravljene vrijednosti (preko onih koje je izračunala girusna obrada)
    popuni(".in-ugao", p.uglovi);
    popuni(".in-duzina", p.duzine);
    popuni(".in-naziv", p.nazivi);

    postavi("redukcijaNacin", p.redukcijaNacin);
    postavi("redukcijaFaktor", p.redukcijaFaktor);
    postavi("redukcijaM0", p.redukcijaM0);
    if (typeof osvjeziPoljaRedukcije === "function") osvjeziPoljaRedukcije();
  }

  /* ---------- automatsko čuvanje ---------- */
  function sacuvaj() {
    if (!aktivanId || ucitavam) return;
    const posao = citaj(aktivanId);
    if (!posao) return;
    const podaci = snimiStanje();
    const s = JSON.stringify(podaci, replacer);
    if (s === zadnjiSnimak) return;               // ništa se nije promijenilo
    posao.podaci = podaci;
    posao.izmijenjen = Date.now();
    if (upisi(posao)) { zadnjiSnimak = s; osvjeziOznaku(); }
  }
  let odgoda = null;
  const planiraj = () => { clearTimeout(odgoda); odgoda = setTimeout(sacuvaj, 600); };

  function osvjeziOznaku() {
    const o = el("posaoOznaka");
    if (!o) return;
    const posao = aktivanId ? citaj(aktivanId) : null;
    o.innerHTML = posao
      ? `<b>${esc(posao.naziv)}</b><small>sačuvano ${vrijemeBs(posao.izmijenjen)}</small>`
      : `<small>Rad bez posla — podaci se ne čuvaju</small>`;
  }

  /* ---------- akcije nad poslovima ---------- */
  function aktiviraj(id) {
    try { sessionStorage.setItem(AKTIVAN, id); } catch (e) { /* ignoriši */ }
  }
  function otvori(id) {
    sacuvaj();
    aktiviraj(id);
    location.reload();          // čisto stanje, pa se posao vraća pri pokretanju
  }

  function kreirajIliSacuvajIzmjene() {
    const naziv = el("posNaziv").value.trim();
    if (!naziv) { alert("Upišite naziv posla."); el("posNaziv").focus(); return; }
    const datum = el("posDatum").value;
    const izvodjac = el("posIzvodjac").value.trim();

    if (urediId) {                                  // samo izmjena podataka posla
      const p = citaj(urediId);
      if (p) { p.naziv = naziv; p.datumMjerenja = datum; p.izvodjac = izvodjac; p.izmijenjen = Date.now(); upisi(p); }
      otkaziUredjivanje();
      osvjeziOznaku(); iscrtajListu();
      return;
    }

    const sad = Date.now();
    const posao = { id: novaId(), naziv, datumMjerenja: datum, izvodjac, kreiran: sad, izmijenjen: sad, podaci: null };

    if (!aktivanId) {
      // radilo se bez posla: ponudi da se trenutni rad preuzme u novi posao
      const imaRada = !!ucitaneStanice;
      const preuzmi = !imaRada || confirm(
        `Trenutno radite bez posla.\n\nOK = sačuvaj trenutne podatke u posao „${naziv}"\nOtkaži = napravi prazan posao`);
      if (preuzmi) {
        posao.podaci = snimiStanje();
        if (!upisi(posao)) return;
        aktivanId = posao.id; aktiviraj(posao.id);
        zadnjiSnimak = JSON.stringify(posao.podaci, replacer);
        osvjeziOznaku(); zatvoriModal();
        return;
      }
    }
    if (!upisi(posao)) return;
    otvori(posao.id);
  }

  function otkaziUredjivanje() {
    urediId = null;
    el("posNaziv").value = ""; el("posDatum").value = ""; el("posIzvodjac").value = "";
    el("posForma").classList.remove("uredjivanje");
    el("posNaslovForme").textContent = "Novi posao";
    el("posSnimi").textContent = "Kreiraj posao";
  }
  function uredi(id) {
    const p = citaj(id); if (!p) return;
    urediId = id;
    el("posNaziv").value = p.naziv || "";
    el("posDatum").value = p.datumMjerenja || "";
    el("posIzvodjac").value = p.izvodjac || "";
    el("posForma").classList.add("uredjivanje");
    el("posNaslovForme").textContent = "Uredi podatke posla";
    el("posSnimi").textContent = "Sačuvaj izmjene";
    el("posNaziv").focus();
  }
  function dupliraj(id) {
    if (id === aktivanId) sacuvaj();
    const p = citaj(id); if (!p) return;
    const sad = Date.now();
    const kopija = JSON.parse(JSON.stringify(p, replacer), reviver);
    kopija.id = novaId(); kopija.naziv = (p.naziv || "Posao") + " (kopija)";
    kopija.kreiran = sad; kopija.izmijenjen = sad;
    if (upisi(kopija)) iscrtajListu();
  }
  function obrisi(id) {
    const p = citaj(id); if (!p) return;
    if (!confirm(`Obrisati posao „${p.naziv}"?\n\nOvo se ne može poništiti. Ako vam treba kopija, prvo ga izvezite (.json).`)) return;
    try { localStorage.removeItem(PREFIKS + id); } catch (e) { /* ignoriši */ }
    if (id === aktivanId) {
      try { sessionStorage.removeItem(AKTIVAN); } catch (e) { /* ignoriši */ }
      location.reload();
      return;
    }
    iscrtajListu();
  }
  function izvezi(id) {
    if (id === aktivanId) sacuvaj();
    const p = citaj(id); if (!p) return;
    const slug = (p.naziv || "posao").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "posao";
    const sadrzaj = JSON.stringify({ format: FORMAT, aplikacija: "poligon", verzija: 1, posao: p }, replacer, 1);
    preuzmi(new Blob([sadrzaj], { type: "application/json;charset=utf-8" }), `posao_${slug}.json`);
  }
  function uvezi(datoteka) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const o = JSON.parse(r.result, reviver);
        if (!o || o.format !== FORMAT || !o.posao) throw new Error("Datoteka nije posao ove aplikacije.");
        if (o.aplikacija !== "poligon") throw new Error("Ovo je posao druge aplikacije, ne poligonske mreže.");
        const p = o.posao;
        const sad = Date.now();
        p.id = novaId();                       // nikad ne prepisuj postojeći posao
        p.naziv = p.naziv || "Uvezeni posao";
        p.kreiran = p.kreiran || sad; p.izmijenjen = sad;
        if (upisi(p)) iscrtajListu();
      } catch (e) {
        alert("Uvoz nije uspio: " + e.message);
      }
    };
    r.readAsText(datoteka);
  }

  /* ---------- prozor „Poslovi" ---------- */
  function napraviModal() {
    const m = document.createElement("div");
    m.id = "posloviModal";
    m.className = "posao-modal";
    m.style.display = "none";
    m.innerHTML = `
      <div class="posao-kutija" role="dialog" aria-modal="true" aria-label="Poslovi">
        <div class="posao-naslov">
          <h2>Poslovi</h2>
          <button class="posao-x" id="posZatvori" aria-label="Zatvori">×</button>
        </div>
        <p class="napomena posao-uvod">Posao čuva sve što unesete (zapisnik, date tačke, ispravke) i snima se sam.
          Poslovi su u ovom pregledniku na ovom uređaju — za sigurnosnu kopiju ili prenos koristite <b>Izvezi</b>.</p>

        <div class="posao-forma" id="posForma">
          <h3 id="posNaslovForme">Novi posao</h3>
          <label>Naziv posla *
            <input id="posNaziv" type="text" maxlength="120" placeholder="npr. Vlak Konjic 2026" />
          </label>
          <div class="posao-red">
            <label>Datum mjerenja <span class="opc">(opciono)</span>
              <input id="posDatum" type="date" />
            </label>
            <label>Izvođač <span class="opc">(opciono)</span>
              <input id="posIzvodjac" type="text" maxlength="120" placeholder="ime / firma" />
            </label>
          </div>
          <div class="akcije">
            <button class="dugme primarno" id="posSnimi">Kreiraj posao</button>
            <button class="dugme" id="posOtkazi">Otkaži uređivanje</button>
          </div>
        </div>

        <div class="posao-lista-naslov">
          <h3>Sačuvani poslovi</h3>
          <label class="dugme dugme-ikona posao-uvoz">Uvezi posao (.json)
            <input id="posUvoz" type="file" accept=".json,application/json" />
          </label>
        </div>
        <div id="posLista"></div>

        <div class="akcije posao-podnozje">
          <button class="dugme" id="posNastavi"></button>
        </div>
      </div>`;
    document.body.appendChild(m);

    el("posZatvori").addEventListener("click", zatvoriModal);
    el("posNastavi").addEventListener("click", zatvoriModal);
    el("posSnimi").addEventListener("click", kreirajIliSacuvajIzmjene);
    el("posOtkazi").addEventListener("click", otkaziUredjivanje);
    el("posNaziv").addEventListener("keydown", (e) => { if (e.key === "Enter") kreirajIliSacuvajIzmjene(); });
    el("posUvoz").addEventListener("change", (e) => {
      if (e.target.files[0]) uvezi(e.target.files[0]);
      e.target.value = "";
    });
    m.addEventListener("click", (e) => { if (e.target === m) zatvoriModal(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") zatvoriModal(); });

    // dugmad u listi (delegiranje)
    el("posLista").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-akcija]");
      if (!b) return;
      const id = b.dataset.id;
      ({ otvori, uredi, dupliraj, izvezi, obrisi }[b.dataset.akcija])(id);
    });
  }

  function iscrtajListu() {
    const lista = sviPoslovi();
    const okvir = el("posLista");
    if (!lista.length) {
      okvir.innerHTML = `<p class="napomena">Još nema sačuvanih poslova. Kreirajte prvi gore.</p>`;
    } else {
      okvir.innerHTML = lista.map((p) => {
        const dijelovi = [];
        if (p.datumMjerenja) dijelovi.push(`Mjerenje: ${datumBs(p.datumMjerenja)}`);
        if (p.izvodjac) dijelovi.push(`Izvođač: ${esc(p.izvodjac)}`);
        dijelovi.push(`Izmijenjeno: ${vrijemeBs(p.izmijenjen)}`);
        const jeAktivan = p.id === aktivanId;
        return `
        <div class="posao-stavka ${jeAktivan ? "otvoren" : ""}">
          <div class="posao-info">
            <div class="posao-ime">${esc(p.naziv)} ${jeAktivan ? '<span class="posao-znak">otvoren</span>' : ""}</div>
            <div class="posao-meta">${dijelovi.join(" · ")}</div>
          </div>
          <div class="posao-dugmad">
            ${jeAktivan ? "" : `<button class="dugme primarno" data-akcija="otvori" data-id="${p.id}">Otvori</button>`}
            <button class="dugme" data-akcija="uredi" data-id="${p.id}">Uredi</button>
            <button class="dugme" data-akcija="dupliraj" data-id="${p.id}">Dupliraj</button>
            <button class="dugme" data-akcija="izvezi" data-id="${p.id}">Izvezi</button>
            <button class="dugme opasno" data-akcija="obrisi" data-id="${p.id}">Obriši</button>
          </div>
        </div>`;
      }).join("");
    }
    el("posNastavi").textContent = aktivanId ? "Zatvori" : "Nastavi bez posla";
  }

  function otvoriModal() {
    otkaziUredjivanje();
    iscrtajListu();
    el("posloviModal").style.display = "flex";
    el("posNaziv").focus();
  }
  function zatvoriModal() {
    const m = el("posloviModal");
    if (m) m.style.display = "none";
  }

  /* ---------- pokretanje ---------- */
  function pokreni() {
    napraviModal();
    el("posloviDugme").addEventListener("click", otvoriModal);

    // zapamti rad i pri izlasku iz aplikacije
    document.addEventListener("input", planiraj);
    document.addEventListener("change", planiraj);
    window.addEventListener("pagehide", sacuvaj);
    document.addEventListener("visibilitychange", () => { if (document.hidden) sacuvaj(); });
    setInterval(sacuvaj, 3000);

    // nakon učitavanja zapisnika i izračuna snimi odmah
    ["obradiUcitaneStanice", "nastaviIzracun"].forEach((ime) => {
      const orig = window[ime];
      if (typeof orig !== "function") return;
      window[ime] = function () { const r = orig.apply(this, arguments); planiraj(); return r; };
    });

    // vrati aktivni posao ove sesije (npr. nakon „Otvori" ili osvježavanja stranice)
    const posao = aktivanId ? citaj(aktivanId) : null;
    if (aktivanId && !posao) { aktivanId = null; try { sessionStorage.removeItem(AKTIVAN); } catch (e) { /* ignoriši */ } }
    if (posao && posao.podaci) {
      ucitavam = true;
      try {
        vratiStanje(posao.podaci);
        if (typeof postaviStatus === "function") postaviStatus(`Otvoren posao „${posao.naziv}".`, true);
      } catch (e) {
        console.error("Povrat posla nije uspio:", e);
        alert("Posao je otvoren, ali dio podataka nije mogao biti vraćen: " + e.message);
      }
      ucitavam = false;
      zadnjiSnimak = JSON.stringify(snimiStanje(), replacer);
      if (posao.podaci.izracunato) {
        try { el("izracunaj").click(); } catch (e) { console.warn("Automatski izračun preskočen:", e); }
      }
    }
    osvjeziOznaku();

    // pri ulasku bez otvorenog posla: ponudi izbor / kreiranje
    if (!posao) otvoriModal();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", pokreni);
  else pokreni();
})();
