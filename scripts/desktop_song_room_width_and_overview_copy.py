from pathlib import Path

script = Path("scripts/desktop_system_final_pass.py")
if not script.exists():
    raise SystemExit("desktop final-pass script is missing")
exec(compile(script.read_text(encoding="utf-8"), str(script), "exec"))
