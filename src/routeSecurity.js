'use strict'

const path = require('path')

exports.getAuthorizers = getAuthorizers
exports.createAuthCheck = createAuthCheck

function getAuthorizers(security, options) {
	return getDefinitionIds(security)
		.map(id => ({ id, auth: getAuthorizer(id, security[id], options) }))
		.reduce((authorizers, info) => authorizers.set(info.id, info.auth), new Map())
}

function getDefinitionIds(security) {
	return Object.keys(security || {})
		.filter(id => !id.startsWith('x-'))
}

function getAuthorizer(id, definition, options) {
	let authorizer
	if (typeof options.createAuthorizer === 'function') authorizer = options.createAuthorizer(id, definition)
	if (!authorizer) authorizer = requireAuthorizer(id, options)
	return authorizer
}

function requireAuthorizer(id, options) {
	const filename = id.replace(/[^\w$]/g, '_')
	const authorizerPath = path.resolve(options.security, filename)
	try { return require(authorizerPath) }
	catch(e) { return null }
}

function createAuthCheck(security, authorizers) {
	const ids = getDefinitionIds(security)
	if (!ids.length) return null

	return function authorize(req, res, next) {
		Promise.all(ids.map(id =>
			new Promise((rej, res) => {
				const authorizer = authorizers.get(id)
				if (typeof authorizer === 'function') {
					req.securityScopes = security[id]
					authorizer(req, res, err => err ? rej(err) : res())
				} else {
					res.statusCode = 401
					rej(new Error('Unauthorized'))
				}
			})
		))
		.then(() => next())
		.catch(e => next(e))
	}
}
