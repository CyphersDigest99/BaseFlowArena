# BaseFlowArena Project Rules

## 0. Project Structure and Development
- **All development work should be done within the `public/` folder structure**
- The `public/` folder contains the complete, deployable web application
- Root directory files are for project management, testing, and build scripts only
- When adding new features or making changes, always work in the appropriate `public/` subdirectory

## 1. File Naming and Case Consistency
- All references to BPM in filenames, variables, and imports must use all caps: `autoBPM.js`, `autoBPM`, etc.
- Enforce case-sensitive imports and file names, even on Windows, to avoid deployment issues on case-sensitive systems.

## 2. Vercel Deployment Rules
- Only rewrite to `/index.html` for routes that do not match an existing file.
- Always set the correct MIME type for JavaScript modules (`application/javascript; charset=utf-8`).
- Never include large files (e.g., `beats.json` > 50MB) in the deployment.
- All static assets (JS, CSS, JSON, audio) must be in the correct directory and referenced with relative paths.

## 3. Module Import Rules
- All ES6 module imports must use relative paths (e.g., `./autoBPM.js`), never absolute or root-based.
- Never use HTML comments (`<!-- ... -->`) in JavaScript files.

## 4. Branching and Version Control
- Always add new or renamed files to git before using `git mv` or similar commands.
- Clean up unused branches and directories regularly to avoid confusion.

## 5. Curated Data and Prompts
- When generating curated word sets or prompts, always use JSON format with clear keys.
- Avoid abstract or generic words in curated sets for AI video generation—prefer visually evocative, concrete nouns, actions, or scenes.

## 6. Error Handling and Debugging
- If a module fails to load, always check the network response for that file to ensure it’s not serving HTML.
- Use the browser’s network tab to debug MIME type and routing issues.

## 7. Documentation
- Keep a `DEPLOYMENT_GUIDE.md` and update it with any new Vercel or build process quirks.
- Document any naming conventions or special rules in a `CONTRIBUTING.md` for collaborators.

---

**These rules are intended to ensure consistency, smooth deployment, and ease of collaboration for all contributors to BaseFlowArena.** 