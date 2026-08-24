---
name: tactical-rpg-design
description: >-
  Design and implementation guidance for building tactical/strategy RPGs — grid-based turn combat games in the lineage of Final Fantasy Tactics, Fire Emblem, Triangle Strategy, and Tactics Ogre. Covers turn structure and movement, combat math (hit/crit/damage formulas, RNG philosophy), terrain and positioning (height, flanking, cover, chokepoints), class/job systems, enemy AI design, map and encounter design, and genre UI/UX conventions (forecast panels, threat ranges, turn order display). Use this whenever building or extending a tactical RPG, designing grid-based combat, tuning hit/damage/crit formulas, building enemy AI for a strategy game, designing a job or class system, laying out battle maps, or deciding how permadeath/turn order/weapon-triangle-style mechanics should work — even without the words "tactical RPG" showing up: "grid combat," "flanking bonus," "turn order," "unit AI," "battle map," "weapon triangle," "permadeath," "height advantage," and "job system" are all this skill's territory.
---

# Tactical RPG Design

Grid-tactics RPGs are a small enough genre that its best games have converged on a shared vocabulary of solved problems — and diverged sharply on a few deliberate axes. This skill exists so you don't have to rediscover either from scratch: it names the solved problems, explains the axes, and tells you which games chose which answer and why it matters for the game you're building.

The four reference points — **Final Fantasy Tactics** (FFT), **Fire Emblem** (FE), **Triangle Strategy** (TS), and **Tactics Ogre** (TO) — are the primary source of examples throughout, but the point is never "copy FFT." It's to show you a mechanic actually shipped and was actually fun, explain *why* it worked, and let you decide whether your game wants that answer or a different one on purpose.

## How to use this

Skim the axis table below to orient, then go straight to the reference file for whatever you're actually deciding or building. Each reference file has concrete formulas/pseudocode, not just concepts — read the one you need, not all of them.

| You're deciding... | Read |
| --- | --- |
| How turns are sequenced, how far units move, action economy | `references/turn-and-movement.md` |
| Hit%, crit, damage formulas, "true hit" vs displayed odds, RNG feel | `references/combat-math.md` |
| Height, flanking/facing, cover, chokepoints, zone-of-control | `references/terrain-and-positioning.md` |
| Fixed classes vs. free job-switching, stat growth, promotion | `references/classes-and-progression.md` |
| How enemies should choose actions, difficulty tuning, telegraphing | `references/ai-and-difficulty.md` |
| Map size/shape, objectives, encounter pacing, permadeath tension | `references/map-and-encounter-design.md` |
| What to put on screen — forecast panels, danger zones, turn order UI | `references/ui-ux-conventions.md` |

## The three axes that actually matter

Before anything else, these are the decisions that shape everything downstream — get them wrong (i.e. pick them by accident instead of on purpose) and you'll be fighting your own systems later.

**1. Turn sequencing: phase-based vs. individual-initiative.**
FE alternates full-army phases (every player unit acts, then every enemy unit acts). FFT/TO interleave individual units by a speed-driven queue (fast units act more often); TS shows that queue as an explicit visible list. Phase-based is simpler to reason about and to build AI for; individual-initiative rewards Speed as a stat and makes turn order itself a tactical resource, but is more code and more UI. Pick based on how much you want Speed/turn-manipulation to matter — don't default to phases just because it's easier to build if turn order was supposed to be a real lever.

**2. Consequence of a fallen unit: permadeath vs. not.**
Classic FE removes a fallen unit permanently — this is the single biggest lever on how carefully a player plays, and it only works if the player believes it (no take-backs). FFT/TO soften it (a KO'd unit has a few turns to be revived before it's final); TS is closer to FFT. Permadeath isn't "the hardcore option" — it's a specific emotional target (tension, loss-aversion, attachment) that some games want and others deliberately avoid because it fights their pacing or their story (you can't permanently lose a named character mid-cutscene-heavy plot without either constraining the writing or undercutting the death). Decide what your game is going for before wiring this up; see `map-and-encounter-design.md`.

**3. Character identity: class-bound vs. class-fluid.**
FE ties identity to class (this unit *is* a Pegasus Knight; promotion is a discrete upgrade moment). FFT lets any qualifying unit learn and switch between jobs freely, decoupling "who this character is" from "what job they're doing right now." TS and TO sit in between (a roster of fixed-class named characters, but with enough sub-systems — TS's elemental skills, TO's Union/loyalty layer — that builds still vary). Class-bound reads as more narratively coherent per-character; class-fluid reads as a bigger, more replayable optimization space. See `classes-and-progression.md`.

## A note on scope

This skill is genre knowledge, not a framework. It doesn't assume Phaser, boardgame.io, Unity, or any specific stack — the reference files give formulas and data shapes you translate into whatever you're building. If you're working in a codebase that already has some of these systems in place, read the relevant reference file for the vocabulary and tradeoffs, then look at what's already there before proposing a change — don't reinvent a system the project already solved differently for a reason.
