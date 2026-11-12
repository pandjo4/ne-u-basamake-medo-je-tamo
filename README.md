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

Testovi pokrivaju osnovnu logiku utrka, redoslijed poteza, prekid i povratak veze, ekskluzivna ciljna mjesta, početno polje Prečice i obje kockice. Trenutno prolazi svih 28 testova.

## Važne dorade

- Igrači koji izgube vezu preskaču se u rotaciji poteza; utrka ostaje nastavljiva ako su svi privremeno van mreže.
- Polja 32 i 31 dodjeljuju se isključivo prvom i drugom mjestu.
- Prečica počinje na polju 10.
- Dvije kockice imaju odvojene prikaze i pamte oba rezultata.
- Igrači mogu napustiti sobu, a domaćin može ukloniti člana.
- Tokom utrke klik na karticu lika otvara opis njegove sposobnosti.
- Dodani su Trgovac koracima i Štedljivac; broj likova je 41.
- Početna stranica sadrži Kolekciju sa opisima svih 41 sposobnosti.
