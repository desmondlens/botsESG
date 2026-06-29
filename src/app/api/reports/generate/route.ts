import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createHash } from 'crypto'
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageBreak, LevelFormat, TabStopType,
  TabStopPosition,
} from 'docx'

// ─── Colour palette ───────────────────────────────────────────────────────────
const NAVY   = '0C4A7C'
const SKY    = '0EA5E9'
const WHITE  = 'FFFFFF'
const LIGHT  = 'F0F9FF'
const GREEN  = '166534'
const GREEN_BG = 'DCFCE7'
const AMBER  = '92400E'
const AMBER_BG = 'FEF3C7'
const RED    = '991B1B'
const RED_BG  = 'FEE2E2'
const GRAY_BG = 'F8FAFC'
const GRAY_BORDER = 'E2E8F0'
const YELLOW_BG = 'FEFCE8'
const YELLOW_TEXT = '713F12'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const border = (color = GRAY_BORDER) => ({ style: BorderStyle.SINGLE, size: 1, color })
const noBorder = () => ({ style: BorderStyle.NONE, size: 0, color: 'FFFFFF' })
const allBorders = (color = GRAY_BORDER) => ({ top: border(color), bottom: border(color), left: border(color), right: border(color) })
const noBorders = () => ({ top: noBorder(), bottom: noBorder(), left: noBorder(), right: noBorder() })
const cellMargins = { top: 100, bottom: 100, left: 140, right: 140 }

function cell(children: Paragraph[], options: {
  width: number
  bg?: string
  borders?: object
  valign?: (typeof VerticalAlign)[keyof typeof VerticalAlign]
  span?: number
} = { width: 1000 }) {
  return new TableCell({
    width: { size: options.width, type: WidthType.DXA },
    shading: options.bg ? { fill: options.bg, type: ShadingType.CLEAR } : undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
borders: (options.borders ?? allBorders()) as any,
    margins: cellMargins,
    verticalAlign: options.valign as 'top' | 'center' | 'bottom' | undefined ?? 'center',
    columnSpan: options.span,
    children,
  })
}

function para(text: string, options: {
  bold?: boolean
  size?: number
  color?: string
  align?: (typeof AlignmentType)[keyof typeof AlignmentType]
  spacing?: { before?: number; after?: number }
  italic?: boolean
} = {}) {
  return new Paragraph({
    alignment: options.align,
    spacing: options.spacing ?? { before: 0, after: 0 },
    children: [
      new TextRun({
        text,
        bold: options.bold,
        size: options.size ?? 20,
        color: options.color ?? '1E293B',
        font: 'Arial',
        italics: options.italic,
      }),
    ],
  })
}

function sectionHeader(title: string, subtitle?: string): Paragraph[] {
  const out: Paragraph[] = [
    new Paragraph({
      spacing: { before: 320, after: 0 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: SKY, space: 4 } },
      children: [
        new TextRun({ text: title.toUpperCase(), bold: true, size: 22, color: NAVY, font: 'Arial', characterSpacing: 40 }),
      ],
    }),
  ]
  if (subtitle) {
    out.push(para(subtitle, { size: 18, color: '64748B', spacing: { before: 60, after: 200 } }))
  } else {
    out.push(new Paragraph({ spacing: { before: 0, after: 200 }, children: [] }))
  }
  return out
}

function scoreCard(label: string, value: string | null, _width: number, _bg = NAVY, _textColor = WHITE): Paragraph[] {
  return [
    para(label, { size: 16, color: '94A3B8', spacing: { before: 0, after: 60 } }),
    para(value ?? '—', { bold: true, size: 48, color: NAVY }),
  ]
}

function statusBadge(status: string): TextRun {
  const config: Record<string, { text: string; color: string }> = {
    Complete:   { text: ' COMPLETE ',   color: GREEN },
    Partial:    { text: ' PARTIAL ',    color: AMBER },
    'Not disclosed': { text: ' NOT DISCLOSED ', color: RED },
    Material:   { text: ' MATERIAL ',   color: GREEN },
    'Not material': { text: ' NOT MATERIAL ', color: '64748B' },
    Omitted:    { text: ' OMITTED ',    color: AMBER },
  }
  const c = config[status] ?? { text: ` ${status.toUpperCase()} `, color: '64748B' }
  return new TextRun({ text: c.text, color: c.color, bold: true, size: 18, font: 'Arial' })
}

function placeholder(fieldName: string, guidance: string): Paragraph {
  return new Paragraph({
    spacing: { before: 120, after: 120 },
    shading: { fill: YELLOW_BG, type: ShadingType.CLEAR },
    border: { left: { style: BorderStyle.SINGLE, size: 12, color: 'EAB308', space: 8 } },
    children: [
      new TextRun({ text: `[MANAGEMENT INPUT REQUIRED — ${fieldName}] `, bold: true, size: 18, color: YELLOW_TEXT, font: 'Arial' }),
      new TextRun({ text: guidance, size: 18, color: YELLOW_TEXT, font: 'Arial', italics: true }),
    ],
  })
}

