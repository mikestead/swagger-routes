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
exports.castQueryParams = castQueryParams

function formatGroupData(groupSchema, groupData) {
	const paramNames = Object.keys(groupSchema.properties)
	if (!groupData) groupData = {}
	paramNames.forEach(name => {
		const paramSchema = groupSchema.properties[name]
		let val = groupData[name]
		val = parseCollectionFormat(paramSchema, val)
		val = applyDefaultValue(paramSchema, val)
		groupData[name] = val
	})
	return groupData
}

function parseCollectionFormat(paramSchema, value) {
	if (paramSchema.type === 'array' && typeof value === 'string') {
		return stringValueToArray(value, paramSchema.collectionFormat || 'csv')
	}
	return value
}

function stringValueToArray(value, format) {
	const delimiter = COLLECTION_FORMAT[format.toUpperCase()] || COLLECTION_FORMAT.CSV
	return value.split(delimiter)
}

function applyDefaultValue(paramSchema, value) {
	return (value === undefined && !paramSchema.required) ? paramSchema.default : value
}

function getPathParams(req, operation) {
	const params = req.params || {}
	if (req.app) return params // express

	// restify
	// req.params may contain a mix of more than just path parameters
	// as restify has the option to merge body and query params in here too.
	// This forces us to pull out just the ones defined in the swagger spec.
	// Note that this means we can't later determine if the client has sent
	// extra/invalid path parameters so validation around this will not run.

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

function castQueryParams(req, groupSchemas) {
	const query = req.query || {}
	const querySchema = groupSchemas.query || { properties: {} }
	Object.keys(query).forEach(key => {
		const propSchema = querySchema.properties[key]
		if (propSchema && (propSchema.type === 'integer' || propSchema.type === 'number')) {
			const num = Number(query[key])
			if (!isNaN(num)) query[key] = num
		}
	})
	return query
}
