'use strict'

const fileAuthorizers = require('./fileAuthorizers')

exports.getAuthorizers = getAuthorizers
exports.createAuthCheck = createAuthCheck

function getAuthorizers(securityDefinitions, options) {
	return getDefinitionIds(securityDefinitions)
		.map(id => ({ id, auth: getAuthorizer(id, securityDefinitions[id], options) }))
		.reduce((authorizers, info) => authorizers.set(info.id, info.auth), new Map())
}

function getDefinitionIds(security) {
	return Object.keys(security || {})
		.filter(id => !id.startsWith('x-'))
}

function getAuthorizer(id, securityScheme, options) {
	let authorizer
	if (typeof options.authorizers.create === 'function') authorizer = options.authorizers.create(id, securityScheme)
	if (authorizer) fileAuthorizers.disableAuthorizer(id, options)
	else authorizer = requireAuthorizer(id, securityScheme, options)
	return authorizer
}

function requireAuthorizer(id, securityScheme, options) {
	const fileInfo = fileAuthorizers.enableAuthorizer(id, securityScheme, options)
	try { return require(fileInfo.path) }
	catch(e) { return null }
}

function createAuthCheck(operation, authorizers) {
	const ids = getDefinitionIds(operation.security)
	if (!ids.length) return null

	return function authorize(req, res, next) {
		Promise.all(ids.map(id =>
			new Promise((rej, res) => {
				const authorizer = authorizers.get(id)
				if (typeof authorizer === 'function') {
					const requiredScopes = operation.security[id]
					req.verifyScopes = function verifyScopes(scopes) {
						return verifyRequiredScopes(requiredScopes, scopes)
					}
					authorizer(req, res, err => err ? rej(err) : res())
				} else {
					const e = new Error('Unauthorized')
					e.status = 401
					rej(e)
				}
			})
		))
		.then(() => next())
		.catch(e => next(e))
	}
}

function verifyRequiredScopes(requiredScopes, scopes) {
	if (!requiredScopes || !requiredScopes.length) return undefined
	if (!scopes) scopes = []

	const hasRequiredScopes = requiredScopes.every(scope => scopes.indexOf(scope) !== -1)
	if (!hasRequiredScopes) {
		const e = new Error('Forbidden')
		e.status = 403
		return e
	}
	return undefined
}
