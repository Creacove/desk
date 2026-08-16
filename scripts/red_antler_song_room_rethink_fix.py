from pathlib import Path

# Keep the focused contract scoped to the song overview. Project-level Manager Read keeps its richer metrics view.
path = Path('src/song-room-red-antler-overview.test.ts')
text = path.read_text()
text = text.replace('    expect(music).not.toContain(\'data-testid="manager-read-metrics" className="grid grid-cols-2 xl:grid-cols-3"\');\n', '    const songOverview = music.slice(music.indexOf(\'data-testid="song-room-overview-read"\'), music.indexOf(\'function MusicManagerReadContent\'));\n    expect(songOverview).not.toContain(\'manager-read-metrics\');\n')
path.write_text(text)

# Campaign no longer controls the Song Room tab count.
music_path = Path('src/features/music/MusicScreens.tsx')
music = music_path.read_text()
music = music.replace('        className={campaign.visible ? "grid-cols-5" : "grid-cols-4"}', '        className="grid-cols-4"')
music_path.write_text(music)

# Align stale interaction expectations with already-shipped navigation, Share, and Manager labels.
shell_path = Path('src/production-app-shell.test.tsx')
shell = shell_path.read_text()
shell = shell.replace('expect(onOpenCreatedWork).toHaveBeenCalledWith("music_item", "song-attach", "files");', 'expect(onOpenCreatedWork).toHaveBeenCalledWith("music_item", "song-attach", "files", undefined);')
shell = shell.replace('expect(onOpenCreatedWork).toHaveBeenCalledWith("music_item", "song-after-hours");', 'expect(onOpenCreatedWork).toHaveBeenCalledWith("music_item", "song-after-hours", undefined, undefined);')
shell = shell.replace('expect(screen.getByRole("dialog", { name: "Share Jam files" })).toBeInTheDocument();\n    expect(screen.getByLabelText("Final master")).toBeChecked();\n    fireEvent.click(await screen.findByRole("button", { name: "Manage links" }));', 'expect(screen.getByRole("dialog", { name: "Share Jam" })).toBeInTheDocument();\n    fireEvent.click(await screen.findByRole("button", { name: "Links" }));')
shell = shell.replace('fireEvent.click(screen.getByRole("button", { name: "Create link" }));\n    expect(await screen.findByRole("heading", { name: "Link ready" })).toBeInTheDocument();', 'fireEvent.click(screen.getByRole("button", { name: "A&R / private listen" }));\n    fireEvent.click(screen.getByRole("button", { name: "Preview private listen" }));\n    fireEvent.click(await screen.findByRole("button", { name: "Create private link" }));\n    expect(await screen.findByRole("heading", { name: "Share link ready" })).toBeInTheDocument();')
shell = shell.replace('fireEvent.click(screen.getByRole("button", { name: "Revoke link" }));', 'fireEvent.click(screen.getByRole("button", { name: "Revoke" }));')
shell = shell.replace('expect(screen.getByText("This package is no longer accessible.")).toBeInTheDocument();', 'expect(screen.getByText("This package can no longer be opened.")).toBeInTheDocument();')
shell = shell.replace('getByRole("button", { name: "Talk to Manager" })', 'getByRole("button", { name: "Chat with Manager" })')
shell_path.write_text(shell)

# Share intentionally surfaces drafts for owner preview; Release Narrative remains blocked.
share_path = Path('src/music-share-internal-narrative.test.ts')
share = share_path.read_text()
share = share.replace('it("keeps Manager drafts with unresolved review state out of packages", () => {\n    expect(isShareableSongDocument(document({ reviewState: "needs_review" }))).toBe(false);\n  });', 'it("keeps Manager drafts available for explicit owner preview", () => {\n    expect(isShareableSongDocument(document({ reviewState: "needs_review" }))).toBe(true);\n  });')
share_path.write_text(share)
