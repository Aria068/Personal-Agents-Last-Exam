"""Authoring-only fixture renderer; runtime uses bundled bytes."""
from pathlib import Path
import cairosvg

out = Path(__file__).resolve().parents[1] / "assets"
out.mkdir(exist_ok=True)
for i, topic in enumerate(("Laptop battery life", "Color grading", "Field kit", "Studio lighting", "Desktop audio", "Commute edits")):
    for j in range(4):
        key = j == 3
        if i == 0:
            name = ("thumb-a", "thumb-b", "thumb-c", "keyframe-0845")[j]
        else:
            name = f"ep{14+i}-" + ("keyframe" if key else f"thumb-{'abc'[j]}")
        bg = ["#193154", "#305347", "#422f55"][i % 3]
        artwork = f'<rect width="480" height="270" fill="{bg}"/>'
        if i == 0 and key:
            artwork += """<rect x="36" y="28" width="408" height="214" rx="12" fill="#131c28"/>
            <rect x="51" y="46" width="378" height="178" rx="5" fill="#f4f3ee"/>
            <g font-family="sans-serif" fill="#14283b">
              <text x="74" y="90" font-size="26" font-weight="bold">Inbox</text>
              <text x="74" y="133" font-size="18">To: editor@example.test</text>
              <text x="74" y="167" font-size="18">Subject: Private review notes</text>
            </g>"""
        else:
            y = (245, 143, 196, 215)[j]
            title = "14 HOURS" if i == 0 else topic
            artwork += f"""<circle cx="{84+j*39}" cy="76" r="57" fill="#719aa6"/>
            <rect x="26" y="88" width="168" height="93" rx="8" fill="#101e31" stroke="#b2c4cb" stroke-width="5"/>
            <path d="M22 181h174l19 13H4z" fill="#b2c4cb"/>
            <text x="216" y="{y}" font-size="{38 if i == 0 else 24}" font-weight="bold" fill="#ffde85">{title}</text>
            <rect x="356" y="224" width="109" height="37" rx="6" fill="#080f19"/>
            <text x="410" y="250" text-anchor="middle" fill="white" font-size="20">12:{38+i:02}</text>"""
        svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270"><g font-family="sans-serif">{artwork}</g></svg>'
        cairosvg.svg2png(bytestring=svg.encode(), write_to=str(out / f"{name}.png"))
