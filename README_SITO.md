# Nicola & Orion 2026 — sito V3

La struttura aggiornata e il flowchart sono in `DOCUMENTAZIONE_SITO_V3.md`.

Sito statico destinato a GitHub Pages. Contiene esclusivamente interfacce e
dati dichiarati pubblicabili. Il motore di raccolta deve rimanere in un
repository separato e privato.

## Dati richiesti

Inserire nella cartella `data/` i tre JSON correnti prodotti dal server:

- `surebet_tradizionali.json`
- `punta_banca_bonus.json`
- `storico_quote_attuali.json`

Copiare inoltre l'intera cartella `pubblicazione/andamento` del server nella
cartella `data/andamento` del sito. La pagina carica l'indice e, su richiesta,
il singolo evento con la cronologia completa delle variazioni.

Per il test locale avviare un server HTTP dalla cartella del repository; il
doppio clic sui file HTML non permette sempre il caricamento dei JSON.

## Versione 3

- menu unico e coerente in tutte le pagine;
- Quote bookmaker, coperture bonus e Punta-Banca riunite in `quote.html`;
- grafico storico a gradini con confronto fra più operatori;
- distinzione PUNTA/BANCA e serie minori facoltative;
- soglia pre-evento aggiornata a dodici ore;
- nessuna dipendenza JavaScript esterna.
