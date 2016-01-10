const swaggerRoutes = require('../../src')
const restify = require('restify')
const server = restify.createServer()

swaggerRoutes(server, {
	api: '../api.yml',
	handlers: './src/handlers',
	authorizers: './src/handlers/security'
})

server.listen(8080, 'localhost', function() {
	console.log('%s listening at %s', server.name, server.url);
});
