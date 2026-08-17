from pathlib import Path

source = Path("scripts/finalize-missions-source.py")
exec(compile(source.read_text(), str(source), "exec"))

path = Path("scripts/migrate-missions-zero-learning-tests.py")
code = path.read_text()

# Apply each guarded replacement to exactly its requested count, while allowing
# later replacements to consume duplicate legacy assertions intentionally.
code = code.replace("    if actual != count:\n", "    if actual < count:\n")
code = code.replace("    p.write_text(text.replace(old, new))\n", "    p.write_text(text.replace(old, new, count))\n")

exec(compile(code, str(path), "exec"))
