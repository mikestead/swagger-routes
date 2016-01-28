'use strict'

const Options = require('./options')
const fileUtil = require('./fileUtil')
const util = require('./util')
const fs = require('fs')
const assert = require('assert')
const jsonSchema = require('jsonschema')
const url = require('url')
const request = require('axios')
const swaggerSpec = require('./swaggerSpec')

const ONLY_SPEC_MARKER = '+'
const ONLY_VERBOSE_SPEC_MARKER = 'v+'

exports.buildMochaSpecs = buildMochaSpecs

/**
 * Generates a suite of Mocha test specifications for each of your Swagger api operations.
 *
 * Both request and response of an operation call are validated for conformity
 * with your Swagger document.
 *
 * @param {object} options
 *  - `api` path to your Swagger spec, or the loaded spec reference.
 *  - `host` server host + port where your tests will run e.g. `localhost:3453`
 *  - `specs` path to specs dir, or function to return the set of specs for an operation.
 *  - `maxTimeout` maximum time a test can take to complete
 *  - `slowTime` time taken before a test is marked slow. Defaults to 1 second.
 *  - `startServer(done)` function called before all tests where you can start your local server
 *  - `stopServer(done)`function called after all tests where you can stop your local server
 * @return {void}
 */
function buildMochaSpecs(options) {
	options = Options.applyDefaultSpecOptions(options)

	const api = swaggerSpec.getSpecSync(options.api)
	const operations = swaggerSpec.getAllOperations(api)

	describe(api.info.title, function () {
		if (this.slow) this.slow(options.slowTime || 1000)
		this.timeout(options.maxTimeout || 10000)

		before(done => options.startServer(done))
		after(done => {
			fileUtil.disableOldOperationFiles(operations, 'specs', options)
			options.stopServer(done)
		})

		operations.forEach(op => {
			const specs = getSpecs(op, options)
			const description = `${op.method.toUpperCase()}: ${op.path} (${op.id})`
			describe(description, () => {
				Object.keys(specs).forEach(id => {
					const specInfo = getSpecInfo(id)
					specInfo.it(specInfo.summary, () => {
						const spec = specs[id]
						const req = createRequest(op, spec.request, options)
						// if the expected outcome of the test is a positive response
						// then the request can be validated for correct format
						if (isValidRequestExpected(spec)) {
							validateRequest(req, spec, op, specInfo.verbose)
						}
						return request(req)
							.then(res => validateResponse(res, spec, op, specInfo.verbose),
								res => validateResponse(res, spec, op, specInfo.verbose))
					})
				})
			})
		})
	})
}

function getSpecs(op, options) {
	let specs
	if (typeof options.specs.create === 'function') specs = options.specs.create(op)
	if (!specs) specs = op['x-specs']
	if (specs) disableSpecsFile(op, options)
	else specs = requireSpecsFile(op, options)
	return specs || {}
}

function disableSpecsFile(op, options) {
	return fileUtil.disableFile(op.id, 'specs', options)
}

function requireSpecsFile(op, options) {
	const fileInfo = fileUtil.enableFile(op.id, op, 'specs', options)
	try { return util.parseFileContents(fs.readFileSync(fileInfo.path), fileInfo.path) }
	catch(e) { return {} }
}

function getSpecInfo(id) {
	if (id.startsWith(ONLY_SPEC_MARKER)) {
		return { it: it.only, summary: summary.substr(ONLY_SPEC_MARKER.length).trim(), verbose: false}
	} else if (id.startsWith(ONLY_VERBOSE_SPEC_MARKER)) {
		return { it: it.only, summary: summary.substr(ONLY_VERBOSE_SPEC_MARKER.length).trim(), verbose: true}
	} else {
		return { it, summary: summary.trim(), verbose: false }
	}
}

function createRequest(op, testReqData, options) {
	let pathname = op.fullPath
	if (testReqData.path) {
		pathname = Object.keys(testReqData.path)
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
		headers: testReqData.header || {},
		params: testReqData.query,
		data: testReqData.body
	}
}

function validateRequest(req, spec, op, verbose) {
	if (verbose) console.log(req)
	const groupSchema = op.paramGroupSchemas
	swaggerSpec.PARAM_GROUPS.forEach(groupId => {
		if (groupSchema[groupId]) {
			try {
				jsonSchema.validate(spec.request[groupId], groupSchema[groupId], {throwError: true})
			} catch(e) {
				if (verbose) e.message = `${e.toString()}\Request: ${JSON.stringify(req, null, 2)}`
				throw e
			}
		}
	})
}

function validateResponse(res, spec, op, verbose) {
	const responseSchema = op.responseSchemas[spec.response]
	try {
		validateStatus(res, responseSchema.id)
		validateHeaders(res, responseSchema.headersSchema)
		validateBody(res, responseSchema.bodySchema)
		validateContentType(res, op)
	} catch (e) {
		if (verbose) e.message = `${e.toString()}\nResponse: ${JSON.stringify(res, null, 2)}`
		throw e
	}
}

function validateStatus(res, id) {
	const status = Number(id)
	if (Number.isInteger(status)) {
		assert.strictEqual(res.status, status, `HTTP response code ${res.status} was expected to be ${status}`)
	}
}

function validateHeaders(res, headersSchema) {
	if (headersSchema) {
		jsonSchema.validate(res.headers, headersSchema, { throwError: true })
	}
}
function validateBody(res, bodySchema) {
	if (bodySchema) {
		jsonSchema.validate(res.data, bodySchema, { throwError: true })
	}
}

function validateContentType(res, op) {
	const contentType = res.headers['content-type']
	assert.notEqual(op.produces.indexOf(contentType), -1, `Response content type '${contentType}' was not expected`)
}

function isValidRequestExpected(spec) {
	return (spec.request.valid || (hasSuccessStatus(spec.response) && spec.request.valid !== false))
}

function hasSuccessStatus(status) {
	status = Number(status)
	return (Number.isInteger(status) && status >= 200 && status < 400)
}
