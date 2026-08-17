from pathlib import Path

path = Path("scripts/migrate-missions-zero-learning-tests.py")
code = path.read_text()
old = "    p.write_text(text.replace(old, new))"
new = "    p.write_text(text.replace(old, new, count))"
if code.count(old) != 1:
    raise SystemExit("migration helper replacement was not exact")
exec(compile(code.replace(old, new), str(path), "exec"))
