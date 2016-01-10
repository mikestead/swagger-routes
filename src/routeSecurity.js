'use strict'

const path = require('path')
const fileAuthorizers = require('./fileAuthorizers')

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

function getAuthorizer(id, securityScheme, options) {
	let authorizer
	if (typeof options.createAuthorizer === 'function') authorizer = options.createAuthorizer(id, securityScheme)
	if (authorizer) fileAuthorizers.disableAuthorizer(id, options)
	else authorizer = requireAuthorizer(id, securityScheme, options)
	return authorizer
}

function requireAuthorizer(id, securityScheme, options) {
	const fileInfo = fileAuthorizers.enableAuthorizer(id, securityScheme, options)
	try { return require(fileInfo.path) }
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
