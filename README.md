# Split Vacanza

L'app puo funzionare in tre modi:

1. Firebase Firestore: consigliato per usarla fuori casa e sincronizzare dispositivi diversi via internet.
2. Server locale Node.js: utile sulla stessa rete Wi-Fi, senza cloud.
3. Modalita locale: salva solo nel browser quando non trova nessun backend.

## Opzione consigliata: Firebase

### 1. Crea il progetto

1. Vai su `https://console.firebase.google.com/`.
2. Crea un nuovo progetto.
3. Google Analytics puo restare disattivato per questa app.

### 2. Registra una Web App

1. Nel progetto Firebase, premi l'icona Web `</>`.
2. Dai un nome all'app, per esempio `Split Vacanza`.
3. Copia l'oggetto `firebaseConfig`.
4. Incolla i valori nel file `firebase-config.js`.

### 3. Crea Firestore

1. Vai su `Firestore Database`.
2. Premi `Create database`.
3. Scegli una posizione vicina, per esempio una regione europea.
4. Per una prova rapida puoi partire in test mode, poi sostituisci le regole con quelle sotto.

### 4. Regole Firestore minime

Queste regole permettono di leggere e scrivere solo il documento della vacanza usato dall'app:

```text
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /trips/vacanza {
      allow read, write: if true;
    }
  }
}
```

Nota: queste regole sono semplici e adatte a una condivisione privata del link tra due persone. Se vuoi pubblicare l'app o proteggerla con login, conviene aggiungere Firebase Authentication.

### 5. Pubblicazione

Per usarla ovunque, carica i file statici su un hosting:

- Firebase Hosting
- Netlify
- GitHub Pages
- Vercel

Con Firebase configurato, non serve tenere acceso il PC.

## Fallback: server locale Node.js

Apri un terminale nella cartella `outputs` ed esegui:

```powershell
node server.js
```

Poi apri:

```text
http://127.0.0.1:5178/index.html
```

Se siete sulla stessa rete Wi-Fi, l'altra persona puo aprire:

```text
http://TUO-IP:5178/index.html
```
