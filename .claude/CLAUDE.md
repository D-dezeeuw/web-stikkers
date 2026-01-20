# True Cost Calculator for Collectible Cards & Stickers

## Project Summary

Web application that calculates the **true cost** of completing a sticker/card collection. Exposes hidden costs that publishers obscure (€3/pack feels cheap, €150-300 total is hidden).

Two modes:
1. **Analysis Mode** — Monte Carlo simulation showing cost range and probability curves
2. **Interactive Mode** — Simulate opening packs, track collection, compare against predictions

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js + Express |
| Frontend | Vue 3 + Vite |
| State | Pinia |
| Charts | Chart.js |
| Styling | Tailwind CSS |

## Key Documentation

| File | Purpose |
|------|---------|
| `/docs/SPECIFICATION.md` | Full technical specification |
| `/docs/WEIGHTS.md` | Rarity weight reference data |
| `/docs/EXAMPLES.md` | Example collection configurations |

## Core Mechanics

### Collection Rules
- Cards have **rarity weights** (1.0 = common, 0.05 = ultra rare)
- Packs contain N cards, **no duplicates within a pack**
- Boxes contain M packs, **~90% unique within box** (seeded distribution)
- Publisher allows ordering up to **50 missing cards** directly
- **Goal:** Reach ≤50 missing cards, then order remainder

### Box Seeding (Important)
Boxes are 90% unique *within the box itself*, NOT relative to your collection. You can still pull cards you already own from previous boxes.

### Success Condition
```
missing_cards <= 50  →  completable via direct order
```

## Primary Output

```
┌─────────────────────────────────────┐
│  TRUE COST TO COMPLETE              │
│     €145 — €175                     │
│     typical    safe                 │
└─────────────────────────────────────┘
```

This is the headline. Everything else supports it.

## Commands

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend
cd frontend && npm install && npm run dev

# Full stack
npm run dev
```

## API Endpoint

```
POST /api/simulate
Body: config object (see SPECIFICATION.md)
Returns: steps[], summary, meta
```

## File Structure

```
/backend
  server.js
  simulation.js
  routes/simulate.js

/frontend/src
  /components
    /form         — ConfigForm, CardTypeEditor, CostInputs
    /results      — TrueCostHero, Charts, TypeBreakdown
    /simulator    — PackOpener, Checklist, CardStack, ProgressTracker
  /stores
    simulatorStore.js
  /views
    SimulatorView.vue
  /utils
    defaults.js
    validation.js
```

## When Implementing

1. Start with `/backend/simulation.js` — core Monte Carlo engine
2. Then `/backend/routes/simulate.js` — API wrapper
3. Then frontend store + form
4. Then results display (TrueCostHero first)
5. Then charts
6. Then interactive mode last

## Gotchas

- Box seeding is per-box, not per-collection
- Percentiles: P10 = lucky, P90 = safe (lower missing = better)
- Weights are estimates — Panini doesn't publish official odds
- Cost calculation: buy boxes first (cheaper per card), then loose packs

## Development Workflow

### Dev Server
- **Keep the dev server running** during the session - don't kill it after tests
- Start with `npm run dev` (runs on port 8080)
- Only stop the server when explicitly asked or session is ending
- The server is needed for both automated tests and manual browser verification
