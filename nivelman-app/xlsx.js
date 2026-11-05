/* =====================================================================
   xlsx.js — Minimalni generator/čitač Excel (.xlsx) BEZ vanjskih biblioteka.
   Pravi oblikovan predložak nivelmanskog zapisnika (obrazac N.O.1) i
   čita popunjeni .xlsx natrag u 2D niz redova.
   .xlsx je ZIP arhiva s XML datotekama (ovdje: store, bez kompresije).
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
  const chunks = [], central = [];
  let offset = 0;
  const u16 = (n) => [n & 255, (n >> 8) & 255];
  const u32 = (n) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255];

  datoteke.forEach((f) => {
    const imeBytes = strToBytes(f.ime);
    const crc = crc32(f.sadrzaj);
    const velicina = f.sadrzaj.length;
    const lh = [].concat(
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(velicina), u32(velicina), u16(imeBytes.length), u16(0));
    chunks.push(new Uint8Array(lh), imeBytes, f.sadrzaj);
    const ch = [].concat(
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(velicina), u32(velicina),
      u16(imeBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset));
    central.push({ header: new Uint8Array(ch), ime: imeBytes });
    offset += lh.length + imeBytes.length + velicina;
  });

  let centralSize = 0; const centralChunks = [];
  central.forEach((c) => { centralChunks.push(c.header, c.ime); centralSize += c.header.length + c.ime.length; });
  const eocd = [].concat(u32(0x06054b50), u16(0), u16(0),
    u16(datoteke.length), u16(datoteke.length), u32(centralSize), u32(offset), u16(0));
  const sviDijelovi = [...chunks, ...centralChunks, new Uint8Array(eocd)];
  let ukupno = 0; sviDijelovi.forEach((d) => ukupno += d.length);
  const rez = new Uint8Array(ukupno);
  let p = 0; sviDijelovi.forEach((d) => { rez.set(d, p); p += d.length; });
  return rez;
}

function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

/* ---- Predložak nivelmanskog zapisnika (obrazac N.O.1) ---- */
function predlozakZapisnikXlsx() {
  // Stilovi:  1=naslov  2=zaglavlje kolone  3=ćelija s obrubom  4=ćelija dionice
  const kolone = ["Smjer","OD","DO","Vezna zad.","Vezna pred.","Odstojanje (m)",
                  "Zad 1","Pred 1","Zad 2","Pred 2","Primjedba"];

  // Primjer (po originalnom Excelu, nivelman NAPRIJED):
  // R100 → a → b → c → R101 → a → R102 → a → R50.
  // Reperi su velikim R/P, vezne tačke malim slovima — dionice se prepoznaju same.
  const primjer = [
    // Smjer, OD, DO, VeznaZad, VeznaPred, Odst, Zad1, Pred1, Zad2, Pred2, Primjedba
    ["naprijed","R100","","R100","a","23","1.587","1.704","1.608","1.725",""],
    ["","","","a","b","27","1.823","2.483","1.869","2.531",""],
    ["","","","b","c","27","1.827","2.515","1.867","2.557",""],
    ["","","","c","R101","24","1.410","1.471","1.437","1.499","kraj 1. dionice"],
    ["","","","R101","a","26","1.879","2.302","1.908","2.331",""],
    ["","","","a","R102","12","1.984","2.489","2.002","2.507","kraj 2. dionice"],
    ["","","","R102","a","14","1.531","1.657","1.544","1.671",""],
    ["","","","a","R50","12","1.024","1.207","1.043","1.227","kraj 3. dionice"],
  ];
  const prazni = [];
  for (let i = 0; i < 24; i++) prazni.push(new Array(11).fill(""));
  const sviRedovi = [kolone, ...primjer, ...prazni];

  const kolSlova = ["A","B","C","D","E","F","G","H","I","J","K"];
  let rowsXml = "";
  sviRedovi.forEach((red, ri) => {
    const rnum = ri + 2;
    let cells = "";
    red.forEach((val, ci) => {
      const ref = kolSlova[ci] + rnum;
      const stil = (ri === 0) ? 2 : (ci <= 2 && val ? 4 : 3);
      cells += `<c r="${ref}" s="${stil}" t="inlineStr"><is><t xml:space="preserve">${esc(val)}</t></is></c>`;
    });
    rowsXml += `<row r="${rnum}">${cells}</row>`;
  });
  const naslovRed = `<row r="1"><c r="A1" s="1" t="inlineStr"><is><t>NIVELMANSKI ZAPISNIK — obrazac N.O.1</t></is></c></row>`;

  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<cols>
<col min="1" max="1" width="11"/><col min="2" max="3" width="9"/>
<col min="4" max="5" width="11"/><col min="6" max="6" width="13"/>
<col min="7" max="10" width="9"/><col min="11" max="11" width="14"/>
</cols>
<sheetData>${naslovRed}${rowsXml}</sheetData>
<mergeCells count="1"><mergeCell ref="A1:K1"/></mergeCells>
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
<sheets><sheet name="N.O.1" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;
  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
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

/* ================== ČITANJE .xlsx → 2D niz redova ================== */
async function citajXlsx(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const datoteke = await raspakirajZip(bytes);

  const shared = [];
  if (datoteke["xl/sharedStrings.xml"]) {
    const txt = new TextDecoder().decode(datoteke["xl/sharedStrings.xml"]);
    const doc = new DOMParser().parseFromString(txt, "application/xml");
    doc.querySelectorAll("si").forEach((si) => {
      let s = ""; si.querySelectorAll("t").forEach((t) => { s += t.textContent; });
      shared.push(s);
    });
  }
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
      if (t === "inlineStr") { const is = c.querySelector("is t"); val = is ? is.textContent : ""; }
      else if (t === "s") { const v = c.querySelector("v"); val = v ? (shared[parseInt(v.textContent, 10)] || "") : ""; }
      else { const v = c.querySelector("v"); val = v ? v.textContent : ""; }
      red[col] = val;
    });
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

async function raspakirajZip(bytes) {
  const out = {};
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let i = 0;
  while (i + 4 <= bytes.length) {
    const sig = dv.getUint32(i, true);
    if (sig !== 0x04034b50) break;
    const metoda = dv.getUint16(i + 8, true);
    const velKomp = dv.getUint32(i + 18, true);
    const imeLen = dv.getUint16(i + 26, true);
    const extraLen = dv.getUint16(i + 28, true);
    const imeStart = i + 30;
    const ime = new TextDecoder().decode(bytes.subarray(imeStart, imeStart + imeLen));
    const dataStart = imeStart + imeLen + extraLen;
    const komp = bytes.subarray(dataStart, dataStart + velKomp);
    let sadrzaj;
    if (metoda === 0) sadrzaj = komp;
    else if (metoda === 8) sadrzaj = await inflate(komp);
    else sadrzaj = komp;
    out[ime] = sadrzaj;
    i = dataStart + velKomp;
  }
  return out;
}

async function inflate(komp) {
  if (typeof DecompressionStream === "undefined")
    throw new Error("Preglednik ne podržava čitanje kompresovanog Excela. Spremite kao CSV ili koristite noviji preglednik.");
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
