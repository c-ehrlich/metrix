Study spec.md and pick the next thing to do
also look at

You tasks are in @plan.md

Only complete ONE task from the plan (you decide what's important), then return

A task is only done when the following pass:
- `pnpm build`
- `pnpm test`
- `pnpm format:check` (some issues can be fixed by `pnpm format`)
- `pnpm lint` (some issues can be fixed by `pnpm lint:fix`)
- `pnmp typecheck`

Before marking a task as completed you should also
- run a separate agent to ensure that the implementation matches the spec
- run a separate agent for code review, and fix any high priority feedback
Make sure you check off each task as you complete it

If you want to leave notes for future agents, leave them in @memory.md
If something in @memory.md is no longer relevant, remove it

Every time a task is complete, commit. Use conventional commit syntax.
If all tasks are complete, reply with exactly "DONEZO". Do not use this word under any other circumstances as it will prevent you from continuing to work.

