'use strict'

const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')
const util = require('./util')
const assert = require('assert')

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
		.then(contents => parseSpec(contents, specPath))
}

function loadSpecSync(specPath) {
	const contents = fs.readFileSync(specPath)
	return parseSpec(contents, specPath)
}

function parseSpec(contents, path) {
	return isYamlFile(path) ?
		yaml.safeLoad(contents) :
		JSON.parse(contents)
}

function isYamlFile(filePath) {
	return path.extname(filePath).match(/^\.ya?ml$/)
}

function applyDefaults(spec) {
	if (!spec.basePath) spec.basePath = '/'
	return spec
}

function getAllOperations(spec) {
	return getPaths(spec)
		.reduce((ops, pathInfo) =>
			ops.concat(getPathOperations(pathInfo, spec)), [])
}

function getPaths(spec) {
	return Object.keys(spec.paths || {})
		.map(path => Object.assign({ path }, spec.paths[path]))
}

function getPathOperations(pathInfo, spec) {
	return Object.keys(pathInfo)
		.filter(key => HTTP_METHODS.indexOf(key) !== -1)
		.map(method => createPathOperation(method, pathInfo, spec))
}

function createPathOperation(method, pathInfo, spec) {
	const operationInfo = resolveParamRefs(pathInfo[method], spec)
	const operation = Object.assign({
		id: operationInfo.operationId,
		path: pathInfo.path,
		fullPath: path.normalize(`/${spec.basePath}/${pathInfo.path}`),
		consumes: getOperationProperty('consumes', operationInfo, spec),
		produces: getOperationProperty('produces', operationInfo, spec),
		paramGroupSchemas: createParamGroupSchemas(operationInfo.parameters, spec),
		method
	}, operationInfo)
	delete operation.operationId
	return operation
}

function resolveParamRefs(paramInfo, spec) {
	const params = paramInfo.parameters || []
	paramInfo.parameters = params.map(param => getRef(param, spec))
	return paramInfo
}

function getRef(data, spec) {
	return (data && data.$ref) ? resolveRef(data.$ref, spec) : data
}

function resolveRef(ref, spec) {
	const parts = ref.split('/')
	parts.shift()
	let value = spec
	while (parts.length) {
		value = value[parts.shift()]
		assert.ok(value, `Invalid schema reference: ${ref}`)
	}
	return value
}

function getOperationProperty(prop, pathInfo, spec) {
	return (pathInfo && pathInfo[prop]) ? pathInfo[prop] : spec[prop]
}

function createParamGroupSchemas(parameters, spec) {
	return PARAM_GROUPS
		.map(loc => {
			const params = parameters.filter(param => param.in === loc)
			return { 'in': loc, schema: createParamGroupSchema(params, spec) }
		})
		.filter(param => Object.keys(param.schema.properties).length)
		.reduce((map, param) => {
			map[param.in] = param.schema
			return map
		}, {})
}

function createParamGroupSchema(params, spec) {
	return {
		type: 'object',
		properties:	params.reduce((props, param) => {
			if (param.schema) {
				param.schema = getRef(param.schema, spec)
				param.schema.items = getRef(param.schema.items, spec)
			}
			else if (param.items) {
				param.items = getRef(param.items, spec)
			}
			props[param.name] = param = Object.assign({}, param)
			return props
		}, {}),
		required: params
			.filter(param => param.required)
			.map(param => param.name)
	}
}
