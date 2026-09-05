# Procedural Variety vs. Hand-Crafted Content

This is the single highest-leverage idea in this skill, and the one most often gotten backwards. The instinct when building a roguelike is often "randomly generate the maps/encounters/content so every run is different." Every game referenced in this skill does almost the opposite: **hand-author a pool of content, then proceduralize which pieces of it appear and in what order.**

## Where the randomness actually lives, in every reference game

**Slay the Spire**: every room's content is hand-designed — the monster roster per act is a fixed, curated list of specific hand-tuned enemies with specific hand-tuned attack patterns; every card and relic is individually hand-authored; the elites and bosses are entirely fixed, hand-built encounters. What's procedural is *which* rooms appear on the map, in *what order*, and which specific fixed-content monster/elite/event is drawn for a given room. The map's *shape* (the DAG layout itself) is also procedurally generated — but from a fixed grammar of room types and fixed rules about how many of each type an act should contain.

**Hades**: every room *layout* in a biome is hand-built (a fixed pool of specific room designs per biome, each with hand-placed enemy spawn points and hand-tuned enemy waves) — what's procedural is which layout gets pulled from the pool for a given run, and the light path branching between rooms. The boon pool is entirely hand-authored (every boon, every god, every duo combination is specific, tested content) — what's procedural is which subset is offered at a given boon room.

**Darkest Dungeon**: dungeon layouts are procedurally generated, but from hand-authored *room and corridor pieces*, hand-authored enemy "mob compositions" (specific, tested groups of enemy types that spawn together, not fully random individual enemy rolls), and a hand-tuned resource/trap/curio table. The procedural layer is assembly, not invention.

## Why this works and pure content-generation usually doesn't

A hand-built encounter can be played, felt, and tuned by a human before it ships — its difficulty, its "does this fight feel fair and interesting," its pacing, are all things a designer can verify directly. A procedurally *generated* encounter (say, a randomly-placed set of enemies and terrain with no human review) can't get that same scrutiny at the individual-instance level — you're trusting the generator's rules to produce something fair and interesting every time, across a combinatorial space you can't fully playtest. The results, even when technically "balanced" on paper, tend to read as generic or occasionally broken (either trivially easy or unfairly hard) in ways a curated pool almost never does, because nothing you built was actually designed to be experienced in that exact configuration.

Randomizing *selection and order* from a hand-tested pool gets you almost all the replay variety (a player genuinely doesn't know which of 15 hand-built encounters is coming next, in which order, alongside which reward options) at a fraction of the risk, because every individual piece was actually designed and tested as itself.

## What to proceduralize vs. hand-author, concretely

**Proceduralize:**
- Which map/encounter is drawn from a pool, for a given slot in the run.
- The order/sequence of rooms (within a grammar of how many of each type per act/segment).
- Which subset of a reward pool (relics/boons/blessings) is offered at a given choice moment.
- Minor per-instance variation on top of a hand-built base (which of 2-3 hand-tuned enemy formations spawns in "the elite room," not a fully free enemy placement).

**Hand-author:**
- The actual terrain/map layouts (a pool of specific, playtested maps — not a terrain generator).
- The individual reward pool contents (every relic/boon/blessing's exact effect, name, flavor).
- Specific hard-scripted encounters (bosses, elites, story beats) — these are exactly the content that most needs direct design attention and least benefits from randomization.
- The difficulty tables/curve shape (see `risk-reward-and-difficulty-pacing.md`) — hand-tune this against playtesting/simulation data, don't derive it from a formula alone and hope.

## Sizing the pool

A pool that's too small repeats noticeably within a handful of runs (the player starts recognizing "oh, it's this map again" too fast, breaking the illusion of variety); a pool that's too large costs proportionally more hand-authoring time for content that, procedurally, most players won't see most of in any given run anyway. A reasonable target: enough pool size that a typical single playthrough (however long a "typical" run is for your game) doesn't repeat the same piece of content twice, with some buffer — the point isn't "infinite content," it's "enough that repetition isn't the *first* thing a player notices."

If hand-authoring N maps/encounters is genuinely too expensive, prefer a **smaller hand-built pool played more than once** over a **larger generated pool played once each** — a repeated but well-designed encounter beats a novel but mediocre one almost every time, and this is exactly why Hades reuses room layouts across many runs rather than generating fresh ones.
