import { afterEach, vi } from 'vitest'

// P14.13 (Wackel-Test „Closing rpc while fetch was pending“): Einige Module laden Teile per `import()` nach, ohne dass der
// Test darauf wartet (z. B. `attachExtra` → `cocoTravel`, `mountCoco` → `cocoExtra`). Endet die Datei, während so ein
// Import noch über die Vitest-RPC aufgelöst wird, bricht der Worker mit dieser Meldung ab – je nach Last mal ja, mal nein.
// Nach jedem Test warten, bis alle angestoßenen Importe fertig sind (nutzt die echten Timer, auch bei Fake-Timern).
afterEach(async () => {
  await vi.dynamicImportSettled()
})
