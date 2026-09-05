# Run Structure

## Finite vs. infinite runs — decide this first

**Finite**: a run has a defined end state (a final boss, a fixed floor count, a victory condition). Slay the Spire is 3 acts (4 with Downfall) of a fixed floor count each, ending in a boss; Darkest Dungeon's individual expeditions are finite (a mission has a length and an objective), even though the meta-game around the hamlet is open-ended. A finite run can *pace toward* its ending: escalate tension, back-load its best rewards and hardest fights near the climax, and let "beat the game" mean something concrete.

**Infinite**: no fixed end, just an escalating challenge the player eventually loses to (wave survival, endless floors, score-attack). The "difficulty curve" here isn't a ramp toward a climax — it's a search for a sustainable steady-state, and the run's *score* is how long that steady-state held before collapsing. Vampire Survivors and most "survive the waves" modes are this shape. Rewards must stay meaningful indefinitely (if by wave 20 every reward is trivial next to your accumulated power, the last 30 waves of a 50-wave run are dead time), and difficulty must scale *forever* in some dimension (enemy count, enemy stats, or both) since there's no finish line to stop scaling at.

**Why this matters before anything else**: reward pacing, difficulty tables, and even how you frame failure in the UI all depend on which shape you picked. Don't let this get decided by accident because "endless mode" was the easiest thing to build first — an infinite run built without a deliberate soft-cap or escalating-but-survivable curve just becomes "however many waves before the numbers get silly," which reads as unfinished rather than as a genre choice.

**A finite run wrapped in an infinite meta-loop** is the actual shape of Slay the Spire *and* Hades once you zoom out: each individual run is finite (it ends in victory or death), but the player is expected to attempt many runs, and the meta-progression (see `meta-progression.md`) is what makes run N+1 different from run N. This is usually the right target for a roguelike: finite runs, replayed indefinitely, rather than one literally-infinite run.

## The "room" grammar

Every reference game breaks a run into discrete beats with a small, reusable vocabulary of beat *types* — this is what lets procedural sequencing (see `procedural-vs-handcrafted.md`) work at all, since you're shuffling a small deck of known shapes, not generating novel content on the fly.

Slay the Spire's map is a branching DAG of rooms per act: **Monster** (standard fight), **Elite** (harder fight, better reward, opt-in via path choice), **Rest Site** (heal or permanently upgrade a card — a real opportunity cost, since you can't do both), **Shop** (spend gold on cards/relics/potions or pay to remove a card from your deck), **Event** (a text-choice encounter, often a card/relic/HP trade-off), **Treasure** (a free relic), and the **Boss** at path's end. The player picks their path through the DAG each act, which is itself a meaningful choice (more elites for more reward and more risk, or a safer route).

Hades has a similar small vocabulary per biome — **Combat Room**, **Boon Room** (a god offers a choice of boons, sometimes with a resource cost), **Shop** (Charon, spends the run's currency), **Fountain** (heal), **Chaos Gate** (curse-for-reward trade) — chosen from a room pool and sequenced with light branching (2-3 paths at points), so no two runs play identically even with fully hand-authored rooms.

**The translation for grid-tactics**: a "room" is a battle-map encounter. Building a small vocabulary of encounter *types* — not just "another fight" — gives a run the same rhythm: a standard battle, an optional harder battle (an elite pack) for better loot, a non-combat choice node (a blessing/relic pick with no fight attached), a shop/rest node, and a boss map. See `tactics-adaptation.md` for how permadeath and squad composition interact with this.

## Branching path vs. single escalating line

Slay the Spire's branching map is itself a strategic layer — the player routes around danger or toward reward. A single linear gauntlet (Hades' fixed biome order, most wave-survival modes) removes that layer but simplifies pacing and control: you know exactly what beat N looks like for every player, which makes hand-tuning the difficulty curve much easier. Branching costs you that certainty (a player who took the all-elites path is in a different state at floor 10 than one who didn't) but buys replayability and a sense of agency over risk exposure.

Neither is "better" — a linear structure with strong per-room variety (Hades) reads as plenty varied without branching-path complexity; a branching structure needs the DAG itself to be interesting or the extra complexity buys nothing. If your game already has strong per-encounter variety (different maps, different enemy comps, different modifiers), a single line is a legitimate, simpler choice. If encounters are otherwise fairly uniform, branching risk/reward paths give the player a lever that content variety alone can't.

## What actually resets at the start of a new run

Be explicit about this — it's the dividing line between "run structure" and "meta-progression" (that file covers *how much* should carry over; this is about *what categories* even exist):
- **Always resets**: current relics/boons/blessings drafted this run, current HP/resources, map position/progress.
- **Sometimes persists within a run but not across**: a "keepsake"-style single carried bonus chosen at run start (Hades), a starting-loadout choice.
- **Never resets** (that's the meta-progression layer): permanent unlocks, currency banked for account-wide upgrades, cosmetic/roster unlocks.

Getting this taxonomy explicit up front avoids the common bug-turned-design-question of "wait, was that supposed to carry over?" showing up as a bug report instead of a decision.
