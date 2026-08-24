# UI/UX Conventions

Tactics games ask the player to make an informed decision every turn, for every unit — the genre's UI conventions exist almost entirely to make the *information* legible enough that a loss reads as "I made a bad call" rather than "the game didn't tell me." Get this wrong and even solid underlying math feels arbitrary or unfair.

## The forecast/confirm panel

Before committing to an attack, show: attacker vs. defender HP, hit chance, expected damage (and crit chance/damage separately if crits are a distinct roll), and whether/how hard the defender counters back. This is non-negotiable in any game where combat has real randomness (see `combat-math.md`'s RNG-philosophy section) — asking the player to commit blind to a probabilistic outcome, in a genre built around informed positioning, undermines the entire premise. Confirm-before-committing (a two-step "select target" → "here's what happens, confirm?" flow) rather than instant-resolve-on-tap is the standard, specifically so a misclick doesn't burn a unit's turn on an unintended target.

## Threat-range / danger-zone display

Show the player which tiles are threatened by enemy units *before* they move into them — either always-on or toggleable. This is the single highest-leverage piece of UI in the genre for making permadeath (or any high-stakes loss) feel *fair*: a unit that dies while standing in a tile that was clearly marked as threatened reads as a player mistake; a unit that dies to a threat the player had no way to see reads as the game cheating. If your enemy AI has any nonstandard reach (a skill with unusual range, a movement ability that ignores normal terrain cost), the threat-range display needs to account for it too, or it becomes actively misleading rather than merely absent — a "safe" tile that turns out not to be safe because the display didn't model some enemy's real threat is worse than no display at all.

## Turn order / initiative display

If you're using individual-initiative turn sequencing (see `turn-and-movement.md`) rather than phases, surface the upcoming turn order as an explicit list (Triangle Strategy's approach) — a hidden CT simulation the player can't see is much harder to plan around, and "kill this unit before its turn comes up" stops being a legible tactic if the player can't see when that turn is coming. Even a simple "next 5 actors" strip is enough; you don't need to show the full remaining battle.

## Status/stats panel

Always-visible or one-tap-away unit info (stats, equipped gear, skill/cooldown state) is expected; how much detail to show *always-visible* vs. *behind a tap* is a real layout tradeoff, not a fixed rule — the right split depends on how much screen real estate you actually have (a phone-portrait layout has much less room than a console HUD) and how much of that info is actually decision-relevant *this turn* vs. reference material. If you're tight on space, the always-visible tier should be whatever's needed to decide "should I engage with this unit right now" (HP, core combat stats, movement); deeper info (full equipment, skill descriptions) is fine gated behind a tap since it's consulted less often per-turn.

## Mobile/touch-specific conventions

If the game targets touch input at all, a few genre-agnostic mobile-UI rules matter more here than in most genres, because the grid itself is the primary input surface:
- **Tap targets need real size** — a tile that's comfortable to tap on a phone is meaningfully bigger than what reads fine on a mouse-driven desktop layout; if a map's grid dimensions push tile size below a comfortable touch target (roughly 44–48 logical px, matching iOS/Android's own minimum-touch-target guidance), the map is too big for the format, not just "a bit small," and the fix is a smaller grid or a bigger screen budget, not smaller UI chrome elsewhere.
- **Fire on release, not on press**, for anything that isn't a drag gesture — pointerdown-triggered actions can misfire mid-swipe/mid-scroll and feel premature; reserve press-only feedback for a visual affordance (a button scaling down slightly) with the actual action firing on release, so a press-then-drag-away-then-release doesn't commit to anything.
- **A destructive or turn-ending action (end turn, confirm attack) benefits from a deliberate two-step confirm** on touch specifically, since touch has no hover state to preview a choice before committing the way a mouse does — what a desktop player might "hover to check, then click," a touch player only gets by tapping and seeing a confirm step.
- **Anchor contextual menus (action choices) near the unit that triggered them, clamped on-screen**, rather than a screen-centered modal — this keeps the board visible underneath so the player retains spatial context while choosing, which matters more in this genre than most because position is itself the thing being decided around.

## What to prioritize if you can only build a few of these

In rough order of how much they affect whether a loss feels *fair*: forecast/confirm panel first (you cannot ask for informed risk-taking without showing the risk), threat-range display second (same reasoning, one step earlier in the decision), then everything else. A gorgeous UI with no forecast panel is a worse tactics game than an ugly one with a clear forecast panel — this genre's whole identity is informed decision-making, and the UI is the thing that makes the information actually available.
