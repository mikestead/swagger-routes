'use strict'

const jsonSchema = require('jsonschema')
const parameters = require('./routeParameters')
const swaggerSpec = require('./swaggerSpec')
const PARAM_GROUP = swaggerSpec.PARAM_GROUP

exports.createValidationCheck = createValidationCheck
exports.validateRequest = validateRequest

function createValidationCheck(operation) {
  return function validator(req, res, next) {
    const result = validateRequest(req, operation)
    next(checkValidationResult(result))
  }
}

function validateRequest(req, operation) {
  const groupSchemas = operation.paramGroupSchemas
  const reqData = groupRequestData(req, operation)
  return Object.keys(groupSchemas)
    .map(groupId => {
      const groupSchema = groupSchemas[groupId]
      const groupData = parameters.formatGroupData(groupSchema, reqData[groupId], groupId, req)
      return validateParam(
        groupId,
        groupSchema,
        groupData
      )
    })
    .filter(result => !result.valid)
    .reduce(reduceFailures, undefined) // must pass init value or reducer doesn't run for single value
}

function groupRequestData(req, operation) {
  return {
    header: req.headers ? req.headers : req.headers = {},
    path: parameters.getPathParams(req, operation),
    query: req.query ? req.query : req.query = {},
    body: req.body ? req.body : req.body = {},
    formData: parameters.getFormData(req)
  }
}

function validateParam(groupId, groupSchema, groupData) {
  groupData = Object.assign({}, groupData)
  let result = jsonSchema.validate(groupData, groupSchema, { propertyName: groupId })
  result = checkForMissingPathParams(groupId, groupSchema, groupData, result)
  result = checkForInvalidPathSegmentName(groupId, groupSchema, groupData, result)
  result = removeErrorsForAllowedEmptyValue(groupId, groupSchema, groupData, result)
  return result
}

function checkForMissingPathParams(groupId, schema, data, result) {
  if (groupId !== 'path' || !schema.properties) return result
  data = data || {}
  Object.keys(schema.properties).forEach(prop => {
    // if the value exists but as an un-replaced Swagger
    // path token then assume the path param has not been provided
    if (data[prop] && data[prop] === `{${prop}}`) {
      const propPath = result.propertyPath
      result.propertyPath += `.${prop}`
      result.addError({ message: `is required`, name: prop })
      result.propertyPath = propPath
    }
  })
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
  failure.errors.forEach(err => err.message = `${err.property} ${err.message}`)
  return failure
}

function checkValidationResult(result) {
  if (!result || result.valid) return undefined
  const message = result.errors.map(e => e.message).join(', ')
  return new ValidationError(message)
}

class ValidationError extends Error {
  constructor(message) {
    super(message)
    this.name = this.constructor.name
    this.message = message
    this.status = this.statusCode = 400
    Error.captureStackTrace(this, this.constructor.name)
  }
}
