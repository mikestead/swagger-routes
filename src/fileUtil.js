'use strict'

const path = require('path')
const fs = require('fs')
const Mustache = require('mustache')
const swaggerSpec = require('./swaggerSpec')
const util = require('./util')

exports.enableFile = enableFile
exports.disableFile = disableFile
exports.getFilePath = getFilePath
exports.getTemplate = getTemplate
exports.renderTemplate = renderTemplate
exports.updateHeader = updateHeader
exports.getDefaultTemplateView = getDefaultTemplateView
exports.getDisabledFilePath = getDisabledFilePath
exports.disableOldOperationFiles = disableOldOperationFiles
exports.fileInfo = fileInfo

function enableFile(id, data, type, headerLineRegex, options) {
  const fileInfo = _enableFile(id, data, type, options)
  if (options.syncHeaders && !fileInfo.gen && !!headerLineRegex) {
    updateHeader(fileInfo, data, type, headerLineRegex, options)
  }
  return fileInfo
}

function _enableFile(id, data, type, options) {
  const filePath = getFilePath(id, type, options)
  if (!util.existsSync(filePath)) {
    const disabledPath = getDisabledFilePath(id, type, options)
    if (util.existsSync(disabledPath)) {
      return renameFile(disabledPath, filePath, options)
    } else if (options[type].generate) {
      return writeNewHandler(data, type, filePath, options)
    }
  }
  return fileInfo(filePath, false, false, options)
}

function renameFile(oldPath, filePath, options) {
  fs.renameSync(oldPath, filePath)
  return fileInfo(filePath, false, false, options)
}

function writeNewHandler(data, type, filePath, options) {
  const contents = renderTemplate(data, type, options)
  util.writeFileSync(filePath, contents)
  return fileInfo(filePath, true, false, options)
}

function renderTemplate(data, type, options) {
  const view = options[type].getTemplateView(data)
  return Mustache.render(options[type].template, view)
}

function disableFile(id, type, options) {
  const filePath = getFilePath(id, type, options)
  const disabledPath = getDisabledFilePath(id, type, options)
  if (util.existsSync(filePath)) {
    fs.renameSync(filePath, disabledPath)
  }
  return fileInfo(disabledPath, false, true, options)
}

function getTemplate(type, options) {
  const template = options[type].template
  if (template && typeof template === 'string') {
    return fs.readFileSync(template, 'utf8')
  } else {
    return template
  }
}

function getFilePath(id, type, options) {
  return path.join(options[type].path, `${id}${options.fileType || '.js'}`)
}

function getDisabledFilePath(id, type, options) {
  return path.join(options[type].path, `${options.unusedFilePrefix}${id}${options.fileType || '.js'}`)
}

function fileInfo(filePath, gen, old, options) {
  return {
    id: path.basename(filePath, options.fileType || '.js'),
    path: path.resolve(filePath),
    gen,
    old
  }
}

function disableOldOperationFiles(operations, type, options) {
  if (!options[type].generate || options[type].create) return []

  const fileType = options.fileType || '.js'
  const filenames = fs.readdirSync(options[type].path)
  const unknown = filenames.filter(name =>
      name.endsWith(fileType) &&
      !name.startsWith(options.unusedFilePrefix) &&
      !operations.find(op => `${op.id}${fileType}` === name))

  return unknown.map(name => {
    name = path.basename(name, fileType)
    const filePath = getFilePath(name, type, options)
    const disabledPath = getDisabledFilePath(name, type, options)
    fs.renameSync(filePath, disabledPath)
    return fileInfo(disabledPath, false, true, options)
  })
}

function getDefaultTemplateView(operation, commentMarker) {
  const view = Object.assign({}, operation)
  const groupsMap = operation.paramGroupSchemas

  view.method = view.method.toUpperCase()
  view.summary = (view.summary || view.id).split('\n').join(`\n${commentMarker}`)
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

/**
 * Keeps the header block of your templated file in sync with your Swagger api.
 *
 * @param {object} fileInfo info on the file to target
 * @param {object} data the operation which to gen the header from
 * @param {string} type the type of file being updated
 * @param {regex} headerLineRegex regex to find if a line is part of the header
 * @param {object} options options containing details on rendering the header
 * @return {void}
 */
function updateHeader(fileInfo, data, type, headerLineRegex, options) {
  const contents = fs.readFileSync(fileInfo.path, 'utf8') || ''
  const bodyLines = contents.split('\n')
  // assumes all comments at top of template are the header block
  while (bodyLines.length && bodyLines[0].trim().match(headerLineRegex)) bodyLines.shift()
  const template = renderTemplate(data, type, options)
  const headerLines = []
  for (let hline of template.split('\n')) {
    if (!hline.trim().match(headerLineRegex)) break
    else headerLines.push(hline)
  }
  const newContents = headerLines.concat(bodyLines).join('\n')
  fs.writeFileSync(fileInfo.path, newContents)
}
