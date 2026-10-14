# UI component sourcing — owner requirement

This is the standing policy for authoring, replacing or restyling any UI component or interactive control. Root `AGENTS.md` points here. The decision came from #475.

**Do not author a new UI component or interactive control when an appropriate
maintained component already exists.** **First actively search and compare**
official shadcn/ui, ReUI, Kibo UI, Dice UI and other relevant mature registries,
regardless of which dependencies are currently installed. Choose on fit to
the required appearance, interaction, accessibility, maintenance and technical
stack; installation status is never the first selection criterion. Evaluate
reasonable substitution and compositions of upstream primitives before
concluding that a custom component is necessary. Reuse an already installed
component **only when it wins that comparison**, not merely because it exists.
Use the registry's documented installation method (prefer the shadcn CLI);
do not hand-copy or fork an upstream component unnecessarily.

An exception requires evidence in the change's design/PR notes: which
maintained components were evaluated, why direct use and reasonable
substitution both fail the actual product requirements, and what remains
unsupported. The exception must be scoped to the smallest missing behavior.
Routine domain data mapping, backend integration and page-level composition
are application code, not permission to create a parallel primitive library.
Do not install several overlapping UI libraries solely to make a screen look
busy. Keep the project on a coherent component stack; check peer-dependency
and major-version compatibility before installation.

For existing bespoke UI, prioritize replacement during work on that surface
using maintained components; do not propagate the bespoke pattern to new
screens. Preserve accessibility, factual content, IAM, keyboard behavior and
server-backed state during each replacement. Visual review must compare the
rendered page, not just count library imports.
