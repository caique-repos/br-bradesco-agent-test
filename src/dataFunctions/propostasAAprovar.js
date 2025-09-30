const fs = require('fs')
const Papa = require('papaparse')

const readCSV = (inputPath) => {
  const conteudo = fs.readFileSync(inputPath, 'utf-8')
  const { data } = Papa.parse(conteudo, {
    header: true,
    delimiter: ';',
    skipEmptyLines: true
  })
  return data
}

const readCSVFromBuffer = (buffer) => {
  const conteudo = buffer.toString('utf-8')
  const { data } = Papa.parse(conteudo, {
    header: true,
    delimiter: ';',
    skipEmptyLines: true
  })
  return data
}

const filtrarAprovadas = (registros) => {
  return registros.filter(r =>
    r.Proposta_comercial?.trim().toLowerCase() === 'valido' &&
    r.Proposta_tecnica?.trim().toLowerCase() === 'válida'
  )
}

const gerarCSVAprovadasBuffer = (buffer) => {
  const dados = readCSVFromBuffer(buffer)
  const aprovadas = filtrarAprovadas(dados)
  return Papa.unparse(aprovadas, { delimiter: ';' })
}

const salvarCSV = (registros, outputPath) => {
  const csv = Papa.unparse(registros, { delimiter: ';' })
  fs.writeFileSync(outputPath, csv, 'utf-8')
}

const gerarCSVAprovadas = (inputPath, outputPath) => {
  const dados = readCSV(inputPath)
  const aprovadas = filtrarAprovadas(dados)
  salvarCSV(aprovadas, outputPath)
}

const aprovarPorLinha = (linha) => {
  if (!linha || typeof linha !== 'object') {
    throw new Error('Linha inválida para aprovação')
  }
  const registro = { ...linha, 'Aprovada por': 'aprovada por um humano' }

  return Papa.unparse([registro], { delimiter: ';' })
}

module.exports = {
  readCSV,
  readCSVFromBuffer,
  filtrarAprovadas,
  gerarCSVAprovadasBuffer,
  salvarCSV,
  gerarCSVAprovadas,
  aprovarPorLinha
}