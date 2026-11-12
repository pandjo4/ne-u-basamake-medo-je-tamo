# NE U BASAMAKE, MEDO JE TAMO

Multiplayer fantasy racing board game built with Node.js, Express and Socket.IO.

## Pokretanje lokalno

```bash
npm install
npm start
```

Server podrazumijevano radi na portu `3000`. Otvori `http://localhost:3000` u pregledniku. Za multiplayer, svi igrači se spajaju na istu javnu adresu i isti kod sobe.

## Kako se igra

1. Domaćin kreira sobu, a ostali se pridružuju kodom.
2. Svi igrači označe da su spremni.
3. Igrači naizmjenično biraju stvorenje za svaku utrku.
4. Nakon izbora slijedi faza **raspoređivanja**. Svaki igrač može pomjerati svoje kartice gore/dolje i odrediti kojim redoslijedom će ih koristiti.
5. Utrka počinje tek kada svi igrači potvrde raspored.
6. Nakon svake utrke prikazuje se tabela plasmana, bodova iz te utrke i ukupnih bodova.
7. Kretanje po stazi animira se polje po polje.

## Deploy na Render

Projekat je spreman za Node servis. `render.yaml` definiše komandu za pokretanje, a aplikacija koristi `process.env.PORT`.

## Testovi

```bash
npm test
```

Testovi pokrivaju osnovnu logiku utrka, poteze i karakteristike stvorenja.
