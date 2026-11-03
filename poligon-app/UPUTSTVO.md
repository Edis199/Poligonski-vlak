# Izravnanje poligonskog vlaka — web aplikacija

Aplikacija za **izravnanje umetnutog (priključnog) poligonskog vlaka**, napravljena
na osnovu originalnog Excel programa. Radi **offline u pregledniku** — ništa se
ne instalira.

## Kako pokrenuti

1. Preuzmite cijelu mapu `poligon-app` (sve datoteke zajedno).
2. Dvoklik na **`index.html`** — otvorit će se u vašem pregledniku (Chrome, Edge, Firefox).
3. To je sve — aplikacija radi bez interneta.

> Važno: držite **sve datoteke** zajedno u istoj mapi
> (`index.html`, `stil.css`, `racun.js`, `girus.js`, `visine.js`,
> `ucitavanje.js`, `obrasci.js`, `xlsx.js`, `app.js`).

## Kako se koristi

### 1. Unos podataka

Date (poznate) tačke unesite ručno:
  - **A** = orijentacijska tačka pozadi, **B** = početna stanica vlaka
  - **C** = krajnja stanica vlaka, **D** = orijentacijska tačka naprijed

Prelomne uglove i dužine možete unijeti na **dva načina**:

**Način 1 — učitavanje iz tahimetrijskog zapisnika (CSV):**
  1. Kliknite **"Preuzmi predložak (CSV)"**.
  2. Otvorite predložak u Excelu, kopirajte mjerenja iz totalke i spremite
     kao CSV (`Datoteka → Spremi kao → CSV`).
  3. Kliknite **"Učitaj zapisnik (CSV)"** i odaberite datoteku.
  4. Aplikacija sama računa sredine iz girusa, prelomne uglove i
     horizontalne dužine, te popuni tabelu.

**Način 2 — ručni unos:**
  - Odaberite **broj prelomnih uglova** (2–15) → **"Generiraj tabelu"**.
  - Uglove unesite kao `57°25'08"` **ili** kao `57.2508`.
  - Dužine (horizontalne, u metrima) — ima ih za jedan manje od uglova.

Na kraju kliknite **"Izračunaj izravnanje"**.

### Visinsko izravnanje (nadmorske visine)

Aplikacija računa i **nadmorske visine** tačaka (trigonometrijsko nivelanje,
obrasci 28P i K iz Excela). Da bi se visine izračunale:
  - učitajte zapisnik iz CSV-a (sadrži **zenitne uglove** potrebne za visine), i
  - unesite **nadmorsku visinu H** za početnu stanicu (B) i krajnju stanicu (C).

Rezultat prikazuje visinske razlike (naprijed/nazad/sredina), popravke,
zatvaranje visina f_h s dopuštenom vrijednošću, i konačne nadmorske visine.
Visine se uključuju i u izvoz (CSV).

### Format zapisnika (girusna metoda)

Jedan girus = 4 reda redom:
  1. **zadnja** (I položaj / krug lijevo)
  2. **prednja** (I položaj)
  3. **prednja** (II položaj / krug desno)
  4. **zadnja** (II položaj)

Dozvoljeno je 1, 2 ili 3 girusa po stanici (4, 8 ili 12 redova).
Stanicu i visinu instrumenta upišite **samo u prvom redu** svake stanice
(ostali redovi te stanice ostaju prazni u tim stupcima).

Stupci predloška:
`Stanica ; VisinaInstrumenta ; Vizura ; Kod ; HorizontalniUgao ;
ZenitniUgao ; KosaDuzina ; VisinaSignala`

### 2. Rezultati
Prikazuje:
- **Kutno odstupanje fβ** i dopuštenu vrijednost (zeleno/crveno)
- **Linearno odstupanje f_d** i dopuštenu vrijednost
- Mjerene i popravljene prelomne uglove
- Direkcijske uglove, priraštaje Δy/Δx i popravke
- **Konačne koordinate** svih tačaka + kontrolu zatvaranja

### 3. Grafički prikaz
Crtež vlaka: date tačke (crveni trokut), nove tačke (zeleni kružić).

### 4. Geodetski obrasci

Službeni obrasci, popunjeni rezultatima izravnanja, vjerno originalnim Excel
shetovima. Dostupni su svi obrasci:

- **TZ** — Tahimetrijski zapisnik (učitana mjerenja)
- **TO 1 i 2** — Girusno mjerenje horizontalnih pravaca
- **TO 1V** — Vertikalni (zenitni) uglovi
- **TO 18D** — Redukcija dužina
- **TO 8** — Direkcioni uglovi i odstojanja iz koordinata
- **TO 19** — Izravnanje (koordinate)
- **TO 28P** — Trigonometrijska nivelacija (visinske razlike)
- **TO K** — Izravnanje visina (nadmorske visine)
- **TO 25** — Spisak koordinata i nadmorskih visina

Svaki se obrazac može ispisati pojedinačno, ili svi odjednom
(**„Ispiši SVE obrasce"**) — svaki ide na zaseban A4 list, s automatskom
numeracijom strana (npr. „Strana 2 / 3") kad obrazac prelazi na sljedeću stranu.

### 5. Ispis / Izvoz
- **Izvoz u Excel (CSV)** — sprema tabelu koordinata (Excel je otvara direktno).
- **Ispis / Spremi u PDF** — otvara dijalog štampe; odaberite „Spremi kao PDF".

## Formule (iz originalnog Excela)

- Pretvorba ugla `SSS.MMSS` → decimalni stupnjevi
- Direkcijski ugao iz koordinata (kvadrantna `ATAN` formula)
- Kutno zatvaranje: `fβ = "treba" − "ima"`, popravak = `fβ / n`
- Dopušteno uglovno odstupanje: `45″ · √n` (n = broj prelomnih i veznih uglova)
- Priraštaji: `Δy = d·sin(α)`, `Δx = d·cos(α)`
- Linearno zatvaranje: `f_d = √(f_y² + f_x²)`
- Dopušteno linearno: `0.0045·√Σd + 0.0003·Σd + 0.05`
- Raspored popravaka proporcionalno dužini stranice

## Napomena

Trenutno je podržan **umetnuti (priključni) vlak**. Struktura je pripremljena
tako da se kasnije mogu dodati **zatvoreni** i **slijepi** vlak.
