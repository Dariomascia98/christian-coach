# MISURA — guida alla pubblicazione (gratis, senza Claude)

Questa versione dell'app è uguale a quella che hai già provato, ma usa un vero database (Supabase, gratuito) invece dello storage di Claude, e va pubblicata su un vero sito (Vercel, gratuito). Una volta online, i tuoi clienti apriranno un link normale — non serve un account Claude.

Metti in conto **20-30 minuti** la prima volta. Segui i passaggi nell'ordine.

---

## 1. Crea il database (Supabase)

1. Vai su **supabase.com** → "Start your project" → registrati (puoi usare GitHub o email).
2. Crea un nuovo progetto: dagli un nome (es. "misura"), scegli una password per il database (salvala da parte, non serve altrove) e una regione vicina a te (es. Europa).
3. Aspetta 1-2 minuti che il progetto sia pronto.
4. Nel menu a sinistra vai su **SQL Editor** → **New query**.
5. Apri il file `supabase/schema.sql` incluso in questo progetto, copia **tutto** il contenuto, incollalo nell'editor e premi **Run**. Questo crea le tabelle e le regole di sicurezza.
6. Vai su **Authentication → Providers → Email** e **disattiva "Confirm email"**. È un passaggio importante: senza questo, la creazione degli account non funziona (l'app usa username finti al posto delle email, che non possono ricevere una mail di conferma).
7. Vai su **Project Settings → API**. Da qui ti servono tre valori per dopo:
   - **Project URL** (es. `https://xxxxx.supabase.co`)
   - **anon public key**
   - **service_role key** (sotto "Project API keys" — tienila segreta, non va mai nel browser)

## 2. Carica il progetto su GitHub

1. Vai su **github.com** e registrati se non hai già un account.
2. Clicca **New repository**, chiamalo ad esempio `misura-app`, lascialo privato o pubblico (indifferente), crealo.
3. Nella pagina del repository, clicca **"uploading an existing file"** (o il tasto "Add file → Upload files").
4. Trascina dentro **tutti i file e le cartelle** di questo progetto (tranne `node_modules`, che non esiste ancora) e conferma il commit.

## 3. Pubblica su Vercel

1. Vai su **vercel.com** → registrati con l'account GitHub appena usato.
2. Clicca **Add New → Project**, seleziona il repository `misura-app` che hai appena caricato.
3. Vercel riconosce automaticamente che è un progetto Vite: lascia le impostazioni di build come sono.
4. **Prima di premere "Deploy"**, apri la sezione **Environment Variables** e aggiungi queste 5 righe (con i valori reali presi da Supabase al punto 1.7):

   | Nome | Valore |
   |---|---|
   | `VITE_SUPABASE_URL` | il tuo Project URL |
   | `VITE_SUPABASE_ANON_KEY` | la tua anon public key |
   | `SUPABASE_URL` | lo stesso Project URL |
   | `SUPABASE_ANON_KEY` | la stessa anon public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | la tua service_role key |

5. Premi **Deploy**. Dopo un minuto avrai un link tipo `misura-app.vercel.app` — è il tuo sito, pronto da condividere.

## 4. Primo utilizzo

1. Apri il link Vercel.
2. Tocca **"Crea un account trainer"**, compila i campi: questo sarà il tuo accesso.
3. Da lì puoi aggiungere clienti (username e password che scegli tu per loro) e condividere con ognuno lo stesso link — ogni cliente farà login con le proprie credenziali.

---

## Cose da sapere

- **Il piano gratuito di Supabase mette in pausa i progetti dopo 7 giorni senza uso.** Se non apri l'app per una settimana, al rientro potresti dover andare sulla dashboard Supabase e premere "Resume/Restore" sul progetto. I dati non si perdono, solo il progetto va "risvegliato".
- **Le password dei clienti sono gestite da Supabase Auth**, quindi sono salvate in modo sicuro (mai in chiaro), a differenza della versione precedente su Claude.
- Se vuoi modificare qualcosa nell'app in futuro, basta editare i file (soprattutto `src/App.jsx`) e ricaricare su GitHub — Vercel ripubblica automaticamente a ogni aggiornamento del repository.
- Se qualcosa non funziona in fase di pubblicazione, il primo posto dove guardare è **Vercel → il tuo progetto → Deployments → (ultimo deploy) → Logs**: lì si vede l'errore esatto.
