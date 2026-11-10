---
name: Sandboxed heat model
description: User-defined thermal rule for the Sandboxed material simulation.
---

Empty cells represent air, not a material: they have no heat value and must not participate in thermal diffusion. Only occupied material cells store temperature and conduct to neighboring occupied material cells; exclude empty neighbors from averaging.

**Why:** the user specified that air should neither conduct heat nor hold temperature.

**How to apply:** When editing temperature initialization, buffers, clearing, erasing, movement, or diffusion, use an explicit no-temperature state for empty cells and keep them out of conduction.
