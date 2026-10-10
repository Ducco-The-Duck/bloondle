# bloondle
Wordle game for Bloons TD 6

### How it works
You get 6 guesses to guess the correct upgrade. Information with each guess:
1. Cost of the upgrade (more/less) (standardized to medium difficulty)
2. Tier (more/less)
3. Category (Military/Primary/Magic/Support)
4. Tower (match / no match)
5. Path (match / no match; paragons count as their own path)

A new upgrade every day (UTC); everyone gets the same one. After a game you can play random ones.
All 404 upgrades are in the pool: the tier 1-5 upgrades of the 26 towers, plus the 14 paragons (tier 6, path "Paragon").

### Running it
No build step, it's a static site:

```sh
npm start        # serves on http://localhost:8000
npm test         # game-rule tests
```

### Data
`data/upgrades.json` and `icons/` are generated from [bloonswiki.com](https://www.bloonswiki.com)'s
Cargo tables (`btd6_upgrades`, `btd6_towers`) and committed, so the game never calls the wiki at runtime.
Refresh them after a game update with:

```sh
npm run fetch-data   # needs Node 22+; ImageMagick (optional) shrinks the icons
```
