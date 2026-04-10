# CLAUDE.md

## Agent Rules

- The UX must be a top notch: user friendly, intuitive, minimalistic, mobile friendly, easy to navigate and understand
- When adding or updating a feature don't forget to update `sitemap.xml` content (either generated one or static one, depending on what is present in code), URLs, SEO routes, titles and metatags
- Try to write the developers-friendly code: DRY principle, separation of concerns principle, SOLID pricnicples, the code should be easy to read and maintain
- At the same time try to not overengineer, but keep the code as simple as possible to the extent that the task or the feature allows (do not sacrifice UX or functionality for over-simplicity)
- Try to keep the UI consistent. For example if we use react-icons everywhere try to avoid creating a custom icons if possible but use the ones from the existing icons library. Try to re-use the existing components and styles as much as possible. If you notice that we use the same UI pattern in multiple places try to extract it into a separate component. 
- Keep code to be easy to maintain and to read by humans. Avoid having files that are too large (i.e., >500 lines of code) when possible.
- When adding new functionality, cover it with tests. Be concise.
- After the work on the new functionality or adjusting the existing functionality is over, make sure that the code is clean, readable, maintainable and follows all the best practices. Make sure the lint and test checks pass, and the web app is buldable.
- Pay attention to the exiting funtionality and do not break what already works. If you notice something that can be improved, suggest it as a separate task.
- Act as a senior software engineer that cares about the engineering excellence of the codebase. Implement changes in a way that makes the codebase better in the long run. Also suggest the possible improvements if you see the oportunity for it.
- Always take the security concerns into account. For example, do not store any sensitive information in the code, do not use any external services that may compromise the security of the users, do not use any external libraries that may have security vulnerabilities.
- When implementing a new feature that requires fetching some data (i.e., city population, crime stats, weather data, etc.) it is very important to avoid guessing and hallucinations and to use the actual, real and accurate data. If you are not sure about the data source of data quality, ask for clarification. The main goal is to provide as accurate data as possible, so that the web-app users can rely on the data and make informed decisions. 
- Every time you scrape or use the external data-sources or APIs, make sure that the information is shareable and that using it do not violate any licenses or terms of service. If some data-source if important, has high quality but requires some additional steps from the licenciong perspective, do not discard it but ask for clarification on how to proceed.
- Before calling the task "done" do a self-review of the changes you made.

## Additional context

- See @CONTRIBUTING and @package.json for available npm commands for this project.
- [URL Architecture & SEO Strategy](./rules/project_url_architecture.md) — path-based routing decisions, multi-layer URL patterns, future county/city pages, blurred map background design
- [Project Hosting Constraints](./rules/project_constraints.md) — GitHub Pages, no server, must stay free
- [E2E Snapshot Testing](./rules/e2e_snapshot_testing.md) — when experimenting with e2e snapshot updates, first test with a single test/snapshot to verify the assumption works before running `--update-snapshots` for all tests. Bulk snapshot updates take a long time.
