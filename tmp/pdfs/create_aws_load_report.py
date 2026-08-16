from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    KeepTogether, PageBreak
)

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "output" / "pdf" / "aws-50-user-load-test-report.pdf"
FONT = r"C:\Windows\Fonts\malgun.ttf"
FONT_BOLD = r"C:\Windows\Fonts\malgunbd.ttf"

pdfmetrics.registerFont(TTFont("Malgun", FONT))
pdfmetrics.registerFont(TTFont("MalgunBold", FONT_BOLD))

PAGE_W, PAGE_H = A4
NAVY = colors.HexColor("#15233B")
BLUE = colors.HexColor("#2563EB")
GREEN = colors.HexColor("#15803D")
RED = colors.HexColor("#DC2626")
ORANGE = colors.HexColor("#D97706")
INK = colors.HexColor("#1F2937")
MUTED = colors.HexColor("#64748B")
LINE = colors.HexColor("#D8E0EA")
PALE_BLUE = colors.HexColor("#EFF6FF")
PALE_RED = colors.HexColor("#FEF2F2")
PALE_GREEN = colors.HexColor("#F0FDF4")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    name="TitleKo", fontName="MalgunBold", fontSize=22, leading=30,
    textColor=NAVY, spaceAfter=5,
))
styles.add(ParagraphStyle(
    name="SubtitleKo", fontName="Malgun", fontSize=10.5, leading=16,
    textColor=MUTED, spaceAfter=14,
))
styles.add(ParagraphStyle(
    name="SectionKo", fontName="MalgunBold", fontSize=14, leading=20,
    textColor=NAVY, spaceBefore=12, spaceAfter=8,
))
styles.add(ParagraphStyle(
    name="BodyKo", fontName="Malgun", fontSize=10.2, leading=16,
    textColor=INK, spaceAfter=7,
))
styles.add(ParagraphStyle(
    name="SmallKo", fontName="Malgun", fontSize=8.7, leading=13,
    textColor=MUTED,
))
styles.add(ParagraphStyle(
    name="MetricValue", fontName="MalgunBold", fontSize=20, leading=25,
    textColor=NAVY, alignment=TA_CENTER,
))
styles.add(ParagraphStyle(
    name="MetricLabel", fontName="Malgun", fontSize=9, leading=13,
    textColor=MUTED, alignment=TA_CENTER,
))
styles.add(ParagraphStyle(
    name="MetricNote", fontName="Malgun", fontSize=8.5, leading=12,
    textColor=INK, alignment=TA_CENTER,
))
styles.add(ParagraphStyle(
    name="Callout", fontName="MalgunBold", fontSize=12, leading=19,
    textColor=RED,
))
styles.add(ParagraphStyle(
    name="TableHeader", fontName="MalgunBold", fontSize=10.2, leading=16,
    textColor=colors.white,
))


def P(text, style="BodyKo"):
    return Paragraph(text, styles[style])


def metric(value, label, note):
    return [P(value, "MetricValue"), P(label, "MetricLabel"), P(note, "MetricNote")]


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(18 * mm, 15 * mm, PAGE_W - 18 * mm, 15 * mm)
    canvas.setFont("Malgun", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(18 * mm, 9.5 * mm, "AWS 50명 수준 부하 테스트 - 읽기 전용 /health 결과")
    canvas.drawRightString(PAGE_W - 18 * mm, 9.5 * mm, f"{doc.page}")
    canvas.restoreState()


story = []
story.append(P("AWS 부하 테스트 결과", "TitleKo"))
story.append(P("50명 수준의 접근을 가정한 /health 테스트 - 2026-08-14", "SubtitleKo"))

summary = Table([
    [P("테스트 대상", "SmallKo"), P("AWS API Gateway -> Lambda", "BodyKo"), P("테스트 경로", "SmallKo"), P("GET /health", "BodyKo")],
    [P("테스트 방식", "SmallKo"), P("초당 50회 요청, 30초", "BodyKo"), P("총 요청 수", "SmallKo"), P("1,500회", "BodyKo")],
], colWidths=[27*mm, 60*mm, 27*mm, 60*mm])
summary.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), colors.white),
    ("BOX", (0, 0), (-1, -1), 0.6, LINE),
    ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ("TOPPADDING", (0, 0), (-1, -1), 7),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
]))
story.append(summary)
story.append(Spacer(1, 11))

story.append(P("한 줄 결론", "SectionKo"))
callout = Table([[P("50명 수준의 요청에서는 약 10건 중 7건이 AWS에서 거절됐습니다. 화면이 느린 문제가 아니라, Lambda가 동시에 처리할 수 있는 수를 넘어서 503 오류가 발생한 상황입니다.", "Callout")]], colWidths=[174*mm])
callout.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), PALE_RED),
    ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#FCA5A5")),
    ("LEFTPADDING", (0, 0), (-1, -1), 12),
    ("RIGHTPADDING", (0, 0), (-1, -1), 12),
    ("TOPPADDING", (0, 0), (-1, -1), 11),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 11),
]))
story.append(callout)
story.append(Spacer(1, 10))

