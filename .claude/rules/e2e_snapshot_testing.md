
# E2E Snapshot Testing Approach

When experimenting with e2e snapshot updates, first test with a single test/snapshot to verify the assumption works before running `--update-snapshots` for all tests. Bulk snapshot updates take a long time.

**Why:** Full snapshot regeneration takes several minutes. Running all tests when you're not sure the change is correct wastes time.

**How to apply:** When investigating snapshot issues, run a targeted test like `npx playwright test -g "sidebar closed" --update-snapshots` first. Only run the full suite once the single test confirms the expected result.
