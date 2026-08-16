from pathlib import Path

path = Path('src/song-room-red-antler-overview.test.ts')
text = path.read_text()
text = text.replace('    expect(music).not.toContain(\'data-testid="manager-read-metrics" className="grid grid-cols-2 xl:grid-cols-3"\');\n', '    const songOverview = music.slice(music.indexOf(\'data-testid="song-room-overview-read"\'), music.indexOf(\'function MusicManagerReadContent\'));\n    expect(songOverview).not.toContain(\'manager-read-metrics\');\n')
path.write_text(text)
