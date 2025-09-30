const express = require('express')
const router = express.Router()
const multer = require('multer')
const XLSX = require('xlsx')
const path = require('path')
const axios = require('axios')
const { listObjects, uploadObject, downloadObjectToFile, downloadObjectToBuffer, getLatestObject } = require('../services/cosService')
const { gerarCSVAprovadasBuffer, aprovarPorLinha } = require('../dataFunctions/propostasAAprovar')
const { gerarCSVNegociacaoBuffer, atualizarComentarioColaborador} = require('../dataFunctions/negociacoes')

const upload = multer({ storage: multer.memoryStorage() })

router.get('/objects', async (req, res) => {
  try {
    const objects = await listObjects()
    res.json(objects)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao listar objetos' })
  }
})

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' })
    }

    let { originalname, mimetype, buffer } = req.file

    const isExcel =
      mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimetype === 'application/vnd.ms-excel' ||
      originalname.toLowerCase().endsWith('.xlsx') ||
      originalname.toLowerCase().endsWith('.xls')

    let uploadBuffer
    let uploadName
    let contentType

    if (isExcel) {
      const workbook = XLSX.read(buffer, { type: 'buffer'})

      const sheetName = workbook.SheetNames[0]
      const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName], {
        FS: ';'
      })

      uploadBuffer = Buffer.from(csv, 'utf-8')

      uploadName = originalname.replace(/\.(xlsx|xls)$/i, '.csv')
      contentType = 'text/csv; charset=utf-8'

      console.log('Conversão de Excel para CSV concluída com sucesso.')
    } else {
      uploadBuffer = buffer
      uploadName = originalname
      contentType = mimetype
    }

    const keyName = req.body.key || uploadName

    const result = await uploadObject({
      buffer: uploadBuffer,
      keyName,
      contentType
    })

    res.json({
      message: 'Upload concluído',
      key: keyName,
      etag: result.ETag
    })

    console.log(`Upload do arquivo ${keyName} conluído`)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro no upload', details: err.message })
  }
})

router.get('/download/:key', async (req, res) => {
  try {
    const keyName = req.params.key
    const savedPath = await downloadObjectToFile(keyName)

    res.json({ message: 'Arquivo salvo no servidor', path: savedPath })
  } catch (err) {
    console.error(err)

    res.status(500).json({ error: 'Falha ao salvar localmente', details: err.message })
  }
})

router.get('/download-doc/:key', async (req, res) => {
  try {
    const keyName = req.params.key

    const fileBuffer = await downloadObjectToBuffer(keyName)

    res.setHeader('Content-Disposition', `attachment; filename="${keyName}"`)

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')

    res.end(fileBuffer)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Falha ao baixar arquivo', details: err.message })
  }
})


router.get('/download-final', async (req, res) => {
  try {
    const keyName = 'tabela_que_vem_da_ia.csv'
    const data = await downloadObjectToBuffer(keyName)

    res.setHeader('Content-Type', data.ContentType || 'application/octet-stream')
    res.setHeader('Content-Disposition', `attachment; filename="${keyName}"`)
    res.send(data.Body)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Falha no download', details: err.message })
  }
})

router.get('/csv-aprovadas', async (req, res) => {
  try {
    const keyName = 'tabela_que_vem_da_ia.csv'

    const data = await downloadObjectToBuffer(keyName)

    const csvFiltrado = gerarCSVAprovadasBuffer(data.Body)

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="tabela_filtrada.csv"')
    res.send(csvFiltrado)
    console.log('Sucesso - Gerado o csv: PROPOSTAS A APROVAR')
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Falha ao gerar CSV filtrado - PROPOSTAS A APROVAR', details: err.message })
  }
})

router.get('/csv-negociacao', async (req, res) => {
  try {
    const keyName = 'tabela_de_negociacao_sem_regras.csv'

    const data = await downloadObjectToBuffer(keyName)

    const csvNegociacaoFiltrado = gerarCSVNegociacaoBuffer(data.Body)

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="csv_analise_ia_negociacao.csv"')
    res.send(csvNegociacaoFiltrado)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Falha ao gerar CSV de negociação', details: e.message })
  }
})

router.get('/aprovar-proposta', async (req, res) => {
  try {
    const linha = req.body
    const csv = aprovarPorLinha(linha)

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="proposta_aprovada.csv"')
    res.send(csv)
  } catch (err) {
    console.error(err)
    res.status(400).json({ error: 'Falha ao aprovar proposta', details: err.message })
  }
})

