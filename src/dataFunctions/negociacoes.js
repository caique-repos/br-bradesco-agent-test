const Papa = require('papaparse')
const iconv = require('iconv-lite')
const { downloadObjectToBuffer, uploadObject } = require('../services/cosService')

const gerarCSVNegociacaoBuffer = (buffer) => {
  let conteudo

  try {
    conteudo = buffer.toString('utf-8')
    if (conteudo.includes('\u0000')) {
      conteudo = iconv.decode(buffer, 'utf16-le')
    }
  } catch {
    conteudo = iconv.decode(buffer, 'latin1')
  }

  const delimiter = conteudo.includes(';') ? ';' : ','

  const { data } = Papa.parse(conteudo, {
    header: true,
    delimiter,
    skipEmptyLines: true,
  })

  if (!data || data.length === 0) {
    throw new Error('CSV vazio ou inválido')
  }

  const normalizedData = data.map(row => {
    const novo = {}
    for (const key in row) {
      const trimmedKey = key.trim()
      novo[trimmedKey] = row[key]?.trim() ?? ''
    }
    return novo
  })

  const colunasDesejadas = [
    'ID',
    'VALOR',
    'CONDICAO_PRECO',
    'DATA_ENTREGA',
    'DATA_PAGAMENTO',
    'COMENTARIO_FORNECEDOR',
    'COMENTARIO_COLABORADOR',
    'NUMERO_RODADA',
  ]

  const filtrado = normalizedData.map(row => {
    const novo = {}
    colunasDesejadas.forEach(col => {
      novo[col] = row[col] ?? ''
    })
    novo['ANALISE DA IA'] = ''
    return novo
  })

  return Papa.unparse(filtrado, { delimiter: ';' })
}

const decodeBuffer = (buf) => {
  if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf)
  if (buf.length === 0) return ''

  if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    const s = iconv.decode(buf, 'utf8')
    return s.replace(/^\uFEFF/, '')
  }
  if (buf.length >= 2 && buf[0] === 0xFF && buf[1] === 0xFE) {
    return iconv.decode(buf, 'utf16-le')
  }
  if (buf.length >= 2 && buf[0] === 0xFE && buf[1] === 0xFF) {
    return iconv.decode(buf, 'utf16-be')
  }

  const asUtf8 = iconv.decode(buf, 'utf8')
  const numReplacement = (asUtf8.match(/\uFFFD/g) || []).length
  const replacementRatio = numReplacement / Math.max(1, asUtf8.length)

  let zerosEven = 0
  let zerosOdd = 0
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 0) {
      if (i % 2 === 0) zerosEven++
      else zerosOdd++
    }
  }
  const half = Math.max(1, Math.floor(buf.length / 2))
  const evenRatio = zerosEven / half
  const oddRatio = zerosOdd / half

  if (oddRatio > 0.20 && oddRatio > evenRatio * 1.5) {
    return iconv.decode(buf, 'utf16-le')
  }
  if (evenRatio > 0.20 && evenRatio > oddRatio * 1.5) {
    return iconv.decode(buf, 'utf16-be')
  }

  if (replacementRatio > 0.01) {
    return iconv.decode(buf, 'latin1')
  }

  return asUtf8
}

const atualizarComentarioColaborador = async (keyName, id, comentario) => {
  const data = await downloadObjectToBuffer(keyName)
  const buf = data.Body

  const conteudo = decodeBuffer(buf)
  const delimiter = conteudo.includes(';') ? ';' : ','

  const { data: rows } = Papa.parse(conteudo, {
    header: true,
    delimiter,
    skipEmptyLines: true,
  })

  if (!rows || rows.length === 0) {
    throw new Error('CSV vazio ou inválido')
  }

  let updated = false

  const atualizados = rows.map(row => {
    const trimmedRow = {}
    for (const k in row) trimmedRow[k.trim()] = row[k]?.trim() ?? ''

    if (trimmedRow.ID === id) {
      trimmedRow.COMENTARIO_COLABORADOR = comentario
      updated = true
    }
    return trimmedRow
  })

  if (!updated) return false

  const csvAtualizado = Papa.unparse(atualizados, { delimiter })

  await uploadObject({
    buffer: csvAtualizado,
    keyName,
    contentType: 'utf-8'
  })

  return true
}

module.exports = {
  gerarCSVNegociacaoBuffer,
  atualizarComentarioColaborador,
  decodeBuffer
}