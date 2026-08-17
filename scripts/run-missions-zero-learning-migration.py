from pathlib import Path

path = Path("scripts/migrate-missions-zero-learning-tests.py")
code = path.read_text()

helper_old = "    p.write_text(text.replace(old, new))"
helper_new = "    p.write_text(text.replace(old, new, count))"
if code.count(helper_old) != 1:
    raise SystemExit("migration helper replacement was not exact")
code = code.replace(helper_old, helper_new)

duplicate_old = '''r(p, 'expect(screen.getByText("Manager reviewing")).toBeInTheDocument();', 'expect(screen.getByText("Saving…")).toBeInTheDocument();')
r(p, 'expect(screen.getByText("Manager reviewing")).toBeInTheDocument();', 'expect(screen.queryByText("Saving…")).not.toBeInTheDocument();\\n    expect(screen.getByText("Provide 90-day thesis")).toBeInTheDocument();')'''
duplicate_new = '''r(p, ''' + repr('''    expect(screen.getByText("Manager reviewing")).toBeInTheDocument();

    resolveReview?.();''') + ''', ''' + repr('''    expect(screen.getByText("Saving…")).toBeInTheDocument();

    resolveReview?.();''') + ''')
r(p, ''' + repr('''    await waitFor(() => expect(onCompleteTask).toHaveResolved());
    expect(screen.getByText("Manager reviewing")).toBeInTheDocument();''') + ''', ''' + repr('''    await waitFor(() => expect(onCompleteTask).toHaveResolved());
    expect(screen.queryByText("Saving…")).not.toBeInTheDocument();
    expect(screen.getByText("Provide 90-day thesis")).toBeInTheDocument();''') + ''')'''
if code.count(duplicate_old) != 1:
    raise SystemExit("pending review migration block was not exact")
code = code.replace(duplicate_old, duplicate_new)

old_count = "r(p, 'expect(await screen.findByText(\"The path from here\")).toBeInTheDocument();', 'expect(await screen.findByRole(\"button\", { name: /^Work/ })).toBeInTheDocument();', 2)"
new_count = "r(p, 'expect(await screen.findByText(\"The path from here\")).toBeInTheDocument();', 'expect(await screen.findByRole(\"button\", { name: /^Work/ })).toBeInTheDocument();', 3)"
if code.count(old_count) != 1:
    raise SystemExit("retired path count migration was not exact")
code = code.replace(old_count, new_count)

redundant = "r(p, '    expect(await screen.findByText(\"The path from here\")).toBeInTheDocument();\\n', '    expect(await screen.findByRole(\"button\", { name: /^Work/ })).toBeInTheDocument();\\n')\n"
if code.count(redundant) != 1:
    raise SystemExit("redundant retired path migration was not exact")
code = code.replace(redundant, "")

exec(compile(code, str(path), "exec"))