router.get('download-latest', async (req, res) => {
  try {
    const latest = await getLatestObject()
    const keyName = latest.key

    const data = await downloadObjectToBuffer(keyName)

    res.setHeader('Content-Type', data.ContentType || 'application/octet-stream')
    res.setHeader('Content-Disposition', `attachment; filename="${keyName}"`)
    res.send(data.Body)

    console.log(`Download do último arquivo no COS (${keyName}) concluído.`)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Falha ao baixar último arquivo', details: e.message })
  }
})

router.put('/negociacao-comentario', async (req, res) => {
  const { id, comentario } = req.body

  if (!id || typeof comentario !== 'string') {
    return res.status(400).json({ error: 'Parâmetros inválidos: é necessário id e comentario' })
  }

  try {
    const latest = await getLatestObject()
    const keyName = latest.key

    const updated = await atualizarComentarioColaborador(keyName, id, comentario)

    if (!updated) return res.status(404).json({ error: `Linha com ID ${id} não encontrado.` })

    res.json({ success: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({
      error: 'Falha ao atualizar COMENTARIO_COLABORADOR',
      details: e.message
    })
  }
})

router.get('/proposta-ia', async (req, res) => {
  try {
    const keyName = 'tabela_que_vem_da_ia.csv'

    const buffer = await downloadObjectToBuffer(keyName)

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${keyName}"`)
    res.send(buffer)

    console.log('Buffer size:', buffer.length)
    console.log(`Download com delay concluído para ${keyName}`)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Falha no download com delay', details: e.message })
  }
})

router.get('/primeira-rodada-negociacao', async (req, res) => {
  try {
    const keyName = 'primeira_rodada_negociacao.csv'
    const buffer = await downloadObjectToBuffer(keyName)

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${keyName}"`)
    res.send(buffer)

    console.log('Buffer size:', buffer.length)
    console.log(`Download com delay concluído para ${keyName}`)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Falha no download da Primeira Rodada de negociação', details: e.message })
  }
})

router.get('/negociacao-andamento', async (req, res) => {
  try {
    const keyName = 'negociacao_andamento.csv'
    const buffer = await downloadObjectToBuffer(keyName)

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${keyName}"`)
    res.send(buffer)

    console.log('Buffer size:', buffer.length)
    console.log(`Download com delay concluído para ${keyName}`)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Falha no download da Primeira Rodada de negociação', details: e.message })
  }
})

router.post('/propostas-analisadas-ia', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' })

    const { originalname, mimetype, buffer } = req.file

    const isExcel =
      mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimetype === 'application/vnd.ms-excel' ||
      originalname.toLowerCase().endsWith('.xlsx') ||
      originalname.toLowerCase().endsWith('.xls')

    let finalBuffer
    let finalName
    let contentType

    if (isExcel) {
      const workbook = XLSX.read(buffer, { type: 'buffer' })

      const csvParts = workbook.SheetNames.map(sheetName => {
        return XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName], { FS: ';' })
      })

      const csvFull = csvParts.join('\n')
      finalBuffer = Buffer.from(csvFull, 'utf-8')
      finalName = originalname.replace(/\.(xlsx|xls)$/i, '.csv')
      contentType = 'text/csv; charset=utf-8'

      console.log(`Conversão Excel → CSV concluída para ${finalName}`)
    } else if (originalname.toLowerCase().endsWith('.csv')) {
      finalBuffer = buffer
      finalName = originalname
      contentType = 'text/csv; charset=utf-8'
    } else {
      return res.status(400).json({ error: 'Formato de arquivo inválido. Use .csv, .xls ou .xlsx' })
    }

    await uploadObject({
      buffer: finalBuffer,
      keyName: finalName,
      contentType
    })

    console.log(`Upload no COS concluído: ${finalName}`)

    const response = await axios.post(
      'https://analysis-api.20ebj8xne78k.us-south.codeengine.appdomain.cloud/proposal_analysis',
      { file_name: finalName },
      { headers: { Accept: 'application/json', 'Content-Type': 'application/json' } }
    )
    console.log(`IA chamada com sucesso, status: ${ response.status }`)

    res.json({ message: 'Arquivo enviado e análise pela IA iniciada com sucesso', fileName: finalName })
  } catch (e) {
    console.error('Erro na chamada do fluxo de análise, API da IA:', e)

    if (e.response) {
      console.error('Status API externa:', e.response.status)
      console.error('Body API externa:', e.response.data?.toString())
    }
    res.status(500).json({ error: 'Falha no processamento', details: e.message })
  }
})

router.get('/proposta-ia-cos', async (req, res) => {
  try {
    const keyName = 'Analise_propostas.csv'
    const buffer = await downloadObjectToBuffer(keyName)

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${keyName}"`)
    res.send(buffer)

    console.log('Buffer size:', buffer.length)
    console.log(`Download concluído para ${keyName}`)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Falha no download de Analise_propostas.csv', details: err.message })
  }
})

module.exports = router
