# Izravnanje nivelmanskog vlaka — web aplikacija

Aplikacija za **izravnanje umetnutog nivelmanskog vlaka** (geometrijski nivelman),
napravljena na osnovu originalnog Excel programa (obrasci **N.O.1, N.O.2, N.O.3**).
Radi **offline u pregledniku** — ništa se ne instalira.

Dio je paketa **Geodetske mreže** (zajedno s aplikacijom za poligonsku mrežu).
Na početnoj stranici (`../index.html`) bira se vrsta mreže.

## Kako pokrenuti

1. Otvorite `index.html` iz mape **Geodetske mreže** i odaberite **Nivelmanska mreža**,
   ili direktno dvoklik na `nivelman-app/index.html`.
2. Radi bez interneta, u pregledniku (Chrome, Edge, Firefox).

> Držite **sve datoteke** zajedno u mapi `nivelman-app`
> (`index.html`, `stil.css`, `racun.js`, `ucitavanje.js`, `obrasci.js`, `xlsx.js`, `app.js`).

## Kako se koristi

### 1. Unos podataka

1. Kliknite **„Preuzmi predložak (Excel)"** — dobijete prazan obrazac **N.O.1**.
2. U predložak prebacite čitanja letvi (jedan red = jedna stanica nivelmana).
3. Kliknite **„Učitaj zapisnik"** i odaberite datoteku (.xlsx ili CSV).
4. Upišite **nadmorske visine H** datih repera:
   - **Početni reper** (obavezno),
   - **Završni reper** (obavezno — umetnuti vlak ima oba repera data).
5. Kliknite **„Izračunaj izravnanje"**.

### Format zapisnika N.O.1

Kolone predloška:
`Smjer ; OD ; DO ; Vezna zad. ; Vezna pred. ; Odstojanje ; Zad 1 ; Pred 1 ; Zad 2 ; Pred 2 ; Primjedba`

- **Smjer** = `naprijed` ili `nazad` (upisuje se samo u prvom redu smjera; prazno = nasljeđuje se).
- **OD / DO** = reperi dionice (mogu se upisati, ali se i **prepoznaju automatski** — vidi niže).
- Svaki red mjerenja = jedna stanica: zadnja (nazad) i prednja (naprijed) letva.
  - **Zad 1 / Pred 1** = čitanja na 1. podjeli letve (lijeva skala),
  - **Zad 2 / Pred 2** = čitanja na 2. podjeli letve (desna skala).
  - Visinska razlika stanice = (zadnja − prednja), sredina dvije podjele.
- **Odstojanje** = dužina stanice [m] (za računanje dužine dionice i dozvoljenog odstupanja).

### Reperi i vezne tačke (automatsko dijeljenje na dionice)

- **Reperi** se označavaju **velikim slovom R ili P** (npr. `R100`, `R101`, `P50`).
- **Vezne tačke** se označavaju **malim slovima abecede** (`a`, `b`, `c`, …).

Aplikacija na osnovu toga **sama prepoznaje granice dionica**: kad je prednja vezna
tačka reper (R/P), to je kraj dionice i početak sljedeće. Zato OD/DO ne morate upisivati
ručno u svaki red — dovoljno je dosljedno označavanje repera velikim R/P.

### Dvostrani nivelman (naprijed i nazad)

Ako dionicu mjerite i naprijed i nazad, upišite oba smjera (kolona **Smjer**).
Nazad se mjeri u suprotnom smjeru; aplikacija spaja naprijed i nazad za isti par
repera i u **N.O.2** računa odstupanje i srednju visinsku razliku. Ako mjerite samo
jednim smjerom, srednja razlika = mjerena razlika tog smjera.

### 2. Rezultati

Prikazuje sažetak (broj dionica, ukupna dužina, zatvaranje f_h s dopuštenom
vrijednošću) i obrasce **N.O.2** i **N.O.3** te spisak nadmorskih visina.

### 3. Nivelmanski obrasci

- **N.O.1** — nivelmanski zapisnik (čitanja letvi, visinske razlike po stanicama)
- **N.O.2** — poređenje nivelmana naprijed/nazad (odstupanje Δ, dozvoljeno, srednja razlika)
- **N.O.3** — izravnanje vlaka (popravke, definitivne visinske razlike, nadmorske visine)
- **Spisak visina** — nadmorske visine svih repera

Svaki obrazac ispisuje se pojedinačno ili svi odjednom (svaki na zaseban A4).

### 4. Ispis / Izvoz

- **Nadmorske visine (TXT)** — red po reperu: `naziv,H`.
- **Ispis / Spremi u PDF** — otvara dijalog štampe.

## Formule (iz originalnog Excela)

- Visinska razlika stanice: `Δh = zadnja − prednja`, sredina dvije podjele letve.
- Odstupanje naprijed/nazad po dionici: `Δ = (Δh'p − Δh'n)·1000` [mm].
- Dozvoljeno odstupanje po dionici: `32·√(S + 0.06·S²)` [mm], S u km (srednja dužina).
- Srednja visinska razlika: `Δh_sred = (Δh'p + Δh'n) / 2`.
- Zatvaranje vlaka: `f_h = (H_poč + ΣΔh_sred) − H_kraj`.
- Dozvoljeno zatvaranje: `32·√(ΣS)` [mm], ΣS u km.
- Popravka po dionici: `V_n = −(f_h / ΣS)·S_i` (proporcionalno dužini dionice).
- Definitivna visinska razlika: `h_n = Δh_sred + V_n`.
- Nadmorska visina: `H_n = H_prethodni + h_n`.

## Napomena

Podržan je **umetnuti** nivelmanski vlak (oba repera data). Zatvoreni vlak dolazi naknadno.

---
Izradio: Malanović Edis
