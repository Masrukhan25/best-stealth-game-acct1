[![make.fun](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![Rank](https://make.fun/badge/best-stealth-game-20261121-1759/Masrukhan25/best-stealth-game-acct1/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![Reward](https://make.fun/badge/best-stealth-game-20261121-1759/Masrukhan25/best-stealth-game-acct1/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)

# The Ember Ledger

A quiet game of five heists across the canal city of Emberwick. You are Rook,
a thief who steals one named prize per house and slips out through the green
hatch — and is never once seen doing it.

**5 heists · 18 guards · 33 treasures · 4 gadgets**

## The heists

| # | House | Prize | Guards |
|---|-------|-------|--------|
| 1 | The Salt Wharf | Brass Tide-Seal | 2 |
| 2 | The Inkbinders' Bindery | Gilded Quill | 3 |
| 3 | The Chimeworks | Bellmaster's Cog | 4 + 1 camera |
| 4 | The Ember Exchange | Coal-Duke's Ruby | 4 + 2 cameras + 1 laser |
| 5 | The Grand Archive | The Starless Ledger | 5 + 2 cameras + 2 lasers |

## How it plays

Top-down, one screen per level, on a tile grid. Guards patrol named routes with
raycast vision cones that turn amber → red as they grow suspicious; suspicion
builds while you are seen and drains while you are not, and a guard who loses
you searches the last place he saw you before returning to his route.

Light is the whole game: lamplight exposes you, darkness hides you, tall grass
hides you unless a guard is almost on top of you, and crates, pillars, planters
and shelves break both sight and movement. Three gaits — sneak (silent, slow),
walk, sprint (fast, loud) — with a noise radius the guards really hear.

Four gadgets: a brass coin to throw and lure a guard off his post, a smoke
pellet that swallows sight, a lamp douse (R) that kills the nearest light, and a
clockwork cricket that walks away chirping and draws every guard in earshot.

Cameras sweep their cones in the later heists; lasers trip the three-level
alarm. Get caught three times and the house keeps its ledger. Finish unseen
and under par for the GHOST rank — plus $500, and a $10-per-second time bonus.

## Controls

- **Move** WASD / arrow keys · **gait** 1 / 2 / 3 or C to cycle (sneak / walk / sprint)
- **Q** throw a coin at the mouse · **F** smoke pellet · **R** douse the nearest lamp · **G** clockwork cricket
- **M** mute · **P** / **Esc** pause · **Space** / click confirm

Progress unlocks heist by heist and is saved in your browser (localStorage).
Sound is synthesised with WebAudio — no audio files, no network.

## Play it

Serve `game/` with any static server and open `game/index.html` in desktop
Chrome. Screenshots are staged from the real simulation behind
`?shot=cover|spotted|lure|win` (see `shots.json`).

Built for the [best stealth game bounty](https://make.fun/bounty/best-stealth-game-20261121-1759) on make.fun.
