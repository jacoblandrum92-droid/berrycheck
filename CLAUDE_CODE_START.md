# Claude Code — First Prompt

Paste this as your opening message in Claude Code:

---

I have a Flask-based blueberry QC tool in this folder called `berrycheck`. 
Please read `PROJECT_BRIEF.md` first — it has the full context, current state, 
and everything that needs to be built next.

Start by reading all the existing files so you understand the codebase, 
then tell me what you see and confirm you're ready to build.

The first thing I want to add is SQLite persistence to replace the 
browser localStorage — all sample records should save to a server-side 
database so they persist across sessions and are accessible from both 
the ThinkPad and eventually a Pi.
