/* =====================================================================
   detalj.js — Računanje koordinata DETALJNIH tačaka (polarna metoda)
   Formule su preuzete iz Excela "Računanje detalja".
   ---------------------------------------------------------------------
   Za svaku stanicu vlaka (s izravnatim koordinatama Y, X i visinom H):
     - orijentacija: pravac na zadnju tačku (srednji pravac iz girusa)
       i direkcioni ugao stanica → zadnja tačka (iz koordinata)
     - direkcioni ugao na detalj:  α = α(zadnja) + (pravac_detalja − pravac_zadnja)
     - horizontalna dužina:        d  = ROUND(kosa · sin z, 3)
     - priraštaji:                 Δy = ROUND(d · sin α, 3),  Δx = ROUND(d · cos α, 3)
     - koordinate:                 Y = Ys + Δy,   X = Xs + Δx
     - visina:                     H = ROUND(Hs + kosa·cos z
                                       + (1 − k)·kosa²/(2R)·sin² z + i − l, 3)
       (k = 0.13 koeficijent refrakcije, R = 6376000 m, i = visina instrumenta,
        l = visina signala)
   ===================================================================== */

const DETALJ_K_REFRAKCIJE = 0.13;
const DETALJ_R_ZEMLJE = 6376000;

function _detaljDeps() {
  if (typeof window !== "undefined") return { R: window.Racun, G: window.Girus };
  return { R: require("./racun.js"), G: require("./girus.js") };
}

function _zaokruzi(x, n) {
  const f = Math.pow(10, n);
  return Math.round((x + Number.EPSILON) * f) / f;
}

/* Izračun jedne detaljne tačke.
   stanica = { Y, X, H|null, visinaInstr, alfaZadnja (dec°), pravacZadnja (dec°) }
   m       = { horiz, zenit, kosa, visinaSignala }  (horiz/zenit: string ili broj u SSS.MMSS / °'")  */
function racunajDetalj(stanica, m) {
  const { R, G } = _detaljDeps();
  let hz = G.parsirajUgao(m.horiz);
  let z = G.parsirajUgao(m.zenit);
  const kosa = Number(String(m.kosa).replace(",", "."));
  if (hz === null || z === null || !(kosa > 0)) return null;

  // mjerenje u II položaju (krug desno): zenit > 180° → svedi na I položaj
  if (z > 180) { z = 360 - z; hz = hz - 180; }

  const dir = R.norm360(stanica.alfaZadnja + (hz - stanica.pravacZadnja));
  const zr = (z * Math.PI) / 180;
  const dr = (dir * Math.PI) / 180;

  const d = _zaokruzi(kosa * Math.sin(zr), 3);
  const dy = _zaokruzi(d * Math.sin(dr), 3);
  const dx = _zaokruzi(d * Math.cos(dr), 3);

  const l = Number(String(m.visinaSignala).replace(",", ".")) || 0;
  let H = null;
  if (stanica.H !== null && stanica.H !== undefined && !isNaN(stanica.H)) {
    const popr = (1 - DETALJ_K_REFRAKCIJE) * (kosa * kosa / (2 * DETALJ_R_ZEMLJE)) * Math.pow(Math.sin(zr), 2);
    H = _zaokruzi(stanica.H + (kosa * Math.cos(zr) + popr + stanica.visinaInstr - l), 3);
  }

  return {
    pravac: hz, zenit: z, kosa, horizDuzina: d, dir,
    dy, dx, Y: _zaokruzi(stanica.Y + dy, 3), X: _zaokruzi(stanica.X + dx, 3), H,
    visinaSignala: l,
  };
}

/* Izračun svih detalja.
   stanice : obrađene stanice (iz girus.obradiStanicu) s dodanim poljem .detalji = [{vizura,horiz,zenit,kosa,visinaSignala}]
   tocke   : izravnate tačke vlaka [{naziv,Y,X}] istim redom kao stanice (B, T1..Tn, C)
   A       : orijentacijska tačka pozadi {naziv,Y,X}
   visine  : niz nadmorskih visina stanica istim redom, ili null                         */
function izracunajDetalje(stanice, tocke, A, visine) {
  const { R } = _detaljDeps();
  const izlaz = [];
  let ukupno = 0, preskoceno = 0;

  stanice.forEach((st, i) => {
    if (!st || st.greska || !tocke[i]) return;
    const T = tocke[i];
    const zad = i === 0 ? A : tocke[i - 1];
    const Hs = visine && visine[i] !== undefined ? visine[i] : null;

    const alfaZadnja = R.direkcijskiUgao(T.Y, T.X, zad.Y, zad.X);
    const stan = { Y: T.Y, X: T.X, H: Hs, visinaInstr: st.visinaInstr, alfaZadnja, pravacZadnja: st.pravacZadnja };

    const tacke = [];
    (st.detalji || []).forEach((m) => {
      const r = racunajDetalj(stan, m);
      if (!r) { preskoceno++; return; }
      tacke.push({ naziv: m.vizura, kod: m.kod || "", ...r });
      ukupno++;
    });

    izlaz.push({
      stanica: st.stanica, naziv: T.naziv, Y: T.Y, X: T.X, H: Hs,
      visinaInstr: st.visinaInstr,
      orijentacija: {
        naziv: zad.naziv || st.nazZadnja, Y: zad.Y, X: zad.X,
        dir: alfaZadnja, pravac: st.pravacZadnja,
        zenit: st.zenitZadnja, kosa: st.kosaZadnja,
        horizDuzina: st.horizDuzinaZadnja, visinaSignala: st.visinaSignalaZadnja,
      },
      tacke,
    });
  });

  return { stanice: izlaz, ukupno, preskoceno };
}

/* Tekstualni izvoz — format iz Excela (stupac "Priprema za txt"):  Y;X;H;broj;H
   (decimalni zarez, razdjelnik ;).                                                */
function detaljiUTxt(rez) {
  const zarez = (v) => (v === null || v === undefined || isNaN(v)) ? "" : String(v).replace(".", ",");
  const linije = [];
  rez.stanice.forEach((s) => s.tacke.forEach((t) => {
    linije.push([zarez(t.Y), zarez(t.X), zarez(t.H), t.naziv, zarez(t.H)].join(";"));
  }));
  return linije.join("\r\n");
}

if (typeof window !== "undefined") {
  window.Detalj = { racunajDetalj, izracunajDetalje, detaljiUTxt };
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { racunajDetalj, izracunajDetalje, detaljiUTxt };
}