function spacer(before = 160, after = 0): Paragraph {
  return new Paragraph({ spacing: { before, after }, children: [] })
}

function pillarBar(label: string, score: number | null, color: string, tableWidth: number): Table {
  const MAX = tableWidth - 2400
  const filled = score != null ? Math.round((score / 100) * MAX) : 0
  const empty = MAX - filled

  return new Table({
    width: { size: tableWidth, type: WidthType.DXA },
    columnWidths: [1800, filled || 1, empty || 1, 600],
    rows: [
      new TableRow({
        children: [
          cell([para(label, { size: 18, bold: true, color: '374151' })], { width: 1800, borders: noBorders() }),
          cell([], { width: filled || 1, bg: color, borders: noBorders() }),
          cell([], { width: empty || 1, bg: 'E5E7EB', borders: noBorders() }),
          cell([para(score != null ? `${score.toFixed(1)}` : '—', { bold: true, size: 18, color: NAVY, align: AlignmentType.RIGHT })], { width: 600, borders: noBorders() }),
        ],
      }),
    ],
  })
}

// ─── Main route ───────────────────────────────────────────────────────────────
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
    
    const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    // ── Fetch report and snapshot ──────────────────────────────────────────────
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

    const org    = data.organisation as Record<string, unknown> | null
    const cycle  = data.cycle as Record<string, unknown> | null
    const scores = data.scores as Record<string, unknown> | null
    const responses    = (data.responses as Array<Record<string, unknown>>) ?? []
    const materiality  = (data.materiality_topics as Array<Record<string, unknown>>) ?? []
    const cycleInds    = (data.cycle_indicators as Array<Record<string, unknown>>) ?? []

    // ── Fetch IFRS disclosures for this cycle ─────────────────────────────────
    const { data: ifrsDiscs } = await supabase
      .from('ifrs_disclosures')
      .select('*')
      .eq('cycle_id', snap.cycle_id)
      .order('disclosure_code')

    // ── Fetch documents ────────────────────────────────────────────────────────
    const { data: documents } = await supabase
      .from('documents')
      .select('filename, document_type, description, uploaded_at')
      .eq('cycle_id', snap.cycle_id)

    const PAGE_W = 11906 // A4 width in DXA
    const MARGIN = 1080  // 0.75 inch
    const CONTENT_W = PAGE_W - MARGIN * 2

    // ── Header and footer ─────────────────────────────────────────────────────
    const docHeader = new Header({
      children: [
        new Paragraph({
          tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
          spacing: { before: 0, after: 0 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: SKY, space: 4 } },
          children: [
            new TextRun({ text: `${org?.name ?? 'Organisation'} · ESG Report`, bold: true, size: 18, color: NAVY, font: 'Arial' }),
            new TextRun({ text: '\t', font: 'Arial' }),
            new TextRun({ text: `Prepared by Botsfirm Solidarity`, size: 18, color: '94A3B8', font: 'Arial' }),
          ],
        }),
      ],
    })

    const docFooter = new Footer({
      children: [
        new Paragraph({
          tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
          spacing: { before: 0, after: 0 },
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: GRAY_BORDER, space: 4 } },
          children: [
            new TextRun({ text: 'Botsfirm Solidarity (Pty) Ltd · admin@botsfirm.co.bw · +267 78 088 472', size: 16, color: '94A3B8', font: 'Arial' }),
            new TextRun({ text: '\t', font: 'Arial' }),
            new TextRun({ text: 'Confidential · ', size: 16, color: '94A3B8', font: 'Arial' }),
          ],
        }),
      ],
    })

    // ── Helper: responses by pillar ───────────────────────────────────────────
    const materialIds = new Set(cycleInds.filter((ci) => ci.is_material).map((ci) => ci.indicator_id))
    const responsesE = responses.filter((r) => {
      const ind = r.indicators as Record<string, unknown> | null
      return ind?.pillar === 'E'
    })
    const responsesS = responses.filter((r) => {
      const ind = r.indicators as Record<string, unknown> | null
      return ind?.pillar === 'S'
    })
    const responsesG = responses.filter((r) => {
      const ind = r.indicators as Record<string, unknown> | null
      return ind?.pillar === 'G'
    })

    function indicatorTable(pillarResponses: Array<Record<string, unknown>>): Table {
      const COL = [2600, 1100, 1800, 1600, 1000, 800]
      const headers = ['Indicator', 'GRI ref', 'Value', 'Source reference', 'Confidence', 'Material']

      return new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: COL,
        rows: [
          // Header row
          new TableRow({
            tableHeader: true,
            children: headers.map((h, i) => cell(
              [para(h, { bold: true, size: 17, color: WHITE })],
              { width: COL[i], bg: NAVY, borders: allBorders(NAVY) }
            )),
          }),
          // Data rows
          ...pillarResponses.map((r, idx) => {
            const ind = r.indicators as Record<string, unknown> | null
            const isMaterial = materialIds.has(r.indicator_id as string)
            const value = r.is_not_applicable ? 'N/A'
              : r.value_boolean != null ? (r.value_boolean ? 'Yes' : 'No')
              : r.value_number != null ? `${r.value_number} ${ind?.unit ?? ''}`
              : r.value_text != null ? String(r.value_text).slice(0, 80)
              : '—'
            const rowBg = idx % 2 === 0 ? WHITE : GRAY_BG
            const conf = String(r.confidence_level ?? '—')
            const confColor = conf === 'high' ? GREEN : conf === 'low' ? RED : AMBER

            return new TableRow({
              children: [
                cell([para(String(ind?.label ?? '—'), { size: 18, bold: true, color: '1E293B' })], { width: COL[0], bg: rowBg }),
                cell([para('GRI', { size: 16, color: '64748B', italic: true })], { width: COL[1], bg: rowBg }),
                cell([para(value, { size: 18, color: '1E293B' })], { width: COL[2], bg: rowBg }),
                cell([para(String(r.source_reference ?? 'Not provided'), { size: 16, color: r.source_reference ? '374151' : RED })], { width: COL[3], bg: rowBg }),
                cell([para(conf, { size: 16, color: confColor, bold: true })], { width: COL[4], bg: rowBg }),
                cell([para(isMaterial ? '★' : '—', { size: 16, color: isMaterial ? GREEN : '94A3B8', align: AlignmentType.CENTER })], { width: COL[5], bg: rowBg }),
              ],
            })
          }),
        ],
      })
    }

    function ifrsSection(standard: string, pillar: string, pillarLabel: string): Paragraph[] {
      const relevant = (ifrsDiscs ?? []).filter((d) => d.standard === standard && d.pillar === pillar)
      if (relevant.length === 0) return []

      const out: Paragraph[] = [
        para(pillarLabel, { bold: true, size: 20, color: NAVY, spacing: { before: 200, after: 100 } }),
      ]

      for (const disc of relevant) {
        out.push(
          new Paragraph({
            spacing: { before: 160, after: 60 },
            children: [
              new TextRun({ text: disc.disclosure_code, size: 17, color: '64748B', font: 'Courier New' }),
              new TextRun({ text: '  ', font: 'Arial' }),
              new TextRun({ text: disc.disclosure_title, bold: true, size: 19, color: '1E293B', font: 'Arial' }),
            ],
          })
        )

        if (disc.is_omitted) {
          out.push(new Paragraph({
            spacing: { before: 60, after: 100 },
            shading: { fill: AMBER_BG, type: ShadingType.CLEAR },
            children: [
              new TextRun({ text: `OMITTED: `, bold: true, size: 18, color: AMBER, font: 'Arial' }),
              new TextRun({ text: disc.omission_reason ?? 'Reason not stated.', size: 18, color: AMBER, font: 'Arial' }),
              disc.omission_target_year
                ? new TextRun({ text: ` Target: ${disc.omission_target_year}.`, size: 18, color: AMBER, font: 'Arial' })
                : new TextRun({ text: '', font: 'Arial' }),
            ],
          }))
        } else if (disc.narrative_response) {
          out.push(para(disc.narrative_response, { size: 19, color: '374151', spacing: { before: 60, after: 100 } }))
        } else {
          out.push(placeholder(disc.disclosure_title, disc.disclosure_guidance ?? ''))
        }
      }
      return out
    }

    // ─── BUILD DOCUMENT ────────────────────────────────────────────────────────
    const overallScore = scores?.overall_score as number | null
    const eScore = scores?.e_score as number | null
    const sScore = scores?.s_score as number | null
    const gScore = scores?.g_score as number | null
    const ifrsScore = scores?.ifrs_alignment_score as number | null
    const sdgScore = scores?.sdg_alignment_score as number | null
    const completionPct = scores?.overall_completion_pct as number | null
    const totalInds = scores?.indicator_count_total as number | null
    const completedInds = scores?.indicator_count_completed as number | null

    const CARD_W = Math.floor(CONTENT_W / 4) - 40
    const BAR_W = CONTENT_W

    const doc = new Document({
      styles: {
        default: { document: { run: { font: 'Arial', size: 20, color: '1E293B' } } },
        paragraphStyles: [
          {
            id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
            run: { size: 36, bold: true, font: 'Arial', color: NAVY },
            paragraph: { spacing: { before: 480, after: 200 }, outlineLevel: 0 },
          },
          {
            id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
            run: { size: 28, bold: true, font: 'Arial', color: NAVY },
            paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 1 },
          },
          {
            id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
            run: { size: 22, bold: true, font: 'Arial', color: '374151' },
            paragraph: { spacing: { before: 240, after: 100 }, outlineLevel: 2 },
          },
        ],
      },
      numbering: {
        config: [
          {
            reference: 'bullets',
            levels: [{
              level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 600, hanging: 300 } } },
            }],
          },
        ],
      },
      sections: [
        // ═══════════════════════════════════════════════════════════════════════
        // SECTION 1 — COVER PAGE
        // ═══════════════════════════════════════════════════════════════════════
        {
          properties: {
            page: {
              size: { width: PAGE_W, height: 16838 },
              margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
            },
          },
          children: [
            // Logo area
            new Paragraph({
              spacing: { before: 480, after: 80 },
              children: [
                new TextRun({ text: 'BOTSFIRM SOLIDARITY', bold: true, size: 36, color: NAVY, font: 'Arial', characterSpacing: 60 }),
              ],
            }),
            para('ESG Assessment Report', { size: 22, color: '64748B', spacing: { before: 0, after: 800 } }),

            // Navy band
            new Table({
              width: { size: CONTENT_W, type: WidthType.DXA },
              columnWidths: [CONTENT_W],
              rows: [
                new TableRow({
                  children: [
                    cell([
                      para('Environmental, Social and Governance', { bold: true, size: 44, color: WHITE, spacing: { before: 80, after: 120 } }),
                      para('Assessment Report', { bold: true, size: 44, color: 'BAE6FD', spacing: { before: 0, after: 200 } }),
                      para('Prepared in accordance with GRI Standards 2021 · IFRS S1/S2 · BSE Sustainability Disclosure Guidance 2024 · UN SDGs',
                        { size: 19, color: 'BAE6FD', spacing: { before: 0, after: 80 } }),
                    ], { width: CONTENT_W, bg: NAVY, borders: noBorders(), valign: VerticalAlign.CENTER }),
                  ],
                }),
              ],
            }),

            spacer(400),

            // Client box
            new Table({
              width: { size: CONTENT_W, type: WidthType.DXA },
              columnWidths: [CONTENT_W],
              rows: [
                new TableRow({
                  children: [
                    cell([
                      para('PREPARED FOR', { size: 16, color: '94A3B8', spacing: { before: 0, after: 80 } }),
                      para(String(org?.name ?? '—'), { bold: true, size: 36, color: NAVY, spacing: { before: 0, after: 60 } }),
                      para(`${org?.sector ?? '—'} · ${org?.country ?? 'Botswana'} · ${org?.size_category ?? '—'}`,
                        { size: 20, color: '64748B' }),
                    ], { width: CONTENT_W, bg: LIGHT, borders: allBorders(SKY) }),
                  ],
                }),
              ],
            }),

            spacer(400),

            // Metadata row
            new Table({
              width: { size: CONTENT_W, type: WidthType.DXA },
              columnWidths: [Math.floor(CONTENT_W / 3), Math.floor(CONTENT_W / 3), CONTENT_W - Math.floor(CONTENT_W / 3) * 2],
              rows: [
                new TableRow({
                  children: [
                    cell([
                      para('REPORTING PERIOD', { size: 16, color: '94A3B8', spacing: { before: 0, after: 60 } }),
                      para(cycle ? `${cycle.period_start} to ${cycle.period_end}` : '—', { bold: true, size: 20, color: NAVY }),
                    ], { width: Math.floor(CONTENT_W / 3), borders: noBorders() }),
                    cell([
                      para('REPORT VERSION', { size: 16, color: '94A3B8', spacing: { before: 0, after: 60 } }),
                      para(`v${report.report_version} · ${report.status}`, { bold: true, size: 20, color: NAVY }),
                    ], { width: Math.floor(CONTENT_W / 3), borders: noBorders() }),
                    cell([
                      para('DATE ISSUED', { size: 16, color: '94A3B8', spacing: { before: 0, after: 60 } }),
                      para(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
                        { bold: true, size: 20, color: NAVY }),
                    ], { width: CONTENT_W - Math.floor(CONTENT_W / 3) * 2, borders: noBorders() }),
                  ],
                }),
              ],
            }),

            spacer(600),
            para('CONFIDENTIAL — For authorised recipients only', { size: 16, color: '94A3B8', align: AlignmentType.CENTER }),

            new Paragraph({ children: [new PageBreak()] }),
          ],
        },

        // ═══════════════════════════════════════════════════════════════════════
        // SECTION 2 — MAIN BODY
        // ═══════════════════════════════════════════════════════════════════════
        {
          properties: {
            page: {
              size: { width: PAGE_W, height: 16838 },
              margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
            },
          },
          headers: { default: docHeader },
          footers: { default: docFooter },
          children: [

            // ── EXECUTIVE SUMMARY ─────────────────────────────────────────────
            ...sectionHeader('1. Executive Summary', 'Key ESG performance metrics for the reporting period'),

           // Score cards
            new Table({
            width: { size: CONTENT_W, type: WidthType.DXA },
            columnWidths: [CARD_W, CARD_W, CARD_W, CONTENT_W - CARD_W * 3],
            rows: [
                new TableRow({
                children: [
                    cell(scoreCard('Overall ESG', overallScore?.toFixed(1) ?? '—', CARD_W - 200), { width: CARD_W, borders: noBorders() }),
                    cell(scoreCard('IFRS S1/S2', ifrsScore?.toFixed(1) ?? '—', CARD_W - 200, '0F172A'), { width: CARD_W, borders: noBorders() }),
                    cell(scoreCard('SDG alignment', sdgScore?.toFixed(1) ?? '—', CARD_W - 200, '1E3A5F'), { width: CARD_W, borders: noBorders() }),
                    cell(scoreCard('Completion', completionPct != null ? `${completionPct.toFixed(0)}%` : '—', CONTENT_W - CARD_W * 3 - 200, '1B4332'),
                    { width: CONTENT_W - CARD_W * 3, borders: noBorders() }),
                ],
                }),
            ],
            }),
            spacer(240),

            // Pillar bars
            para('Pillar scores', { bold: true, size: 20, color: NAVY, spacing: { before: 0, after: 120 } }),
            pillarBar('Environmental', eScore, '22C55E', BAR_W),
            spacer(80),
            pillarBar('Social', sScore, SKY, BAR_W),
            spacer(80),
            pillarBar('Governance', gScore, 'A855F7', BAR_W),
            spacer(240),

            // Indicator completion
            new Table({
              width: { size: CONTENT_W, type: WidthType.DXA },
              columnWidths: [CONTENT_W],
              rows: [
                new TableRow({
                  children: [
                    cell([
                      para(`${completedInds ?? 0} of ${totalInds ?? 0} indicators completed (${completionPct?.toFixed(0) ?? 0}%)`,
                        { size: 18, color: '374151' }),
                    ], { width: CONTENT_W, bg: GRAY_BG }),
                  ],
                }),
              ],
            }),

            spacer(160),
            new Paragraph({ children: [new PageBreak()] }),

            // ── ABOUT THIS ASSESSMENT ─────────────────────────────────────────
            ...sectionHeader('2. About this assessment', 'Reporting boundary, frameworks, and methodology'),

            para('Reporting organisation', { bold: true, size: 20, color: NAVY, spacing: { before: 0, after: 80 } }),
            new Table({
              width: { size: CONTENT_W, type: WidthType.DXA },
              columnWidths: [2400, CONTENT_W - 2400],
              rows: [
                ['Organisation name', String(org?.name ?? '—')],
                ['Registration number', String(org?.registration_number ?? '—')],
                ['Sector', String(org?.sector ?? '—')],
                ['Sub-sector', String(org?.sub_sector ?? '—')],
                ['Country', String(org?.country ?? 'Botswana')],
                ['Organisation size', String(org?.size_category ?? '—')],
                ['Number of employees', String(org?.employee_count ?? '—')],
                ['Annual turnover', org?.annual_turnover_bwp ? `P ${Number(org.annual_turnover_bwp).toLocaleString()}` : '—'],
              ].map(([label, value], idx) => new TableRow({
                children: [
                  cell([para(label, { size: 18, bold: true, color: '374151' })], { width: 2400, bg: idx % 2 === 0 ? GRAY_BG : WHITE }),
                  cell([para(value, { size: 18, color: '374151' })], { width: CONTENT_W - 2400, bg: idx % 2 === 0 ? GRAY_BG : WHITE }),
                ],
              })),
            }),

            spacer(200),
            para('Reporting period and boundary', { bold: true, size: 20, color: NAVY, spacing: { before: 0, after: 80 } }),
            para(`This report covers the period ${cycle?.period_start ?? '—'} to ${cycle?.period_end ?? '—'}.`,
              { size: 19, color: '374151', spacing: { before: 0, after: 80 } }),

            placeholder('Reporting boundary', 'Describe which legal entities, subsidiaries, joint ventures, and operational sites are included in this assessment. State the consolidation approach used (operational control, financial control, or equity share). Ref: GRI 2-2, IFRS S1 paragraph 22.'),

            spacer(160),
            para('Frameworks applied', { bold: true, size: 20, color: NAVY, spacing: { before: 0, after: 80 } }),

            ...[
              ['GRI Standards 2021', 'Impact reporting structure — Universal Standards and applicable Topic Standards. Governs the identification and disclosure of the organisation\'s most significant impacts on the economy, environment, and people.'],
              ['IFRS S1 (2023)', 'General requirements for disclosure of sustainability-related financial information. Requires disclosure of sustainability risks and opportunities that could reasonably be expected to affect the entity\'s cash flows, access to finance, or cost of capital.'],
              ['IFRS S2 (2023)', 'Climate-related disclosures — physical risks, transition risks, GHG metrics, energy, and climate targets.'],
              ['BSE Sustainability Disclosure Guidance (August 2024)', 'Botswana Stock Exchange guidance for listed and unlisted companies, structured around GRI, IFRS S1/S2, and ESRS. Adopts a double materiality approach covering both financial materiality and impact materiality.'],
              ['UN Sustainable Development Goals', 'Impact classification and alignment layer across all 17 SDGs.'],
            ].map(([fw, desc]) => new Paragraph({
              numbering: { reference: 'bullets', level: 0 },
              spacing: { before: 60, after: 60 },
              children: [
                new TextRun({ text: `${fw}: `, bold: true, size: 19, color: NAVY, font: 'Arial' }),
                new TextRun({ text: desc, size: 19, color: '374151', font: 'Arial' }),
              ],
            })),

            spacer(160),
            new Paragraph({ children: [new PageBreak()] }),

            // ── MATERIALITY ASSESSMENT ────────────────────────────────────────
            ...sectionHeader('3. Materiality assessment', 'Dual-axis assessment of impact and financial significance'),

            para('Methodology', { bold: true, size: 20, color: NAVY, spacing: { before: 0, after: 80 } }),
            para('The materiality assessment was conducted using a dual-axis model consistent with the BSE Sustainability Disclosure Guidance (double materiality approach). Topics were scored on: (1) impact significance — the significance of the organisation\'s actual or potential impacts on people and the environment (GRI impact materiality lens); and (2) financial significance — the likelihood and magnitude of effect on the organisation\'s financial position, cash flows, and access to capital (IFRS S1 financial materiality lens). Topics scoring 3.0 or above on either axis were determined material.',
              { size: 19, color: '374151', spacing: { before: 0, after: 200 } }),

            materiality.length === 0
              ? placeholder('Materiality topics', 'No materiality topics were recorded for this cycle. Complete the materiality assessment before generating the report.')
              : new Table({
                  width: { size: CONTENT_W, type: WidthType.DXA },
                  columnWidths: [2200, 800, 900, 1100, 900, 900, CONTENT_W - 6800],
                  rows: [
                    new TableRow({
                      tableHeader: true,
                      children: ['Topic', 'Impact', 'Financial', 'Status', 'Horizon', 'IFRS', 'SDGs'].map((h, i) => {
                        const widths = [2200, 800, 900, 1100, 900, 900, CONTENT_W - 6800]
                        return cell([para(h, { bold: true, size: 17, color: WHITE })], { width: widths[i], bg: NAVY, borders: allBorders(NAVY) })
                      }),
                    }),
                    ...materiality.map((t, idx) => {
                      const isMat = t.is_material
                      const widths = [2200, 800, 900, 1100, 900, 900, CONTENT_W - 6800]
                      const rowBg = idx % 2 === 0 ? WHITE : GRAY_BG
                      return new TableRow({
                        children: [
                          cell([para(String(t.topic_name ?? '—'), { size: 18, bold: true })], { width: widths[0], bg: rowBg }),
                          cell([para(t.impact_score != null ? `${t.impact_score}/5` : '—', { size: 18, align: AlignmentType.CENTER })], { width: widths[1], bg: rowBg }),
                          cell([para(t.financial_score != null ? `${t.financial_score}/5` : '—', { size: 18, align: AlignmentType.CENTER })], { width: widths[2], bg: rowBg }),
                          cell([new Paragraph({
                            alignment: AlignmentType.CENTER,
                            spacing: { before: 0, after: 0 },
                            children: [statusBadge(isMat ? 'Material' : 'Not material')],
                          })], { width: widths[3], bg: isMat ? GREEN_BG : rowBg }),
                          cell([para(String(t.time_horizon ?? '—'), { size: 17, color: '64748B' })], { width: widths[4], bg: rowBg }),
                          cell([para(t.ifrs_relevant ? 'Yes' : 'No', { size: 17, color: t.ifrs_relevant ? GREEN : '94A3B8', bold: !!t.ifrs_relevant })], { width: widths[5], bg: rowBg }),
                          cell([para(Array.isArray(t.sdg_tags) ? t.sdg_tags.map((s: number) => `SDG ${s}`).join(', ') : '—', { size: 16, color: '64748B' })], { width: widths[6], bg: rowBg }),
                        ],
                      })
                    }),
                  ],
                }),

            spacer(160),
            new Paragraph({ children: [new PageBreak()] }),

            // ── ENVIRONMENTAL ─────────────────────────────────────────────────
            ...sectionHeader('4. Environmental performance', `Pillar score: ${eScore?.toFixed(1) ?? '—'} / 100`),
            responsesE.length === 0
              ? placeholder('Environmental indicators', 'No environmental indicator responses were recorded for this cycle.')
              : indicatorTable(responsesE),
            spacer(160),
            new Paragraph({ children: [new PageBreak()] }),

            // ── SOCIAL ────────────────────────────────────────────────────────
            ...sectionHeader('5. Social performance', `Pillar score: ${sScore?.toFixed(1) ?? '—'} / 100`),
            responsesS.length === 0
              ? placeholder('Social indicators', 'No social indicator responses were recorded for this cycle.')
              : indicatorTable(responsesS),
            spacer(160),
            new Paragraph({ children: [new PageBreak()] }),

            // ── GOVERNANCE ────────────────────────────────────────────────────
            ...sectionHeader('6. Governance performance', `Pillar score: ${gScore?.toFixed(1) ?? '—'} / 100`),
            responsesG.length === 0
              ? placeholder('Governance indicators', 'No governance indicator responses were recorded for this cycle.')
              : indicatorTable(responsesG),
            spacer(160),
            new Paragraph({ children: [new PageBreak()] }),

            // ── IFRS S1/S2 DISCLOSURES ────────────────────────────────────────
            ...sectionHeader('7. IFRS S1/S2 qualitative disclosures', 'Required narrative disclosures under IFRS S1 General Requirements and IFRS S2 Climate-Related Disclosures'),

            para('About IFRS S1 and S2', { bold: true, size: 20, color: NAVY, spacing: { before: 0, after: 80 } }),
            para('IFRS S1 requires entities to disclose information about sustainability-related risks and opportunities that could reasonably be expected to affect the entity\'s cash flows, access to finance, or cost of capital. IFRS S2 requires specific disclosures on climate-related risks and opportunities. Both standards are structured around four pillars: Governance, Strategy, Risk Management, and Metrics and Targets.',
              { size: 19, color: '374151', spacing: { before: 0, after: 200 } }),

            // IFRS S1 disclosures
            para('IFRS S1 — General sustainability disclosures', { bold: true, size: 22, color: NAVY, spacing: { before: 0, after: 80 } }),
            ...ifrsSection('IFRS_S1', 'governance', 'Governance'),
            ...ifrsSection('IFRS_S1', 'strategy', 'Strategy'),
            ...ifrsSection('IFRS_S1', 'risk_management', 'Risk management'),
            ...ifrsSection('IFRS_S1', 'metrics_targets', 'Metrics and targets'),

            spacer(160),

            // IFRS S2 disclosures
            para('IFRS S2 — Climate-related disclosures', { bold: true, size: 22, color: NAVY, spacing: { before: 0, after: 80 } }),
            ...ifrsSection('IFRS_S2', 'governance', 'Governance'),
            ...ifrsSection('IFRS_S2', 'strategy', 'Strategy'),
            ...ifrsSection('IFRS_S2', 'risk_management', 'Risk management'),
            ...ifrsSection('IFRS_S2', 'metrics_targets', 'Metrics and targets'),

            spacer(160),
            new Paragraph({ children: [new PageBreak()] }),

            // ── GRI CONTENT INDEX ─────────────────────────────────────────────
            ...sectionHeader('8. GRI content index', 'This report has been prepared with reference to the GRI Standards 2021'),

            new Table({
              width: { size: CONTENT_W, type: WidthType.DXA },
              columnWidths: [1400, 2800, 1600, CONTENT_W - 5800],
              rows: [
                new TableRow({
                  tableHeader: true,
                  children: ['GRI disclosure', 'Title', 'Location', 'Omission / note'].map((h, i) => {
                    const w = [1400, 2800, 1600, CONTENT_W - 5800]
                    return cell([para(h, { bold: true, size: 17, color: WHITE })], { width: w[i], bg: NAVY, borders: allBorders(NAVY) })
                  }),
                }),
                ...responses.map((r, idx) => {
                  const ind = r.indicators as Record<string, unknown> | null
                  const hasValue = r.is_not_applicable || r.value_number != null || r.value_text || r.value_boolean != null
                  const rowBg = idx % 2 === 0 ? WHITE : GRAY_BG
                  const w = [1400, 2800, 1600, CONTENT_W - 5800]
                  return new TableRow({
                    children: [
                      cell([para('GRI', { size: 16, color: '64748B', italic: true })], { width: w[0], bg: rowBg }),
                      cell([para(String(ind?.label ?? '—'), { size: 17, color: '1E293B' })], { width: w[1], bg: rowBg }),
                      cell([para(`Section ${ind?.pillar === 'E' ? '4' : ind?.pillar === 'S' ? '5' : '6'}`, { size: 17, color: '374151' })], { width: w[2], bg: rowBg }),
                      cell([
                        hasValue
                          ? para('Disclosed', { size: 17, color: GREEN })
                          : para('Omitted — data not available for this reporting period.', { size: 17, color: RED }),
                      ], { width: w[3], bg: rowBg }),
                    ],
                  })
                }),
              ],
            }),

            spacer(160),
            new Paragraph({ children: [new PageBreak()] }),

            // ── DOCUMENT REGISTER ─────────────────────────────────────────────
            ...sectionHeader('9. Document register', 'Evidence documents uploaded to support indicator responses'),

            documents && documents.length > 0
              ? new Table({
                  width: { size: CONTENT_W, type: WidthType.DXA },
                  columnWidths: [3200, 1600, CONTENT_W - 4800],
                  rows: [
                    new TableRow({
                      tableHeader: true,
                      children: ['Document name', 'Type', 'Description'].map((h, i) => {
                        const w = [3200, 1600, CONTENT_W - 4800]
                        return cell([para(h, { bold: true, size: 17, color: WHITE })], { width: w[i], bg: NAVY, borders: allBorders(NAVY) })
                      }),
                    }),
                    ...documents.map((doc, idx) => {
                      const rowBg = idx % 2 === 0 ? WHITE : GRAY_BG
                      const w = [3200, 1600, CONTENT_W - 4800]
                      return new TableRow({
                        children: [
                          cell([para(doc.filename ?? '—', { size: 17, color: '1E293B', bold: true })], { width: w[0], bg: rowBg }),
                          cell([para(String(doc.document_type ?? '—'), { size: 17, color: '64748B' })], { width: w[1], bg: rowBg }),
                          cell([para(String(doc.description ?? '—'), { size: 17, color: '374151' })], { width: w[2], bg: rowBg }),
                        ],
                      })
                    }),
                  ],
                })
              : placeholder('Document register', 'No evidence documents were uploaded for this assessment cycle. Upload supporting documents in the Document Vault to populate this section.'),

            spacer(160),
            new Paragraph({ children: [new PageBreak()] }),

            // ── METHODOLOGY ───────────────────────────────────────────────────
            ...sectionHeader('10. Methodology and scoring', 'Assessment approach, scoring formula, and data quality notes'),

            ...[
              ['Materiality approach', 'A dual-axis materiality assessment was conducted per the BSE Sustainability Disclosure Guidance (double materiality) and GRI 3. Topics were scored on impact significance (effect on people and environment) and financial significance (effect on financial position and cash flows). Topics scoring 3.0 or above on either axis were determined material. IFRS financial materiality was applied separately to identify topics requiring IFRS S1/S2 narrative disclosure.'],
              ['Scoring methodology', 'Each indicator is scored 0-100 based on response completeness. Full response = 100 base score. Penalties are deducted: low confidence (-20 points), estimated data (-10 points), missing source reference (-10 points). Material indicators carry double weight in pillar score calculations. Pillar weights: Environmental 35%, Social 35%, Governance 30%. The scoring configuration used for this assessment can be reviewed in the Botsfirm ESG platform.'],
              ['GHG calculation methodology', 'Scope 1 GHG emissions were calculated using DEFRA 2023 emission factors for diesel and petrol combustion. Scope 2 GHG emissions used the BPC Botswana grid location-based emission factor of 0.90 kgCO2e/kWh (estimated). All GHG values are expressed in metric tonnes of CO2 equivalent (tCO2e) using IPCC AR6 GWP100 values. Market-based Scope 2 emissions are not available for this reporting period.'],
              ['IFRS alignment score', 'The IFRS S1/S2 alignment score reflects the proportion of IFRS-mapped indicators for which a response was provided. It does not reflect the quality or completeness of qualitative narrative disclosures, which require management review and completion.'],
              ['SDG alignment score', 'The SDG alignment score reflects the proportion of SDGs addressed by indicators for which a response was provided, expressed as a percentage of total SDGs tagged in the indicator library.'],
              ['BSE alignment', 'This report has been prepared with reference to the Botswana Stock Exchange Sustainability Disclosure Guidance (August 2024). The BSE Guidance adopts a double materiality approach aligned with GRI, IFRS S1/S2, and the European Sustainability Reporting Standards. This report does not constitute a formal BSE listing disclosure.'],
            ].map(([title, text]) => [
              para(title, { bold: true, size: 20, color: NAVY, spacing: { before: 160, after: 80 } }),
              para(text, { size: 19, color: '374151', spacing: { before: 0, after: 80 } }),
            ]).flat(),

            spacer(200),

            // Disclaimer
            new Table({
              width: { size: CONTENT_W, type: WidthType.DXA },
              columnWidths: [CONTENT_W],
              rows: [
                new TableRow({
                  children: [
                    cell([
                      para('Disclaimer', { bold: true, size: 18, color: '374151', spacing: { before: 0, after: 80 } }),
                      para('This report was prepared by Botsfirm Solidarity (Pty) Ltd on behalf of the named organisation. The information contained in this report is based on data provided by the client and has not been independently verified or assured. Botsfirm Solidarity accepts no liability for errors or omissions in the underlying data. This report is intended for use in the client\'s ESG and sustainability disclosure programme and for submission to development finance institutions as part of financing applications. Sections marked [MANAGEMENT INPUT REQUIRED] must be completed by management before the report is finalised and submitted.',
                        { size: 17, color: '64748B', spacing: { before: 0, after: 0 } }),
                    ], { width: CONTENT_W, bg: GRAY_BG }),
                  ],
                }),
              ],
            }),
          ],
        },
      ],
    })
    const buffer = await Packer.toBuffer(doc)

