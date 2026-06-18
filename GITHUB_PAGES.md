# Pubblicazione su GitHub Pages

Questi sono i file da caricare nella repository GitHub:

- `index.html`
- `styles.css`
- `script.js`
- `firebase-config.js`
- `.nojekyll`
- `README.md`
- `GITHUB_PAGES.md`

Non serve caricare `server.js` o `expenses.json` per GitHub Pages: erano utili solo per il server locale Node.js.

## Procedura

Prima di attivare GitHub Pages, la repository deve essere pubblica. Se GitHub mostra il messaggio `Upgrade or make this repository public to enable Pages`, vai su `Settings > General > Danger Zone > Change repository visibility` e cambia la visibilita in `Public`.

1. Crea una nuova repository su GitHub.
2. Carica i file elencati sopra nella root della repository.
3. Vai su `Settings`.
4. Apri `Pages`.
5. In `Build and deployment`, scegli:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
6. Salva.

Dopo qualche minuto GitHub mostrera il link pubblico della tua app.

## Aggiornare una modifica gia pubblicata

Quando modifichi il codice, non devi rifare la configurazione di Pages.

1. Apri la repository su GitHub.
2. Carica e sostituisci i file modificati.
3. Scrivi un messaggio di commit, per esempio `Aggiorna lista spese`.
4. Conferma con `Commit changes`.
5. GitHub Pages aggiorna il sito automaticamente dopo qualche minuto.

Per le modifiche recenti devi sostituire:

- `index.html`
- `script.js`
- `styles.css`

## Firebase

La sincronizzazione cloud funziona tramite Firestore usando i dati presenti in `firebase-config.js`.

Se Firebase blocca il dominio GitHub Pages:

1. Vai su Firebase Console.
2. Apri `Authentication`.
3. Vai su `Settings`.
4. In `Authorized domains`, aggiungi il dominio GitHub Pages, per esempio:

```text
nomeutente.github.io
```

Per Firestore, assicurati che le regole permettano accesso al documento `trips/vacanza`.
