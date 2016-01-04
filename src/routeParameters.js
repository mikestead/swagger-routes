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
exports.getFormData = getFormData

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
