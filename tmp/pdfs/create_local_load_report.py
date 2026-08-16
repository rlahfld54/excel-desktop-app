from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.graphics.shapes import Drawing, Rect, String

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "output" / "pdf" / "local-vite-load-test-report.pdf"
pdfmetrics.registerFont(TTFont("Malgun", r"C:\Windows\Fonts\malgun.ttf"))
pdfmetrics.registerFont(TTFont("MalgunBold", r"C:\Windows\Fonts\malgunbd.ttf"))

PAGE_W, PAGE_H = A4
NAVY = colors.HexColor("#15233B")
BLUE = colors.HexColor("#2563EB")
GREEN = colors.HexColor("#15803D")
ORANGE = colors.HexColor("#D97706")
RED = colors.HexColor("#DC2626")
INK = colors.HexColor("#1F2937")
MUTED = colors.HexColor("#64748B")
LINE = colors.HexColor("#D8E0EA")
PALE_GREEN = colors.HexColor("#F0FDF4")
PALE_BLUE = colors.HexColor("#EFF6FF")
PALE_ORANGE = colors.HexColor("#FFF7ED")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="TitleKo", fontName="MalgunBold", fontSize=22, leading=30, textColor=NAVY, spaceAfter=5))
styles.add(ParagraphStyle(name="SubtitleKo", fontName="Malgun", fontSize=10.5, leading=16, textColor=MUTED, spaceAfter=12))
styles.add(ParagraphStyle(name="SectionKo", fontName="MalgunBold", fontSize=14, leading=20, textColor=NAVY, spaceBefore=10, spaceAfter=7))
styles.add(ParagraphStyle(name="BodyKo", fontName="Malgun", fontSize=10.2, leading=16, textColor=INK, spaceAfter=6))
styles.add(ParagraphStyle(name="SmallKo", fontName="Malgun", fontSize=8.7, leading=13, textColor=MUTED))
styles.add(ParagraphStyle(name="HeaderKo", fontName="MalgunBold", fontSize=9.5, leading=14, textColor=colors.white, alignment=1))
styles.add(ParagraphStyle(name="MetricKo", fontName="MalgunBold", fontSize=19, leading=24, textColor=NAVY, alignment=1))
styles.add(ParagraphStyle(name="MetricLabel", fontName="Malgun", fontSize=8.7, leading=12, textColor=MUTED, alignment=1))
styles.add(ParagraphStyle(name="Callout", fontName="MalgunBold", fontSize=11.5, leading=18, textColor=GREEN))


