/* =====================================================================
   ucitavanje.js — Učitavanje nivelmanskog zapisnika (obrazac N.O.1)
   iz .xlsx ili CSV, pa pretvaranje u dionice (OD → DO reper) sa
   stanicama za izravnanje.

   OČEKIVANI STUPCI predloška (zaglavlje u prvom redu podataka):
     Smjer ; OD ; DO ; VeznaZad ; VeznaPred ; Odstojanje ;
     Zad1 ; Pred1 ; Zad2 ; Pred2 ; Primjedba

   - "Smjer" = "naprijed" ili "nazad" (upisuje se samo u prvom redu dionice;
     prazno = nasljeđuje se od reda iznad).
   - "OD" / "DO" = nazivi repera dionice (upisuju se u prvom redu dionice).
   - Svaki red = jedna stanica nivelmana (zadnja i prednja letva).
       Zad1/Pred1 = čitanja na 1. podjeli (lijeva skala)
       Zad2/Pred2 = čitanja na 2. podjeli (desna skala)
       Odstojanje = ukupno odstojanje stanice [m] (zad + pred), ili prazno.
   ===================================================================== */

function normZaglavlje(s) {
  return String(s || "").toLowerCase()
    .replace(/š/g, "s").replace(/ž/g, "z").replace(/č/g, "c").replace(/ć/g, "c").replace(/đ/g, "d")
    .replace(/[^a-z0-9]/g, "");
}

function parseBroj(s) {
  if (s === "" || s === null || s === undefined) return null;
  const v = parseFloat(String(s).trim().replace(/\s/g, "").replace(",", "."));
  return isNaN(v) ? null : v;
}

/* REPER vs VEZNA TAČKA:
   - reper = počinje velikim slovom R ili P (npr. R100, R101, P50, Rn1);
   - vezna tačka = malo slovo abecede (a, b, c, …) ili bilo šta što nije reper.
   Repere koristimo kao granice dionica (OD → DO). */
function jeReper(naziv) {
  const s = String(naziv || "").trim();
  if (!s) return false;
  return /^[RP]/.test(s);   // veliko R ili P na početku
}

/* CSV → 2D niz redova */
function ucitajCSV(tekst) {
  if (tekst.charCodeAt(0) === 0xFEFF) tekst = tekst.slice(1);
  const prviRed = tekst.split(/\r?\n/)[0] || "";
  const kandidati = ["\t", ";", ","];
  let sep = ";", najvise = -1;
  for (const k of kandidati) {
    const broj = prviRed.split(k).length - 1;
    if (broj > najvise) { najvise = broj; sep = k; }
  }
  if (najvise <= 0) throw new Error("Ne mogu prepoznati stupce. Spremite kao CSV ili Tekst (tab).");
  const redovi = tekst.split(/\r?\n/)
    .map((r) => r.replace(/^[ \r\n]+|[ \r\n]+$/g, ""))
    .filter((r) => r !== "")
    .map((r) => r.split(sep));
  return ucitajRedove(redovi);
}

