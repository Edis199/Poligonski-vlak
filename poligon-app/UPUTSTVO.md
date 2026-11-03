# Izravnanje poligonskog vlaka — web aplikacija

Aplikacija za **izravnanje umetnutog (priključnog) poligonskog vlaka**, napravljena
na osnovu originalnog Excel programa. Radi **offline u pregledniku** — ništa se
ne instalira.

## Kako pokrenuti

1. Preuzmite cijelu mapu `poligon-app` (sve datoteke zajedno).
2. Dvoklik na **`index.html`** — otvorit će se u vašem pregledniku (Chrome, Edge, Firefox).
3. To je sve — aplikacija radi bez interneta.

> Važno: držite sve 4 datoteke (`index.html`, `stil.css`, `racun.js`, `app.js`)
> zajedno u istoj mapi.

## Kako se koristi

### 1. Unos podataka
- Unesite **date (poznate) tačke**:
  - **A** = orijentacijska tačka pozadi, **B** = početna stanica vlaka
  - **C** = krajnja stanica vlaka, **D** = orijentacijska tačka naprijed
- Odaberite **broj prelomnih uglova** (2–15) i kliknite **"Generiraj tabelu"**.
- Unesite **prelomne uglove** u obliku `SSS.MMSS`
  (npr. `237.2509` znači 237°25′09″).
- Unesite **dužine stranica** (horizontalne dužine, u metrima).
  Dužina ima za jedan manje nego prelomnih uglova.
- Kliknite **"Izračunaj izravnanje"**.

Dugme **"Učitaj primjer iz Excela"** popuni date tačke iz originalnog Excela
(uglovi i dužine su ilustrativni — zamijenite ih svojim mjerenjima).

### 2. Rezultati
Prikazuje:
- **Kutno odstupanje fβ** i dopuštenu vrijednost (zeleno/crveno)
- **Linearno odstupanje f_d** i dopuštenu vrijednost
- Mjerene i popravljene prelomne uglove
- Direkcijske uglove, priraštaje Δy/Δx i popravke
- **Konačne koordinate** svih tačaka + kontrolu zatvaranja

### 3. Grafički prikaz
Crtež vlaka: date tačke (crveni trokut), nove tačke (zeleni kružić).

### 4. Ispis / Izvoz
- **Izvoz u Excel (CSV)** — sprema tabelu koordinata (Excel je otvara direktno).
- **Ispis / Spremi u PDF** — otvara dijalog štampe; odaberite "Spremi kao PDF".

## Formule (iz originalnog Excela)

- Pretvorba ugla `SSS.MMSS` → decimalni stupnjevi
- Direkcijski ugao iz koordinata (kvadrantna `ATAN` formula)
- Kutno zatvaranje: `fβ = "treba" − "ima"`, popravak = `fβ / n`
- Dopušteno kutno odstupanje: `4.5″ · √n`
- Priraštaji: `Δy = d·sin(α)`, `Δx = d·cos(α)`
- Linearno zatvaranje: `f_d = √(f_y² + f_x²)`
- Dopušteno linearno: `0.0045·√Σd + 0.0003·Σd + 0.05`
- Raspored popravaka proporcionalno dužini stranice

## Napomena

Trenutno je podržan **umetnuti (priključni) vlak**. Struktura je pripremljena
tako da se kasnije mogu dodati **zatvoreni** i **slijepi** vlak.
