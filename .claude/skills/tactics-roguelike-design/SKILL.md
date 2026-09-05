---
name: tactics-roguelike-design
description: >-
  Design and redesign guidance for roguelike / rogue-lite run structure in grid-based tactical RPGs — turn-based squad tactics with permadeath or run-based stakes, not real-time action roguelikes. Draws on Slay the Spire, Hades, Darkest Dungeon, Into the Breach, and Dicey Dungeons as reference points for run structure, meta-progression vs. per-run builds, card/relic/boon-style choice design, risk/reward economy, procedural variety vs. hand-crafted content, and difficulty pacing across a run — then translates each of those into grid-tactics terms (squad permadeath, battle-map-as-room, blessing/relic-as-draft-choice). Use this whenever building or redesigning a roguelike/survival/endless mode for a tactics game, designing a relic/blessing/boon/card pool, deciding what should persist between runs vs. reset, tuning a run's difficulty curve or "how many floors/waves," or figuring out why a run-based mode feels flat, grindy, or samey even without the word "roguelike" showing up — "run-based," "permadeath mode," "endless mode," "wave survival," "meta progression," "unlock tree," "draft pick," "loot pool," and "difficulty scaling" are all this skill's territory.
---

# Tactics Roguelike Design

Roguelikes/rogue-lites are a genre defined by structure more than content: the same core tactics-combat loop reads completely differently depending on how runs are shaped, what carries between them, and how choices are offered. This skill exists so you don't have to rediscover the genre's solved problems from scratch — it names them, shows which shipped games chose which answer and why it worked, and gives you the vocabulary to pick on purpose rather than by accident.

**Sibling skill, not a substitute**: `tactical-rpg-design` covers the moment-to-moment combat layer (turn order, hit/damage math, terrain, AI). This skill covers the layer *around* that — the run's shape, its economy, and its pacing across many encounters. A roguelike mode needs both; read `tactical-rpg-design`'s `map-and-encounter-design.md` alongside this skill's `tactics-adaptation.md` when you're deciding how permadeath and map design interact.

The four reference points — **Slay the Spire**, **Hades**, **Darkest Dungeon**, and (for the tactics-specific angle) **Into the Breach** — anchor every claim here in a shipped, widely-played design, not just theory. The point is never "copy Slay the Spire's card list" — it's to show you a mechanic that demonstrably worked, explain *why*, and let you decide whether your game wants that answer or a deliberately different one.

## How to use this

Skim the axis table below to orient on the big decisions, then go to whichever reference file covers what you're actually deciding. Each file has concrete mechanics and named examples, not just concepts — read the one you need.

| You're deciding... | Read |
| --- | --- |
| Is a run one map or many, finite or endless, how "rooms"/floors/waves are sequenced | `references/run-structure.md` |
| What a relic/blessing/boon/card pool should look like, avoiding a pile of flat +stat filler | `references/build-variety-and-choice-design.md` |
| What should persist across runs vs. reset on death, and how much | `references/meta-progression.md` |
| Elites, rest sites, shops, voluntary difficulty dials, attrition mechanics | `references/risk-reward-and-difficulty-pacing.md` |
| How much to procedurally generate vs. hand-author, and at which layer | `references/procedural-vs-handcrafted.md` |
| How any of the above changes when your "character" is a squad on a grid, not one hero | `references/tactics-adaptation.md` |

## The four decisions that shape everything downstream

Make these on purpose before touching the reward pool or the difficulty tables — they determine what "good" even means for everything else.

**1. Finite run vs. infinite run.**
Slay the Spire has an ending: a fixed number of acts, a final boss, credits. Hades has a narrative ending too, but is built to be replayed past it via Heat. A wave-survival mode with no cap (kill enemies until you die, score = waves survived) is a third shape entirely — its "difficulty curve" isn't a ramp toward a climax, it's a search for a sustainable steady-state the player eventually loses to. These need different reward pacing (a finite run can back-load its best rewards near the end; an infinite run's rewards must stay meaningful indefinitely or the run degenerates into repetition) and different failure framing (a finite run's death is "you didn't reach the end this time"; an infinite run's death is *the* scoring mechanism, not a setback). Decide which one your mode is — see `run-structure.md`.

**2. How much power should survive a death.**
Zero meta-progression (every run starts from the exact same blank slate) keeps every run equally skill-tested forever, but makes losing feel like it bought nothing — a real cost for a genre whose core loop is "die, then immediately go again." Heavy meta-progression (each run's currency buys permanent stat/unlock power) makes failure feel like progress, but risks trivializing the early game once a returning player is meta-progressed far past a first-timer, and risks turning the run itself into a formality gating the *real* progression. Hades and Slay the Spire sit at very different points on this spectrum on purpose — see `meta-progression.md` for exactly where and why.

**3. What generates the run's variety: content or sequencing.**
The single most common mistake building a roguelike is trying to procedurally generate the *content* (maps, encounters, dialogue) instead of hand-authoring a content pool and proceduralizing which pieces of it appear and in what order. Every game referenced in this skill hand-builds its rooms/floors/relics/boons and randomizes selection and sequence, not the content itself. See `procedural-vs-handcrafted.md` — this one file will save you the most wasted effort of anything here.

**4. What a "choice moment" actually offers.**
A draft pick (a relic, a boon, a blessing, a card) is only interesting if turning it down is a real cost, not a formality — which means the pool needs internal tension (no auto-includes, no obvious traps) and synergy (options that interact with *each other*, not just flat independent bonuses.) A pool of "+2 to a stat" options with no cross-referencing reads as filler no matter how big the number is. See `build-variety-and-choice-design.md`.

## A note on scope

This skill is genre knowledge, not a framework — it doesn't assume any engine or stack. It's also specifically about **turn-based, permadeath-or-run-based tactics games**: squad-based grid combat where a "run" is a sequence of encounters with stakes attached. It is not about real-time action-roguelike moment-to-moment combat (dodge-rolling, i-frames, real-time boon procs) — where Hades' *combat* design is out of scope, its *run/meta/boon* design is very much in scope and translates cleanly, which is why it's cited throughout. If you're working in a codebase that already has some run-structure or reward systems in place, read the relevant reference file for vocabulary and tradeoffs, then look at what's already built before proposing a change — a working system that answers these axes differently on purpose is not automatically wrong.
