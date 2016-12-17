'use strict'

const fs = require('fs')
const util = require('./util')

const HTTP_METHODS = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch'
]

const PARAM_GROUP = {
  HEADER: 'header',
  PATH: 'path',
  QUERY: 'query',
  BODY: 'body',
  FORM_DATA: 'formData'
}

const PARAM_GROUPS =
  Object.keys(PARAM_GROUP)
    .map(k => PARAM_GROUP[k])

exports.PARAM_GROUP = PARAM_GROUP
exports.PARAM_GROUPS = PARAM_GROUPS
exports.getSpec = getSpec
exports.getSpecSync = getSpecSync
exports.getAllOperations = getAllOperations
exports.createPathOperation = createPathOperation

function getSpec(spec) {
  if (typeof spec === 'string') {
    return loadSpec(spec).then(spec => applyDefaults(spec))
  } else {
    return Promise.resolve(applyDefaults(spec))
  }
}

function getSpecSync(spec) {
  if (typeof spec === 'string') {
    spec = loadSpecSync(spec)
  }
  return applyDefaults(spec)
}

function loadSpec(specPath) {
  return util.readFile(specPath)
    .then(contents => util.parseFileContents(contents, specPath))
}

function loadSpecSync(specPath) {
  const contents = fs.readFileSync(specPath)
  return util.parseFileContents(contents, specPath)
}

function applyDefaults(spec) {
  if (!spec.basePath) spec.basePath = '/'
  return spec
}

function getAllOperations(spec) {
  // we need to resolve refs so a deep copy is needed to avoid modifying the original
  spec = JSON.parse(JSON.stringify(spec))
  return getPaths(spec)
    .reduce((ops, pathInfo) =>
      ops.concat(getPathOperations(pathInfo, spec)), [])
}

function getPaths(spec) {
  return Object.keys(spec.paths || {})
    .map(path => Object.assign({ path }, spec.paths[path]))
}

function getPathOperations(pathInfo, spec) {
  const xProps = getXProps(pathInfo)
  return Object.keys(pathInfo)
    .filter(key => HTTP_METHODS.indexOf(key) !== -1)
    .map(method => createPathOperation(method, pathInfo, xProps, spec))
}

function getXProps(data) {
  return Object.keys(data)
    .filter(prop => prop.startsWith('x-'))
    .reduce((xProps, prop) => {
      xProps[prop] = data[prop]
      return xProps
    }, {})
}

function createPathOperation(method, pathInfo, pathsXProps, spec) {
  const operationInfo = util.resolveSchemaRefs(pathInfo[method], spec)
  if (!operationInfo.parameters) operationInfo.parameters = []
  if (!operationInfo.responses) operationInfo.responses = {}
  const operation = Object.assign({
    id: operationInfo.operationId,
    pkg: getPackageName(operationInfo),
    path: pathInfo.path,
    fullPath: `/${spec.basePath}/${pathInfo.path}`.replace(/\/{2,}/g,'/'),
    consumes: getOperationProperty('consumes', operationInfo, spec),
    produces: getOperationProperty('produces', operationInfo, spec),
    paramGroupSchemas: createParamGroupSchemas(operationInfo.parameters, spec),
    responseSchemas: createResponseSchemas(operationInfo.responses, spec),
    method
  }, pathsXProps, operationInfo)
  delete operation.operationId
  return operation
}

function getOperationProperty(prop, pathInfo, spec) {
  return (pathInfo && pathInfo[prop]) ? pathInfo[prop] : spec[prop]
}

function createParamGroupSchemas(parameters) {
  return PARAM_GROUPS
    .map(loc => {
      const params = parameters.filter(param => param.in === loc)
      return { 'in': loc, schema: createParamsSchema(params, loc) }
    })
    .filter(param => Object.keys(param.schema.properties || {}).length)
    .reduce((map, param) => {
      map[param.in] = param.schema
      return map
    }, {})
}

function createParamsSchema(params, loc) {
  if (loc === PARAM_GROUP.BODY) {
    const param = params.shift() // there can only be a single body param
    if (param) {
      param.name = 'body' // using a consistent name helps with error reporting
      if (param.schema) return param.schema
    }
  }
  return {
    type: 'object',
    properties:  params.reduce((props, param) => {
      const p = Object.assign({}, param)
      delete p.required
      props[param.name] = p
      return props
    }, {}),
    required: params
      .filter(param => param.required)
      .map(param => param.name)
  }
}

function createResponseSchemas(responses, spec) {
  return Object.keys(responses)
    .map(id => ({
      id,
      bodySchema: responses[id].schema,
      headersSchema: createResponseHeadersSchema(responses[id].headers, spec)
    }))
    .reduce((result, response) => {
      result[response.id] = response
      return result
    }, {})
}

function createResponseHeadersSchema(headers) {
  if (!headers) return undefined
  return {
    type: 'object',
    properties:  headers,
    required: Object.keys(headers)
      .filter(name => headers[name].required)
  }
}

function getPackageName(op) {
  if (!op.tags || !op.tags[0]) return 'default'
  
  let pkg = op.tags[0].replace(/[^\w$]/g, '')
  if (/^[^a-zA-Z_$]/.test(pkg)) {
    pkg = `$${pkg}`
  }
  return pkg
}
