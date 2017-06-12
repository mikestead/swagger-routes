'use strict'

const COLLECTION_FORMAT = {
  CSV: ',',
  SSV: ' ',
  TSV: '\t',
  PIPES: '|',
  MULTI: '&' // multi query param instances foo=bar&foo=baz
}

exports.COLLECTION_FORMAT = COLLECTION_FORMAT
exports.formatGroupData = formatGroupData
exports.getPathParams = getPathParams
exports.getFormData = getFormData

function formatGroupData(groupSchema, groupData, groupId, req) {
  const paramNames = Object.keys(groupSchema.properties)
  if (!groupData) groupData = {}
  const origGroupData = getOriginalGroup(req, groupId)
  const reqParams = getReqParams(req, groupId)
  paramNames.forEach(name => {
    const paramSchema = groupSchema.properties[name]
    let val = groupData[name]
    val = parseCollectionFormat(paramSchema, val)
    val = parseBoolean(paramSchema, val)
    val = parseNumber(paramSchema, val)
    val = applyDefaultValue(paramSchema, val, name, req)
    origGroupData[name] = groupData[name] = val
    if (reqParams && reqParams[name] !== undefined) {
      reqParams[name] = val
    }
  })
  return groupData
}

function parseCollectionFormat(paramSchema, value) {
  if (paramSchema.type === 'array' && typeof value === 'string') {
    return stringValueToArray(value, paramSchema.collectionFormat || 'csv')
  }
  return value
}

function parseBoolean(paramSchema, value) {
  if (paramSchema.type === 'boolean') {
    switch(`${value}`.toLowerCase().trim()) {
      case 'true':
      case '1':
      case 'on':
      case 'yes':
      case 'y':
        return true
      case 'undefined':
        return undefined
      default:
        return false
    }
  }
  return value
}

function parseNumber(paramSchema, value) {
  if ((paramSchema.type === 'integer' || paramSchema.type === 'number') && value !== '') {
    const num = Number(value)
    if (!isNaN(num)) return num
  }
  return value
}

function stringValueToArray(value, format) {
  const delimiter = COLLECTION_FORMAT[format.toUpperCase()] || COLLECTION_FORMAT.CSV
  return value.split(delimiter)
}

function applyDefaultValue(paramSchema, value, name, req) {
  if (value === undefined && !paramSchema.required && paramSchema.default !== undefined) {
    if (!req.appliedDefaults) req.appliedDefaults = {}
    req.appliedDefaults[name] = true
    return paramSchema.default
  }
  return value
}

function getPathParams(req, operation) {
  const params = req.params ? req.params : req.params = {}
  if (req.app) return params // express

  // restify
  // req.params may contain a mix of more than just path parameters
  // as restify has the option to merge body and query params in here too.
  // This forces us to pull out just the ones defined in the swagger spec.
  // Note that this means we can't later determine if the client has sent
  // extra path parameters so validation around this is not possible.

  return operation.parameters
    .filter(op => op.in === 'path')
    .reduce((pathParams, op) => {
      if (params[op.name] !== undefined) {
        pathParams[op.name] = params[op.name]
      }
      return pathParams
    }, {})
}

function getFormData(req) {
  if (req.accepts('multipart/form-data') || req.accepts('application/x-www-form-urlencoded')) {
    const formData = Object.assign({}, req.body)
    if (Array.isArray(req.files)) {
      req.files.forEach(file => {
        formData[file.filename] = file
      })
    } else if (req.files && typeof req.files === 'object') {
      Object.assign(formData, req.files)
    }
    else if (req.file && typeof req.files === 'object') {
      formData[req.file.filename] = req.file
    }
    return formData
  }
  return null
}

function getOriginalGroup(req, groupId) {
  switch (groupId) {
    case 'header': return req.headers || {}
    case 'path': return req.params || {}
    case 'query': return (typeof req.query === 'function') ? {} : req.query || {}
    case 'body':
    case 'formData': return req.body || {}
    default: return {}
  }
}

/*
 * If using Restify, grab the common params object.
 * We'll merge back formatted query and path params
 * if they existed unformatted in there previously.
 */
function getReqParams(req, groupId) {
  return (req && !req.app && (groupId === 'query' || groupId === 'path'))
    ? req.params
    : undefined
}
