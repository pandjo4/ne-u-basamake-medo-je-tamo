# MAGICAL ATHLETE — Fantastična utrka

Multiplayer društvena igra utrkivanja po tabli. Server je izgrađen na Node.js i Socket.IO, a stanje utrke i bacanje kockice obrađuju se na serveru.

## Pokretanje na računaru

Potrebna je Node.js verzija 18 ili novija.

```bash
npm install
npm start
```

Zatim otvori `http://localhost:3000` u najmanje dva prozora preglednika. U jednom prozoru kreiraj sobu, a u ostalima se pridruži pomoću šest znakova koda sobe.

## Objavljivanje na GitHub + Render

1. Raspakuj ZIP i postavi **sadržaj foldera `magical-athlete`** u GitHub repozitorij.
2. Na Renderu izaberi **New → Web Service** i poveži taj repozitorij.
3. Kao okruženje izaberi **Node**.
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Ne moraš ručno postavljati `PORT`; Render ga dodjeljuje automatski.
7. Nakon objave otvori Render adresu i podijeli kod sobe s ostalim igračima.

Render servis mora biti Web Service, ne Static Site, jer igra koristi Node.js i Socket.IO server.

## Provjera rada

- `GET /health` vraća JSON odgovor `{ "ok": true }`.
- `npm test` pokreće automatske testove pravila igre.
- `npm start` pokreće server na `0.0.0.0` i Renderovom `PORT` portu.

## Struktura projekta

- `public/index.html` — ekrani i HTML interfejs.
- `public/style.css` — izgled i prilagođavanje mobilnim ekranima.
- `public/game.js` — Socket.IO klijent i prikaz igre.
- `public/pictures/` — ilustracije 40 likova.
- `server/server.js` — sobe, predvorje, izbor likova, multiplayer i ponovno povezivanje.
- `server/gameLogic.js` — kretanje, bacanje kockice, bodovanje i posebne sposobnosti.
- `server/characters.js` — spisak likova i opisi njihovih sposobnosti.
- `test/gameLogic.test.js` — automatski testovi.

## Važne napomene

- Igra podržava 2–6 igrača i 3–5 utrka.
- Sobe i rezultati čuvaju se u memoriji servera. Ako se Render proces ponovo pokrene ili ugasi, aktivne sobe se brišu. Za trajne profile i historiju potrebna je baza podataka.
- Ponovno povezivanje radi dok soba postoji u memoriji servera.
- Dugme za zvuk je samo vizuelni element; zvučni efekti i muzika nisu uključeni.
- Pojedine posebne sposobnosti imaju pojednostavljena pravila radi balansa. Prije takmičarske upotrebe pregledaj `server/gameLogic.js`.

## Sigurnost

Bacanje kockice, kretanje, redoslijed završetka i bodovanje obrađuje server. Klijent šalje samo zahtjev za akciju, a server provjerava čiji je potez i da li je izabrani lik dostupan.
