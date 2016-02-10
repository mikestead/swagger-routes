'use strict'

const swaggerSpec = require('./swaggerSpec')
const fileUtil = require('./fileUtil')

exports.enableHandler = enableHandler
exports.disableHandler = disableHandler
exports.disableOldHandlers = disableOldHandlers
exports.getTemplateView = getTemplateView

function enableHandler(operation, options) {
  return fileUtil.enableFile(operation.id, operation, 'handlers', options)
}

function disableHandler(operation, options) {
  return fileUtil.disableFile(operation.id, 'handlers', options)
}

function disableOldHandlers(operations, options) {
  return fileUtil.disableOldOperationFiles(operations, 'handlers', options)
}

function getTemplateView(operation) {
  const view = Object.assign({}, operation)
  const groupsMap = operation.paramGroupSchemas

  view.method = view.method.toUpperCase()
  view.summary = (view.summary || view.id).split('\n').join('\n * ')
  view.params = Object.keys(groupsMap)
    .map(groupId => {
      const propMap = groupsMap[groupId].properties
      return {
        groupId,
        order: swaggerSpec.PARAM_GROUPS.indexOf(groupId),
        properties: Object.keys(propMap).map(name => ({
          details: formatParamPropertyDoc(name, propMap[name])
        }))
      }
    })
    .sort((a, b) => a.order - b.order)

  return view
}

function formatParamPropertyDoc(name, info) {
  const MAX_CHARS = 100
  const type = info.format || info.type || ''
  const desc = (info.description || '').split('\n')[0]
  const match = desc.match(/(^.*?[a-z]{2,}[.!?])\s+\W*[A-Z]/)
  const i = match ? Math.min(match.index, MAX_CHARS) : Math.min(desc.length, MAX_CHARS)
  const shortDesc = desc.substr(0, i)

  let dot = '.'
  if (shortDesc.endsWith('.')) dot = ''
  else if (shortDesc.length === MAX_CHARS) dot = '...'

  let s = name
  if (type) s += ` {${type}}`
  if (shortDesc) s += ` ${shortDesc}${dot}`
  return s
}
