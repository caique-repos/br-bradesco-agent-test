const XLSX = require('xlsx')
const fs = require('fs')
const path = require('path')

const inputFilePath = path.join(__dirname, 'primeira_rodada_negociacao.xlsx')
const outputFilePath = path.join(__dirname, 'primeira_rodada_negociacao.csv')

const workbook = XLSX.readFile(inputFilePath)
const sheet = workbook.Sheets[workbook.SheetNames[0]]

const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

const filtered = rows.filter(row =>
  row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')
)

function escapeCell(cell) {
  if (cell === null || cell === undefined) return ''

  if (typeof cell === 'number') {
    return String(cell)
  }

  let s = String(cell)
  if (s.includes('"')) s = s.replace(/"/g, '""')

  if (s.includes(';') || s.includes('\n') || s.includes('"')) {
    return `"${s}"`
  }
  return s
}

const csvLines = filtered.map(row => row.map(escapeCell).join(';'))
const csv = '\uFEFF' + csvLines.join('\n')

fs.writeFileSync(outputFilePath, csv, 'utf8')
console.log(`Arquivo CSV gerado com sucesso: ${outputFilePath}`)
