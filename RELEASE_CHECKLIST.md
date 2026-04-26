# Release Checklist

Before merging to `main` or cutting a release, all of the following must pass:

- [ ] **Compile clean** — `npm run compile` (`tsc --noEmit`) exits with code 0, no type errors
- [ ] **Build successful** — `npm run build` (`wxt build`) completes without errors
- [ ] **All tests passing** — `npm test` (`vitest --run`) exits with code 0, no failing tests
- [ ] **No unresolved P0 issues** — all P0 bugs and stability issues are resolved or explicitly deferred with a tracking issue
