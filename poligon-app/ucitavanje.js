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
  // makni eventualni BOM na početku
  if (tekst.charCodeAt(0) === 0xFEFF) tekst = tekst.slice(1);

  const prviRed = tekst.split(/\r?\n/)[0] || "";

  // Automatski prepoznaj razdjelnik stupaca: tab, tačka-zarez ili zarez.
  const kandidati = ["\t", ";", ","];
  let sep = ";";
  let najvise = -1;
  for (const k of kandidati) {
    const broj = prviRed.split(k).length - 1;
    if (broj > najvise) { najvise = broj; sep = k; }
  }
  if (najvise <= 0) {
    throw new Error("Ne mogu prepoznati stupce. Spremite datoteku kao CSV (razdvojeno zarezom) ili Tekst (tab).");
  }

  // razbij u 2D niz redova
  const redovi2D = tekst.split(/\r?\n/)
    .map((r) => r.replace(/^[ \r\n]+|[ \r\n]+$/g, ""))
    .filter((r) => r !== "")
    .map((r) => r.split(sep));
  return ucitajRedove(redovi2D);
}

/* Učitaj iz 2D niza redova (koristi se i za CSV i za .xlsx). */
function ucitajRedove(redovi) {
  if (!redovi || redovi.length < 2) throw new Error("Datoteka je prazna ili nema podataka.");

  // preskoči eventualni naslovni red (npr. "TAHIMETRIJSKI ZAPISNIK" spojen u A1)
  // zaglavlje je prvi red koji sadrži "vizura" ili "stanica"
  let zaglRed = 0;
  for (let i = 0; i < Math.min(redovi.length, 3); i++) {
    const spoj = redovi[i].map((x) => normZaglavlje(x || "")).join("|");
    if (spoj.includes("vizura") || spoj.includes("stanica")) { zaglRed = i; break; }
  }

  const zagl = redovi[zaglRed].map((x) => normZaglavlje(x));
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

  // postoji li zasebna kolona za visinu instrumenta (stari format)?
  const imaKolonuVisine = (idx["visinainstrumenta"] !== undefined || idx["visinainstr"] !== undefined
                           || idx["visinainstrumentam"] !== undefined || idx["vi"] !== undefined);

  // visina instrumenta je broj s DECIMALOM (npr. 1.694 / 1,694); naziv tačke može biti cijeli broj (83)
  const jeVisinaInstr = (s) => s !== "" && /^[0-9]+[.,][0-9]+$/.test(String(s).trim());

  for (let i = zaglRed + 1; i < redovi.length; i++) {
    const c = redovi[i];
    const prvaKol = uzmi(c, ["stanicai", "stanica"]);
    const visKol = uzmi(c, ["visinainstrumenta", "visinainstr", "visinainstrumentam", "vi"]);
    const vizura = uzmi(c, ["vizura", "vuzura", "vizurnatacka"]);
    const kod = uzmi(c, ["kod"]);
    const horiz = uzmi(c, ["horizontalniugao", "horizontalni", "hz", "ha"]);
    const zenit = uzmi(c, ["zenitniugao", "zenitni", "vz", "z"]);
    const kosa = uzmi(c, ["kosaduzina", "kosa", "sd"]);
    const visSig = uzmi(c, ["visinasignala", "vissignala", "vs"]);

    if (imaKolonuVisine) {
      // --- STARI FORMAT: visina instrumenta u zasebnoj koloni ---
      // prva kolona popunjena = naziv stanice (nasljeđuje se ako prazna)
      let stan = prvaKol;
      if (stan === "" && trenutna) stan = trenutna.stanica;
      if (prvaKol !== "") {
        const visBroj = parseFloat(String(visKol).replace(",", ".")) || 0;
        trenutna = { stanica: prvaKol, visinaInstr: visBroj, mjerenja: [] };
        stanice.push(trenutna);
      }
      if (vizura === "" && horiz === "") continue;
      if (!trenutna) continue;
      trenutna.mjerenja.push({
        vizura, kod, horiz, zenit, kosa: parseFloat((kosa || "0").replace(",", ".")),
        visinaSignala: parseFloat((visSig || "0").replace(",", "."))
      });
    } else {
      // --- NOVI FORMAT: visina instrumenta u redu ISPOD stanice (ista kolona) ---
      // red s visinom instrumenta (decimalan broj, bez vizure)
      if (jeVisinaInstr(prvaKol) && vizura === "" && horiz === "") {
        if (trenutna) trenutna.visinaInstr = parseFloat(String(prvaKol).replace(",", ".")) || 0;
        continue;
      }
      // red s nazivom nove stanice (nije decimalan broj; nema vizure/horiz na tom redu)
      if (prvaKol !== "" && vizura === "" && horiz === "") {
        trenutna = { stanica: prvaKol, visinaInstr: 0, mjerenja: [] };
        stanice.push(trenutna);
        continue;
      }
      // red mjerenja
      if (vizura === "" && horiz === "") continue;
      if (!trenutna) continue;
      trenutna.mjerenja.push({
        vizura, kod, horiz, zenit, kosa: parseFloat((kosa || "0").replace(",", ".")),
        visinaSignala: parseFloat((visSig || "0").replace(",", "."))
      });
    }
  }

  if (!stanice.length) throw new Error("Nije pronađeno nijedno mjerenje. Provjerite zaglavlje stupaca.");

  // Na svakoj stanici odvoji girusna mjerenja (vlak) od detaljnih tačaka.
  stanice.forEach((s, i) => {
    // zadnja stanica može biti bez girusa (slijepi vlak): vizura unazad na prethodnu stanicu + detalji
    const prethodna = (i === stanice.length - 1 && i > 0) ? stanice[i - 1].stanica : null;
    const { girus, detalji, orijentacija } = razdvojiGirusIDetalje(s.mjerenja, prethodna);
    s.sviRedovi = s.mjerenja;   // sva mjerenja, originalnim redoslijedom (za obrazac TZ)
    s.mjerenja = girus;         // samo girus (4 vizure po girusu)
    s.detalji = detalji;        // detaljne tačke (po jedno mjerenje, I položaj)
    if (orijentacija) s.orijentacija = orijentacija;   // 1–2 reda: vizura unazad (bez girusa)
  });
  return stanice;
}

