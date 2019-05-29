'use strict'

const expect = require('expect')
const routeValidation = require('../src/routeValidation')
const util = require('../src/swaggerSpec')

const EMPTY_REQ = { params: {}, headers: {}, query: {}, body: {}, files: {}, accepts: () => true }
const PARAM = {
  STRING: {
    name: 'STRING',
    in: 'path',
    type: 'string'
  },
  INT: {
    name: 'INT',
    in: 'query',
    type: 'integer'
  },
  NUM: {
    name: 'NUM',
    in: 'query',
    type: 'number'
  },
  BOOL: {
    name: 'BOOL',
    in: 'query',
    type: 'bool'
  },
  ARRAY: {
    name: 'ARRAY',
    in: 'query',
    type: 'array',
    items: {
      type: 'string'
    }
  },
  FILE: {
    name: 'FILE',
    in: 'formData',
    type: 'file'
  }
}

const copy = (val, param) => Object.assign({}, param, val)

function newReq(req) {
  return copy(req, EMPTY_REQ)
}

function newSpec(template, param) {
  const method = 'get'
  const info = {}
  param = copy(param, template)
  info[method] = {
    parameters: [ param ]
  }
  return util.createPathOperation(method, info, {}, {})
}

describe('routeValidation', () => {
  describe('validateRequest', () => {
    const validateRequest = routeValidation.validateRequest

    it('should enforce required params', () => {
      const spec = newSpec(PARAM.STRING, { required: true })
      const failure = validateRequest(EMPTY_REQ, spec)

      expect(failure).toExist()
      expect(failure.errors.length).toBe(1)
      expect(failure.errors[0].message).toBe('path requires property "STRING"')
    })

    it('should allow params which are not required to be missing', () => {
      const spec = newSpec(PARAM.STRING, { required: false })
      const failure = validateRequest(EMPTY_REQ, spec)

      expect(failure).toNotExist()
    })

    it('should not allow an integer to have a decimal value', () => {
      const spec = newSpec(PARAM.INT)
      const req = newReq({ query: { INT: 2.3 } })
      const failure = validateRequest(req, spec)

      expect(failure).toExist()
      expect(failure.errors[0].message).toBe('query.INT is not of a type(s) integer')
    })

    it('should allow integer path param', () => {
      const param = copy({ in: 'path' }, PARAM.INT)
      const spec = newSpec(param)
      const req = newReq({ params: { [param.name]: '2330' } })

      const failure = validateRequest(req, spec)
      expect(failure).toNotExist()
    })

    it('should allow integer query param', () => {
      const spec = newSpec(PARAM.INT)
      const req = newReq({ query: { [PARAM.INT.name]: '2330' } })

      const failure = validateRequest(req, spec)
      expect(failure).toNotExist()
    })

    it('should fail if integer path param is decimal', () => {
      const param = copy({ in: 'path' }, PARAM.INT)
      const spec = newSpec(param)
      const req = newReq({ params: { [param.name]: '2330.33' } })

      const failure = validateRequest(req, spec)
      expect(failure).toExist()
      expect(failure.errors.length).toBe(1)
      expect(failure.errors[0].message).toBe('path.INT is not of a type(s) integer')
    })

    it('should fail if integer query param is decimal', () => {
      const spec = newSpec(PARAM.INT)
      const req = newReq({ query: { [PARAM.INT.name]: '2330.33' } })

      const failure = validateRequest(req, spec)
      expect(failure).toExist()
      expect(failure.errors.length).toBe(1)
      expect(failure.errors[0].message).toBe('query.INT is not of a type(s) integer')
    })

    it('should enforce that path param is a valid path segment id under express', () => {
      const spec = newSpec(PARAM.STRING)
      const req = newReq({ params: { 'wrong': 'value' } })
      req.app = true // simulate express request
      const failure = validateRequest(req, spec)

      expect(failure).toExist()
      expect(failure.errors[0].message).toBe('path.wrong is an invalid path segment')
    })

    it('should respect allowEmptyValue in query parameters', () => {
      const spec = newSpec(PARAM.INT, { allowEmptyValue: true })
      const req = newReq({ query: { 'INT': '' } })
      const failure = validateRequest(req, spec)

      expect(failure).toNotExist()
    })

    it('should respect allowEmptyValue in formData parameters', () => {
      const spec = newSpec(PARAM.INT, { allowEmptyValue: true, 'in': 'formData' })
      const req = newReq({ formData: { 'INT': '' } })
      const failure = validateRequest(req, spec)

      expect(failure).toNotExist()
    })

    it('should ignore allowEmptyValue in parameters outside of formData or query', () => {
      const spec = newSpec(PARAM.INT, { allowEmptyValue: true, required: true, 'in': 'path' })
      const req = newReq({ params: { 'INT': '' } })
      const failure = validateRequest(req, spec)

      expect(failure).toExist()
      expect(failure.errors[0].message).toBe('path requires property "INT"')
    })

    it('should restrict values to enum set', () => {
      const spec = newSpec(PARAM.STRING, { enum:[ 'a', 'b', 'c' ] })
      const req = newReq({ params: { 'STRING': 'd' } })
      const failure = validateRequest(req, spec)

      expect(failure).toExist()
      expect(failure.errors[0].message).toBe('path.STRING is not one of enum values: a,b,c')
    })

    it('should restrict number to defined maximum', () => {
      const spec = newSpec(PARAM.INT, { maximum: 10 })
      const req = newReq({ query: { 'INT': 11 } })
      const failure = validateRequest(req, spec)

      expect(failure).toExist()
      expect(failure.errors[0].message).toBe('query.INT must have a maximum value of 10')
    })

    it('should restrict number to defined exclusive maximum', () => {
      const spec = newSpec(PARAM.INT, { maximum: 10, exclusiveMaximum: true })
      const req = newReq({ query: { 'INT': 10 } })
      const failure = validateRequest(req, spec)

      expect(failure).toExist()
      expect(failure.errors[0].message).toBe('query.INT must have a maximum value of 10')
    })

    it('should restrict number to defined minimum', () => {
      const spec = newSpec(PARAM.INT, { minimum: 10 })
      const req = newReq({ query: { 'INT': 9 } })
      const failure = validateRequest(req, spec)

      expect(failure).toExist()
      expect(failure.errors[0].message).toBe('query.INT must have a minimum value of 10')
    })

    it('should restrict number to defined exclusive minimum', () => {
      const spec = newSpec(PARAM.INT, { minimum: 10, exclusiveMinimum: true })
      const req = newReq({ query: { 'INT': 10 } })
      const failure = validateRequest(req, spec)

      expect(failure).toExist()
      expect(failure.errors[0].message).toBe('query.INT must have a minimum value of 10')
    })

    it('should restrict a string length to a defined maximum', () => {
      const spec = newSpec(PARAM.STRING, { maxLength: 2 })
      const req = newReq({ params: { 'STRING': 'long' } })
      const failure = validateRequest(req, spec)

      expect(failure).toExist()
      expect(failure.errors[0].message).toBe('path.STRING does not meet maximum length of 2')
    })

    it('should restrict a string length to a defined minimum', () => {
      const spec = newSpec(PARAM.STRING, { minLength: 2 })
      const req = newReq({ params: { 'STRING': 'a' } })
      const failure = validateRequest(req, spec)

      expect(failure).toExist()
      expect(failure.errors[0].message).toBe('path.STRING does not meet minimum length of 2')
    })

    it('should restrict a string to match a defined pattern', () => {
      const spec = newSpec(PARAM.STRING, { pattern: '^s' })
      const req = newReq({ params: { 'STRING': 'oops' } })
      const failure = validateRequest(req, spec)

      expect(failure).toExist()
      expect(failure.errors[0].message).toBe('path.STRING does not match pattern "^s"')
    })

    it('should fail if string path param is empty', () => {
      const param = copy({ in: 'path', required: true }, PARAM.STRING)
      const spec = newSpec(param)
      const req = newReq({ params: { [param.name]: '' } })

      const failure = validateRequest(req, spec)
      expect(failure).toExist()
      expect(failure.errors[0].message).toBe('path requires property "STRING"')
    })

    it('should restrict an array length to a defined maximum', () => {
      const spec = newSpec(PARAM.ARRAY, { maxItems: 2 })
      const req = newReq({ query: { 'ARRAY': 'a,b,c' } })
      const failure = validateRequest(req, spec)

      expect(failure).toExist()
      expect(failure.errors[0].message).toBe('query.ARRAY does not meet maximum length of 2')
    })

    it('should restrict an array length to a defined minimum', () => {
      const spec = newSpec(PARAM.ARRAY, { minItems: 5 })
      const req = newReq({ query: { 'ARRAY': 'a,b,c' } })
      const failure = validateRequest(req, spec)

      expect(failure).toExist()
      expect(failure.errors[0].message).toBe('query.ARRAY does not meet minimum length of 5')
    })

    it('should restrict an array to unique items', () => {
      const spec = newSpec(PARAM.ARRAY, { uniqueItems: true })
      const req = newReq({ query: { 'ARRAY': 'a,a,c' } })
      const failure = validateRequest(req, spec)

      expect(failure).toExist()
      expect(failure.errors[0].message).toBe('query.ARRAY contains duplicate item')
    })

    it('should apply default values before validation', () => {
      const spec = newSpec(PARAM.INT, { default: 2 })
      const req = newReq({})
      const result = validateRequest(req, spec)

      expect(result).toNotExist()
      expect(req.query.INT).toBe(2)
    })
  })
})
