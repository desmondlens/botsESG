import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import ExcelJS from 'exceljs'

const NAVY   = '0C4A7C'
const SKY    = '0EA5E9'
const WHITE  = 'FFFFFF'
const LIGHT_BLUE = 'E0F2FE'
const GREEN  = '166534'
const GREEN_BG = 'DCFCE7'
const AMBER  = '92400E'
const AMBER_BG = 'FEF3C7'
const RED    = '991B1B'
const RED_BG  = 'FEE2E2'
const GRAY_BG = 'F8FAFC'
const GRAY_TEXT = '64748B'
const DARK   = '1E293B'

function headerStyle(bg = NAVY, fg = WHITE): Partial<ExcelJS.Style> {
  return {
    font: { name: 'Arial', bold: true, size: 10, color: { argb: `FF${fg}` } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${bg}` } },
    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
    border: {
      top: { style: 'thin', color: { argb: `FF${bg}` } },
      bottom: { style: 'thin', color: { argb: `FF${bg}` } },
      left: { style: 'thin', color: { argb: `FF${bg}` } },
      right: { style: 'thin', color: { argb: `FF${bg}` } },
    },
  }
}

function dataStyle(bg = WHITE, fg = DARK, bold = false): Partial<ExcelJS.Style> {
  return {
    font: { name: 'Arial', size: 10, color: { argb: `FF${fg}` }, bold },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${bg}` } },
    alignment: { vertical: 'middle', horizontal: 'left', wrapText: true },
    border: {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    },
  }
}

function centerStyle(bg = WHITE, fg = DARK, bold = false): Partial<ExcelJS.Style> {
  return { ...dataStyle(bg, fg, bold), alignment: { vertical: 'middle', horizontal: 'center', wrapText: true } }
}

function applyHeader(row: ExcelJS.Row, bg = NAVY, fg = WHITE) {
  row.height = 32
  row.eachCell((cell) => { cell.style = headerStyle(bg, fg) })
}

function scoreColor(score: number | null): string {
  if (score == null) return GRAY_BG
  if (score >= 70) return GREEN_BG
  if (score >= 40) return AMBER_BG
  return RED_BG
}

function scoreTextColor(score: number | null): string {
  if (score == null) return GRAY_TEXT
  if (score >= 70) return GREEN
  if (score >= 40) return AMBER
  return RED
}