metrics = Table([
    [metric("458건", "정상 응답", "30.5%"), metric("1,042건", "503 처리 불가", "69.5%"), metric("10개", "동시 실행 최대", "Lambda 모니터링")],
], colWidths=[58*mm, 58*mm, 58*mm])
metrics.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (0, 0), PALE_GREEN),
    ("BACKGROUND", (1, 0), (1, 0), PALE_RED),
    ("BACKGROUND", (2, 0), (2, 0), PALE_BLUE),
    ("BOX", (0, 0), (-1, -1), 0.6, LINE),
    ("INNERGRID", (0, 0), (-1, -1), 0.6, LINE),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("TOPPADDING", (0, 0), (-1, -1), 12),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
]))
story.append(metrics)

story.append(P("응답 시간", "SectionKo"))
latency = Table([
    [P("평균", "SmallKo"), P("중앙값", "SmallKo"), P("p99", "SmallKo"), P("가장 느린 응답", "SmallKo")],
    [P("49ms", "MetricValue"), P("14ms", "MetricValue"), P("431ms", "MetricValue"), P("486ms", "MetricValue")],
], colWidths=[43.5*mm]*4)
latency.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F8FAFC")),
    ("BOX", (0, 0), (-1, -1), 0.6, LINE),
    ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("TOPPADDING", (0, 0), (-1, -1), 8),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
]))
story.append(latency)
story.append(P("응답 시간이 빠르게 보이는 일부 요청은 성공한 것이 아니라 503으로 즉시 거절된 요청일 수 있습니다. 그래서 이번 테스트의 핵심은 속도보다 성공률입니다.", "SmallKo"))

story.append(PageBreak())
story.append(P("왜 503 오류가 났나", "TitleKo"))
story.append(P("제공해주신 Lambda 모니터링 화면의 숫자를 바탕으로 정리했습니다.", "SubtitleKo"))

evidence = [
    [P("확인된 수치", "TableHeader"), P("쉬운 해석", "TableHeader")],
    [P("Throttles 최대 1,042", "BodyKo"), P("Lambda가 받을 수 있는 동시 요청을 넘어선 1,042건을 차단했습니다. 테스트의 503 건수와 정확히 일치합니다.", "BodyKo")],
    [P("동시 실행 최대 10", "BodyKo"), P("동시에 처리할 수 있는 Lambda 실행 수가 10개 근처에서 멈췄습니다. 현재 제한 또는 설정을 먼저 확인해야 합니다.", "BodyKo")],
    [P("함수 오류 0, 성공률 100%", "BodyKo"), P("실행을 시작한 Lambda 자체는 정상 동작했습니다. 코드 오류보다 처리량 제한이 먼저 문제입니다.", "BodyKo")],
    [P("메모리 256MB, 사용 약 111MB", "BodyKo"), P("제공된 화면만 보면 메모리 부족 증거는 없습니다. 메모리 증설보다 동시 실행 제한 확인이 우선입니다.", "BodyKo")],
]
evidence_table = Table(evidence, colWidths=[48*mm, 126*mm], repeatRows=1)
evidence_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), NAVY),
    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
    ("BOX", (0, 0), (-1, -1), 0.6, LINE),
    ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ("TOPPADDING", (0, 0), (-1, -1), 8),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
]))
story.append(evidence_table)

story.append(P("권장 순서", "SectionKo"))
steps = [
    "1. Lambda 콘솔 -> 구성 -> 동시성에서 '예약된 동시성' 값을 확인합니다. 10으로 고정되어 있다면 테스트용으로 20부터 올립니다.",
    "2. 20 -> 30 -> 50 순서로 같은 읽기 전용 테스트를 반복합니다. 한 번에 크게 올리면 RDS 연결이 다음 병목이 될 수 있습니다.",
    "3. 실제 업무 테스트는 /health가 아니라 인증된 테스트 계정으로 조회 기능을 대상으로 만듭니다. 저장, 업로드, 삭제 요청은 데이터가 바뀌므로 별도 테스트 환경에서만 실행합니다.",
    "4. RDS에 직접 연결하는 Lambda라면 RDS Proxy 또는 연결 재사용을 검토합니다. 동시 실행 수를 올릴 때 DB 연결 폭증을 막는 데 도움이 됩니다.",
]
for item in steps:
    story.append(P(item, "BodyKo"))

next_box = Table([[P("다음 확인 화면: Lambda -> 구성 -> 동시성\n이 화면에서 예약된 동시성 값이 10인지 확인하면, 이번 503 오류의 직접 원인을 확정할 수 있습니다.", "BodyKo")]], colWidths=[174*mm])
next_box.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), PALE_BLUE),
    ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#93C5FD")),
    ("LEFTPADDING", (0, 0), (-1, -1), 12),
    ("RIGHTPADDING", (0, 0), (-1, -1), 12),
    ("TOPPADDING", (0, 0), (-1, -1), 10),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
]))
story.append(Spacer(1, 6))
story.append(next_box)

doc = SimpleDocTemplate(
    str(OUTPUT), pagesize=A4,
    rightMargin=18*mm, leftMargin=18*mm,
    topMargin=17*mm, bottomMargin=21*mm,
    title="AWS 50명 수준 부하 테스트 결과",
    author="Codex",
)
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print(OUTPUT)
