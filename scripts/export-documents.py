#!/usr/bin/env python3
"""Build the offline report and presentation artifacts for Ví Nhỏ.

Outputs (all under docs/):
  report.html, report.pdf, report.docx
  presentation.html, presentation.pdf, presentation.pptx

The HTML uses only external docs.css/presentation.js so it remains compatible
with the application's strict route-scoped Content Security Policy.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
REPORT_SOURCE = DOCS / "report.md"
SLIDES_SOURCE = DOCS / "presentation.md"
EVIDENCE_SOURCE = DOCS / "test-evidence.json"
PAGE_BREAK = "<!-- PAGE -->"
SLIDE_BREAK = "<!-- SLIDE -->"


def require_modules() -> tuple[object, object]:
    try:
        import markdown  # type: ignore
        from bs4 import BeautifulSoup  # type: ignore
    except ImportError as exc:
        raise SystemExit(
            "Thiếu thư viện tạo tài liệu. Cài Python packages: markdown beautifulsoup4 "
            "python-docx python-pptx PyMuPDF"
        ) from exc
    return markdown, BeautifulSoup


MARKDOWN, BEAUTIFUL_SOUP = require_modules()


def read_utf8(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def load_context() -> dict[str, str]:
    default = "Chưa chốt; hãy chạy npm test và cập nhật docs/test-evidence.json."
    context = {"TEST_SUMMARY": default}
    if EVIDENCE_SOURCE.exists():
        value = json.loads(read_utf8(EVIDENCE_SOURCE))
        summary = str(value.get("summary", "")).strip()
        if summary:
            context["TEST_SUMMARY"] = summary
    return context


def interpolate(source: str, context: dict[str, str]) -> str:
    for key, value in context.items():
        source = source.replace("{{" + key + "}}", value)
    unresolved = sorted(set(re.findall(r"\{\{[A-Z0-9_]+\}\}", source)))
    if unresolved:
        raise ValueError("Token tài liệu chưa được thay: " + ", ".join(unresolved))
    return source


def render_markdown(source: str) -> str:
    return MARKDOWN.markdown(
        source,
        extensions=["extra", "sane_lists"],
        output_format="html5",
    )


def first_heading(source: str) -> str:
    match = re.search(r"^#\s+(.+?)\s*$", source, flags=re.MULTILINE)
    return match.group(1).strip() if match else "Ví Nhỏ"


def order_report_pages(pages: list[str]) -> list[str]:
    """Keep cover/summary first and assignment chapters in numeric order."""
    decorated: list[tuple[float, int, str]] = []
    for index, page in enumerate(pages):
        heading = first_heading(page)
        if index == 0 or heading == "HỆ THỐNG QUẢN LÝ TÀI CHÍNH CÁ NHÂN":
            rank = -2.0
        elif heading.startswith("Tóm tắt"):
            rank = -1.0
        else:
            match = re.match(r"(\d+)\.", heading)
            rank = float(match.group(1)) if match else 99.0
        decorated.append((rank, index, page))
    return [page for _, _, page in sorted(decorated, key=lambda item: (item[0], item[1]))]


def report_html(pages: list[str]) -> str:
    sections = []
    total = len(pages)
    for index, page in enumerate(pages, start=1):
        classes = "report-page cover-page" if index == 1 else "report-page"
        content = render_markdown(page)
        sections.append(
            f'<section class="{classes}" aria-label="Trang {index} trên {total}">'
            f'<div class="report-content">{content}</div>'
            '<footer class="page-footer"><span>Ví Nhỏ · Hệ thống quản lý tài chính cá nhân</span>'
            f'<span>{index} / {total}</span></footer></section>'
        )
    return """<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="Báo cáo dự án cuối kỳ FinTech Ví Nhỏ">
  <title>Ví Nhỏ — Báo cáo dự án cuối kỳ FinTech</title>
  <link rel="stylesheet" href="docs.css">
</head>
<body class="report-body">
  <nav class="document-toolbar" aria-label="Tài liệu">
    <a href="presentation.html">Mở slide</a>
    <a href="report.pdf">PDF</a>
    <a href="report.docx">DOCX</a>
  </nav>
  <main class="report-document">""" + "".join(sections) + """</main>
