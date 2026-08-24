# Combat Math

## The core loop

Almost every game in this genre resolves an attack the same way: compute a hit chance, roll it, if it hits compute damage (with a crit chance/multiplier folded in), apply it, then resolve a counter-attack under the same rules if the defender can still counter. The interesting design decisions are in the *details* of each step, not the loop shape.

## Hit chance

Standard shape: `hitChance = clamp(attackerAccuracy - defenderAvoid + situationalModifiers, lowerBound, upperBound)`. What goes into Accuracy and Avoid is where games differentiate:
- **Accuracy**: usually `baseHit + weaponAccuracy + (Skill or Dex stat)×coefficient`.
- **Avoid**: usually `(Speed or Agility)×coefficient + terrainAvoidBonus + situational (e.g. facing/flanking)`.
- **Clamping**: almost never let hit chance hit true 0% or true 100% — FE famously clamps to a 1%–99% range partly for game-feel reasons (a "sure thing" that fails 1 in 100 times is a story people tell; true 100% removes the tension entirely) and partly to avoid divide-by-zero-style edge cases in AI scoring that treats 0%/100% as special.

**Displayed hit% vs. true hit%** is a real, deliberate divergence some games make. FE's "true hit" system rolls hit chance *twice* and averages the two rolls before comparing to the threshold — this doesn't change the displayed percentage, but it pulls outcomes toward the middle: a displayed 70% hits more reliably than a single-roll 70% would (because two rolls averaging above 50 is more likely than one roll being above 50), and a displayed 30% *misses* more reliably than single-roll 30% would. The player-facing effect: extreme percentages (90%+, 10%-) feel much more reliable than a naive single roll, which reduces "the 90% attack that whiffs and ruins the run" frustration without changing the number on screen. If you want a genre-standard way to make displayed percentages *feel* more trustworthy without changing what's displayed, this is the lever — implement it as `roll = (rng() + rng()) / 2` compared against the same threshold you'd use for a single roll.

## Damage

Standard shape: `damage = max(minimumDamage, attackerAttackStat + weaponMight - defenderDefenseStat - terrainDefBonus)`, then crit multiplies the *result* (commonly ×2 or ×3, not the raw stat). Keep a `minimumDamage` floor (often 0 or 1) — mismatched stats (a level-1 unit hit by an endgame boss) should not produce negative-then-clamped-weirdly damage; make the floor explicit rather than relying on a stray `Math.max` someone forgets in one code path.

**Expected value matters more than the deterministic roll once hit/crit are probabilistic.** Any AI or forecast-panel scoring should weigh an attack by its *expected* damage (`hitChance × damage`, crit-weighted) rather than the raw damage number — otherwise the AI will confidently throw a unit at a 15%-to-hit "big" attack the way a deterministic game would, and a forecast panel showing raw damage without hit% context is actively misleading the player about how good the play actually is. Concretely:
```
expectedDamage = hitChance × (normalDamage × (1 - critChance) + critDamage × critChance)
```
and if scoring a potential kill, weight the "this kills them" bonus by *kill chance*, not by "damage >= their HP" as a boolean — a 100-damage attack that has a 30% chance to connect for a kill is not as good as a guaranteed 40-damage attack that also kills, even though the first "kills" on paper.

## The weapon/type triangle

FE's Sword→Axe→Lance→Sword (each beats one, loses to another) is the canonical example of a *soft* rock-paper-scissors layer: winning the matchup grants a small hit/damage bonus (not a hard counter), so it nudges positioning and squad composition without making any single unit unusable against a given enemy type. This is the right *weight* for a triangle system — if the bonus is too large, off-triangle matchups become unplayable and the "triangle" becomes a hard lock rather than a soft nudge; too small and it's flavor text nobody plans around. A good starting point is a modifier in the same order of magnitude as one point of Skill/Speed stat difference — enough to matter in a close fight, not enough to overturn a mismatched fight on its own.

## Facing and flanking as damage modifiers

Tactics Ogre is the reference implementation: units have a facing direction, and attacking from the side or rear grants a meaningfully larger bonus (accuracy, damage, and/or guaranteed crit chance) than a frontal attack — turning "get behind the enemy" into the single most important positioning skill in the game, on top of whatever terrain/height system exists. If you add facing, you're adding a whole extra positioning axis beyond "which tile" — mobile/flying units get disproportionately stronger (they can reliably reach flanks), so expect to retune movement ranges or add "cannot be flanked while adjacent to another ally" type mitigations if melee infantry starts feeling unplayable. See `terrain-and-positioning.md` for how this interacts with height and chokepoints.

## RNG philosophy: is bad luck ever the player's fault?

Two coherent design stances, both used successfully in this genre:
1. **RNG is a resource the player manages** (classic FE): the player is expected to only take fights they'd be okay losing, use terrain/support bonuses to push percentages to safe ranges, and treat a bad roll on a risky play as a consequence of *choosing* to take that risk — the game's difficulty is partly "did you leave yourself exposed to variance."
2. **RNG is smoothed toward predictability** (true hit, or removing crit variance in favor of guaranteed bonus effects): the designer wants tactical *certainty* to be the skill being tested, with variance as seasoning rather than a core stake.

Neither is "more correct" — but pick one on purpose, because they imply different UI obligations (stance 1 demands you show the player the real percentage clearly and let them decide risk tolerance — see `ui-ux-conventions.md`'s forecast panel section; stance 2 wants smoothing like true-hit specifically so the displayed number is closer to the felt outcome).
