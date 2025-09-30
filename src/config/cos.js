const IBM = require('ibm-cos-sdk')
require('dotenv').config()

const cos = new IBM.S3({
  endpoint: process.env.COS_ENDPOINT,
  apiKeyId: process.env.COS_APIKEY,
  ibmAuthEndpoint: process.env.IBM_TOKEN_URL,
  serviceInstanceId: process.env.COS_SERVICE_ID
})

module.exports = cos
