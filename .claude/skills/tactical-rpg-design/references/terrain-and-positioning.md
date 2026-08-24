# Terrain & Positioning

The whole point of a grid is that *where* is a decision with weight. If terrain only affects movement cost and nothing else, you've built a maze, not a tactics game — the genre's defining trait is that position itself is a combat stat.

## Height / elevation

Central to FFT and Triangle Strategy specifically (TS arguably makes it *the* core mechanic). The standard rule: attacking from a higher tile than the defender grants a damage and/or accuracy bonus; some games also block or reduce ranged/arcing attacks when there's insufficient height difference to arc over an obstacle between attacker and target (line-of-sight in the vertical axis, not just the horizontal). Implementation-wise this means your terrain data needs an actual elevation value per tile, not just a terrain-type enum — `{ type: 'plain', elevation: 2 }` — and your range/targeting math needs to fold elevation difference into both hit chance and damage, typically:
```
heightBonus = clamp((attackerElevation - defenderElevation) × coefficient, -cap, +cap)
```
Symmetric clamping (high ground helps the attacker, low ground genuinely hurts them) reads as more consistent than a bonus-only-never-penalty version, but a bonus-only version is gentler and easier to balance around if you're worried about it feeling punishing.

## Facing and flanking

Covered in depth in `combat-math.md` (it's fundamentally a damage-modifier system), but the positioning consequence is what matters here: once facing exists, "walk around behind them" becomes a first-class tactic, which means chokepoints and formations that protect flanks/backs become valuable, and unit AI needs to *weight* ending its move somewhere flankable as a cost (see `ai-and-difficulty.md`). A simpler, lower-commitment version of the same idea that doesn't require a full facing system: a flat "attacked while already engaged by 2+ enemies this turn" bonus, or "no support ally within N tiles" penalty — gets some of the same "don't get surrounded" tension without the extra state (facing direction) and UI (facing indicators) that a full flanking system needs.

## Cover and terrain defense

Forest/rubble/fortification-style terrain granting a flat defense and/or avoid bonus to whoever's standing on it (FE's forest +Def/+Avoid, fort tiles even more so) makes terrain a *destination* worth pathing toward, not just an obstacle. Pair this with a movement-cost penalty for the same tile type on the *attacker's* approach (forest costing more to enter) and you get a genuinely interesting tension: the defensive tile is also slower to reach, so claiming it first is a real tempo decision.

## Chokepoints and zone control

A single passable tile (a bridge, a mountain pass, a gate) connecting two larger open areas is the single most reliable way to create a tactically interesting map without any exotic mechanics — it forces melee engagement at a predictable point, rewards ranged units positioned to hit the chokepoint from range, and gives the player a natural "hold here" decision instead of an open free-for-all. When generating or hand-authoring a map, treat "is there at least one meaningful chokepoint, or is this just an open field" as a real design checklist item, not an afterthought — an open map without terrain variety tends to degenerate into "whoever has more Move wins," since there's no positional decision beyond raw distance.

**Zone-of-control** (a unit threatens all adjacent tiles, discouraging enemies from moving adjacent-then-past) is a heavier mechanic most of these four games *don't* use directly (they rely on turn structure and threat-range display instead — see `ui-ux-conventions.md`'s danger-zone section) — mention it because it's a common tactics-genre mechanic from the wider genre (e.g., Advance Wars-adjacent titles, XCOM) worth knowing exists as an option, not because FFT/FE/TS/TO lean on it. If your game doesn't have real zone-of-control, a clearly-displayed enemy threat-range overlay is doing the same *informational* job (let the player see danger before it happens) without the *mechanical* restriction, which is usually the better fit for this genre's pacing.

## Environmental interaction as a positioning tool

Triangle Strategy's standout contribution: terrain isn't just static stats, it's *manipulable* — ice mages freeze water into walkable platforms (opening new paths), fire ignites oil-slicked ground (area damage + terrain denial), wind pushes units (including off ledges, for instant KOs regardless of HP). This turns terrain from "read the map, plan around what's there" into "the map is itself a resource your kit interacts with," which is a much higher-investment system (needs elemental interaction rules, needs terrain-state-change persistence within a battle, needs UI to telegraph what's ignitable/freezable) but creates some of the genre's most memorable tactical moments (freezing a river to flank, igniting a whole line of oil-soaked enemies). Worth the investment specifically if your class/skill system already has an elemental axis to hang it on — bolting environmental interaction onto a game with no elemental identity per class is a lot of system for little payoff.

## A practical checklist for a new map

- At least one chokepoint or terrain feature that isn't purely decorative (affects movement cost, defense, or line of sight)
- Verify passable-tile connectivity — every passable tile should be reachable from every other passable tile (a BFS/flood-fill check over passable tiles is cheap and catches "oops, sealed off a whole region" before a playtester does)
- Height variance, if your combat math uses elevation — a perfectly flat map wastes that whole system
- Spawn points that respect the above: don't spawn a unit in a pocket that's topologically connected but requires an unreasonable detour to ever reach the fight (technically valid, practically useless)
