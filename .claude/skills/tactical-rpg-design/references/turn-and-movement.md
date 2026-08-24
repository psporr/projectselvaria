# Turn Structure & Movement

## Turn sequencing models

### Phase-based (Fire Emblem)
Every player unit gets a chance to act, then every enemy unit does, then (in some games) allied/third-party factions, repeating. Simple to explain, simple to build AI for (just iterate the enemy roster each enemy phase), and it makes "end turn" a single meaningful commitment point — the player decides when they're done positioning, which is a real decision (holding units back vs. pushing).

Implementation shape:
```
turn.onBegin: reset hasActed/hasMoved for the phase's team
each unit in that team may: move, act, or both, once
phase ends when every unit has acted OR player explicitly ends turn
```
The subtlety worth getting right: a unit that hasn't acted yet should still be interactable (info, cancel-and-reselect), and "hasActed" should reset only at the start of *that unit's own team's* phase, not globally — an enemy that acted last enemy-phase must not read as "fresh" during the player phase that follows, or dimming/UI cues lie to the player about what's already resolved.

### Individual initiative / Charge Time (FFT, Tactics Ogre)
Every unit has a Speed stat and a running charge value; each global tick, add each unit's Speed to its charge; whoever crosses the action threshold first acts, resets to 0 (or subtracts the threshold, carrying overflow), and the clock advances again. This interleaves turns — a fast unit might act twice before a slow one acts once — and makes Speed a stat with real tactical weight (a Haste spell literally buys extra actions).

```
function nextActor(units):
  loop:
    for u in units: u.charge += u.speed
    ready = units.filter(u => u.charge >= THRESHOLD)
    if ready: return min(ready, by charge desc, tiebreak by speed then id)
```
Costs more to build (you need this simulation running continuously, not just "whose team is it"), and the AI needs to reason about *when* it'll next act, not just *what* to do this turn. Worth it specifically when you want Speed itemization (haste/slow effects, heavy armor slowing turns) to be a real lever, per Tactics Ogre's equipment-weight-affects-turn-speed system.

### Visible individual queue (Triangle Strategy)
Same underlying idea as CT, but the UI surfaces the *next N actors* as an explicit ordered list, refreshed as speed buffs/debuffs land. This trades some of CT's emergent unpredictability for legibility — the player can plan "if I kill this unit before its turn, I skip its action entirely" as a precise, visible tactic rather than a probabilistic guess. If you're building individual-initiative turns, strongly consider surfacing the queue (see `ui-ux-conventions.md`) — the hidden version is a worse version of the same system for most players.

## Movement

**Movement range**: near-universally a per-unit Move stat consumed by a per-tile-type cost via Dijkstra/BFS over the grid (not raw Manhattan/Chebyshev distance) — terrain costs more than 1 to enter for some/all unit types, and a tile occupied by an enemy blocks the path entirely while a tile occupied by an ally can be passed through but not landed on ("allies block landing, not passage" is the standard rule — check this specifically, it's an easy thing to get backwards).

**Movement-cost-by-unit-type** is a real design lever, not just terrain flavor: FE's cavalry/armor units take a penalty in forest that infantry don't, fliers ignore terrain cost entirely — this is what makes class choice matter on a *specific map* (a cavalry-heavy squad struggles on a forest map) rather than just being a stat block.

**Action economy per turn**: standard is move-or-act, or move-and-act (move then attack from the new tile), but *not* act-then-move in most of these games (committing to an attack ends your positioning options for that unit) — the exception is a small number of "hit and run" class abilities that explicitly grant a post-action move, which reads as a special ability specifically *because* it breaks the normal rule. If you let every unit act-then-move by default, hit-and-run stops being a build choice and just becomes strictly better positioning for everyone — decide if that's what you want.

**A pathing trap worth knowing about**: if your AI (or a player-facing "move toward target" assist) ranks candidate tiles by straight-line distance-to-target instead of real path distance, it can get stuck refusing to step around a wide obstacle — every tile it can actually reach looks *farther* away in a straight line even though stepping sideways is the only way to eventually close the gap. Use a real BFS/path-distance field from the target (ignoring occupancy, respecting terrain passability) to rank candidate tiles, not Manhattan/Chebyshev distance. This is a genuinely easy mistake to make (Manhattan-distance-to-target reads as "obviously correct" until a map has a wall or lake wide enough to expose it) and it manifests as a very confusing bug: units that just... stop, forever, near an obstacle.
