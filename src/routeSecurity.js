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
  if (authorizer && authorizer.default) authorizer = authorizer.default
  return authorizer
}

function requireAuthorizer(id, securityScheme, options) {
  const fileInfo = fileAuthorizers.enableAuthorizer(id, securityScheme, options)
  try { return require(fileInfo.path) }
  catch(e) {
    if (e.code === 'MODULE_NOT_FOUND') return null
    else throw e
  }
}

function createAuthCheck(operation, authorizers) {
  let security = operation.security || []
  if (security && !Array.isArray(security)) security = [ security ]
  if (!security.length) return null
  
  const securityExt = operation['x-security']

  return function authorize(req, res, next) {
    return Promise.all(security.map(scheme => {
      const id = Object.keys(scheme)[0]
      if (!id || id.startsWith('x-')) return null

      return new Promise((resolve, reject) => {
        const authorizer = authorizers.get(id)
        const ext = (securityExt && securityExt[id]) 
          ? securityExt[id]
          : {}
        
        if (typeof authorizer === 'function') {
          const requiredScopes = scheme[id]
          req.requiredScopes = requiredScopes
          req.verifyScopes = function verifyScopes(scopes) {
            return verifyRequiredScopes(requiredScopes, scopes, ext)
          }
          try {
            const result = authorizer(req, res, err => err ? reject(err) : resolve())
            if (result && result.catch) result.catch(e => reject(e))
          } catch(e) {
            reject(e)
          }
        } else {
          // Unable to determine at this point if authorized but don't
          // have correct scope(s), or if authorization is required.
          // Assume the latter.
          const e = new Error('Unauthorized')
          e.statusCode = e.status = 401
          reject(e)
        }
      })
    }))
    .then(() => next())
    .catch(e => next(e))
  }
}

function verifyRequiredScopes(requiredScopes, scopes, ext) {
  if (!requiredScopes || !requiredScopes.length) return undefined
  if (!scopes) scopes = []

  let hasRequiredScopes = false
  if (ext && ext.OR_scopes) {
    // This extension allows for the logical OR of token scopes, so if one
    // or more scopes exist, access is permitted.
    hasRequiredScopes = requiredScopes.some(scope => scopes.indexOf(scope) !== -1)
  } else {
    hasRequiredScopes = requiredScopes.every(scope => scopes.indexOf(scope) !== -1)
  }
  if (!hasRequiredScopes) {
    const e = new Error('Forbidden')
    e.statusCode = e.status = 403
    e.requiredScopes = requiredScopes
    return e
  }
  return undefined
}