def P(text, style="BodyKo"):
    return Paragraph(text, styles[style])


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.line(18 * mm, 15 * mm, PAGE_W - 18 * mm, 15 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont("Malgun", 8)
    canvas.drawString(18 * mm, 9.5 * mm, "로컬 Vite 부하 테스트 - localhost:5173 메인 화면")
    canvas.drawRightString(PAGE_W - 18 * mm, 9.5 * mm, str(doc.page))
    canvas.restoreState()


def chart():
    items = [("10명", 12.72, GREEN), ("50명", 52.74, BLUE), ("200명", 210.6, ORANGE)]
    d = Drawing(492, 145)
    d.add(String(0, 130, "평균 응답 시간(ms) - 낮을수록 좋음", fontName="MalgunBold", fontSize=10, fillColor=NAVY))
    max_value = 240
    base_y = 25
    chart_h = 82
    for tick in [0, 60, 120, 180, 240]:
        y = base_y + chart_h * tick / max_value
        d.add(Rect(45, y, 415, 0.35, fillColor=LINE, strokeColor=None))
        d.add(String(7, y - 3, str(tick), fontName="Malgun", fontSize=8, fillColor=MUTED))
    for index, (label, value, color) in enumerate(items):
        x = 95 + index * 130
        h = chart_h * value / max_value
        d.add(Rect(x, base_y, 62, h, fillColor=color, strokeColor=color))
        d.add(String(x + 8, base_y + h + 7, f"{value:.0f}ms", fontName="MalgunBold", fontSize=10, fillColor=INK))
        d.add(String(x + 12, 7, label, fontName="Malgun", fontSize=9, fillColor=INK))
    return d


story = [
    P("로컬 부하 테스트 결과", "TitleKo"),
    P("Vite 개발 서버의 메인 화면(localhost:5173) - 30초 반복 요청 결과", "SubtitleKo"),
]

scope = Table([
    [P("테스트 대상", "SmallKo"), P("GET /", "BodyKo"), P("테스트 도구", "SmallKo"), P("autocannon", "BodyKo")],
    [P("각 테스트 시간", "SmallKo"), P("30초", "BodyKo"), P("검증 범위", "SmallKo"), P("Vite 화면 제공", "BodyKo")],
], colWidths=[30*mm, 57*mm, 30*mm, 57*mm])
scope.setStyle(TableStyle([
    ("BOX", (0, 0), (-1, -1), 0.6, LINE), ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
]))
story.extend([scope, Spacer(1, 10), P("결과 비교", "SectionKo")])

rows = [
    [P("동시 연결", "HeaderKo"), P("총 요청", "HeaderKo"), P("평균 응답", "HeaderKo"), P("p99 응답", "HeaderKo"), P("최대 응답", "HeaderKo"), P("평균 처리량", "HeaderKo")],
    [P("10명", "BodyKo"), P("약 23,000건", "BodyKo"), P("12.72ms", "BodyKo"), P("24ms", "BodyKo"), P("73ms", "BodyKo"), P("초당 757건", "BodyKo")],
    [P("50명", "BodyKo"), P("약 28,000건", "BodyKo"), P("52.74ms", "BodyKo"), P("77ms", "BodyKo"), P("147ms", "BodyKo"), P("초당 941건", "BodyKo")],
    [P("200명", "BodyKo"), P("약 29,000건", "BodyKo"), P("210.6ms", "BodyKo"), P("333ms", "BodyKo"), P("538ms", "BodyKo"), P("초당 953건", "BodyKo")],
]
comparison = Table(rows, colWidths=[25*mm, 33*mm, 31*mm, 31*mm, 31*mm, 31*mm])
comparison.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), NAVY), ("BACKGROUND", (0, 1), (-1, 1), PALE_GREEN),
    ("BACKGROUND", (0, 2), (-1, 2), PALE_BLUE), ("BACKGROUND", (0, 3), (-1, 3), PALE_ORANGE),
    ("BOX", (0, 0), (-1, -1), 0.6, LINE), ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
    ("ALIGN", (0, 0), (-1, -1), "CENTER"), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
]))
story.extend([comparison, Spacer(1, 8), chart(), Spacer(1, 3)])

callout = Table([[P("한 줄 결론: 200명 동시 연결에서도 실패 없이 동작했지만, 응답 시간은 10명 때보다 약 16배 늘었습니다. 처리량은 초당 약 950건 근처에서 더 이상 크게 오르지 않아, 이 환경의 포화 구간으로 보입니다.", "Callout")]], colWidths=[174*mm])
callout.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), PALE_GREEN), ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#86EFAC")),
    ("LEFTPADDING", (0, 0), (-1, -1), 12), ("RIGHTPADDING", (0, 0), (-1, -1), 12),
    ("TOPPADDING", (0, 0), (-1, -1), 10), ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
]))
story.extend([callout, P("주의: 이 결과는 메인 화면 파일을 제공하는 Vite 개발 서버 기준입니다. Electron 내부 SQLite, 엑셀 처리, AWS API 동기화의 동시 사용 성능은 포함하지 않습니다.", "SmallKo")])

doc = SimpleDocTemplate(str(OUTPUT), pagesize=A4, rightMargin=18*mm, leftMargin=18*mm, topMargin=17*mm, bottomMargin=21*mm, title="로컬 Vite 부하 테스트 결과", author="Codex")
doc.build(story, onFirstPage=footer)
print(OUTPUT)
