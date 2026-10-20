# Repository instructions

## Commit messages

- Apply these rules to every commit created in this repository.
- Before composing a commit message, inspect recent history with `git log -12 --oneline` and follow the relevant naming and scope conventions.
- Use Conventional Commits: `<type>[optional scope]: <description>`. Existing examples include `fix(dock): adjust scaling margins to prevent dock overflow` and `chore: release v0.41.1`.
- Write the entire commit message in English, including the subject, optional body, and footer, even when the conversation or changed documentation uses another language.
- Use an appropriate lowercase type, such as `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, or `ci`. Add a scope when it helps identify the affected area.
- Keep the subject concise and describe the actual change with an imperative verb. If a body is useful, separate it from the subject with a blank line and explain the reason for the change and relevant validation.
- Review the staged diff before committing, and keep the commit message consistent with the final staged changes.
