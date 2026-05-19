# "tsc" watch plugin

For use with `tsc --watch`.

When `tsc -w` sees a change and starts compiling, it writes

> "File change detected. Starting incremental compilation..."

to stdout. When it's done compiling, it writes

> "Compilation complete. Watching for file changes."

to stdout. This is how we hook into `tsc -w`.