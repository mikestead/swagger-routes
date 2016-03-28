'use strict'

const fileHandlers = require('./fileHandlers')
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
    handler = handler.handler || handler.default || handler[operation.id]
  }
  if (handler && typeof handler === 'function') {
    handler = wrapRequestHandler(handler)
    middleware = getMiddleware(middleware, operation, authorizers)
    return middleware.concat([ handler ])
  }
  return []
}

function getHandler(operation, options) {
  let handler
  if (typeof options.handlers.create === 'function') handler = options.handlers.create(operation)
  if (handler) fileHandlers.disableHandler(operation, options)
  else handler = requireHandler(operation, options)
  return handler
}

function requireHandler(operation, options) {
  const fileInfo = fileHandlers.enableHandler(operation, options)
  try { return require(fileInfo.path) }
  catch(e) {
    if (e.code === 'MODULE_NOT_FOUND') return null
    else throw e
  }
}

function getMiddleware(customMiddleware, operation, authorizers) {
  const middleware = []
  const authCheck = security.createAuthCheck(operation, authorizers)
  const validationCheck = validation.createValidationCheck(operation)

  if (authCheck) middleware.push(authCheck)
  if (customMiddleware) middleware.push.apply(middleware, customMiddleware)
  if (validationCheck) middleware.push(validationCheck)

  return middleware
}

function wrapRequestHandler(func) {
  return function errorCapture(req, res, next) {
    try {
      const result = func(req, res, next)
      if (result && result.catch) result.catch(e => next(e))
    } catch(e) {
      next(e)
    }
  }
}
