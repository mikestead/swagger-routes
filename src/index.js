'use strict'

const swaggerSpec = require('./swaggerSpec')
const routeRegister = require('./routeRegister')
const genHandlers = require('./genHandlers')
const Options = require('./options')

exports.genHandlers = genHandlers
exports.addRoutes = addRoutes

function addRoutes(app, options) {
	const api = swaggerSpec.getSpecSync(options.api)
	const operations = swaggerSpec.getAllOperations(api)
	app = applyDefaultAppOptions(app)
	options = applyDefaultOptions(options, { api })
	return routeRegister.registerRoutes(app, operations, options)
}

function applyDefaultAppOptions(app) {
	if (isExpress(app)) {
		applyDefaultExpressOptions(app)
	}
	return app
}

function isExpress(app) {
	return (!!app && !!app.set && !!app.render)
}

function applyDefaultExpressOptions(app) {
	Object.keys(Options.DEFAULT_EXPRESS_OPTIONS)
		.forEach(name =>
			app.set(name, Options.DEFAULT_EXPRESS_OPTIONS[name]))
}

function applyDefaultOptions(options, other) {
	return Object.assign({}, Options.DEFAULT_OPTIONS, options, other)
}
