---
name: Sandboxed material densities
description: Density hierarchy and displacement rules for particle movement in Sandboxed.
---

Material density controls occupied-cell swapping: Air 0, Steam 1, Fire 2, Ash 25, Water 100, Sand 200, and Stone/Wood 65535. A moving particle may displace a lower-density occupied cell; equal or higher density blocks it. This lets sand sink through water, water displace steam, and keeps stone and wood from being displaced.

**Why:** the user defined density as the rule for which elements displace each other, with air at zero and stone/wood effectively immovable.

**How to apply:** Keep the density hierarchy aligned with the intended movement order. When two occupied cells swap, preserve each material's associated heat and burn state. Empty air remains outside the thermal model; see the Sandboxed heat model note.
