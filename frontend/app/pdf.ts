import { jsPDF } from 'jspdf'

/**
 * Generates a clean, branded PDF report from any Pitch Intel AI output.
 * Used by the "Export PDF" buttons across modules so a verdict/briefing
 * can be downloaded as a professional document.
 */

export interface ReportSection {
  heading: string
  body: string
}

function clean(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/[#*_`>|]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function exportReport(opts: {
  title: string
  subtitle?: string
  meta?: string[]
  sections: ReportSection[]
  filename?: string
  lang?: string
}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 50
  const maxW = W - M * 2
  let y = M

  const green: [number, number, number] = [34, 197, 94]
  const dark: [number, number, number] = [15, 23, 42]
  const grey: [number, number, number] = [100, 116, 139]

  const ensure = (need: number) => {
    if (y + need > H - M) { doc.addPage(); y = M }
  }

  // Brand header bar
  doc.setFillColor(...dark)
  doc.rect(0, 0, W, 38, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(255, 255, 255)
  doc.text('PITCH INTEL', M, 24)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...green)
  doc.text('WORLD CUP AI COMMAND CENTER', W - M, 24, { align: 'right' })
  y = 70

  // Title
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(...dark)
  doc.splitTextToSize(opts.title, maxW).forEach((line: string) => {
    ensure(26); doc.text(line, M, y); y += 26
  })

  if (opts.subtitle) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(...grey)
    ensure(18); doc.text(opts.subtitle, M, y); y += 20
  }

  if (opts.meta && opts.meta.length) {
    doc.setFontSize(9); doc.setTextColor(...grey)
    ensure(14); doc.text(opts.meta.join('   ·   '), M, y); y += 8
  }

  // Divider
  y += 10; ensure(4)
  doc.setDrawColor(...green); doc.setLineWidth(2); doc.line(M, y, M + 60, y); y += 22

  // Sections
  opts.sections.forEach(sec => {
    if (!sec.body?.trim()) return
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...green)
    ensure(18); doc.text(sec.heading.toUpperCase(), M, y); y += 16

    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(40, 40, 40)
    const lines = doc.splitTextToSize(clean(sec.body), maxW)
    lines.forEach((line: string) => { ensure(16); doc.text(line, M, y); y += 16 })
    y += 12
  })

  // Footer on every page
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...grey)
    const langNote = opts.lang && opts.lang !== 'en' ? `  ·  ${opts.lang.toUpperCase()}` : ''
    doc.text(`Powered by IBM Granite (watsonx.ai)  ·  StatsBomb Open Data${langNote}`, M, H - 24)
    doc.text(`${p} / ${pages}`, W - M, H - 24, { align: 'right' })
  }

  const name = opts.filename || opts.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  doc.save(`${name}.pdf`)
}