// ── Hash and log ─────────────────────────────────────────────────────────────
const { createHash } = await import('crypto')
const hash = createHash('sha256').update(Buffer.from(buffer)).digest('hex')

const { error: hashError } = await supabase
  .from('reports')
  .update({
    docx_hash: hash,
    hash_algorithm: 'SHA-256',
    hash_computed_at: new Date().toISOString(),
  })
  .eq('id', reportId)

if (hashError) {
  console.error('Hash update failed:', hashError)
}

await supabase.from('file_activity_log').insert({
  activity_type: 'report_generated',
  file_type: 'word_report',
  filename: `ESG_Report_v${report.report_version}.docx`,
  report_id: reportId,
  cycle_id: snap.cycle_id,
  workspace_id: report.workspace_id,
  report_version: report.report_version,
  performed_by: user.id,
  performed_by_email: user.email,
  notes: `SHA-256: ${hash}`,
})

// ── Return ────────────────────────────────────────────────────────────────────
const uint8 = new Uint8Array(buffer)

return new NextResponse(uint8, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="ESG_Report_v${report.report_version}_${String(org?.name ?? 'Client').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.docx"`,
      },
    })
  } catch (err) {
    console.error('Report generation error:', err)
    return NextResponse.json({ error: 'Failed to generate report', detail: String(err) }, { status: 500 })
  }
}