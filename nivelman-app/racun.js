/* =====================================================================
   racun.js — Jezgro izravnanja NIVELMANSKOG VLAKA (geometrijski nivelman)
   Vjerno pratimo logiku originalnog Excela (obrasci N.O.1, N.O.2, N.O.3).

   TOK:
   1) N.O.1  — iz čitanja letvi po stanicama računamo visinske razlike
               po dionici, za nivelman "naprijed" i (ako postoji) "nazad".
   2) N.O.2  — poređenje naprijed/nazad: odstupanje Δ=Δh'p−Δh'n [mm],
               dozvoljeno odstupanje, srednja visinska razlika.
   3) N.O.3  — izravnanje vlaka: raspored popravke proporcionalno dužini,
               definitivne visinske razlike i nadmorske visine repera.
   ===================================================================== */

/* Visinska razlika jedne STANICE geometrijskog nivelmana:
   Δh = čitanje ZADNJA (nazad) − čitanje PREDNJA (naprijed).
   Svaka stanica se mjeri na dvije podjele letve (podjela 1 i podjela 2).
   stanica = {
     red, veznaZad, veznaPred,
     zad1, pred1,      // podjela 1 (lijeva skala)
     zad2, pred2,      // podjela 2 (desna skala)
     odstZad, odstPred // odstojanja letvi (za dužinu dionice)
   }
   Vraća { d1, d2, dSred } u metrima.                                  */
function visinskaRazlikaStanice(s) {
  const d1 = (s.zad1 - s.pred1);
  const d2 = (s.zad2 - s.pred2);
  const dSred = (d1 + d2) / 2;
  return { d1, d2, dSred };
}

/* Dozvoljeno odstupanje između naprijed/nazad za jednu dionicu [mm].
   Iz Excela (N.O.2):  32 · √( S + 0.06·S² ),  S u km (srednja dužina dionice). */
function dozvoljenoOdstupanje(S_km) {
  return 32 * Math.sqrt(S_km + 0.06 * S_km * S_km);
}

/* Dozvoljeno zatvaranje cijelog vlaka fh [mm].
   Standardna formula tehničkog nivelmana: fh_dop = 32·√(ΣS)  (ΣS u km).
   (Konzervativno; po potrebi se lako mijenja.)                         */
function dozvoljenoZatvaranje(sumaS_km) {
  return 32 * Math.sqrt(sumaS_km);
}

/* -----------------------------------------------------------------
   Glavni izračun.
   ulaz = {
     dionice: [            // po jednoj dionici (OD → DO reper)
       {
         od, do,                       // nazivi repera
         naprijed: [stanica, ...],     // stanice nivelmana naprijed
         nazad:    [stanica, ...]      // stanice nivelmana nazad (opcionalno)
       }, ...
     ],
     Hpoc,     // nadmorska visina početnog repera (obavezno)
     Hkraj,    // nadmorska visina krajnjeg repera (za kontrolu zatvaranja; opc.)
     nazivPoc, nazivKraj
   }
   ------------------------------------------------------------------ */
