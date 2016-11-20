'use strict'

const fileUtil = require('./fileUtil')

exports.enableSpec = enableSpec
exports.disableSpec = disableSpec
exports.disableOldSpecs = disableOldSpecs
exports.getTemplateView = getTemplateView

function enableSpec(operation, options) {
  return fileUtil.enableFile(operation, operation, 'specs', /^#/, options)
}

function disableSpec(operation, options) {
  return fileUtil.disableFile(operation, 'specs', options)
}

function disableOldSpecs(operations, options) {
  return fileUtil.disableOldOperationFiles(operations, 'specs', options)
}

function getTemplateView(operation) {
  return fileUtil.getDefaultTemplateView(operation, '# ')
}
