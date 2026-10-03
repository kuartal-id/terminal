# Ask Kuartal — AI plan

## Today (free, shipped)
`web/src/lib/assistant.ts` runs a **rule-based provider** in the browser. It understands
English and some Bahasa ("show me bank stocks", "inflasi ASEAN", "berita batubara",
"compare rupiah and gold") and turns them into terminal **actions**:

```ts
type Action =
  | { kind: 'open'; type: PanelType; params?; reuse? }   // open/update a panel
  | { kind: 'focus'; symbol }                           // send a symbol to linked charts
  | { kind: 'watch'; symbol }                           // toggle watchlist
  | { kind: 'workspace'; preset }                       // open a preset workspace
  | { kind: 'theme'; theme };
interface Reply { text: string; actions: Action[]; suggestions?: string[] }
```

It refuses buy/sell questions and never invents data.

## The seam for a real model
The client first calls `POST /api/ai/ask` (`remoteProvider`). Today the server answers
**501**, so the client falls back to rules for the rest of the session. To add a model,
implement that route — nothing in the UI changes.

Request body: `{ text, context: { focusSymbol, openPanels }, panels: PanelType[] }`
Response: a `Reply` (JSON above).

## Recommended zero-cost setup (Kuartal AI home server)
- Run **Ollama** (or llama.cpp) on the home server's GTX 1070 Ti (8 GB VRAM). A 7–8B
  instruct model with tool/JSON output (e.g. Qwen 2.5/3 7B, Llama 3.1 8B, quantised Q4)
  fits and is plenty for **intent → actions**.
- Server route: build a system prompt listing the panel catalogue (`PANELS` codes,
  descriptions, params) and the `Action` schema; ask the model for JSON only; **validate
  every action** against the catalogue before returning (drop unknown panels/params).
- Keep the rule-based provider as the first pass for instant answers; call the model only
  when rules return no actions.
- Guardrails to keep: no buy/sell advice, no fabricated numbers — the model only
  *navigates*; numbers always come from the panels' real data.
- Add `AI_URL` / `AI_MODEL` env vars (never hard-code), and a timeout (≤ 8 s) with fallback.

## Later ideas
- "Explain this panel" — send the panel's current data (already in JSON) for a plain-language summary, labelled AI-generated.
- Morning brief generated from Pulse + news headlines (cache once per morning for all users).
