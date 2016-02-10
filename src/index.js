'use strict'

const swaggerSpec = require('./swaggerSpec')
const routeRegister = require('./routeRegister')
const fileHandlers = require('./fileHandlers')
const fileAuthorizers = require('./fileAuthorizers')
const SwaggerApis = require('./SwaggerApis')
const Options = require('./options')

module.exports = addHandlers

function addHandlers(app, options) {
  const api = swaggerSpec.getSpecSync(options.api)
  const operations = swaggerSpec.getAllOperations(api)

  options = Options.applyDefaultOptions(options, { api })
  app = Options.applyDefaultAppOptions(app)

  routeRegister.registerRoutes(app, operations, options)

  fileHandlers.disableOldHandlers(operations, options)
  fileAuthorizers.disableOldAuthorizers(options)

  if (app.swagger) app.swagger.add(api)
  else app.swagger = new SwaggerApis().add(api)

  return app
}
