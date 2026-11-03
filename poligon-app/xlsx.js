/* =====================================================================
   xlsx.js — Minimalni generator Excel (.xlsx) datoteke u pregledniku,
   BEZ vanjskih biblioteka. Pravi uredan, oblikovan predložak
   tahimetrijskog zapisnika (okviri, spojeno zaglavlje, boje).
   ---------------------------------------------------------------------
   .xlsx je ZIP arhiva s XML datotekama. Ovdje gradimo minimalni ZIP
   (store, bez kompresije) s potrebnim dijelovima.
   ===================================================================== */

/* ---- CRC32 (za ZIP) ---- */
const _crcTab = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = _crcTab[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function strToBytes(s) { return new TextEncoder().encode(s); }

/* ---- Minimalni ZIP (store metoda) ---- */
function napraviZip(datoteke) {
  // datoteke = [{ime, sadrzaj(bytes)}]
  const chunks = [];
  const central = [];
  let offset = 0;

  function u16(n){ return [n & 255, (n>>8)&255]; }
  function u32(n){ return [n & 255, (n>>8)&255, (n>>16)&255, (n>>24)&255]; }

  datoteke.forEach((f) => {
    const imeBytes = strToBytes(f.ime);
    const crc = crc32(f.sadrzaj);
    const velicina = f.sadrzaj.length;

    // Local file header
    const lh = [].concat(
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(velicina), u32(velicina),
      u16(imeBytes.length), u16(0)
    );
    chunks.push(new Uint8Array(lh));
    chunks.push(imeBytes);
    chunks.push(f.sadrzaj);

    // Central directory record
    const ch = [].concat(
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(velicina), u32(velicina),
      u16(imeBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset)
    );
    central.push({ header: new Uint8Array(ch), ime: imeBytes });

    offset += lh.length + imeBytes.length + velicina;
  });

  let centralSize = 0;
  const centralChunks = [];
  central.forEach((c) => {
    centralChunks.push(c.header, c.ime);
    centralSize += c.header.length + c.ime.length;
  });

  const eocd = [].concat(
    u32(0x06054b50), u16(0), u16(0),
    u16(datoteke.length), u16(datoteke.length),
    u32(centralSize), u32(offset), u16(0)
  );

  const sviDijelovi = [...chunks, ...centralChunks, new Uint8Array(eocd)];
  let ukupno = 0;
  sviDijelovi.forEach((d) => ukupno += d.length);
  const rez = new Uint8Array(ukupno);
  let p = 0;
  sviDijelovi.forEach((d) => { rez.set(d, p); p += d.length; });
  return rez;
}

/* ---- XML escape ---- */
function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

/* ---- Generiranje predloška tahimetrijskog zapisnika ---- */
function predlozakZapisnikXlsx() {
  // Stilovi: definirani u styles.xml. Indeksi:
  // 0 = default
  // 1 = naslov (bold, centar, spojeno) — plava pozadina, bijeli tekst
  // 2 = zaglavlje kolone (bold, centar, obrub, siva pozadina)
  // 3 = ćelija s obrubom (centar)
  // 4 = ćelija stanice (bold, obrub, svijetloplava)

  // Redovi podataka (zaglavlja + primjer). Svaka ćelija: {v, s}
  const kolone = ["Stanica i","Vizura","Kod","Horizontalni ugao","Zenitni ugao",
                  "Kosa dužina","Horizontalna dužina","Visina signala","Primjedba","Visina instrumenta"];

  // primjer (kao TZ): P647 stanica, jedan girus + praznine
  const primjer = [
    ["P647","P646","","254°28'48\"","89°19'50\"","76.019","","1.649","","1.694"],
    ["","83","","347°37'52\"","90°09'14\"","68.084","","1.608","",""],
    ["","83","","167°38'01\"","269°50'40\"","68.084","","1.608","",""],
    ["","P646","","74°28'46\"","270°40'11\"","76.019","","1.649","",""],
    ["","P646","","254°28'50\"","89°19'47\"","76.019","","1.649","",""],
    ["","83","","347°37'56\"","90°09'12\"","68.084","","1.608","",""],
    ["","83","","167°38'01\"","269°50'40\"","68.084","","1.608","",""],
    ["","P646","","74°28'48\"","270°40'11\"","76.019","","1.649","",""],
  ];
  // dodaj prazne redove za upisivanje
  const prazni = [];
  for (let i = 0; i < 20; i++) prazni.push(new Array(10).fill(""));
  const sviRedovi = [kolone, ...primjer, ...prazni];

  // izgradi sheetData
  const kolSlova = ["A","B","C","D","E","F","G","H","I","J"];
  let rowsXml = "";
  sviRedovi.forEach((red, ri) => {
    const rnum = ri + 2; // red 1 je naslov (spojen), podaci kreću od reda 2
    let cells = "";
    red.forEach((val, ci) => {
      const ref = kolSlova[ci] + rnum;
      const stil = (ri === 0) ? 2 : (ci === 0 && val ? 4 : 3);
      cells += `<c r="${ref}" s="${stil}" t="inlineStr"><is><t xml:space="preserve">${esc(val)}</t></is></c>`;
    });
    rowsXml += `<row r="${rnum}">${cells}</row>`;
  });
  // red 1: naslov (spojen A1:J1)
  const naslovRed = `<row r="1"><c r="A1" s="1" t="inlineStr"><is><t>TAHIMETRIJSKI ZAPISNIK</t></is></c></row>`;

  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<cols>
<col min="1" max="1" width="11"/><col min="2" max="2" width="9"/><col min="3" max="3" width="6"/>
<col min="4" max="5" width="16"/><col min="6" max="7" width="15"/><col min="8" max="8" width="12"/>
<col min="9" max="9" width="14"/><col min="10" max="10" width="16"/>
</cols>
<sheetData>${naslovRed}${rowsXml}</sheetData>
<mergeCells count="1"><mergeCell ref="A1:J1"/></mergeCells>
</worksheet>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Zapisnik" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  // Stilovi: obrubi, fontovi, boje
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="3">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="12"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FF17407A"/><name val="Calibri"/></font>
</fonts>
<fills count="4">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF1E5AA8"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFEEF4FB"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FF808080"/></left><right style="thin"><color rgb="FF808080"/></right><top style="thin"><color rgb="FF808080"/></top><bottom style="thin"><color rgb="FF808080"/></bottom></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="2" fillId="3" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="2" fillId="3" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
</cellXfs>
</styleSheet>`;

  const datoteke = [
    { ime: "[Content_Types].xml", sadrzaj: strToBytes(contentTypes) },
    { ime: "_rels/.rels", sadrzaj: strToBytes(rels) },
    { ime: "xl/workbook.xml", sadrzaj: strToBytes(workbook) },
    { ime: "xl/_rels/workbook.xml.rels", sadrzaj: strToBytes(wbRels) },
    { ime: "xl/styles.xml", sadrzaj: strToBytes(styles) },
    { ime: "xl/worksheets/sheet1.xml", sadrzaj: strToBytes(sheet) },
  ];
  return napraviZip(datoteke);
}

/* =====================================================================
   ČITANJE .xlsx u pregledniku (raspakiravanje ZIP + XML parsiranje).
   Podržava store (bez kompresije) i deflate (kompresija) — za deflate
   koristi DecompressionStream ako je dostupan.
   Vraća 2D niz redova/ćelija (tekst), kao da je CSV.
   ===================================================================== */

async function citajXlsx(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const datoteke = await raspakirajZip(bytes);

  // sharedStrings (ako postoji)
  const shared = [];
  if (datoteke["xl/sharedStrings.xml"]) {
    const txt = new TextDecoder().decode(datoteke["xl/sharedStrings.xml"]);
    const doc = new DOMParser().parseFromString(txt, "application/xml");
    doc.querySelectorAll("si").forEach((si) => {
      // spoji sve <t>
      let s = "";
      si.querySelectorAll("t").forEach((t) => { s += t.textContent; });
      shared.push(s);
    });
  }

  // nađi prvi worksheet
  let sheetIme = Object.keys(datoteke).find((k) => /^xl\/worksheets\/sheet1\.xml$/.test(k))
    || Object.keys(datoteke).find((k) => /^xl\/worksheets\/.*\.xml$/.test(k));
  if (!sheetIme) throw new Error("Excel ne sadrži radni list.");

  const sheetTxt = new TextDecoder().decode(datoteke[sheetIme]);
  const doc = new DOMParser().parseFromString(sheetTxt, "application/xml");

  const redovi = [];
  doc.querySelectorAll("row").forEach((row) => {
    const red = [];
    row.querySelectorAll("c").forEach((c) => {
      const ref = c.getAttribute("r") || "";
      const col = kolIndeks(ref);
      const t = c.getAttribute("t");
      let val = "";
      if (t === "inlineStr") {
        const is = c.querySelector("is t");
        val = is ? is.textContent : "";
      } else if (t === "s") {
        const v = c.querySelector("v");
        val = v ? (shared[parseInt(v.textContent, 10)] || "") : "";
      } else {
        const v = c.querySelector("v");
        val = v ? v.textContent : "";
      }
      red[col] = val;
    });
    // popuni rupe
    for (let i = 0; i < red.length; i++) if (red[i] === undefined) red[i] = "";
    redovi.push(red);
  });
  return redovi;
}

function kolIndeks(ref) {
  const m = /^([A-Z]+)\d+$/.exec(ref);
  if (!m) return 0;
  let s = m[1], n = 0;
  for (let i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
  return n - 1;
}

/* raspakira ZIP (store + deflate) -> {ime: Uint8Array} */
async function raspakirajZip(bytes) {
  const out = {};
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let i = 0;
  while (i + 4 <= bytes.length) {
    const sig = dv.getUint32(i, true);
    if (sig !== 0x04034b50) break; // nije više local file header
    const metoda = dv.getUint16(i + 8, true);
    const velKomp = dv.getUint32(i + 18, true);
    const velOrig = dv.getUint32(i + 22, true);
    const imeLen = dv.getUint16(i + 26, true);
    const extraLen = dv.getUint16(i + 28, true);
    const imeStart = i + 30;
    const ime = new TextDecoder().decode(bytes.subarray(imeStart, imeStart + imeLen));
    const dataStart = imeStart + imeLen + extraLen;
    const komp = bytes.subarray(dataStart, dataStart + velKomp);
    let sadrzaj;
    if (metoda === 0) {
      sadrzaj = komp;                       // store
    } else if (metoda === 8) {
      sadrzaj = await inflate(komp);        // deflate
    } else {
      sadrzaj = komp;
    }
    out[ime] = sadrzaj;
    i = dataStart + velKomp;
  }
  return out;
}

/* deflate -> bytes, koristi DecompressionStream (dostupan u modernim preglednicima) */
async function inflate(komp) {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Preglednik ne podržava čitanje kompresovanog Excela. Spremite kao CSV ili koristite noviji preglednik.");
  }
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Response(komp).body.pipeThrough(ds);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

if (typeof window !== "undefined") {
  window.XlsxGen = { predlozakZapisnikXlsx, citajXlsx };
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { predlozakZapisnikXlsx, napraviZip, citajXlsx };
}
