from pathlib import Path

red_antler_path = Path("src/song-room-red-antler-overview.test.ts")
red_antler = red_antler_path.read_text()
red_antler = red_antler.replace(
    "    expect(music).toContain('Review this record');\n    expect(music).toContain('See what needs attention.');",
    "    expect(music).toContain('Review record');\n    expect(music).toContain('Manager review');",
)
red_antler_path.write_text(red_antler)

width_path = Path("src/desktop-workspace-width.test.ts")
width = width_path.read_text()
width = width.replace(
    '    expect(music).toContain("See what needs attention.");\n    expect(music).toContain("Review this record");',
    '    expect(music).toContain("Manager review");\n    expect(music).toContain("Review record");',
)
width_path.write_text(width)