</body>
</html>
"""


def slides_html(slides: list[str]) -> str:
    sections = []
    total = len(slides)
    for index, slide in enumerate(slides, start=1):
        active = " active" if index == 1 else ""
        sections.append(
            f'<section class="slide{active}" id="slide-{index}" data-number="{index}" '
            f'data-total="{total}" aria-label="Slide {index} trên {total}">'
            f'<div class="slide-content">{render_markdown(slide)}</div></section>'
        )
    return """<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="Slide bảo vệ dự án FinTech Ví Nhỏ">
  <title>Ví Nhỏ — Presentation</title>
  <link rel="stylesheet" href="docs.css">
  <script defer src="presentation.js"></script>
</head>
<body class="slides-body">
  <nav class="slide-toolbar" aria-label="Điều khiển slide">
    <a href="report.html">Báo cáo</a>
    <button type="button" data-previous aria-label="Slide trước">←</button>
    <span data-slide-counter aria-live="polite"></span>
    <button type="button" data-next aria-label="Slide sau">→</button>
    <button type="button" data-fullscreen>Toàn màn hình</button>
    <button type="button" data-print>In</button>
  </nav>
  <main class="slide-deck">""" + "".join(sections) + """</main>
  <progress class="slide-progress" max="1" value="1" aria-label="Tiến độ slide"></progress>
