- All project command execution must use WSL. Use Linux/WSL commands and Linux paths for shell work; do not run project commands through Windows `cmd.exe`, PowerShell, or Windows-side `node`, `npm`, `python`, `git`, or other toolchain executables.
- When invoking commands from a Windows-side host, enter WSL explicitly (for example with `wsl.exe bash -lc ...`) and run commands from the repository's WSL-mounted root. Load the WSL-native toolchain first when needed (for example `source ~/.nvm/nvm.sh` before Node/npm commands).
- Do not preserve backward compatibility. Remove obsolete paths instead of
  adding compatibility layers, fallbacks, or migrations.
- Choose the simplest implementation that fully meets the current
  requirements. Avoid speculative abstractions, configuration, and
  indirection.
- Grow the system in layers. Start from the smallest version that works end
  to end, and add each new capability on top of a product that already
  works. Never trade a working product for unfinished complexity.
- Keep components modular and concerns clearly separated.
- Prefer established, well-maintained libraries when they reduce overall
  complexity or improve reliability. Do not reimplement common
  functionality without a clear reason.
- Lean on the dependencies already in the project before writing your own
  implementation or adding packages. Do not assume a library lacks a
  capability without checking its documentation and types.
- Make architectural decisions for the long term. Do not accept a stopgap
  that only works for now and is meant to be replaced later.
