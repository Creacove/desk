from pathlib import Path

music_path = Path('src/features/music/MusicScreens.tsx')
music = music_path.read_text()
music = music.replace('Couldn&apos;t refresh just now. Showing the last read.', 'Couldn’t refresh just now. Showing the last read.')
music_path.write_text(music)

shell_path = Path('src/production-app-shell.test.tsx')
shell = shell_path.read_text()
# If the exact status remains inconclusive after the focused check, do not expose generation.
shell = shell.replace('''    expect(screen.getByTestId("music-song-detail")).toHaveTextContent("Get Manager’s take on this record.");
    expect(within(screen.getByTestId("music-song-detail")).getByRole("button", { name: "Get Manager’s read" })).toBeInTheDocument();
  });

  it("preserves an inconclusive exact Manager Read status without exposing generation"''', '''    expect(screen.getByTestId("music-song-detail")).toHaveTextContent("Checking Manager’s read");
    expect(within(screen.getByTestId("music-song-detail")).getByRole("button", { name: "Check again" })).toBeInTheDocument();
  });

  it("preserves an inconclusive exact Manager Read status without exposing generation"''')
shell_path.write_text(shell)

# The secure link remains usable even if optional email delivery fails; surface that failure in the ready state.
share_path = Path('src/features/music/MusicShareDialog.tsx')
share = share_path.read_text()
anchor = '''                  {emailOpen && onSend ? (
                    <form onSubmit={sendEmail} className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <input type="email" required aria-label="Send by email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" className="h-11 min-w-0 rounded-[11px] border border-foreground/10 bg-background px-3 text-[12px] font-semibold outline-none focus:border-foreground" />
                      <button type="submit" disabled={pending || emailSent} className="h-11 rounded-[11px] bg-foreground px-5 text-[11px] font-bold text-background disabled:opacity-50">{emailSent ? "Sent" : "Send"}</button>
                    </form>
                  ) : null}
                  <div className="mt-7 flex items-center justify-between border-t border-foreground/8 pt-4">'''
replacement = '''                  {emailOpen && onSend ? (
                    <form onSubmit={sendEmail} className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <input type="email" required aria-label="Send by email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" className="h-11 min-w-0 rounded-[11px] border border-foreground/10 bg-background px-3 text-[12px] font-semibold outline-none focus:border-foreground" />
                      <button type="submit" disabled={pending || emailSent} className="h-11 rounded-[11px] bg-foreground px-5 text-[11px] font-bold text-background disabled:opacity-50">{emailSent ? "Sent" : "Send"}</button>
                    </form>
                  ) : null}
                  {error ? <p role="alert" className="mt-3 rounded-[11px] border border-danger/20 bg-danger/8 px-3.5 py-3 text-[11px] font-semibold text-danger">{error}</p> : null}
                  <div className="mt-7 flex items-center justify-between border-t border-foreground/8 pt-4">'''
if anchor not in share:
    raise SystemExit('ready email form anchor missing')
share_path.write_text(share.replace(anchor, replacement, 1))
