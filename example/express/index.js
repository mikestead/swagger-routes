const swaggerRoutes = require('../../src')
const express = require('express')
const app = express()

swaggerRoutes(app, {
	api: '../api.yml',
	handlers: './src/handlers',
	authorizers: './src/handlers/security'
})

const server = app.listen(8080, 'localhost', function() {
	const address = server.address()
	console.log(`express listening at ${address.address}:${address.port}`)
});
