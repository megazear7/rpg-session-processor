---
agent: "agent"
model: Grok Code Fast 1
tools: ["vscode", "execute", "read"]
description: "Commit the current changes"
---

# Steps

- Run `git add .` to stage all changes for commit.
- Review the staged changes made in the codebase.
- If there are any changes that need to be addressed before committing or any changes that do not look like they should be commited, such as debug code or temporary files, then pause these steps and inform me. If there are no issues, continue to the next step.
- Write a clear and concise commit message based on the code changes and any recent conversation context.
- Ensure the commit message follows best practices (e.g., imperative mood, brief summary).
- Run `git commit -m "<your commit message>"` to create the commit with the prepared message.
- Run `git push` to push the committed changes to the remote repository.
- DO NOT try to use `git checkout` or `git reset` to undo any changes. If you want to make changes, such as removing debug code, ask me first and then just make new edits.
