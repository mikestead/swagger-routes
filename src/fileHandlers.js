'use strict'

const fileUtil = require('./fileUtil')

exports.enableHandler = enableHandler
exports.disableHandler = disableHandler
exports.disableOldHandlers = disableOldHandlers
exports.getTemplateView = getTemplateView

function enableHandler(operation, options) {
  return fileUtil.enableFile(operation, operation, 'handlers', /^\/?\*/, options)
}

function disableHandler(operation, options) {
  return fileUtil.disableFile(operation, 'handlers', options)
}

function disableOldHandlers(operations, options) {
  return fileUtil.disableOldOperationFiles(operations, 'handlers', options)
}

function getTemplateView(operation) {
  return fileUtil.getDefaultTemplateView(operation, ' * ')
}
