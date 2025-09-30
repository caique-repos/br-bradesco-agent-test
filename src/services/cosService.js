const fs = require('fs')
const path = require('path')
const cos = require('../config/cos')

const listObjects = async (max = 15) => {
  const params = {
    Bucket: process.env.COS_BUCKET,
    MaxKeys: max
  }

  const data = await cos.listObjectsV2(params).promise()
  return data.Contents || []
}

const uploadObject = async ({ buffer, keyName, contentType }) => {
  const params = {
    Bucket: process.env.COS_BUCKET,
    Key: keyName,
    Body: buffer,
    ContentType: contentType
  }

  return await cos.putObject(params).promise()
}

const downloadObjectToFile = async (keyName, targetFolder = '/Users/mariannesalomaodeoliveira/Downloads') => {
  if (!fs.existsSync(targetFolder)) {
    throw new Error(`Pasta de destino não existe: ${targetFolder}`)
  }

  const localPath = path.join(targetFolder, keyName)

  const params = {
    Bucket: process.env.COS_BUCKET,
    Key: keyName
  }

  return new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(localPath)

    cos.getObject(params)
      .createReadStream()
      .on('error', reject)
      .pipe(fileStream)
      .on('error', reject)
      .on('finish', () => resolve(localPath))
  })
}

const downloadObjectToBuffer = async (keyName) => {
  const params = {
    Bucket: process.env.COS_BUCKET,
    Key: keyName,
  }

  const data = await cos.getObject(params).promise()
  return data.Body
}

const getLatestObject = async () => {
  const objects = await listObjects()

  if (!objects.length) throw new Error('Nenhum arquivo encontrado no COS')

  objects.sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified))
  return objects[0]
}

module.exports = { listObjects, uploadObject, downloadObjectToFile, downloadObjectToBuffer, getLatestObject }
