'use strict'

const path = require('path')
const security = require('./routeSecurity')
const routeBuilder = require('./routeBuilder')

exports.registerRoutes = registerRoutes

function registerRoutes(app, operations, options) {
	registerOperationRoutes(app, operations, options)
	registerDocsRoute(app, options)
	return app
}

function registerOperationRoutes(app, operations, options) {
	const authorizers = security.getAuthorizers(options.api.securityDefinitions, options)
	operations.forEach(operation => {
		let opPath = operation.path.replace(/{([^}]+)}/g, ':$1')
		opPath = path.normalize(`/${options.api.basePath}/${opPath}`)
		const stack = routeBuilder.buildHandlerStack(operation, authorizers, options)
		if (stack.length) getMethod(app, operation).apply(app, [ opPath ].concat(stack))
		else throw new Error(`Missing operation handler for '${operation.id}'`)
	})
}

function getMethod(app, operation) {
	const method = operation.method
	let func = app[method]
	if (func) return func
	else if (method === 'delete') return app['del']
	else return null
}

function registerDocsRoute(app, options) {
	const docsPath = path.normalize(`/${options.api.basePath}/${options.docsPath}`)
	app.get(docsPath, function handler(req, res) { res.json(options.api) })
}