function izravnajNivelmanskiVlak(ulaz) {
  const greske = [];
  const dionice = ulaz.dionice || [];
  if (dionice.length < 1) throw new Error("Nema nijedne dionice (OD → DO).");

  const redoviNO1 = [];   // detaljni račun po stanicama (za obrazac N.O.1)
  const redoviNO2 = [];   // poređenje naprijed/nazad (za N.O.2)

  dionice.forEach((di) => {
    // --- Naprijed ---
    const napr = obradiSmjer(di.naprijed || []);
    // --- Nazad ---
    const naz = (di.nazad && di.nazad.length) ? obradiSmjer(di.nazad) : null;

    // Δh nazad se u N.O.2 uzima sa suprotnim predznakom (mjeri se u suprotnom smjeru)
    const dHp = napr.dHuk;                        // Δh'p [m]  (naprijed)
    const dHn = naz ? -naz.dHuk : null;           // Δh'n [m]  (nazad, obrnut predznak)
    const Sp_km = napr.sumaOdst / 1000 / 1000;    // odstojanja su u metrima → u km (Σ mm? vidi niže)

    // U Excelu su odstojanja upisana u "koracima/m" i sumirana pa dijeljena /1000 → km.
    // Mi odstojanja držimo u metrima; Σodst (m) / 1000 = km.
    const Sp = napr.sumaOdst / 1000;              // km (naprijed)
    const Sn = naz ? naz.sumaOdst / 1000 : Sp;    // km (nazad)
    const Ssr = (Sp + Sn) / 2;                    // srednja dužina dionice [km]

    const odstMm = (dHn !== null) ? (dHp - dHn) * 1000 : 0;   // Δ [mm]
    const dop = dozvoljenoOdstupanje(Ssr);
    const dHsred = (dHn !== null) ? (dHp + dHn) / 2 : dHp;    // srednja visinska razlika [m]

    redoviNO1.push({ od: di.od, do: di.do, naprijed: napr, nazad: naz });
    redoviNO2.push({
      od: di.od, do: di.do,
      dHp, dHn, Sp, Sn, Ssr,
      odstMm, dop, dHsred,
      odstOK: (dHn === null) ? true : Math.abs(odstMm) <= dop
    });
  });

  // --- N.O.3: izravnanje vlaka ---
  const sumaS = redoviNO2.reduce((a, r) => a + r.Ssr, 0);        // Σ srednjih dužina [km]
  const sumaDh = redoviNO2.reduce((a, r) => a + r.dHsred, 0);    // Σ srednjih visinskih razlika [m]

  // Umetnuti vlak: oba repera (početni i završni) su DATA i oba ulaze u izravnanje.
  // Zatvaranje:  fh = (Hpoc + ΣΔh) − Hkraj.  Ovo fh se raspoređuje kao popravke
  // (završni reper NIJE samo kontrola — on definira zatvaranje vlaka).
  let fh = null, dopFh = null, visinskiOK = true;
  const imaKraj = (ulaz.Hkraj !== null && ulaz.Hkraj !== undefined && !isNaN(ulaz.Hkraj));
  if (imaKraj) {
    fh = (ulaz.Hpoc + sumaDh) - ulaz.Hkraj;        // [m]
    dopFh = dozvoljenoZatvaranje(sumaS) / 1000;    // [m]
    visinskiOK = Math.abs(fh) <= dopFh;
  }

  // popravka po dionici: Vn = −(fh/ΣS)·Si   (ukupne popravke = −fh)
  const redoviNO3 = [];
  let H = ulaz.Hpoc;
  redoviNO2.forEach((r, i) => {
    const Vn = imaKraj ? -(fh / sumaS) * r.Ssr : 0;    // [m]
    const hDef = r.dHsred + Vn;                        // definitivna visinska razlika [m]
    const Hprije = H;
    H = H + hDef;                                       // nadmorska visina sljedećeg repera
    redoviNO3.push({
      rb: i + 1,
      od: r.od, do: r.do,
      dHn: r.dHsred,     // visinska razlika dobivena nivelanjem (srednja)
      S: r.Ssr,          // odstojanje između repera [km]
      Vn,                // popravka [m]
      hDef,              // definitivna visinska razlika [m]
      Hod: Hprije,       // visina početnog repera dionice
      Hdo: H             // visina krajnjeg repera dionice
    });
  });

  // kontrola: suma popravaka treba biti −fh
  const sumaV = redoviNO3.reduce((a, r) => a + r.Vn, 0);

  // spisak nadmorskih visina repera
  const visine = [{ naziv: ulaz.nazivPoc || redoviNO2[0].od, H: ulaz.Hpoc, tip: "dati" }];
  redoviNO3.forEach((r, i) => {
    const zadnji = (i === redoviNO3.length - 1);
    visine.push({
      naziv: r.do,
      // završni reper umetnutog vlaka je dati → prikazujemo datu visinu, ne izračunatu
      H: (zadnji && imaKraj) ? ulaz.Hkraj : r.Hdo,
      tip: (zadnji && imaKraj) ? "dati" : "novi"
    });
  });

  return {
    redoviNO1, redoviNO2, redoviNO3,
    sumaS, sumaDh, sumaV,
    fh, dopFh, visinskiOK, imaKraj,
    Hpoc: ulaz.Hpoc, Hkraj: ulaz.Hkraj,
    nazivPoc: ulaz.nazivPoc, nazivKraj: ulaz.nazivKraj,
    visine, greske,
    brojDionica: redoviNO2.length,
    brojStanica: redoviNO1.reduce((a, d) => a + d.naprijed.stanice.length + (d.nazad ? d.nazad.stanice.length : 0), 0)
  };
}

/* Obradi jedan smjer nivelmana (niz stanica) → visinske razlike po stanici,
   ukupna visinska razlika dionice i suma odstojanja.                       */
function obradiSmjer(stanice) {
  const obr = [];
  let dHuk = 0, sumaOdst = 0;
  stanice.forEach((s) => {
    const r = visinskaRazlikaStanice(s);
    dHuk += r.dSred;
    sumaOdst += (s.odstZad || 0) + (s.odstPred || 0);
    obr.push({ ...s, ...r });
  });
  return { stanice: obr, dHuk, sumaOdst };
}

if (typeof window !== "undefined") {
  window.RacunNiv = {
    izravnajNivelmanskiVlak, visinskaRazlikaStanice,
    dozvoljenoOdstupanje, dozvoljenoZatvaranje, obradiSmjer
  };
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    izravnajNivelmanskiVlak, visinskaRazlikaStanice,
    dozvoljenoOdstupanje, dozvoljenoZatvaranje, obradiSmjer
  };
}
