'use strict'

const path = require('path')
const security = require('./routeSecurity')
const validation = require('./routeValidation')

exports.buildHandlerStack = buildHandlerStack

function buildHandlerStack(operation, authorizers, options) {
	let middleware
	let handler = getHandler(operation, options)
	if (handler && typeof handler === 'object') {
		if (Array.isArray(handler.middleware)) {
			middleware = handler.middleware
		} else if (typeof handler.middleware === 'function') {
			middleware = [ handler.middleware ]
		}
		handler = handler.handler || handler[operation.id]
	}
	if (handler && typeof handler === 'function') {
		middleware = getMiddleware(middleware, operation, authorizers)
		return middleware.concat([ handler ])
	}
	return []
}

function getHandler(operation, options) {
	var handler
	if (typeof options.createHandler === 'function') handler = options.createHandler(operation)
	if (!handler) handler = requireHandler(operation, options)
	return handler
}

function requireHandler(operation, options) {
	const handlerPath = path.resolve(options.handlers, operation.id)
	try { return require(handlerPath) }
	catch(e) { return null }
}

function getMiddleware(customMiddleware, operation, authorizers) {
	const middleware = []
	const authCheck = security.createAuthCheck(operation.security, authorizers)
	const validationCheck = validation.createValidationCheck(operation)

	if (authCheck) middleware.push(authCheck)
	if (customMiddleware) middleware.push.apply(middleware, customMiddleware)
	if (validationCheck) middleware.push(validationCheck)

	return middleware
}
