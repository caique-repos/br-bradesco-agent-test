const express = require('express')
const cors = require('cors')
const cosRoutes = require('./routes/cosRoutes')

const app = express()
app.use(cors())
app.use(express.json())

app.use('/cos', cosRoutes)

module.exports = app
