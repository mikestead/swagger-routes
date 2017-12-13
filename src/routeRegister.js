'use strict'

const path = require('path')
const security = require('./routeSecurity')
const routeBuilder = require('./routeBuilder')
const assert = require('assert')

exports.registerRoutes = registerRoutes

function registerRoutes(app, operations, options) {
  registerOperationRoutes(app, operations, options)
  registerDocsRoute(app, options)
  return app
}

function registerOperationRoutes(app, operations, options) {
  const authorizers = security.getAuthorizers(options.api.securityDefinitions, options)
  operations.forEach(operation => {
    const opPath = operation.fullPath.replace(/{([^}]+)}/g, ':$1')
    const stack = routeBuilder.buildHandlerStack(operation, authorizers, options)
    assert.ok(stack.length > 1, `Missing operation handler for '${operation.id}'`)
    getHttpMethod(app, operation).apply(app, [ opPath ].concat(stack))
  })
}

function getHttpMethod(app, operation) {
  const method = operation.method
  let func = app[method]
  if (func) return func
  else if (method === 'delete') return app['del']
  else return null
}

function registerDocsRoute(app, options) {
  const docsPath = path.normalize(`/${options.api.basePath}/${options.docsPath}`)
  app.get(docsPath, options.docsMiddleware, function handler(req, res) { res.json(options.api) })
}
