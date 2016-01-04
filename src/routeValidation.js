'use strict'

const jsonSchema = require('jsonschema')
const parameters = require('./routeParameters')
const swaggerSpec = require('./swaggerSpec')
const PARAM_GROUP = swaggerSpec.PARAM_GROUP

exports.createValidationCheck = createValidationCheck
exports.validateRequest = validateRequest

function createValidationCheck(operation) {
	return function validator(req, res, next) {
		next(validateRequest(req, operation))
	}
}

function validateRequest(req, operation) {
	const groupSchemas = operation.paramGroupSchemas
	const reqData = groupRequestData(req, operation)
	return Object.keys(groupSchemas)
		.map(groupId => validateParam(
			groupId,
			groupSchemas[groupId],
			reqData[groupId]
		))
		.filter(result => !result.valid)
		.reduce(reduceFailures, undefined) // must pass init value or reducer doesn't run for single value
}

function groupRequestData(req, operation) {
	return {
		header: req.headers || {},
		path: parameters.getPathParams(req, operation),
		query: req.query || {},
		body: req.body || {},
		formData: parameters.getFormData(req)
	}
}

function validateParam(groupId, groupSchema, groupData) {
	groupData = parameters.formatGroupData(groupSchema, groupData)

	let result = jsonSchema.validate(groupData, groupSchema, { propertyName: groupId })
	result = checkForInvalidPathSegmentName(groupId, groupSchema, groupData, result)
	result = removeErrorsForAllowedEmptyValue(groupId, groupSchema, groupData, result)
	return result
}

function checkForInvalidPathSegmentName(groupId, schema, data, result) {
	if (groupId === PARAM_GROUP.PATH) {
		const propKeys = Object.keys(schema.properties)
		Object.keys(data).forEach(key => {
			if (propKeys.indexOf(key) === -1) {
				const path = result.propertyPath
				result.propertyPath += `.${key}`
				result.addError({ message: 'is an invalid path segment', name: key })
				result.propertyPath = path
			}
		})
	}
	return result
}

function removeErrorsForAllowedEmptyValue(groupId, schema, data, result) {
	if (groupId === PARAM_GROUP.QUERY || groupId === PARAM_GROUP.FORM_DATA) {
		result.errors = result.errors.filter(err => {
			const prop = err.property.indexOf('.') === -1 ? err.argument : err.property.split('.').pop()
			const val = data[prop]
			const spec = schema.properties[prop]
			return !(spec && spec.allowEmptyValue && !val && val !== 0)
		})
	}
	return result
}

function reduceFailures(master, failure) {
	failure = formatFailure(failure)
	if (master) {
		master.importErrors(failure)
		return master
	} else {
		return failure
	}
}

function formatFailure(failure) {
	failure.errors = failure.errors.filter(err => err.property.indexOf('.') !== -1)
	failure.errors.forEach(err => err.message = `${err.property} ${err.message}`)
	return failure
}