/* Prepoznaje li stanica POLARNU snimku: nema girusa, nego jedan red orijentacije
   (vizura unazad) + niz detaljnih tačaka. Tipično: prvi red je orijentacija (često
   horizontalni ugao 0), svaka ostala vizura je zasebna detaljna tačka.               */
function jePolarnaStanica(m) {
  if (!m || m.length < 2) return false;
  const naz = (r) => String(r.vizura || "").trim();
  const Z = naz(m[0]), P = naz(m[1]);
  // ako liči na girus (Z,P,P,Z), nije polarna
  if (m.length >= 4 && naz(m[0]) === Z && naz(m[1]) === P && naz(m[2]) === P && naz(m[3]) === Z) return false;
  return true;
}

/* Girus = 4 reda: ZADNJA, PREDNJA, PREDNJA, ZADNJA (isti nazivi tačaka u svakom girusu).
   Redovi iza zadnjeg potpunog girusa su detaljne tačke.                             */
function razdvojiGirusIDetalje(m, prethodna) {
  const naz = (r) => String(r.vizura || "").trim();
  // zadnja stanica bez girusa: vizura unazad na prethodnu stanicu (1 ili 2 reda: I i II položaj)
  const bezGirusa = () => {
    if (!prethodna || !m.length) return null;
    let j = 0;
    while (j < m.length && j < 2 && naz(m[j]) === String(prethodna).trim()) j++;
    return j > 0 ? { girus: [], detalji: m.slice(j), orijentacija: m.slice(0, j) } : null;
  };
  // POLARNA snimka: nema girusa, prvi red je orijentacija (vizura unazad), ostatak su detalji
  const polarno = () => (m.length >= 2 ? { girus: [], detalji: m.slice(1), orijentacija: m.slice(0, 1) } : null);

  if (m.length < 4) return bezGirusa() || polarno() || { girus: m, detalji: [] };
  const Z = naz(m[0]), P = naz(m[1]);
  let k = 0;
  while (k + 4 <= m.length &&
         naz(m[k]) === Z && naz(m[k + 1]) === P &&
         naz(m[k + 2]) === P && naz(m[k + 3]) === Z) k += 4;
  if (k === 0) return bezGirusa() || polarno() || { girus: m, detalji: [] };   // nema girusa → polarna snimka
  return { girus: m.slice(0, k), detalji: m.slice(k) };
}

function normZaglavlje(s) {
  return s.toLowerCase()
    .replace(/š/g, "s").replace(/ž/g, "z").replace(/č/g, "c").replace(/ć/g, "c").replace(/đ/g, "d")
    .replace(/[^a-z0-9]/g, "");
}

/* Iz učitanih stanica izračunaj prelomne uglove i dužine (girusna obrada)
   te složi ulaz za izravnanje umetnutog vlaka.
   Potrebne su i date tačke (A,B,C,D) koje korisnik unese u aplikaciji.    */
function pripremiIzStanica(stanice, izbori) {
  const G = (typeof window !== "undefined") ? window.Girus : require("./girus.js");
  const obradjene = [];
  const greske = [];
  for (const s of stanice) {
    const r = s.orijentacija
      ? G.obradiOrijentaciju(s.stanica, s.visinaInstr, s.orijentacija)
      : G.obradiStanicu(s.stanica, s.visinaInstr, s.mjerenja, izbori && izbori[obradjene.length]);
    if (r.greska) greske.push(r.greska);
    r.detalji = s.detalji || [];          // detaljne tačke ove stanice
    obradjene.push(r);
  }
  return { obradjene, greske };
}

/* Učitavanje iz .xlsx (ArrayBuffer) — koristi XlsxGen.citajXlsx pa ucitajRedove */
async function ucitajXlsxStanice(arrayBuffer) {
  const redovi = await window.XlsxGen.citajXlsx(arrayBuffer);
  return ucitajRedove(redovi);
}

if (typeof window !== "undefined") {
  window.Ucitavanje = { ucitajCSV, ucitajRedove, ucitajXlsxStanice, pripremiIzStanica };
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { ucitajCSV, ucitajRedove, pripremiIzStanica };
}
