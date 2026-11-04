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
> `detalj.js`, `ucitavanje.js`, `obrasci.js`, `xlsx.js`, `app.js`).

## Kako se koristi

### 1. Unos podataka

Prelomni uglovi i dužine se **ne unose ručno** — računaju se iz tahimetrijskog zapisnika (TZ):

  1. Kliknite **„Preuzmi predložak (Excel)"** i u njega prebacite mjerenja (isti raspored kolona kao TZ).
  2. Kliknite **„Učitaj zapisnik"** i odaberite datoteku (.xlsx ili CSV).
  3. Aplikacija sama računa sredine iz girusa, prelomne uglove i horizontalne dužine, i upisuje
     nazive datih tačaka A, B, C, D.
  4. Upišite **koordinate (Y, X) i visine (H)** datih tačaka (ili ih zalijepite iz Excela u tablicu):
     - **A** = orijentacijska tačka pozadi, **B** = početna stanica vlaka
     - **C** = krajnja stanica vlaka, **D** = orijentacijska tačka naprijed
  5. Kliknite **„Izračunaj izravnanje"**. Bez učitanog zapisnika izračun nije moguć.

### Visinsko izravnanje (nadmorske visine)

Aplikacija računa i **nadmorske visine** tačaka (trigonometrijsko nivelanje,
obrasci 28P i K iz Excela). Da bi se visine izračunale:
  - učitajte zapisnik (sadrži **zenitne uglove** potrebne za visine), i
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

### Dozvoljena odstupanja i kontrola girusa

**Dozvoljena odstupanja** računaju se prema obrascima 2019: uglovno `20″·√(broj stranica)`, linearno
`0,03 + 0,001·√Σd + 0,00012·Σd`, visinsko `(4·Σ(d/100)/√n′ + 2)/100` uz `n′ = broj stranica − 1`,
a po stranici (TO 28P) `0,02 + 0,0004·d` [m].

**Kontrola girusa** (kartica 1, ispod učitavanja zapisnika) prikazuje redukovani ugao svakog girusa i
rasipanje. Girus koji ne želite koristiti isključite kvačicom; sredina uglova, dužina i vertikalnih uglova
računa se iz preostalih, a TO 1 i 2 prikazuje samo korištene girus-e. Obrazac TZ i dalje prikazuje sva mjerenja.
Poslije izmjene ponovo kliknite „Izračunaj".

### Zatvoren vlak

Ako vlak počinje i završava na istoj tački (npr. T809 → 69 → 70 → 71 → T809, s orijentacijom na
istu tačku na početku i na kraju), uključite **„Zatvoren vlak"** ispod tabele date tačke: tada su
C = B i D = A i popunjavaju se same, pa unosite samo A i B. Pri učitavanju zapisnika aplikacija
zatvoren vlak prepozna sama (prva i zadnja stanica imaju isti naziv). Izravnanje, visine i detalji
računaju se isto kao kod umetnutog vlaka.

**Vertikalni ugao** (TO 1V, 18D, 28P) uzima se iz **zadnjeg girusa**, zaokružen na cijelu sekundu,
kao u Excel obrascima; kose dužine su sredina iz svih girusa.

### Redukcija dužina na nultu plohu (TO 18D)

Iznad tabele prelomnih uglova bira se **redukcija dužina**:

- **Automatski** (zadano nakon učitavanja zapisnika): horizontalna dužina se množi faktorom
  `k = m₀ · (1 − Hm/R) · (1 + ym²/2R²)`, gdje je `m₀` mjerilo na srednjem meridijanu (zadano 0,9999;
  upišite 1 ako ga ne želite), `Hm` srednja visina tačaka B i C, `ym` udaljenost od srednjeg
  meridijana (iz Y koordinate), `R = 6377397 m` (Bessel). Potrebne su visine H tačaka B i C.
- **Bez redukcije**: dužine kako su izmjerene (kao u ranijem primjeru).
- **Ručno unesen faktor**: npr. `0,99992279`.

Za dužinu stranice uzima se **sredina naprijed–nazad**. Ista redukovana dužina koristi se i u
visinskom izravnanju (TO 28P, TO K), koje se tada računa bez međuzaokruživanja. Korišteni faktor
piše u sažetku rezultata i u obrascu TO 18D.

**Preporuka:** u zapisniku upisujte kose dužine i visine signala na **3 decimale** (192,232, a ne 192,23).
Zaokruživanje na cm daje razlike do nekoliko milimetara u koordinatama i visinama.

### Detaljne tačke (u istom zapisniku)

U isti tahimetrijski zapisnik možete upisati i detaljne tačke (npr. 1, 2, 3…). Na svakoj
stanici prvo idu girusna mjerenja vlaka (4 vizure po girusu), a **iza njih** redovi detaljnih
tačaka (po jedno mjerenje u I položaju). Aplikacija ih sama prepoznaje.

- Izravnanje vlaka računa se **kao i prije** — detalji ne utiču na njega.
- Nakon izračuna detalji se računaju iz izravnatih koordinata i visina stanica
  (orijentacija na zadnju tačku, polarna metoda; visina uz korekciju zakrivljenosti i refrakcije).
- Rezultat je u obrascu **„Detaljne tačke"** (kartica Geodetski obrasci; broj tačke, Y, X, H, kod), a može se izvesti i kao
  TXT preko dugmadi „Tačke vlaka (TXT)" i „Detaljne tačke (TXT)" na kartici Ispis / Izvoz.
  To su dva odvojena fajla (`tacke_vlaka.txt`, `detaljne_tacke.txt`), red po tački: `broj,Y,X,H,kod`
  (razdvojeno zarezom, decimalna tačka; kod je iz kolone Kod u zapisniku).

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
- **Detaljne tačke** — broj tačke, Y, X, H i kod (staje na A4 uspravno)
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
