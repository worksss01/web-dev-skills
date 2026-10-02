# Upload the Cowork skill

Download `web-debug-cowork-1.8.3.zip` from [Releases](https://github.com/worksss01/web-dev-skills/releases/latest). Upload the complete ZIP in Skills → Add → Upload skill. Do not select SKILL.md alone: references and scripts are part of the package.

Wait for the platform's upload/security result, then find and enable web-debug-cowork if the account exposes an enable option. Start with:

> Use web-debug-cowork to check this execution environment. Report the observed Node version/platform and whether Chrome/Chromium is available for direct CDP. Distinguish verified results from untested assumptions. If helpers cannot run, explain the limitation and use only supplied files/evidence.

The package has one root folder, minimal name/description YAML, references and shared scripts. It omits Codex UI metadata and a root package notice. Its scripts match the core skill byte for byte. [Historical 1.6.1 packaging](package-validation.json) and [local helper smoke](local-smoke-validation.json) retain their original scope; they are not live tests of a new Cowork session.

The maintainer has not verified live execution of this release inside Cowork. An accepted upload does not establish access to the user's Windows Chrome. Run direct CDP only when the execution environment supports it; do not silently substitute built-in provider browser tools. Otherwise provide evidence-based analysis/manual reporting and say which helpers were not executed.

An uploaded personal Pro/Max ZIP does not automatically track the repository. [Update status](../UPDATES.md). Account-loaded Cowork skills and local Claude Code folders are distinct; see [Claude Code skills](https://code.claude.com/docs/en/skills#use-skills-in-cowork-and-cloud-sessions), [custom skill structure](https://support.claude.com/en/articles/12512198-how-to-create-custom-skills) and [Cowork execution boundaries](https://support.claude.com/en/articles/13364135-use-claude-cowork-safely).

No report store, browser profile, credential or personal installation state is included.
