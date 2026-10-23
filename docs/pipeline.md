# Pipeline – Utpost

*Exempelifyllt facit (M1). Tider är från en riktig körning på mallrepot – teamen fyller i sina egna.*

## Flödet

```mermaid
flowchart LR
  B[branch + commit] --> PR[pull request mot main]
  PR --> Q[Kvalitet<br/>npm ci · lint · format:check · test]
  PR --> BU[Bygg<br/>npm ci · build → artefakt]
  PR --> I[Integration<br/>Postgres + Mongo · seed · migrate:logs · test:api]
  I --> S
  Q --> S{status checks<br/>gröna?}
  BU --> S
  S -->|ja| M[merge – knappen är grön]
  S -->|nej| F[fixa, pusha igen<br/>körningen startar om]
  M --> MAIN[main är alltid byggbar]
```

## Vad som körs, och varför

| Steg | Kommando | Fångar | Tar |
|---|---|---|---|
| Lint | `npm run lint` (ESLint på `client/`) | oanvända variabler, fel i Vue-templates, `no-undef` | ~4 s |
| Format | `npm run format:check` (Prettier, bara kontroll) | filer som inte kördes genom Prettier – ändrar inget i CI, det gör man lokalt | ~2 s |
| Test | `npm test` (`vitest run`) | ett röktest på guidevyn den här veckan (M1) – riktiga tester i M2 | ~3 s |
| Bygg | `npm run build` (`vite build` av `client/`) | importfel, trasiga templates, allt som bara syns vid bygge | ~2 s |
| Integration | `npm run seed` · `npm run migrate:logs` · `npm run test:api` mot Postgres 16 och Mongo 8.2 som services | N+1 (`extensions.databasfragor` ≤ 2), inloggningskravet, fel som bara syns med riktig databas, mätpunkterna i Mongo | PR: **TODO s** · main: **TODO s** (hela jobbet inkl. containerstart och `npm ci`; fyll i från Actions) |

`npm ci` (~25 s) dominerar – den installerar alla tre workspaces inklusive React-klientens beroenden. När `web/` tas bort (M6) halveras tiden.

## Branch protection (ruleset på `main`)

- Kräver PR – ingen pushar direkt till `main`
- Kräver status checks **Kvalitet**, **Bygg**, **Integration** och **Image** gröna innan merge (fyra required checks – en check som inte är required stoppar ingen merge)
- Kräver att branchen är uppdaterad mot `main` före merge (annars testas en kod som aldrig kommer att finnas)
- Gäller även admins

## Vanliga fel vi sett

- **Grönt lokalt, rött i CI:** `npm run lint` lokalt är samma kommando som i CI. Kör det innan du pushar. Skillnaden brukar vara en fil som inte är sparad, eller `--fix` lokalt som gömde felet.
- **`format:check` rött:** kör `npm run format --workspace=client` och committa. CI ska aldrig ändra kod, bara säga nej.
- **Status check heter fel i rulesetet:** namnet är jobbets `name:` (Kvalitet, Bygg) – inte filnamnet.