</body>
</html>
"""


def set_cell_text(cell: object, text: str) -> None:
    cell.text = text
    for paragraph in cell.paragraphs:
        for run in paragraph.runs:
            run.font.name = "Arial"
            run.font.size = Pt(8.5)


def build_docx(pages: list[str], output: Path) -> None:
    try:
        from docx import Document
        from docx.enum.text import WD_ALIGN_PARAGRAPH
        from docx.oxml import OxmlElement
        from docx.oxml.ns import qn
        from docx.shared import Mm, Pt, RGBColor
    except ImportError as exc:
        raise RuntimeError("python-docx chưa được cài") from exc

    globals().update({"Pt": Pt})  # Used by set_cell_text without repeated imports.
    document = Document()
    section = document.sections[0]
    section.page_width, section.page_height = Mm(210), Mm(297)
    section.top_margin, section.bottom_margin = Mm(18), Mm(17)
    section.left_margin, section.right_margin = Mm(20), Mm(18)
    normal = document.styles["Normal"]
    normal.font.name = "Arial"
    normal.font.size = Pt(10.5)
    normal.paragraph_format.space_after = Pt(4)
    normal.paragraph_format.line_spacing = 1.15
    for name, size, color in (("Title", 28, "173F31"), ("Heading 1", 18, "173F31"),
                              ("Heading 2", 13, "2D6A4F"), ("Heading 3", 11, "2D6A4F")):
        style = document.styles[name]
        style.font.name = "Arial"
        style.font.size = Pt(size)
        style.font.color.rgb = RGBColor.from_string(color)

    document.core_properties.title = "Hệ thống quản lý tài chính cá nhân — Ví Nhỏ"
    document.core_properties.subject = "Báo cáo dự án cuối kỳ FinTech"

    def append_inline(paragraph: object, node: object) -> None:
        if getattr(node, "name", None) is None:
            paragraph.add_run(str(node))
            return
        if node.name == "br":
            paragraph.add_run().add_break()
            return
        run = paragraph.add_run(node.get_text("", strip=False))
        run.bold = node.name in {"strong", "b"}
        run.italic = node.name in {"em", "i"}
        if node.name == "code":
            run.font.name = "Consolas"
            run.font.size = Pt(9)

    def add_paragraph_from(tag: object, style: str | None = None) -> object:
        paragraph = document.add_paragraph(style=style)
        for child in tag.children:
            append_inline(paragraph, child)
        return paragraph

    for page_index, source in enumerate(pages):
        if page_index:
            document.add_page_break()
        soup = BEAUTIFUL_SOUP(render_markdown(source), "html.parser")
        for node in list(soup.children):
            name = getattr(node, "name", None)
            if not name:
                continue
            if name in {"h1", "h2", "h3"}:
                level = {"h1": 1, "h2": 2, "h3": 3}[name]
                heading = document.add_heading(node.get_text(" ", strip=True), level=level)
                if page_index == 0 and name == "h1":
                    heading.style = document.styles["Title"]
                    heading.alignment = WD_ALIGN_PARAGRAPH.CENTER
            elif name == "p":
                add_paragraph_from(node)
            elif name in {"ul", "ol"}:
                style = "List Bullet" if name == "ul" else "List Number"
                for item in node.find_all("li", recursive=False):
                    document.add_paragraph(item.get_text(" ", strip=True), style=style)
            elif name == "blockquote":
                paragraph = document.add_paragraph(node.get_text(" ", strip=True))
                paragraph.paragraph_format.left_indent = Mm(7)
                for run in paragraph.runs:
                    run.italic = True
                    run.font.color.rgb = RGBColor(80, 91, 83)
            elif name == "table":
                rows = node.find_all("tr")
                columns = max((len(row.find_all(["th", "td"], recursive=False)) for row in rows), default=1)
                table = document.add_table(rows=len(rows), cols=columns)
                table.style = "Light Shading Accent 1"
                for row_index, row in enumerate(rows):
                    cells = row.find_all(["th", "td"], recursive=False)
                    for column_index, cell in enumerate(cells):
                        set_cell_text(table.cell(row_index, column_index), cell.get_text(" ", strip=True))
            elif name == "pre":
                paragraph = document.add_paragraph(node.get_text("\n", strip=False))
                paragraph.paragraph_format.left_indent = Mm(4)
                for run in paragraph.runs:
                    run.font.name = "Consolas"
                    run.font.size = Pt(7.5)

    footer = document.sections[0].footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    footer.add_run("Ví Nhỏ · Báo cáo dự án cuối kỳ FinTech · ")
    field = OxmlElement("w:fldSimple")
    field.set(qn("w:instr"), "PAGE")
    footer._p.append(field)
    document.save(output)


def slide_parts(source: str) -> tuple[str, list[tuple[str, str]]]:
    soup = BEAUTIFUL_SOUP(render_markdown(source), "html.parser")
    heading = soup.find("h1")
    title = heading.get_text(" ", strip=True) if heading else "Ví Nhỏ"
    if heading:
        heading.extract()
    items: list[tuple[str, str]] = []
    for node in list(soup.children):
        name = getattr(node, "name", None)
        if not name:
            continue
        if name in {"h2", "h3"}:
            items.append(("section", node.get_text(" ", strip=True)))
        elif name == "p":
            text = node.get_text(" ", strip=True)
            if text:
                items.append(("body", text))
        elif name in {"ul", "ol"}:
            for number, item in enumerate(node.find_all("li", recursive=False), start=1):
                prefix = f"{number}. " if name == "ol" else "• "
                items.append(("bullet", prefix + item.get_text(" ", strip=True)))
        elif name == "blockquote":
            items.append(("quote", node.get_text(" ", strip=True)))
        elif name == "table":
            for row_index, row in enumerate(node.find_all("tr")):
                values = [cell.get_text(" ", strip=True) for cell in row.find_all(["th", "td"], recursive=False)]
                if values:
                    items.append(("table_head" if row_index == 0 else "table", "  ·  ".join(values)))
    return title, items


def build_pptx(slides: list[str], output: Path) -> None:
    try:
        from pptx import Presentation
        from pptx.dml.color import RGBColor
        from pptx.enum.shapes import MSO_SHAPE
        from pptx.enum.text import MSO_ANCHOR, MSO_AUTO_SIZE, PP_ALIGN
        from pptx.util import Inches, Pt
    except ImportError as exc:
        raise RuntimeError("python-pptx chưa được cài") from exc

    prs = Presentation()
    prs.slide_width, prs.slide_height = Inches(13.333333), Inches(7.5)
    blank = prs.slide_layouts[6]
    forest, green, paper = RGBColor(23, 63, 49), RGBColor(45, 106, 79), RGBColor(255, 254, 249)
    ink, muted, amber, sage = RGBColor(23, 37, 29), RGBColor(86, 101, 92), RGBColor(199, 133, 53), RGBColor(223, 236, 226)

    def text_box(slide: object, x: float, y: float, w: float, h: float, text: str,
                 size: float, color: object, bold: bool = False) -> object:
        shape = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
        frame = shape.text_frame
        frame.clear()
        frame.margin_left = frame.margin_right = Inches(0.02)
        frame.margin_top = frame.margin_bottom = Inches(0.02)
        paragraph = frame.paragraphs[0]
        paragraph.text = text
        paragraph.font.name = "Arial"
        paragraph.font.size = Pt(size)
        paragraph.font.bold = bold
        paragraph.font.color.rgb = color
        return shape

    for index, source in enumerate(slides, start=1):
        title, items = slide_parts(source)
        slide = prs.slides.add_slide(blank)
        background = slide.background.fill
        background.solid()
        background.fore_color.rgb = forest if index == 1 else paper

        if index == 1:
            text_box(slide, .9, .55, 5.5, .35, "VÍ NHỎ · FINTECH", 12, RGBColor(191, 224, 189), True)
            text_box(slide, .9, 1.65, 10.8, 1.55, title, 34, RGBColor(255, 255, 255), True)
            body = "\n".join(text for _, text in items)
            shape = text_box(slide, .95, 3.4, 9.8, 2.4, body, 17, RGBColor(235, 245, 232))
            shape.text_frame.paragraphs[0].font.color.rgb = RGBColor(240, 189, 109)
        else:
            accent = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(.55), Inches(.62), Inches(.09), Inches(1.0))
            accent.fill.solid(); accent.fill.fore_color.rgb = amber; accent.line.fill.background()
            text_box(slide, .85, .42, 4.5, .25, "VÍ NHỎ · FINTECH", 10, green, True)
            text_box(slide, .85, .83, 11.3, .78, title, 27, forest, True)
            panel = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(.78), Inches(1.83), Inches(11.75), Inches(4.85))
            panel.fill.solid(); panel.fill.fore_color.rgb = RGBColor(247, 250, 246)
            panel.line.color.rgb = sage
            frame = panel.text_frame
            frame.clear(); frame.margin_left = Inches(.25); frame.margin_right = Inches(.25)
            frame.margin_top = Inches(.18); frame.margin_bottom = Inches(.15)
            frame.vertical_anchor = MSO_ANCHOR.TOP
            frame.auto_size = MSO_AUTO_SIZE.TEXT_TO_FIT_SHAPE
            total_chars = sum(len(text) for _, text in items)
            font_size = 13.5 if total_chars > 1050 else 15 if total_chars > 750 else 17
            for item_index, (kind, text_value) in enumerate(items):
                paragraph = frame.paragraphs[0] if item_index == 0 else frame.add_paragraph()
                paragraph.text = text_value
                paragraph.font.name = "Arial"
                paragraph.font.size = Pt(font_size + (1.5 if kind == "section" else 0))
                paragraph.font.bold = kind in {"section", "table_head"}
                paragraph.font.color.rgb = green if kind == "section" else ink
                paragraph.space_after = Pt(5 if kind != "section" else 7)
                if kind == "quote":
                    paragraph.font.italic = True
                    paragraph.font.color.rgb = muted
        number = text_box(slide, 11.4, 7.05, 1.2, .22, f"{index} / {len(slides)}", 9, RGBColor(215, 232, 213) if index == 1 else muted)
        number.text_frame.paragraphs[0].alignment = PP_ALIGN.RIGHT

    prs.core_properties.title = "Hệ thống quản lý tài chính cá nhân — Ví Nhỏ"
    prs.core_properties.subject = "Presentation dự án cuối kỳ FinTech"
    prs.save(output)


def browser_binary() -> Path | None:
    candidates = [
        Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
        Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),
        Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
        Path(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
    ]
    for executable in candidates:
        if executable.exists():
            return executable
    for name in ("msedge", "chrome", "chromium"):
        found = shutil.which(name)
        if found:
            return Path(found)
    return None


def print_pdf(source: Path, output: Path) -> None:
    executable = browser_binary()
    if executable:
        with tempfile.TemporaryDirectory(prefix="vinho-print-") as profile:
            command = [
                str(executable), "--headless=new", "--disable-gpu", "--disable-extensions",
                "--no-first-run", "--no-default-browser-check", "--run-all-compositor-stages-before-draw",
                "--virtual-time-budget=2500", "--print-to-pdf-no-header",
                f"--user-data-dir={profile}", f"--print-to-pdf={output.resolve()}", source.resolve().as_uri(),
            ]
            result = subprocess.run(command, capture_output=True, text=True, timeout=90)
            if result.returncode == 0 and output.exists() and output.stat().st_size > 1000:
                return
            print("Trình duyệt không tạo được PDF, thử WeasyPrint.", file=sys.stderr)
            if result.stderr:
                print(result.stderr[-1000:], file=sys.stderr)
    try:
        from weasyprint import HTML  # type: ignore
        HTML(filename=str(source)).write_pdf(str(output))
    except Exception as exc:
        raise RuntimeError(f"Không thể tạo {output.name}: {exc}") from exc


def pdf_pages(path: Path) -> int:
    try:
        import fitz  # type: ignore
        with fitz.open(path) as document:
            return document.page_count
    except ImportError:
        return -1


def validate_outputs(report_pages: int, slide_pages: int) -> None:
    if not 14 <= report_pages <= 20:
        raise RuntimeError(f"report.pdf có {report_pages} trang; yêu cầu bản thiết kế là 14–20 trang gồm bìa/tham khảo.")
    if slide_pages != 14:
        raise RuntimeError(f"presentation.pdf có {slide_pages} trang; dự kiến đúng 14 slide.")
    for html_path in (DOCS / "report.html", DOCS / "presentation.html"):
        source = read_utf8(html_path)
        if re.search(r"<style(?:\s|>)", source, re.IGNORECASE):
            raise RuntimeError(f"{html_path.name} chứa style nội tuyến, không hợp CSP.")
        if re.search(r"<script(?![^>]*\bsrc=)", source, re.IGNORECASE):
            raise RuntimeError(f"{html_path.name} chứa script nội tuyến, không hợp CSP.")


def main() -> int:
    parser = argparse.ArgumentParser(description="Xuất bộ báo cáo/slide Ví Nhỏ")
    parser.add_argument("--skip-pdf", action="store_true", help="Không tạo PDF")
    args = parser.parse_args()

    context = load_context()
    report_source = interpolate(read_utf8(REPORT_SOURCE), context)
    slides_source = interpolate(read_utf8(SLIDES_SOURCE), context)
    pages = order_report_pages([part.strip() for part in report_source.split(PAGE_BREAK) if part.strip()])
    slides = [part.strip() for part in slides_source.split(SLIDE_BREAK) if part.strip()]
    if not 14 <= len(pages) <= 20:
        raise RuntimeError(f"Nguồn report có {len(pages)} trang thiết kế; yêu cầu 14–20.")
    if len(slides) != 14:
        raise RuntimeError(f"Nguồn presentation có {len(slides)} slide; yêu cầu đúng 14.")

    (DOCS / "report.html").write_text(report_html(pages), encoding="utf-8", newline="\n")
    (DOCS / "presentation.html").write_text(slides_html(slides), encoding="utf-8", newline="\n")
    build_docx(pages, DOCS / "report.docx")
    build_pptx(slides, DOCS / "presentation.pptx")

    if not args.skip_pdf:
        print_pdf(DOCS / "report.html", DOCS / "report.pdf")
        print_pdf(DOCS / "presentation.html", DOCS / "presentation.pdf")
        report_count = pdf_pages(DOCS / "report.pdf")
        slide_count = pdf_pages(DOCS / "presentation.pdf")
        if report_count >= 0 and slide_count >= 0:
            validate_outputs(report_count, slide_count)
            print(f"PDF: report={report_count} trang; presentation={slide_count} slide")

    print(f"Đã xuất {len(pages)} trang thiết kế và {len(slides)} slide vào {DOCS}")
    print("Test evidence:", context["TEST_SUMMARY"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
