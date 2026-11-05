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

  // nađi red zaglavlja (sadrži neki od poznatih naziva kolona)
  const jeZaglavljeRed = (spoj) =>
    spoj.includes("zad") || spoj.includes("pred") || spoj.includes("citanj") ||
    spoj.includes("vezna") || spoj.includes("brojletve") || spoj.includes("stanica") ||
    spoj.includes("odstojanj");
  let zaglRed = 0;
  for (let i = 0; i < Math.min(redovi.length, 5); i++) {
    const spoj = redovi[i].map((x) => normZaglavlje(x)).join("|");
    if (jeZaglavljeRed(spoj)) { zaglRed = i; break; }
  }
  // N.O.1 ima DVA reda zaglavlja (grupa "Čitanja" + pod-podjele). Spoji oba reda u mapu
  // kolona: za svaku kolonu uzmi naziv iz reda zaglavlja, a ako je prazan — iz sljedećeg.
  const idx = {};
  const dodajZagl = (redIdx) => {
    if (redIdx >= redovi.length) return;
    redovi[redIdx].forEach((naziv, i) => {
      const n = normZaglavlje(naziv);
      if (n && idx[n] === undefined) idx[n] = i;
    });
  };
  dodajZagl(zaglRed);
  // drugi red zaglavlja (pod-podjele) ako postoji i izgleda kao nastavak zaglavlja
  const drugiSpoj = (zaglRed + 1 < redovi.length) ? redovi[zaglRed + 1].map((x) => normZaglavlje(x)).join("|") : "";
  let zaglKraj = zaglRed;
  if (drugiSpoj.includes("podjela") || drugiSpoj.includes("citanj") || drugiSpoj.includes("z1") || drugiSpoj.includes("z2")) {
    dodajZagl(zaglRed + 1);
    zaglKraj = zaglRed + 1;
  }
  // od kojeg reda kreću podaci
  zaglRed = zaglKraj;

  function uzmi(c, kljucevi) {
    for (const k of kljucevi) if (idx[k] !== undefined) return (c[idx[k]] || "").trim();
    return "";
  }

  // Detekcija FORMATA:
  //  - N.O.1 format (kao u Excelu): postoji kolona "Broj letve" (I/II); svaki red je
  //    jedan položaj letve, par redova (I=zadnja, II=prednja) = jedna stanica.
  //  - jednostavni format: jedan red = jedna stanica (Zad1/Pred1/Zad2/Pred2).
  const imaBrojLetve = (idx["brojletve"] !== undefined || idx["letva"] !== undefined || idx["polozaj"] !== undefined);

  // 1) Pročitaj sve redove-mjerenja uz tekući smjer i (opcionalni) ručni OD/DO.
  const mjerenja = [];       // { smjer, od, doR, stanica }
  let trenutniSmjer = "naprijed";
  let rucniOD = "", rucniDO = "";

  if (imaBrojLetve) {
    // --- N.O.1 FORMAT: svaki red = položaj letve (I/II), vezna tačka tog položaja ---
    // red I (zadnja) nosi vezanu tačku "odakle"; red II (prednja) tačku "dokle".
    // Čitanja: kolona "Z (1.podjela)" / "Z (2.podjela)" — u svakom redu po jedno čitanje te skale.
    let polazniRed = null;  // red I u obradi (zadnja letva)
    for (let i = zaglRed + 1; i < redovi.length; i++) {
      const c = redovi[i];
      const smjer = normZaglavlje(uzmi(c, ["smjer", "nivelman"]));
      if (smjer === "naprijed" || smjer === "nazad") trenutniSmjer = smjer;

      const veznaT = uzmi(c, ["veznatacka", "vezna", "tacka"]);
      const letva = normZaglavlje(uzmi(c, ["brojletve", "letva", "polozaj"]));  // "i" ili "ii"
      const odst = parseBroj(uzmi(c, ["odstojanjeodletve", "odstojanje", "odst", "s"]));
      // čitanja: 1. podjela i 2. podjela (svaki red po jedno čitanje po podjeli)
      const c1 = parseBroj(uzmi(c, ["citanje1podjela", "citanja1podjela", "citanja", "citanje", "citanja1", "citanje1", "podjela1", "1podjela", "z1podjela", "z1"]));
      const c2 = parseBroj(uzmi(c, ["citanje2podjela", "citanja2podjela", "citanja2", "citanje2", "podjela2", "2podjela", "z2podjela", "z2"]));
      if (c1 === null && c2 === null) continue;  // red bez čitanja (npr. red razlike) → preskoči

      if (letva === "i" || (!polazniRed && letva !== "ii")) {
        // red I = zadnja letva (početak stanice)
        polazniRed = { smjer: trenutniSmjer, veznaZad: veznaT, z1: c1, z2: (c2 !== null ? c2 : c1), odstZad: odst };
      } else {
        // red II = prednja letva (kraj stanice) → sklopi stanicu
        const z1 = polazniRed ? polazniRed.z1 : null;
        const z2 = polazniRed ? polazniRed.z2 : null;
        const p1 = c1, p2 = (c2 !== null ? c2 : c1);
        const odZ = polazniRed ? (polazniRed.odstZad || 0) : 0;
        const odP = odst || 0;
        mjerenja.push({
          smjer: polazniRed ? polazniRed.smjer : trenutniSmjer,
          od: "", doR: "",
          stanica: {
            veznaZad: polazniRed ? polazniRed.veznaZad : "",
            veznaPred: veznaT,
            zad1: z1, pred1: p1, zad2: z2, pred2: p2,
            odstZad: odZ, odstPred: odP
          }
        });
        polazniRed = null;
      }
    }
  } else {
    // --- jednostavni format: jedan red = jedna stanica ---
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
        rucniOD = ""; rucniDO = "";
      }
      if (od !== "") rucniOD = od;
      if (doR !== "") rucniDO = doR;

      if (zad1 === null && zad2 === null && pred1 === null && pred2 === null) continue;
      const z1 = zad1 !== null ? zad1 : zad2;
      const p1 = pred1 !== null ? pred1 : pred2;
      const z2 = zad2 !== null ? zad2 : z1;
      const p2 = pred2 !== null ? pred2 : p1;
      mjerenja.push({
        smjer: trenutniSmjer, od: rucniOD, doR: rucniDO,
        stanica: {
          veznaZad, veznaPred, zad1: z1, pred1: p1, zad2: z2, pred2: p2,
          odstZad: (odst !== null ? odst / 2 : 0), odstPred: (odst !== null ? odst / 2 : 0)
        }
      });
    }
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

  // Je li korisnik EKSPLICITNO naznačio smjer (stara kolona "Smjer")?
  const imaSmjerKolonu = mjerenja.some((m) => m.smjer === "nazad");

  let segNaprijed, segNazad;
  if (imaSmjerKolonu) {
    // poštuj eksplicitni smjer
    segNaprijed = segmentiraj(mjerenja.filter((m) => m.smjer === "naprijed"));
    segNazad    = segmentiraj(mjerenja.filter((m) => m.smjer === "nazad"));
  } else {
    // AUTOMATSKA detekcija smjera iz veznih tačaka:
    // segmentiramo sve, pa dionice dijelimo na "naprijed" (prva pojava lanca repera)
    // i "nazad" (kad se nizanje repera vrati — prednji reper je već bio posjećen).
    const sviSeg = segmentiraj(mjerenja);
    segNaprijed = [];
    segNazad = [];
    const vidjeni = new Set();   // reperi koje je lanac "naprijed" već dostigao
    let krenuoNazad = false;
    let prethodniDO = null;
    sviSeg.forEach((s) => {
      if (!krenuoNazad) {
        // nazad počinje kad segment vodi ka REPERU koji je već posjećen (vraćanje),
        // a OD je zadnji dostignuti reper
        const vracaSe = vidjeni.has(s.do) && s.od === prethodniDO;
        if (vracaSe) krenuoNazad = true;
      }
      if (krenuoNazad) segNazad.push(s);
      else {
        segNaprijed.push(s);
        vidjeni.add(s.od); vidjeni.add(s.do);
        prethodniDO = s.do;
      }
    });
  }

  // 3) Spoji "naprijed" i "nazad" za ISTI par repera u jednu dionicu.
  //    Nazad se mjeri u suprotnom smjeru (DO→OD), pa segment {od:X, do:Y} nazad
  //    odgovara dionici {od:Y, do:X} naprijed (isti par repera).
  const dioniceMap = [];

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
