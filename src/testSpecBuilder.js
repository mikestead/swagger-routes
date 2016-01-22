'use strict'

const assert = require('assert')
const jsonSchema = require('jsonschema')
const url = require('url')
const request = require('axios')
const swaggerSpec = require('./swaggerSpec')

exports.buildSpecs = buildSpecs

/**
 * Generates a suite of test specifications in the jasmine / mocha style for
 * each of your Swagger api operations.
 *
 * Both request and response of an operation call are validated for conformity
 * with your Swagger document.
 *
 * @param options {object}
 *  - `api` path to your Swagger spec, or the loaded spec reference.
 *  - `host` server host + port where your tests will run e.g. `localhost:3453`
 *  - `getOperationTests(op)` function to return the set of tests for an operation. Falls back to operation['x-tests'].
 *  - `maxTimeout` maximum time a test can take to complete
 *  - `startServer(done)` function called before all tests where you can start your local server
 *  - `stopServer(done)`function called after all tests where you can stop your local server
 */
function buildSpecs(options) {
	options = Object.assign({}, options)
	if (!options.getOperationTests) options.getOperationTests = op => {}

	const api = swaggerSpec.getSpecSync(options.api)
	const operations = swaggerSpec.getAllOperations(api)

	describe(api.info.title, function() {
		this.timeout(options.maxTimeout || 10000);

		before(done => options.startServer(done))
		after(done => options.stopServer(done))

		operations.forEach(op => {
			const tests = options.getOperationTests(op) || op['x-tests'] || {}
			const desc = `${op.method.toUpperCase()}: ${op.path} (${op.id})`
			describe(desc, () => {
				Object.keys(tests).forEach(description => {
					it(description, () => {
						const test = tests[description]
						const req = createRequest(op, test.request, options)
						// if the expected outcome of the test is a positive response
						// then the request can be validated for correct format
						if (isValidRequestExpected(test)) {
							validateRequest(req, test, op)
						}
						request(req).then(res => validateResponse(res, test, op))
					})
				})
			})
		})
	})
}

function createRequest(op, testReqData, options) {
	let pathname = op.fullPath
	if (testReqData.path) {
		pathname = Object.keys(req.path)
			.reduce((p, t) =>
				p.replace(new RegExp(`{${t}}`, 'g'), testReqData.path[t]), pathname)
	}
	return {
		url: url.format({
			protocol: 'http',
			host: options.host,
			pathname
		}),
		method: op.method,
		headers: testReqData.header,
		params: testReqData.query,
		data: testReqData.body
	}
}

function validateRequest(req, test, op) {
	const groupSchema = op.paramGroupSchemas
	swaggerSpec.PARAM_GROUPS.forEach(groupId => {
		if (groupSchema[groupId]) {
			jsonSchema.validate(test.request[groupId], groupSchema[groupId], {throwError: true})
		}
	})
}

function validateResponse(res, test, op) {
	const responseSchema = op.responseSchemas[test.response]
	validateStatus(res, responseSchema.id)
	validateHeaders(res, responseSchema.headersSchema)
	validateBody(res, responseSchema.bodySchema)
	validateContentType(res, op)
}

function validateStatus(res, id) {
	const status = Number(id)
	if (Number.isInteger(status)) {
		assert.strictEqual(res.status, status, `HTTP response code ${res.status} was expected to be ${status}`)
	}
}

function validateHeaders(res, headersSchema) {
	if (headersSchema) {
		jsonSchema.validate(res.headers, headersSchema, {throwError: true})
	}
}
function validateBody(res, bodySchema) {
	if (bodySchema) {
		jsonSchema.validate(res.data, bodySchema, {throwError: true})
	}
}

function validateContentType(res, op) {
	const contentType = res.headers.get('content-type')
	assert.notEqual(op.produces.indexOf(contentType), -1, `Response content type '${contentType}' was not expected`)
}

function isValidRequestExpected(test) {
	return (test.request.valid || (hasSuccessStatus(test.response) && test.request.valid !== false))
}

function hasSuccessStatus(status) {
	status = Number(status)
	return (Number.isInteger(status) && status >= 200 && status < 400)
}
