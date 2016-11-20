'use strict'

const fileUtil = require('./fileUtil')

exports.enableAuthorizer = enableAuthorizer
exports.disableAuthorizer = disableAuthorizer
exports.disableOldAuthorizers = disableOldAuthorizers
exports.getTemplateView = getTemplateView


function enableAuthorizer(schemeId, securityScheme, options) {
  const data = Object.assign({ id: schemeId }, securityScheme)
  return fileUtil.enableFile({ id: schemeId }, data, 'authorizers', null, options)
}

function disableAuthorizer(schemeId, options) {
  return fileUtil.disableFile({ id: schemeId }, 'authorizers', options)
}

function disableOldAuthorizers() {

}

function getTemplateView(securitySchema) {
  return securitySchema
}
