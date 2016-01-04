'use strict'

const expect = require('expect')
const v = require('../src/routeValidation')
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
	return util.createPathOperation(method, info, {})
}

describe('validation', () => {
	describe('validateParams', () => {
		it('should enforce required params', () => {
			const spec = newSpec(PARAM.STRING, { required: true })
			const failure = v.validateRequest(EMPTY_REQ, spec)

			expect(failure).toExist()
			expect(failure.errors.length).toBe(1)
			expect(failure.errors[0].message).toBe('path.STRING is required')
		})

		it('should allow params which are not required to be missing', () => {
			const spec = newSpec(PARAM.STRING, { required: false })
			const failure = v.validateRequest(EMPTY_REQ, spec)

			expect(failure).toNotExist()
		})

		it('should not allow an integer to have a decimal value', () => {
			const spec = newSpec(PARAM.INT)
			const req = newReq({ query: { INT: 2.3 } })
			const failure = v.validateRequest(req, spec)

			expect(failure).toExist()
			expect(failure.errors[0].message).toBe('query.INT is not of a type(s) integer')
		})

		it('should enforce that path param is a valid path segment id', () => {
			const spec = newSpec(PARAM.STRING)
			const req = newReq({ params: { 'wrong': 'value' } })
			const failure = v.validateRequest(req, spec)

			expect(failure).toExist()
			expect(failure.errors[0].message).toBe('path.wrong is an invalid path segment')
		})

		it('should respect allowEmptyValue in query parameters', () => {
			const spec = newSpec(PARAM.INT, { allowEmptyValue: true })
			const req = newReq({ query: { 'INT': '' } })
			const failure = v.validateRequest(req, spec)

			expect(failure).toNotExist()
		})

		it('should respect allowEmptyValue in formData parameters', () => {
			const spec = newSpec(PARAM.INT, { allowEmptyValue: true, 'in': 'formData' })
			const req = newReq({ formData: { 'INT': '' } })
			const failure = v.validateRequest(req, spec)

			expect(failure).toNotExist()
		})

		it('should ignore allowEmptyValue in parameters outside of formData or query', () => {
			const spec = newSpec(PARAM.INT, { allowEmptyValue: true, 'in': 'path' })
			const req = newReq({ params: { 'INT': '' } })
			const failure = v.validateRequest(req, spec)

			expect(failure).toExist()
			expect(failure.errors[0].message).toBe('path.INT is not of a type(s) integer')
		})

		it('should restrict values to enum set', () => {
			const spec = newSpec(PARAM.STRING, { enum:[ 'a', 'b', 'c' ] })
			const req = newReq({ params: { 'STRING': 'd' } })
			const failure = v.validateRequest(req, spec)

			expect(failure).toExist()
			expect(failure.errors[0].message).toBe('path.STRING is not one of enum values: a,b,c')
		})

		it('should restrict number to defined maximum', () => {
			const spec = newSpec(PARAM.INT, { maximum: 10 })
			const req = newReq({ query: { 'INT': 11 } })
			const failure = v.validateRequest(req, spec)

			expect(failure).toExist()
			expect(failure.errors[0].message).toBe('query.INT must have a maximum value of 10')
		})

		it('should restrict number to defined exclusive maximum', () => {
			const spec = newSpec(PARAM.INT, { maximum: 10, exclusiveMaximum: true })
			const req = newReq({ query: { 'INT': 10 } })
			const failure = v.validateRequest(req, spec)

			expect(failure).toExist()
			expect(failure.errors[0].message).toBe('query.INT must have a maximum value of 10')
		})

		it('should restrict number to defined minimum', () => {
			const spec = newSpec(PARAM.INT, { minimum: 10 })
			const req = newReq({ query: { 'INT': 9 } })
			const failure = v.validateRequest(req, spec)

			expect(failure).toExist()
			expect(failure.errors[0].message).toBe('query.INT must have a minimum value of 10')
		})

		it('should restrict number to defined exclusive minimum', () => {
			const spec = newSpec(PARAM.INT, { minimum: 10, exclusiveMinimum: true })
			const req = newReq({ query: { 'INT': 10 } })
			const failure = v.validateRequest(req, spec)

			expect(failure).toExist()
			expect(failure.errors[0].message).toBe('query.INT must have a minimum value of 10')
		})

		it('should restrict a string length to a defined maximum', () => {
			const spec = newSpec(PARAM.STRING, { maxLength: 2 })
			const req = newReq({ params: { 'STRING': 'long' } })
			const failure = v.validateRequest(req, spec)

			expect(failure).toExist()
			expect(failure.errors[0].message).toBe('path.STRING does not meet maximum length of 2')
		})

		it('should restrict a string length to a defined minimum', () => {
			const spec = newSpec(PARAM.STRING, { minLength: 2 })
			const req = newReq({ params: { 'STRING': 'a' } })
			const failure = v.validateRequest(req, spec)

			expect(failure).toExist()
			expect(failure.errors[0].message).toBe('path.STRING does not meet minimum length of 2')
		})

		it('should restrict a string to match a defined pattern', () => {
			const spec = newSpec(PARAM.STRING, { pattern: '^s' })
			const req = newReq({ params: { 'STRING': 'oops' } })
			const failure = v.validateRequest(req, spec)

			expect(failure).toExist()
			expect(failure.errors[0].message).toBe('path.STRING does not match pattern "^s"')
		})

		it('should restrict an array length to a defined maximum', () => {
			const spec = newSpec(PARAM.ARRAY, { maxItems: 2 })
			const req = newReq({ query: { 'ARRAY': 'a,b,c' } })
			const failure = v.validateRequest(req, spec)

			expect(failure).toExist()
			expect(failure.errors[0].message).toBe('query.ARRAY does not meet maximum length of 2')
		})

		it('should restrict an array length to a defined minimum', () => {
			const spec = newSpec(PARAM.ARRAY, { minItems: 5 })
			const req = newReq({ query: { 'ARRAY': 'a,b,c' } })
			const failure = v.validateRequest(req, spec)

			expect(failure).toExist()
			expect(failure.errors[0].message).toBe('query.ARRAY does not meet minimum length of 5')
		})

		it('should restrict an array to unique items', () => {
			const spec = newSpec(PARAM.ARRAY, { uniqueItems: true })
			const req = newReq({ query: { 'ARRAY': 'a,a,c' } })
			const failure = v.validateRequest(req, spec)

			expect(failure).toExist()
			expect(failure.errors[0].message).toBe('query.ARRAY contains duplicate item')
		})
	})
})
