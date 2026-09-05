# Build Variety and Choice Design

This is the file for designing a relic pool, a boon pool, a blessing list, or any other "pick one of three" reward moment. The genre's core promise is that each run *feels* different because of what you drafted — if the pool doesn't deliver that, nothing else in the run structure matters.

## The failure mode: flat, independent bonuses

A pool of options like "+2 Atk," "+2 Def," "+10 max HP," each applying to a stat with no interaction with anything else, is the single most common way a reward system reads as filler. The player evaluates each option in isolation ("+2 Atk is fine, I guess"), never has an interesting reason to prefer one over another beyond raw number comparison, and nothing about the run's *identity* changes based on what they picked. Bigger numbers don't fix this — a pool of "+2 Atk" vs. "+5 Atk" options has the same problem, just with different arithmetic.

You can tell a pool has this problem if: every option's value is describable as a single stat delta, no option's usefulness depends on what else you've picked, and a player who saw every option's number could rank them without knowing anything else about their run.

## What Slay the Spire's relics/cards actually do instead

- **Non-linear effects, not stat deltas.** Relics like *Runic Pyramid* (retain hand at end of turn) or *Snecko Eye* (draw more cards, but costs are randomized) don't add a number — they change a *rule* your deck operates under, and whether that rule helps depends entirely on the rest of your deck.
- **Anti-synergy is intentional.** Some relics are actively bad for some decks (Snecko Eye is close to a trap for a deck relying on precise energy costs) and excellent for others (a deck that plays every card in hand anyway). This is deliberate: a relic that's "good for everyone" is a stat stick with extra steps; a relic that's "amazing for one archetype, dead weight for another" is the thing that makes drafting *decisions* instead of auto-picks.
- **Rarity correlates with power, not with excitement.** A common card should still feel worth taking — Spire's commons are efficient, low-complexity tools, not the "filler tier." The rare/boss-relic tier is where build-defining, run-warping effects live, but nothing in the pool should feel like a trap or a non-choice.
- **No card/relic auto-includes.** If there's an option that's correct to take literally every time regardless of your build, it's not a choice — it's a tax you pay to reach the next real choice. Playtesting should specifically hunt for these and either cut them or give them a real cost.

## What Hades' boon system actually does instead

- **Boons are tied to gods, and gods have a flavor/identity** (Zeus = chain lightning/status, Ares = doom/blood-price damage, Aphrodite = weaken/debuff, etc.) — so even before reading the exact numbers, a player is choosing a *direction*, not just a magnitude.
- **Duo boons**: taking specific boon *pairs* from two different gods unlocks a bonus third effect unique to that combination (e.g., specific Zeus+Poseidon or Ares+Zeus pairings). This explicitly rewards reading the board and steering toward combinations, not just picking whatever's offered — the interesting choice is often "should I take this decent boon now to set up a duo later," a genuinely different kind of decision than "which number is bigger."
- **Keepsakes** are a single per-run modifier chosen before the run starts (not mid-run), which biases what you'll see or gives a fixed passive edge — a slower, once-per-run version of the same "build identity" lever.
- **The Daedalus Hammer** offers a binary choice of two different upgrade paths *for your currently equipped weapon specifically*, once per run — a build choice gated on which weapon you brought, adding another axis of interaction between systems rather than a flat buff.
- **Curses/downsides exist and are opt-in** (Chaos boons: take a temporary curse for a stronger reward once the curse resolves) — risk/reward folded directly into the choice mechanic itself, not bolted on separately.

## Practical checklist when designing your own pool

1. **Can every option be fully evaluated with a single number?** If yes for most of the pool, it's under-designed — add conditionals, interactions, or rule changes to at least the rare/top tier.
2. **Does any option interact with 2+ other options in the pool** (better together, actively worse together, or unlocks something new when paired)? If none do, there's no synergy space, and "build variety" is just "which numbers I have," not "what strategy I'm playing."
3. **Is there an option that's correct almost every time?** Cut it or give it a real, felt cost.
4. **Do the low-rarity options still feel worth taking on their own?** If the low tier is filler the player tolerates to reach the good stuff, players will feel punished by bad luck rather than excited by variety.
5. **Does an option's flavor text/name telegraph what it does before the player reads the fine print?** (Zeus = lightning, a "Blessing of the Vanguard" style name should telegraph "melee-focused" before the tooltip does.) Names and theming aren't cosmetic — they're how a player builds a mental model of the pool fast enough to make snap decisions feel informed rather than random.

## Translating this to a squad-tactics game

A blessing/relic system in a squad game has one extra axis a single-hero game doesn't: **which unit(s) it applies to**. This is a free synergy lever most single-character roguelikes don't have — "a bonus for melee units" or "a bonus for your lowest-HP unit" already creates board-reading decisions (do I have enough melee units to make this worth it?) that a flat "+2 to everyone" option doesn't. Lean into this before reaching for numeric-only options: class-conditional, role-conditional, or positional ("units adjacent to an ally," "units that haven't acted yet") triggers are the tactics-genre's native version of Spire's non-linear effects. See `tactics-adaptation.md` for more on this.
