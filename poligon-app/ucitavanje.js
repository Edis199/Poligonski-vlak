/* =====================================================================
   ucitavanje.js — Učitavanje tahimetrijskog zapisnika iz CSV datoteke
   i pretvaranje u mjerenja po stanicama (za girusnu obradu).

   Očekivani stupci (zaglavlje u prvom redu), razdjelnik ; ili ,:
   Stanica ; VisinaInstrumenta ; Vizura ; Kod ; HorizontalniUgao ;
   ZenitniUgao ; KosaDuzina ; VisinaSignala

   - "Stanica" i "VisinaInstrumenta" se upisuju samo u prvom redu
     svake stanice; prazne ćelije znače "ista stanica kao gore".
   ===================================================================== */

function ucitajCSV(tekst) {
  // razdjelnik: ako ima više ; nego , koristi ;
  const prviRed = tekst.split(/\r?\n/)[0] || "";
  const sep = (prviRed.split(";").length >= prviRed.split(",").length) ? ";" : ",";

  const redovi = tekst.split(/\r?\n/).map((r) => r.trim()).filter((r) => r !== "");
  if (redovi.length < 2) throw new Error("Datoteka je prazna ili nema podataka.");

  // zaglavlje -> mapa naziva na indeks
  const zagl = redovi[0].split(sep).map((x) => normZaglavlje(x));
  const idx = {};
  zagl.forEach((naziv, i) => { idx[naziv] = i; });

  function uzmi(celije, kljucevi) {
    for (const k of kljucevi) {
      if (idx[k] !== undefined) return (celije[idx[k]] || "").trim();
    }
    return "";
  }

  const stanice = [];       // niz { stanica, visinaInstr, mjerenja:[...] }
  let trenutna = null;
  let zadnjaStanica = "";
  let zadnjaVisina = "";

  for (let i = 1; i < redovi.length; i++) {
    const c = redovi[i].split(sep);
    let stan = uzmi(c, ["stanica"]);
    let vis = uzmi(c, ["visinainstrumenta", "visinainstr", "visinainstrumenta(m)", "vi"]);
    const vizura = uzmi(c, ["vizura", "vuzura", "vizurnatacka"]);
    const horiz = uzmi(c, ["horizontalniugao", "horizontalni", "hz", "ha"]);
    const zenit = uzmi(c, ["zenitniugao", "zenitni", "vz", "z"]);
    const kosa = uzmi(c, ["kosaduzina", "kosa", "duzina", "sd"]);
    const visSig = uzmi(c, ["visinasignala", "vissignala", "vs"]);

    // ako nema stanice u retku -> nasljeđuje prethodnu
    if (stan === "") stan = zadnjaStanica; else zadnjaStanica = stan;
    if (vis === "") vis = zadnjaVisina; else zadnjaVisina = vis;

    // ako nema vizure, preskoči (prazan red)
    if (vizura === "" && horiz === "") continue;

    if (!trenutna || trenutna.stanica !== stan) {
      trenutna = { stanica: stan, visinaInstr: vis, mjerenja: [] };
      stanice.push(trenutna);
    }
    trenutna.mjerenja.push({
      vizura, horiz, zenit, kosa: parseFloat((kosa || "0").replace(",", ".")),
      visinaSignala: parseFloat((visSig || "0").replace(",", "."))
    });
  }

  if (!stanice.length) throw new Error("Nije pronađeno nijedno mjerenje. Provjerite zaglavlje stupaca.");
  return stanice;
}

function normZaglavlje(s) {
  return s.toLowerCase()
    .replace(/š/g, "s").replace(/ž/g, "z").replace(/č/g, "c").replace(/ć/g, "c").replace(/đ/g, "d")
    .replace(/[^a-z0-9]/g, "");
}

/* Iz učitanih stanica izračunaj prelomne uglove i dužine (girusna obrada)
   te složi ulaz za izravnanje umetnutog vlaka.
   Potrebne su i date tačke (A,B,C,D) koje korisnik unese u aplikaciji.    */
function pripremiIzStanica(stanice) {
  const G = (typeof window !== "undefined") ? window.Girus : require("./girus.js");
  const obradjene = [];
  const greske = [];
  for (const s of stanice) {
    const r = G.obradiStanicu(s.stanica, s.visinaInstr, s.mjerenja);
    if (r.greska) greske.push(r.greska);
    obradjene.push(r);
  }
  return { obradjene, greske };
}

if (typeof window !== "undefined") {
  window.Ucitavanje = { ucitajCSV, pripremiIzStanica };
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { ucitajCSV, pripremiIzStanica };
}
