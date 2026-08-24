# Map & Encounter Design

## Objective types and why they're not interchangeable

- **Rout** (defeat all enemies): the default, and the most forgiving to design around — any map layout works, since the win condition doesn't depend on reaching anywhere specific. Good default for a first pass at a chapter.
- **Seize/reach a point**: forces forward pressure — the player can't just turtle in a defensible corner, which is the point (it directly counters the "hold a chokepoint forever" strategy that rout-objective maps can degenerate into if the AI doesn't press). Needs a map actually shaped to make the destination meaningfully far/defended, or it's trivial.
- **Defend/survive N turns**: inverts the pressure — now the *player* wants to turtle, and the map needs to be shaped to make that hard (multiple approach routes, timed reinforcements from more than one direction) or it's also trivial in the other direction.
- **Escort**: a fragile unit that must survive to a destination, usually with the player's control over it limited or absent — high tension by design (protect something you don't fully control), needs the escort's AI or auto-pathing to not be actively suicidal or the objective reads as unfair rather than tense.
- **Survive N waves** (roguelike/endless structure): different pacing problem entirely — see the wave-scaling note below, since this format doesn't have hand-placed enemies to tune per-encounter.

Mixing objective types across a campaign (not every chapter is rout) is doing real work even if each individual map is simple — it's what stops the whole game from feeling like the same fight with a different coat of paint.

## Map size and shape

- Err smaller than feels natural, especially early. A map that takes 15+ turns to clear isn't more epic, it's more tedious — most memorable tactics-genre encounters resolve in single-digit turns. Mobile/touch play especially punishes large maps (see `ui-ux-conventions.md`), since board legibility and tap-target size both degrade as the grid grows relative to the screen.
- Shape should serve the objective: a rout map wants multiple viable approach routes (so there's a real choice of where to commit); a seize map wants the destination to require passing through contested space, not just being far away in a straight line; a defend map wants 2+ approach vectors so a single chokepoint can't trivialize it.
- Reserve one deliberate chokepoint or terrain feature per map (see `terrain-and-positioning.md`'s checklist) — an open field with no terrain variety collapses into "whoever has more Move and bigger numbers wins," regardless of how the rest of the design is going.

## Reinforcements and pacing within a fight

A map that's fully visible and static from turn 1 is easier to plan around perfectly, which sounds good but tends toward a single dominant opening strategy once players find it. Reinforcements (new enemies appearing on a later turn, from a known or unknown spawn point) reintroduce uncertainty and force the player to keep something in reserve rather than fully committing every unit turn 1 — used well, this is one of the most reliable ways to make a map replay differently. Telegraph reinforcement *timing* even if not composition (a visible "reinforcements arrive turn 4" warning) — hidden-timer reinforcements that ambush an overcommitted player read as unfair rather than tense, unless "expect the unexpected" is specifically the point of that map (a boss/late-game gotcha, used sparingly).

## Wave-survival / roguelike structure

If your structure is "survive escalating waves" rather than hand-placed chapters, the tuning problem is different: you're balancing an *enemy count/composition scaling function* against player growth (levels, gear) turn over turn, not authoring one specific fight. Concretely:
- Scale enemy **count** primarily, stat-bonus scaling secondarily (per `ai-and-difficulty.md`'s note that flat stat inflation stops feeling meaningful past a point) — `enemyCount = min(baseCount + floor((wave - 1) / N), cap)` is a reasonable starting shape, with a hard cap so late waves don't become unrenderable or unplayable.
- Give the player a real **choice point between waves** (a reward/upgrade pick) — this is what turns "endless grind" into "endless *build*," and it's the structural reason wave-survival roguelikes pair naturally with a light deckbuilder-style choice system between waves.
- Verify your spawn-zone has enough passable tiles for your *maximum* wave size before you ever hit that wave in testing — a spawn pool sized for wave-1 enemy counts will silently fail (or need to overflow into occupied/invalid tiles) once scaling pushes past what that zone can hold. Compute the real number (`passable tiles in the spawn zone`) against your scaling formula's cap, don't eyeball it.

## Permadeath and its map-design consequences

If fallen units are permanently gone (see SKILL.md's axis discussion), map design needs to account for the *stakes* that creates: a map shouldn't have an unavoidable, unwinnable-to-prevent unit loss baked in (a scripted event that kills a unit no matter what the player does reads as a design failure, not tension, when the loss is *permanent*) — reserve genuinely unavoidable danger for non-permanent stakes (HP loss, a resource cost) and make sure permanent losses are always the result of a choice the player could have played around (overextending, ignoring a telegraphed threat), not a trap with no visible tell. This is the map-design half of what makes permadeath feel *fair* rather than arbitrary — the other half (clear threat-range display, clear hit% before committing) is a UI obligation, covered in `ui-ux-conventions.md`.

## A practical map-design checklist

- Objective type chosen deliberately, not defaulted to rout every time
- At least one real terrain feature/chokepoint (not a flat field)
- Passable-tile connectivity verified (BFS/flood-fill, catches sealed-off regions before a playtester does)
- Unit spawns (both sides) land on passable, reachable terrain — verify programmatically, not by eyeballing the ASCII/data grid
- If reinforcements exist, their timing is telegraphed even if composition isn't
- If wave-scaling exists, the max-wave enemy count is checked against actual spawn-zone capacity, not assumed
- If permadeath is on, no unavoidable forced loss exists on this map
