# Da prototipo a servizio vendibile

Piano operativo. Ogni fase dice **chi** fa cosa, **cosa serve procurare**, e **quale
decisione sblocca**. Le fasi sono in ordine di dipendenza: la 1 decide se vale la
pena fare la 2.

Stato al momento della scrittura: il codice compila, 110 test passano, il flusso
utente è verificato in browser contro un modello simulato. **Il loop di
generazione non è mai stato eseguito con un modello vero.**

---

## FASE 0 — Sbloccare l'esecuzione

**Chi:** tu. **Tempo:** un'ora. **Costo:** ~20–50 € per iniziare.

| Cosa serve | Dove | Note |
|---|---|---|
| Chiave modello | console.anthropic.com · platform.openai.com · aistudio.google.com · console.groq.com | Una basta. Pagamento a consumo, nessun minimo |
| Sandbox | e2b.dev (più semplice) oppure Vercel Sandbox | E2B ha un piano gratuito per iniziare |
| Firecrawl | firecrawl.dev | Solo per "ricostruisci un sito". Rimandabile |

Nell'ambiente cloud di questa sessione servono anche:
- la chiave come **variabile d'ambiente** (impostazioni ambiente → Edit), mai incollata in chat;
- `api.e2b.app` fra i **domini consentiti** in Network access.

**Sblocca:** la prima build vera.

---

## FASE 1 — Scoprire se il prodotto esiste

**Chi:** io eseguo, tu giudichi. **Tempo:** mezza giornata.

1. Una build reale da descrizione, end to end.
2. Guardare l'app che esce. È utilizzabile o è una demo che si sfalda al secondo click?
3. Se è scarsa: iterare sui prompt e sugli archetipi. Qui si vince o si perde.
4. Misurare il **costo reale di una build**: token consumati + minuti di sandbox.

**Decisione:** se dopo qualche iterazione l'output non è convincente, il problema
non è l'infrastruttura ed è inutile costruirci sopra. Se lo è, si continua.

> Senza il numero del costo per build, il pricing di `config/plans.config.ts` è
> indovinato. 29 €/mese per 200 build regge solo se una build costa meno di ~10 ¢.

---

## FASE 2 — Renderlo esercibile

**Chi:** io, interamente. Non dipende da niente di esterno.

| Cosa | Perché blocca |
|---|---|
| Togliere lo stato globale | 18 rotte tengono il sandbox in una variabile di processo: **una build concorrente per istanza**. Non è scalabile |
| CI | Nessuna pipeline: test e build girano solo a mano |
| Osservabilità | 215 `console.log`, zero error tracking. In produzione saresti cieco |
| Contabilità costi | Registrare token e minuti per build, altrimenti il margine è ignoto |
| Test sul motore | Parser, intent analyzer e sandbox layer vengono da upstream e hanno zero test. È il 42% del codice |

---

## FASE 3 — Incassare

**Chi:** io scrivo il codice, tu procuri gli account.

| Cosa serve | Come ottenerlo | Nota |
|---|---|---|
| Account Stripe | stripe.com | Serve un'identità fiscale: persona fisica o società |
| Partita IVA / entità | Commercialista | In Italia: SRLS o ditta individuale. Sentire un commercialista **prima** di incassare |
| Gestione IVA | Stripe Tax | Vendere software in UE significa MOSS/OSS |

Il codice (checkout, webhook firmato, portale clienti, sincronizzazione piani) si
scrive e si testa senza chiavi vere: Stripe ha una modalità test completa.

---

## FASE 4 — Operare

**Chi:** misto. **Costo:** ~40–80 €/mese all'inizio.

| Cosa | Dove | Costo indicativo |
|---|---|---|
| Hosting | Vercel, Fly.io, Railway | 20 €/mese |
| Database gestito | Turso | Piano gratuito generoso |
| Dominio | qualsiasi registrar | 15 €/anno |
| Error tracking | Sentry | Piano gratuito |
| Backup + ripristino | procedura scritta e **provata** | — |

Legale, da fare prima di avere clienti paganti:
- Privacy policy e Termini **rivisti da un legale** — quelli nel repo sono un
  modello da adattare, non un documento valido.
- DPA per clienti business.
- Registro dei trattamenti se sei in UE.

---

## FASE 5 — Mercato

**Chi:** solo tu. È la fase che nessuno può delegare.

1. Venti utenti veri. Non amici: gente che ha il problema.
2. Guardarli usarlo. Dove si bloccano, cosa non capiscono.
3. Tornano una seconda volta? È l'unica metrica che conta all'inizio.
4. Costo per utente vs prezzo. Il margine esiste o no.

**Solo dopo** ha senso parlare con un fondo. A questo stadio un investitore
compra team, intuizione e trazione iniziale — non un repository.

---

## Il contesto competitivo, detto chiaramente

Lovable, v0, Bolt e Replit Agent fanno questo, hanno raccolto centinaia di
milioni e spediscono ogni settimana. Il README del progetto originale rimanda
esplicitamente a Lovable per la versione cloud.

Competere frontalmente non è realistico. Le strade praticabili sono due:

- **Verticalizzare** — non "costruisci qualsiasi app" ma un dominio specifico
  dove gli archetipi e i dati di esempio valgono davvero (gestionali di
  settore, strumenti interni per una nicchia).
- **Self-hosted** — chi non può mandare il proprio codice a un SaaS esterno.
  La licenza MIT e l'installazione senza dipendenze esterne rendono questa
  strada già percorribile.

La differenza tecnica reale rispetto agli incumbent è la **pianificazione prima
della generazione**: il blueprint approvabile. È un vantaggio se il mercato lo
percepisce come tale, e la Fase 1 serve anche a scoprirlo.
