# Enemy AI & Difficulty

## What tactics-genre AI actually needs to do

Unlike a real-time or hidden-information game, the AI's whole job is legible decision-making over full information — the player can see the entire board, so the AI's choices need to look like a *reasonable tactician's* choices, not necessarily optimal ones. A tactics AI that's mechanically perfect (always the highest-expected-value play) often reads as *worse* game design than one that's merely sensible, because perfect play tends toward degenerate patterns (always focus-fire the lowest-HP target regardless of position, never take a risk) that feel robotic rather than threatening.

## A minimal decision loop that reads as competent

For each unit that hasn't acted, in roughly this priority order:
1. **Can I get a good attack in this turn?** Score every reachable-tile × in-range-target combination by *expected value* (see `combat-math.md` — hit% × damage, kill-chance-weighted, minus expected counter damage taken), not raw damage. Take the best one if it clears some minimum bar (don't attack into a terrible trade just because it's technically positive).
2. **If not, close the distance.** Move toward the nearest/most threatening target by real path distance (not straight-line — see `turn-and-movement.md`'s pathing-trap note, the same bug bites AI "approach" logic even harder than player-assist logic, because AI has no player to notice it's stuck and route around manually).
3. **If nothing to do, hold position or retreat**, depending on the unit's role — a fragile ranged unit backing away from an approaching melee threat reads as far more "intelligent" than it standing still waiting to die, for very little extra code (score retreat tiles by distance-from-nearest-threat instead of distance-to-target).

This loop, even without anything fancier, reads as a competent-if-simple opponent — most of what makes tactics AI feel *good* rather than *cheap* is less about search depth and more about not doing obviously dumb things (attacking into a lethal counter, standing still while an archer picks it apart, walking a healer into melee range for no reason).

## Where to add real depth, if you want it

- **Focus fire on weakened targets**, weighted by kill-chance, not just "any target with damage taken" — an AI that abandons a 95%-HP target to chase a 10%-HP one across the map (ignoring the tactical situation) reads as scripted in a bad way; one that finishes a nearly-dead target *when it's already in range* reads as smart.
- **Threat-awareness for its own units**: scoring a move that leaves a unit exposed to 3 enemy threat ranges as worse than one that leaves it exposed to 1, even if the immediate attack looks the same — this is what separates AI that "protects its ranged units" from AI that doesn't, and it's a genuinely visible difference to players.
- **Class-appropriate behavior profiles**: a berserker archetype that always advances and attacks even into bad trades, vs. a tactician archetype that holds formation and waits for a good opening — differentiated AI behavior *per class*, not one policy for the whole enemy roster, is a large perceived-intelligence upgrade for relatively little extra code (a behavior-weight multiplier per archetype on top of the same base scoring function).
- **Scripted openings for boss/named encounters**: a unique enemy that has one or two hard-scripted early moves (retreat behind guards until turn 3, or always target the unit that just used a specific skill) before falling back to generic AI reads as a designed encounter rather than a reused stat block, for a small amount of special-case code.

## Difficulty tuning — the levers, roughly in order of how much they change the *feel* of a fight

1. **Enemy count and composition** — the single biggest lever, and the cheapest to tune (no new systems needed). A map that's "too easy" is very often just under-populated or under-varied relative to the player's roster size, not badly designed.
2. **Enemy stat scaling** (flat bonuses to a shared base kit) — fast to tune, but past a point it stops feeling like "harder" and starts feeling like "the numbers stopped meaning anything" (an enemy that survives 4 hits instead of 2 isn't more *interesting*, just longer). Prefer this as a coarse global knob, not the primary difficulty tool.
3. **AI aggression/quality** (per the section above) — slower to build, but the highest-quality lever: a smarter opponent creates harder *decisions* for the player rather than just a longer damage race.
4. **Map/terrain design** (chokepoints, reinforcement timing, objective pressure — see `map-and-encounter-design.md`) — the highest-effort lever but also the one most directly responsible for a fight being remembered as a specific, interesting puzzle rather than "the one where the numbers were bigger."

## Mercy and accessibility mechanics

Tactics Ogre's Chariot Tarot (rewind a small number of turns to undo a bad outcome, with a rationed number of uses) is worth knowing about as a genre-legitimate way to soften permadeath/RNG tension for players who want the tactical puzzle without the loss-aversion stakes, without touching the base difficulty at all — it's an opt-in safety net, not an easy-mode stat nerf. If your game leans hard into permadeath (see `map-and-encounter-design.md`) and you're worried about accessibility, a rationed rewind/undo is a genre-precedented way to have it both ways rather than defaulting straight to a difficulty-slider that also touches combat numbers.
