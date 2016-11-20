'use strict'

const fileHandlers = require('./fileHandlers')
const security = require('./routeSecurity')
const validation = require('./routeValidation')
const util = require('./util')

exports.buildHandlerStack = buildHandlerStack

function buildHandlerStack(operation, authorizers, options) {
  let middleware = []
  let handler = getHandler(operation, options)
  if (util.isObj(handler)) {
    if (Array.isArray(handler.middleware)) {
      middleware = handler.middleware
    } else if (util.isFunc(handler.middleware) || util.isObj(handler.middleware)) {
      middleware = [ handler.middleware ]
    }
    handler = handler.handler || handler.default || handler[operation.id]
  }
  if (util.isFunc(handler)) {
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

  const getAction = m => util.isObj(m) ? m.action : m
  const preValidation = customMiddleware.filter(m => !m.validated).map(getAction).filter(util.isFunc)
  const postValidation = customMiddleware.filter(m => !!m.validated).map(getAction).filter(util.isFunc)

  middleware.push(augmentRequest(operation))
  
  if (authCheck) middleware.push(authCheck)
  if (preValidation.length) middleware.push.apply(middleware, preValidation)
  if (validationCheck) middleware.push(validationCheck)
  if (postValidation.length) middleware.push.apply(middleware, postValidation)

  return middleware
}

function augmentRequest(operation) {
  return function augmentReq(req, res, next) {
    req.operation = operation
    return next()
  }
}

/*
Wrap primary handler and capture any errors, especially if returning a Promise as the
error will be lost otherwise. A Promise may be returned manually, or more often when
using async / await on a handler.
*/
function wrapRequestHandler(func) {
  return function handler(req, res, next) {
    try {
      const result = func(req, res, next)
      if (result && result.catch) result.catch(e => next(e))
    } catch(e) {
      next(e)
    }
  }
}