function addSheet(wb: ExcelJS.Workbook, name: string, color: string): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(name)
  ws.views = [{ showGridLines: false }]
  // Tab color set via properties after creation
  const wsAny = ws as unknown as Record<string, unknown>
  if (wsAny.properties) {
    (wsAny.properties as Record<string, unknown>).tabColor = { argb: `FF${color}` }
  }
  return ws
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )

    const { reportId } = await req.json()
    if (!reportId) return NextResponse.json({ error: 'reportId required' }, { status: 400 })

    const { data: report } = await supabase
      .from('reports')
      .select('*, report_snapshots ( snapshot_data, cycle_id )')
      .eq('id', reportId)
      .single()

    if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

    const snap = Array.isArray(report.report_snapshots)
      ? report.report_snapshots[0]
      : report.report_snapshots

    const data = snap?.snapshot_data as Record<string, unknown>
    if (!data) return NextResponse.json({ error: 'Snapshot data missing' }, { status: 404 })

    const org       = data.organisation as Record<string, unknown> | null
    const cycle     = data.cycle as Record<string, unknown> | null
    const scores    = data.scores as Record<string, unknown> | null
    const responses = (data.responses as Array<Record<string, unknown>>) ?? []
    const materiality = (data.materiality_topics as Array<Record<string, unknown>>) ?? []
    const cycleInds = (data.cycle_indicators as Array<Record<string, unknown>>) ?? []

    const { data: ifrsDiscs } = await supabase
      .from('ifrs_disclosures')
      .select('*')
      .eq('cycle_id', snap.cycle_id)
      .order('disclosure_code')

    const { data: documents } = await supabase
      .from('documents')
      .select('filename, document_type, description, uploaded_at')
      .eq('cycle_id', snap.cycle_id)

    const materialIds = new Set(cycleInds.filter((ci) => ci.is_material).map((ci) => ci.indicator_id))

    const wb = new ExcelJS.Workbook()
    wb.creator = 'Botsfirm Solidarity ESG Platform'
    wb.created = new Date()
    wb.modified = new Date()

    // ═══════════════════════════════════════════════════════════════════════════
    // SHEET 1: DASHBOARD
    // ═══════════════════════════════════════════════════════════════════════════
    const dash = addSheet(wb, 'Dashboard', NAVY)

    dash.mergeCells('A1:H1')
    const titleCell = dash.getCell('A1')
    titleCell.value = 'BOTSFIRM SOLIDARITY — ESG ASSESSMENT REPORT'
    titleCell.style = {
      font: { name: 'Arial', bold: true, size: 16, color: { argb: `FF${WHITE}` } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${NAVY}` } },
      alignment: { vertical: 'middle', horizontal: 'left' },
    }
    dash.getRow(1).height = 40

    dash.mergeCells('A2:H2')
    const subCell = dash.getCell('A2')
    subCell.value = `${org?.name ?? '—'} · ${cycle?.period_start ?? '—'} to ${cycle?.period_end ?? '—'} · v${report.report_version}`
    subCell.style = {
      font: { name: 'Arial', size: 11, color: { argb: `FF${WHITE}` } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${NAVY}` } },
      alignment: { vertical: 'middle', horizontal: 'left' },
    }
    dash.getRow(2).height = 24
    dash.getRow(3).height = 16

    const cardHeaders = ['Overall ESG', 'Environmental', 'Social', 'Governance', 'IFRS S1/S2', 'SDG Alignment', 'Completion', 'Indicators']
    const scoreKeys = ['overall_score','e_score','s_score','g_score','ifrs_alignment_score','sdg_alignment_score']
    const cardValues = [
      scores?.overall_score != null ? `${(scores.overall_score as number).toFixed(1)} / 100` : '—',
      scores?.e_score != null ? `${(scores.e_score as number).toFixed(1)} / 100` : '—',
      scores?.s_score != null ? `${(scores.s_score as number).toFixed(1)} / 100` : '—',
      scores?.g_score != null ? `${(scores.g_score as number).toFixed(1)} / 100` : '—',
      scores?.ifrs_alignment_score != null ? `${(scores.ifrs_alignment_score as number).toFixed(1)} / 100` : '—',
      scores?.sdg_alignment_score != null ? `${(scores.sdg_alignment_score as number).toFixed(1)} / 100` : '—',
      scores?.overall_completion_pct != null ? `${(scores.overall_completion_pct as number).toFixed(0)}%` : '—',
      `${scores?.indicator_count_completed ?? 0} / ${scores?.indicator_count_total ?? 0}`,
    ]
    const cardBgs = [
      scoreColor(scores?.overall_score as number | null),
      scoreColor(scores?.e_score as number | null),
      scoreColor(scores?.s_score as number | null),
      scoreColor(scores?.g_score as number | null),
      scoreColor(scores?.ifrs_alignment_score as number | null),
      scoreColor(scores?.sdg_alignment_score as number | null),
      LIGHT_BLUE,
      LIGHT_BLUE,
    ]

    const cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
    cols.forEach((col, i) => {
      dash.getColumn(col).width = 18
      const hCell = dash.getCell(`${col}4`)
      hCell.value = cardHeaders[i]
      hCell.style = centerStyle(NAVY, WHITE, true)
      dash.getRow(4).height = 24

      const vCell = dash.getCell(`${col}5`)
      vCell.value = cardValues[i]
      const scoreVal = i < scoreKeys.length ? scores?.[scoreKeys[i]] as number | null : null
      vCell.style = {
        font: { name: 'Arial', bold: true, size: 14, color: { argb: `FF${scoreTextColor(scoreVal)}` } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${cardBgs[i]}` } },
        alignment: { vertical: 'middle', horizontal: 'center' },
        border: { top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }, left: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } } },
      }
      dash.getRow(5).height = 36
    })

    dash.getRow(6).height = 16

    dash.mergeCells('A7:D7')
    dash.getCell('A7').value = 'ORGANISATION PROFILE'
    dash.getCell('A7').style = headerStyle(NAVY)
    dash.getRow(7).height = 24

    const orgFields = [
      ['Name', org?.name],
      ['Registration', org?.registration_number],
      ['Sector', org?.sector],
      ['Sub-sector', org?.sub_sector],
      ['Country', org?.country],
      ['Size category', org?.size_category],
      ['Employees', org?.employee_count],
      ['Annual turnover (BWP)', org?.annual_turnover_bwp ? `P ${Number(org.annual_turnover_bwp).toLocaleString()}` : '—'],
    ]

    orgFields.forEach(([label, value], i) => {
      const row = dash.getRow(8 + i)
      row.height = 20
      const lCell = dash.getCell(`A${8 + i}`)
      lCell.value = String(label)
      lCell.style = dataStyle(GRAY_BG, DARK, true)
      dash.mergeCells(`A${8 + i}:B${8 + i}`)
      const vCell = dash.getCell(`C${8 + i}`)
      vCell.value = value != null ? String(value) : '—'
      vCell.style = dataStyle(WHITE, DARK)
      dash.mergeCells(`C${8 + i}:D${8 + i}`)
    })

    dash.mergeCells('E7:H7')
    dash.getCell('E7').value = 'PILLAR SCORE SUMMARY'
    dash.getCell('E7').style = headerStyle(NAVY)

    const pillarHeaderLabels = ['Pillar', 'Score / 100', 'Completion %', 'Responses']
    pillarHeaderLabels.forEach((h, i) => {
      const c = dash.getCell(`${['E','F','G','H'][i]}8`)
      c.value = h
      c.style = headerStyle('334155', WHITE)
    })
    dash.getRow(8).height = 24

    const pillarsData = [
      ['Environmental', scores?.e_score, scores?.e_completion_pct, 'E'],
      ['Social', scores?.s_score, scores?.s_completion_pct, 'S'],
      ['Governance', scores?.g_score, scores?.g_completion_pct, 'G'],
    ]

    pillarsData.forEach(([label, score, comp, pillarKey], i) => {
      const row = dash.getRow(9 + i)
      row.height = 22
      const bg = scoreColor(score as number | null)
      const fg = scoreTextColor(score as number | null)
      dash.getCell(`E${9 + i}`).value = String(label)
      dash.getCell(`E${9 + i}`).style = dataStyle(bg, DARK, true)
      dash.getCell(`F${9 + i}`).value = score != null ? `${(score as number).toFixed(1)}` : '—'
      dash.getCell(`F${9 + i}`).style = centerStyle(bg, fg, true)
      dash.getCell(`G${9 + i}`).value = comp != null ? `${(comp as number).toFixed(0)}%` : '—'
      dash.getCell(`G${9 + i}`).style = centerStyle(bg, fg)
      const count = responses.filter((r) => (r.indicators as Record<string, unknown>)?.pillar === pillarKey).length
      dash.getCell(`H${9 + i}`).value = count
      dash.getCell(`H${9 + i}`).style = centerStyle(bg, fg)
    })

    // Pillar scores visual table (replaces chart — exceljs charting not reliable in all versions)
    dash.getRow(18).height = 16
    dash.mergeCells('A19:H19')
    dash.getCell('A19').value = 'PILLAR SCORE VISUALISATION (0–100)'
    dash.getCell('A19').style = headerStyle(NAVY)
    dash.getRow(19).height = 24
    dash.getCell('A14').value = 'PILLAR SCORE VISUALISATION (0–100)'
    dash.getCell('A14').style = headerStyle(NAVY)
    dash.getRow(14).height = 24

    const vizPillars = [
      { name: 'Environmental', score: scores?.e_score as number | null, color: '22C55E' },
      { name: 'Social', score: scores?.s_score as number | null, color: SKY },
      { name: 'Governance', score: scores?.g_score as number | null, color: 'A855F7' },
    ]

    vizPillars.forEach(({ name, score, color }, i) => {
    const rowNum = 20 + i
      dash.getRow(rowNum).height = 28
      dash.getCell(`A${rowNum}`).value = name
      dash.getCell(`A${rowNum}`).style = dataStyle(GRAY_BG, DARK, true)
      dash.mergeCells(`A${rowNum}:B${rowNum}`)

      const pct = score != null ? Math.round(score) : 0
      // Fill cells C-G proportionally (5 cells = 20 pts each)
      for (let c = 0; c < 5; c++) {
        const colLetter = ['C','D','E','F','G'][c]
        const threshold = (c + 1) * 20
        const cell = dash.getCell(`${colLetter}${rowNum}`)
        cell.style = {
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: pct >= threshold ? `FF${color}` : 'FFE5E7EB' } },
          border: { top: { style: 'thin', color: { argb: 'FFFFFFFF' } }, bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } }, left: { style: 'thin', color: { argb: 'FFFFFFFF' } }, right: { style: 'thin', color: { argb: 'FFFFFFFF' } } },
        }
      }
      dash.getCell(`H${rowNum}`).value = score != null ? `${score.toFixed(1)} / 100` : '—'
      dash.getCell(`H${rowNum}`).style = centerStyle(GRAY_BG, DARK, true)
    })

    // ═══════════════════════════════════════════════════════════════════════════
    // SHEET 2: MATERIALITY
    // ═══════════════════════════════════════════════════════════════════════════
    const matSheet = addSheet(wb, 'Materiality', SKY)

    matSheet.mergeCells('A1:I1')
    matSheet.getCell('A1').value = 'MATERIALITY ASSESSMENT'
    matSheet.getCell('A1').style = headerStyle(NAVY)
    matSheet.getRow(1).height = 28

    const matCols = [
      { header: 'Topic', width: 28 },
      { header: 'Description', width: 32 },
      { header: 'Impact score (/5)', width: 16 },
      { header: 'Financial score (/5)', width: 16 },
      { header: 'Status', width: 14 },
      { header: 'Time horizon', width: 14 },
      { header: 'IFRS relevant', width: 13 },
      { header: 'SDG tags', width: 20 },
      { header: 'Financial effect', width: 36 },
    ]

    matCols.forEach((col, i) => {
      matSheet.getColumn(i + 1).width = col.width
      const hCell = matSheet.getRow(2).getCell(i + 1)
      hCell.value = col.header
      hCell.style = headerStyle('334155')
    })
    matSheet.getRow(2).height = 28

    materiality.forEach((t, i) => {
      const row = matSheet.getRow(3 + i)
      row.height = 24
      const isMat = t.is_material as boolean
      const bg = isMat ? GREEN_BG : WHITE

      const vals: ExcelJS.CellValue[] = [
        String(t.topic_name ?? '—'),
        String(t.topic_description ?? '—'),
        t.impact_score as number ?? null,
        t.financial_score as number ?? null,
        isMat ? 'Material' : 'Not material',
        String(t.time_horizon ?? '—'),
        t.ifrs_relevant ? 'Yes' : 'No',
        Array.isArray(t.sdg_tags) ? t.sdg_tags.map((s: number) => `SDG ${s}`).join(', ') : '—',
        String(t.financial_effect ?? '—'),
      ]

      vals.forEach((v, j) => {
        const cell = row.getCell(j + 1)
        cell.value = v
        if (j === 2 || j === 3) {
          cell.style = centerStyle(bg, isMat ? GREEN : DARK, isMat)
        } else if (j === 4) {
          cell.style = centerStyle(isMat ? GREEN_BG : GRAY_BG, isMat ? GREEN : GRAY_TEXT, true)
        } else {
          cell.style = dataStyle(bg, DARK)
        }
      })
    })

    if (materiality.length === 0) {
      matSheet.getRow(3).getCell(1).value = 'No materiality topics recorded for this cycle.'
      matSheet.getRow(3).getCell(1).style = dataStyle(AMBER_BG, AMBER)
    }

    // Materiality 5x5 matrix
    const matrixStartRow = 3 + materiality.length + 3
    matSheet.mergeCells(`A${matrixStartRow}:I${matrixStartRow}`)
    matSheet.getCell(`A${matrixStartRow}`).value = 'MATERIALITY MATRIX — Rows: Impact significance (5=highest) · Columns: Financial significance (5=highest)'
    matSheet.getCell(`A${matrixStartRow}`).style = headerStyle(NAVY)
    matSheet.getRow(matrixStartRow).height = 28

    for (let col = 1; col <= 5; col++) {
      const hCell = matSheet.getRow(matrixStartRow + 1).getCell(col + 1)
      hCell.value = `Financial: ${col}`
      hCell.style = headerStyle('334155')
      matSheet.getColumn(col + 1).width = 16
    }
    matSheet.getColumn(1).width = 14

    for (let row = 1; row <= 5; row++) {
      const lCell = matSheet.getRow(matrixStartRow + 1 + row).getCell(1)
      lCell.value = `Impact: ${6 - row}`
      lCell.style = headerStyle('334155')
      matSheet.getRow(matrixStartRow + 1 + row).height = 40
    }

    for (let r = 1; r <= 5; r++) {
      for (let c = 1; c <= 5; c++) {
        const impact = 6 - r
        const financial = c
        const cellBg = (impact >= 4 && financial >= 4) ? 'FEE2E2'
          : (impact >= 3 || financial >= 3) ? AMBER_BG
          : GREEN_BG

        const gridCell = matSheet.getRow(matrixStartRow + 1 + r).getCell(c + 1)
        const topicsHere = materiality.filter((t) =>
          Math.round(t.impact_score as number) === impact &&
          Math.round(t.financial_score as number) === financial
        )
        gridCell.value = topicsHere.length > 0
          ? topicsHere.map((t) => String(t.topic_name).substring(0, 14)).join('\n')
          : ''
        gridCell.style = {
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${cellBg}` } },
          border: { top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }, left: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } } },
          alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
          font: { name: 'Arial', size: 8, color: { argb: 'FF374151' } },
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SHEET 3: INDICATORS
    // ═══════════════════════════════════════════════════════════════════════════
    const indSheet = addSheet(wb, 'Indicators', '22C55E')

    indSheet.mergeCells('A1:L1')
    indSheet.getCell('A1').value = 'ESG INDICATOR RESPONSES'
    indSheet.getCell('A1').style = headerStyle(NAVY)
    indSheet.getRow(1).height = 28

    const indCols = [
      { header: 'Pillar', width: 8 },
      { header: 'Indicator', width: 32 },
      { header: 'Data type', width: 12 },
      { header: 'Unit', width: 10 },
      { header: 'Value', width: 18 },
      { header: 'Source reference', width: 28 },
      { header: 'Confidence', width: 12 },
      { header: 'Material', width: 10 },
      { header: 'Target value', width: 12 },
      { header: 'Target year', width: 12 },
      { header: 'N/A', width: 8 },
      { header: 'Consultant note', width: 32 },
    ]

    indCols.forEach((col, i) => {
      indSheet.getColumn(i + 1).width = col.width
      const hCell = indSheet.getRow(2).getCell(i + 1)
      hCell.value = col.header
      hCell.style = headerStyle('334155')
    })
    indSheet.getRow(2).height = 28

    const sortedResponses = [...responses].sort((a, b) => {
      const pa = (a.indicators as Record<string, unknown>)?.pillar as string ?? ''
      const pb = (b.indicators as Record<string, unknown>)?.pillar as string ?? ''
      return pa.localeCompare(pb)
    })

    sortedResponses.forEach((r, i) => {
      const ind = r.indicators as Record<string, unknown> | null
      const pillar = String(ind?.pillar ?? '—')
      const isMat = materialIds.has(r.indicator_id as string)
      const conf = String(r.confidence_level ?? '—')
      const rowNum = 3 + i
      const row = indSheet.getRow(rowNum)
      row.height = 22

      const pillarBg = pillar === 'E' ? 'F0FDF4' : pillar === 'S' ? 'F0F9FF' : 'FAF5FF'
      const bg = i % 2 === 0 ? pillarBg : WHITE
      const confColor = conf === 'high' ? GREEN : conf === 'low' ? RED : AMBER

      const value: ExcelJS.CellValue = r.is_not_applicable ? 'N/A'
        : r.value_boolean != null ? (r.value_boolean ? 'Yes' : 'No')
        : r.value_number != null ? r.value_number as number
        : r.value_text as string ?? '—'

      const vals: ExcelJS.CellValue[] = [
        pillar,
        String(ind?.label ?? '—'),
        String(ind?.data_type ?? '—'),
        String(ind?.unit ?? '—'),
        value,
        String(r.source_reference ?? ''),
        conf,
        isMat ? 'Yes' : 'No',
        r.target_value as number ?? null,
        r.target_year as number ?? null,
        r.is_not_applicable ? 'Yes' : 'No',
        String(r.consultant_note ?? ''),
      ]

      vals.forEach((v, j) => {
        const cell = row.getCell(j + 1)
        cell.value = v
        if (j === 6) {
          cell.style = centerStyle(bg, confColor, true)
        } else if (j === 7) {
          cell.style = centerStyle(bg, isMat ? GREEN : GRAY_TEXT, isMat)
        } else if (j === 0) {
          cell.style = centerStyle(bg, DARK, true)
        } else {
          cell.style = dataStyle(bg, DARK)
        }
      })

      if (!r.source_reference && !r.is_not_applicable) {
        row.getCell(6).style = dataStyle(RED_BG, RED)
        row.getCell(6).value = 'SOURCE MISSING'
      }
    })

    indSheet.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: 12 } }

    // ═══════════════════════════════════════════════════════════════════════════
    // SHEET 4: IFRS DISCLOSURES
    // ═══════════════════════════════════════════════════════════════════════════
    const ifrsSheet = addSheet(wb, 'IFRS Disclosures', 'A855F7')

    ifrsSheet.mergeCells('A1:G1')
    ifrsSheet.getCell('A1').value = 'IFRS S1/S2 DISCLOSURE STATUS'
    ifrsSheet.getCell('A1').style = headerStyle(NAVY)
    ifrsSheet.getRow(1).height = 28

    const ifrsCols = [
      { header: 'Code', width: 14 },
      { header: 'Standard', width: 12 },
      { header: 'Pillar', width: 16 },
      { header: 'Disclosure', width: 40 },
      { header: 'Status', width: 16 },
      { header: 'Narrative response', width: 50 },
      { header: 'Omission reason', width: 30 },
    ]

    ifrsCols.forEach((col, i) => {
      ifrsSheet.getColumn(i + 1).width = col.width
      const hCell = ifrsSheet.getRow(2).getCell(i + 1)
      hCell.value = col.header
      hCell.style = headerStyle('334155')
    })
    ifrsSheet.getRow(2).height = 28

    const allTemplates = await supabase
      .from('ifrs_disclosure_templates')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')

    const discMap = new Map((ifrsDiscs ?? []).map((d) => [d.disclosure_code, d]))

    ;(allTemplates.data ?? []).forEach((tmpl, i) => {
      const disc = discMap.get(tmpl.disclosure_code)
      const rowNum = 3 + i
      const row = ifrsSheet.getRow(rowNum)
      row.height = 22

      let status = 'Not started'
      let statusBg = RED_BG
      let statusFg = RED

      if (tmpl.is_quantitative) {
        status = 'Data indicator'
        statusBg = LIGHT_BLUE
        statusFg = '0369A1'
      } else if (disc?.is_omitted) {
        status = 'Omitted'
        statusBg = AMBER_BG
        statusFg = AMBER
      } else if (disc?.narrative_response) {
        status = 'Complete'
        statusBg = GREEN_BG
        statusFg = GREEN
      }

      const bg = i % 2 === 0 ? WHITE : GRAY_BG

      const vals: ExcelJS.CellValue[] = [
        tmpl.disclosure_code,
        tmpl.standard.replace('_', ' '),
        tmpl.pillar.replace('_', ' '),
        tmpl.disclosure_title,
        status,
        String(disc?.narrative_response ?? ''),
        String(disc?.omission_reason ?? ''),
      ]

      vals.forEach((v, j) => {
        const cell = row.getCell(j + 1)
        cell.value = v
        if (j === 4) {
          cell.style = centerStyle(statusBg, statusFg, true)
        } else {
          cell.style = dataStyle(bg, DARK)
        }
      })
    })

    ifrsSheet.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: 7 } }

    // ═══════════════════════════════════════════════════════════════════════════
    // SHEET 5: TARGETS
    // ═══════════════════════════════════════════════════════════════════════════
    const targSheet = addSheet(wb, 'Targets', 'EF4444')

    targSheet.mergeCells('A1:H1')
    targSheet.getCell('A1').value = 'PERFORMANCE TARGETS'
    targSheet.getCell('A1').style = headerStyle(NAVY)
    targSheet.getRow(1).height = 28

    const targCols = [
      { header: 'Pillar', width: 8 },
      { header: 'Indicator', width: 32 },
      { header: 'Unit', width: 12 },
      { header: 'Current value', width: 14 },
      { header: 'Target value', width: 14 },
      { header: 'Target year', width: 12 },
      { header: 'Gap', width: 14 },
      { header: 'Progress', width: 16 },
    ]

    targCols.forEach((col, i) => {
      targSheet.getColumn(i + 1).width = col.width
      const hCell = targSheet.getRow(2).getCell(i + 1)
      hCell.value = col.header
      hCell.style = headerStyle('334155')
    })
    targSheet.getRow(2).height = 28

    const withTargets = responses.filter((r) => r.target_value != null && r.value_number != null)

    if (withTargets.length === 0) {
      const emptyRow = targSheet.getRow(3)
      emptyRow.getCell(1).value = 'No targets set. Add target values in the data collection stage.'
      emptyRow.getCell(1).style = dataStyle(AMBER_BG, AMBER)
      targSheet.mergeCells('A3:H3')
    } else {
      withTargets.forEach((r, i) => {
        const ind = r.indicators as Record<string, unknown> | null
        const current = r.value_number as number
        const target = r.target_value as number
        const gap = target - current
        const progress = target !== 0 ? Math.min(100, Math.round((current / target) * 100)) : 0
        const rowNum = 3 + i
        const row = targSheet.getRow(rowNum)
        row.height = 22
        const bg = i % 2 === 0 ? WHITE : GRAY_BG

        const vals: ExcelJS.CellValue[] = [
          String(ind?.pillar ?? '—'),
          String(ind?.label ?? '—'),
          String(ind?.unit ?? '—'),
          current,
          target,
          r.target_year as number ?? null,
          gap,
          `${progress}%`,
        ]

        vals.forEach((v, j) => {
          const cell = row.getCell(j + 1)
          cell.value = v
          if (j === 6) {
            cell.style = centerStyle(gap <= 0 ? GREEN_BG : RED_BG, gap <= 0 ? GREEN : RED, true)
          } else if (j === 7) {
            cell.style = centerStyle(progress >= 100 ? GREEN_BG : bg, progress >= 100 ? GREEN : DARK)
          } else {
            cell.style = dataStyle(bg, DARK)
          }
        })
      })
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SHEET 6: GRI INDEX
    // ═══════════════════════════════════════════════════════════════════════════
    const griSheet = addSheet(wb, 'GRI Index', SKY)

    griSheet.mergeCells('A1:F1')
    griSheet.getCell('A1').value = 'GRI CONTENT INDEX — Prepared with reference to GRI Standards 2021'
    griSheet.getCell('A1').style = headerStyle(NAVY)
    griSheet.getRow(1).height = 28

    const griCols = [
      { header: 'Pillar', width: 8 },
      { header: 'Indicator', width: 36 },
      { header: 'GRI reference', width: 14 },
      { header: 'Value disclosed', width: 20 },
      { header: 'Source', width: 28 },
      { header: 'Status', width: 14 },
    ]

    griCols.forEach((col, i) => {
      griSheet.getColumn(i + 1).width = col.width
      const hCell = griSheet.getRow(2).getCell(i + 1)
      hCell.value = col.header
      hCell.style = headerStyle('334155')
    })
    griSheet.getRow(2).height = 28

    responses.forEach((r, i) => {
      const ind = r.indicators as Record<string, unknown> | null
      const hasValue = r.is_not_applicable || r.value_number != null || r.value_text || r.value_boolean != null
      const rowNum = 3 + i
      const row = griSheet.getRow(rowNum)
      row.height = 22
      const bg = i % 2 === 0 ? WHITE : GRAY_BG

      const value: ExcelJS.CellValue = r.is_not_applicable ? 'N/A'
        : r.value_boolean != null ? (r.value_boolean ? 'Yes' : 'No')
        : r.value_number != null ? `${r.value_number} ${ind?.unit ?? ''}`
        : String(r.value_text ?? '—')

      const vals: ExcelJS.CellValue[] = [
        String(ind?.pillar ?? '—'),
        String(ind?.label ?? '—'),
        'GRI',
        value,
        String(r.source_reference ?? 'Not provided'),
        hasValue ? 'Disclosed' : 'Omitted',
      ]

      vals.forEach((v, j) => {
        const cell = row.getCell(j + 1)
        cell.value = v
        if (j === 5) {
          cell.style = centerStyle(hasValue ? GREEN_BG : RED_BG, hasValue ? GREEN : RED, true)
        } else {
          cell.style = dataStyle(bg, DARK)
        }
      })
    })

    griSheet.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: 6 } }

    // ═══════════════════════════════════════════════════════════════════════════
    // SHEET 7: DOCUMENTS
    // ═══════════════════════════════════════════════════════════════════════════
    const docSheet = addSheet(wb, 'Documents', '64748B')

    docSheet.mergeCells('A1:D1')
    docSheet.getCell('A1').value = 'EVIDENCE DOCUMENT REGISTER'
    docSheet.getCell('A1').style = headerStyle(NAVY)
    docSheet.getRow(1).height = 28

    const docCols = [
      { header: 'Filename', width: 40 },
      { header: 'Document type', width: 20 },
      { header: 'Description', width: 50 },
      { header: 'Uploaded', width: 18 },
    ]

    docCols.forEach((col, i) => {
      docSheet.getColumn(i + 1).width = col.width
      const hCell = docSheet.getRow(2).getCell(i + 1)
      hCell.value = col.header
      hCell.style = headerStyle('334155')
    })
    docSheet.getRow(2).height = 28

    if (!documents || documents.length === 0) {
      const emptyRow = docSheet.getRow(3)
      emptyRow.getCell(1).value = 'No documents uploaded for this assessment cycle.'
      emptyRow.getCell(1).style = dataStyle(AMBER_BG, AMBER)
      docSheet.mergeCells('A3:D3')
    } else {
      documents.forEach((doc, i) => {
        const rowNum = 3 + i
        const row = docSheet.getRow(rowNum)
        row.height = 22
        const bg = i % 2 === 0 ? WHITE : GRAY_BG
        const vals: ExcelJS.CellValue[] = [
          String(doc.filename ?? '—'),
          String(doc.document_type ?? '—'),
          String(doc.description ?? '—'),
          doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString('en-GB') : '—',
        ]
        vals.forEach((v, j) => {
          const cell = row.getCell(j + 1)
          cell.value = v
          cell.style = dataStyle(bg, DARK)
        })
      })
    }

    const buffer = await wb.xlsx.writeBuffer()
    const uint8 = new Uint8Array(buffer as ArrayBuffer)

    return new NextResponse(uint8, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="ESG_Data_v${report.report_version}_${String(org?.name ?? 'Client').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    })
  } catch (err) {
    console.error('Excel generation error:', err)
    return NextResponse.json({ error: 'Failed to generate Excel report', detail: String(err) }, { status: 500 })
  }
}