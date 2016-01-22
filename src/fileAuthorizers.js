'use strict'

const fileUtil = require('./fileUtil')

exports.enableAuthorizer = enableAuthorizer
exports.disableAuthorizer = disableAuthorizer
exports.disableOldAuthorizers = disableOldAuthorizers
exports.getTemplateView = getTemplateView


function enableAuthorizer(schemeId, securityScheme, options) {
	return fileUtil.enableFile(schemeId, Object.assign({ id: schemeId }, securityScheme), 'authorizers', options)
}

function disableAuthorizer(schemeId, options) {
	return fileUtil.disableFile(schemeId, 'authorizers', options)
}

function disableOldAuthorizers() {

}

function getTemplateView(securitySchema) {
	return securitySchema
}
