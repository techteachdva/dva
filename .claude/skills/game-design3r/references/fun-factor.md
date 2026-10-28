# The Fun Factor Formula (FFF) and Exp

Phil's model of fun, for comparing games of any genre by abstracting them
into four measurable parts. Use it whenever a review asks "how fun is this",
"which game/level needs work", or for setting a redesign threshold. Score
with `scripts/fff.py`.

## The four parts

Measure every part **per decision** (one aim-and-putt, one move, one key
burst, one combo choice), averaged over real play, never from the rules
text alone. Write down how each number was measured.

| Part | Range | Meaning | How to measure |
|---|---|---|---|
| **C** Choice | 0 to 1 | Share of the player's inputs that are real choices (a skilled player would sometimes choose differently), not pure execution. | Audit a session's inputs: choices / all inputs. Typing ≈ low, a puzzle move ≈ high. |
| **P** Possibilities | ≥ 1 | Viable options at a decision: options that aren't obviously wrong. | Count legal options, minus the ones no thinking player takes. Use a solver or logged play where possible. |
| **O** Obstacles | ≥ 1 | Things that can punish a decision (threats, hazards, blockers, costs), plus 1. | Count active threats per decision from level data or logs. |
| **V** Variety | ≥ 1 | Distinct variations a player meets over a session: levels, modes, opponents and modifiers that change the best play. | Count only variations that change strategy, not skins. |

## Fun Factor

    FF = (C × P / O) × V

FF is Phil's raw formula. It rises with choice, possibilities and variety and
falls with obstacles. Compare raw FF between levels of the **same** game;
across genres, use Exp.

## Exp: FF standardized to 1 to 100

Read literally, raw FF says zero obstacles is best, and a puzzle with
nothing in the way is boring. Exp keeps FF's shape but compares the
obstacle load with the ideal load for that many possibilities, so it
rewards progressively hard levels instead of empty ones:

    O* = 1 + √P                                  ideal obstacle load
    B  = max(0, 1 − |ln(O / O*)| / ln 4)          obstacle balance (0 at 4× off)
    Sp = min(1, ln(1+P) / ln(1+24))               possibility saturation
    Sv = min(1, ln(1+V) / ln(1+48))               variety saturation
    Exp = 1 + 99 × (C × Sp × B × Sv)^(1/4)

- 100 is a perfect game on this scale (full choice, 24+ possibilities,
  ideal obstacles, 48+ variations). 1 is the floor.
- The 1/4 power is a geometric mean: one weak part drags Exp down, but
  can't zero it on its own unless it is truly zero.
- Also report **FF\*** (FF at the ideal load O*) and **FF/FF\*** (the
  obstacle verdict: > 1 means too easy, < 1 means too hard).

## Thresholds

- **Exp ≥ 80:** working. Don't redesign; leave it to the designer's eye.
- **Exp 75 to 79:** polish only (feedback, clarity, small tuning).
- **Exp ≤ 74:** redesign the weakest part first. The part with the lowest
  normalized score (C, Sp, B or Sv) is where the fun is leaking.

## Using it in a review

1. Measure C, P, O, V per level (or per mode) with a note on how.
2. Run `python .claude/skills/game-design3r/scripts/fff.py data.json`.
3. Rank the levels by Exp. Fix the weakest part of anything under the
   threshold, and say which part each fix targets.
4. Re-measure after the change. The fix worked if Exp crosses the bar.