/* 2D niz redova → dionice (koristi se i za CSV i za .xlsx) */
function ucitajRedove(redovi) {
  if (!redovi || redovi.length < 2) throw new Error("Datoteka je prazna ili nema podataka.");

  // nađi red zaglavlja (sadrži "zad" ili "pred" ili "od")
  let zaglRed = 0;
  for (let i = 0; i < Math.min(redovi.length, 4); i++) {
    const spoj = redovi[i].map((x) => normZaglavlje(x)).join("|");
    if (spoj.includes("zad") || spoj.includes("pred") || spoj.includes("citanje")) { zaglRed = i; break; }
  }
  const zagl = redovi[zaglRed].map((x) => normZaglavlje(x));
  const idx = {};
  zagl.forEach((naziv, i) => { if (idx[naziv] === undefined) idx[naziv] = i; });

  function uzmi(c, kljucevi) {
    for (const k of kljucevi) if (idx[k] !== undefined) return (c[idx[k]] || "").trim();
    return "";
  }

  // 1) Pročitaj sve redove-mjerenja uz tekući smjer i (opcionalni) ručni OD/DO.
  const mjerenja = [];       // { smjer, od, doR, stanica }
  let trenutniSmjer = "naprijed";
  let rucniOD = "", rucniDO = "";

  for (let i = zaglRed + 1; i < redovi.length; i++) {
    const c = redovi[i];
    const smjer = normZaglavlje(uzmi(c, ["smjer", "nivelman", "smjernivelmana"]));
    const od = uzmi(c, ["od", "odreper", "odakle"]);
    const doR = uzmi(c, ["do", "doreper", "dokle"]);
    const veznaZad = uzmi(c, ["veznazad", "zadnjatacka", "zadnja", "zadtacka"]);
    const veznaPred = uzmi(c, ["veznapred", "prednjatacka", "prednja", "predtacka"]);
    const odst = parseBroj(uzmi(c, ["odstojanje", "odst", "s", "duzina"]));
    const zad1 = parseBroj(uzmi(c, ["zad1", "zadnja1", "z1", "citanjezad1"]));
    const pred1 = parseBroj(uzmi(c, ["pred1", "prednja1", "p1", "citanjepred1"]));
    const zad2 = parseBroj(uzmi(c, ["zad2", "zadnja2", "z2", "citanjezad2"]));
    const pred2 = parseBroj(uzmi(c, ["pred2", "prednja2", "p2", "citanjepred2"]));

    if (smjer === "naprijed" || smjer === "nazad") {
      trenutniSmjer = smjer;
      rucniOD = ""; rucniDO = "";   // novi smjer → poništi naslijeđeni ručni OD/DO
    }
    if (od !== "") rucniOD = od;
    if (doR !== "") rucniDO = doR;

    // red bez ijednog čitanja = nije stanica (preskoči)
    if (zad1 === null && zad2 === null && pred1 === null && pred2 === null) continue;

    // podjela 2 opcionalna: ako nema, koristimo podjelu 1 kao obje
    const z1 = zad1 !== null ? zad1 : zad2;
    const p1 = pred1 !== null ? pred1 : pred2;
    const z2 = zad2 !== null ? zad2 : z1;
    const p2 = pred2 !== null ? pred2 : p1;

    mjerenja.push({
      smjer: trenutniSmjer,
      od: rucniOD, doR: rucniDO,
      stanica: {
        veznaZad, veznaPred,
        zad1: z1, pred1: p1, zad2: z2, pred2: p2,
        odstZad: (odst !== null ? odst / 2 : 0),
        odstPred: (odst !== null ? odst / 2 : 0)
      }
    });
  }
  if (!mjerenja.length) throw new Error("Nije pronađena nijedna stanica s mjerenjima. Provjerite zaglavlje stupaca i podatke.");

  // 2) Razdvoji mjerenja na pod-dionice (segment od repera do repera) unutar svakog smjera.
  //    Pod-dionica se cijepa na REPERU: reper (R/P) kao PREDNJA vezna tačka = kraj segmenta.
  function segmentiraj(niz) {
    const segmenti = [];   // { od, do, stanice:[...] }
    let i = 0;
    while (i < niz.length) {
      const prvi = niz[i];
      // OD segmenta: ako je zadnja vezna tačka prve stanice reper → to je OD
      // (tako svaki segment počinje reperom na kojem je prethodni završio).
      // Ručni OD koristimo samo za PRVI segment (kad zadnja vezna tačka nije reper).
      let odR = jeReper(prvi.stanica.veznaZad) ? prvi.stanica.veznaZad
              : (jeReper(prvi.od) ? prvi.od : (prvi.od || prvi.stanica.veznaZad || "?"));
      const stanice = [];
      let doR = "";
      let j = i;
      for (; j < niz.length; j++) {
        stanice.push(niz[j].stanica);
        const vp = niz[j].stanica.veznaPred;
        const rucnoDO = niz[j].doR;
        if (jeReper(vp)) { doR = vp; j++; break; }
        if (rucnoDO && jeReper(rucnoDO)) { doR = rucnoDO; j++; break; }
      }
      if (!doR) doR = (jeReper(prvi.doR) ? prvi.doR : (stanice[stanice.length - 1]?.veznaPred || "?"));
      segmenti.push({ od: odR, do: doR, stanice });
      i = j;
    }
    return segmenti;
  }

  const segNaprijed = segmentiraj(mjerenja.filter((m) => m.smjer === "naprijed"));
  const segNazad    = segmentiraj(mjerenja.filter((m) => m.smjer === "nazad"));

  // 3) Spoji "naprijed" i "nazad" za ISTI par repera u jednu dionicu.
  //    Nazad se mjeri u suprotnom smjeru (DO→OD), pa segment {od:X, do:Y} nazad
  //    odgovara dionici {od:Y, do:X} naprijed (isti par repera).
  const dioniceMap = [];
  const kljuc = (a, b) => [a, b].join("→");

  // redoslijed dionica diktira smjer "naprijed" (ako postoji), inače "nazad" obrnuto
  const bazni = segNaprijed.length ? segNaprijed
                                   : segNazad.map((s) => ({ od: s.do, do: s.od, stanice: s.stanice }));
  bazni.forEach((s) => {
    const d = { od: s.od, do: s.do, naprijed: [], nazad: [] };
    if (segNaprijed.length) s.stanice.forEach((st) => d.naprijed.push(st));
    dioniceMap.push(d);
  });

  // ubaci nazad u odgovarajuću dionicu (po paru repera, bez obzira na smjer)
  segNazad.forEach((s) => {
    const d = dioniceMap.find((x) =>
      (x.od === s.do && x.do === s.od) || (x.od === s.od && x.do === s.do));
    if (d) {
      s.stanice.forEach((st) => d.nazad.push(st));
    } else {
      // nazad bez para naprijed → zasebna dionica (orijentisana kao naprijed)
      dioniceMap.push({ od: s.do, do: s.od, naprijed: [], nazad: [...s.stanice] });
    }
  });

  const dionice = dioniceMap.filter((d) => d.naprijed.length || d.nazad.length);
  if (!dionice.length) throw new Error("Nije pronađena nijedna dionica s mjerenjima. Provjerite da su reperi označeni velikim R/P, a vezne tačke malim slovima (a, b, c…).");
  return dionice;
}

/* Učitavanje iz .xlsx (ArrayBuffer) — koristi XlsxGen.citajXlsx pa ucitajRedove */
async function ucitajXlsxDionice(arrayBuffer) {
  const redovi = await window.XlsxGen.citajXlsx(arrayBuffer);
  return ucitajRedove(redovi);
}

if (typeof window !== "undefined") {
  window.UcitavanjeNiv = { ucitajCSV, ucitajRedove, ucitajXlsxDionice, normZaglavlje, parseBroj, jeReper };
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { ucitajCSV, ucitajRedove, normZaglavlje, parseBroj, jeReper };
}
