'use strict'

const Options = require('./options')
const fileUtil = require('./fileUtil')
const util = require('./util')
const fs = require('fs')
const path = require('path')
const assert = require('assert')
const jsonSchema = require('jsonschema')
const url = require('url')
const request = require('axios')
const swaggerSpec = require('./swaggerSpec')

const ONLY_SPEC_MARKER = '+'
const ONLY_VERBOSE_SPEC_MARKER = 'v+'

module.exports = apiSpecs

/**
 * Generates a suite of Mocha test specifications for each of your Swagger api operations.
 *
 * Both request and response of an operation call are validated for conformity
 * with your Swagger document.
 *
 * You'll need to depend on and set up Mocha in your project yourself.
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
function apiSpecs(options) {
	options = Options.applyDefaultSpecOptions(options)
	const api = swaggerSpec.getSpecSync(options.api)
	const operations = swaggerSpec.getAllOperations(api)
	options.fixtures = getFixtures(options)
	describeApi(api, operations, options)
}

function getFixtures(options) {
	const p = path.resolve(options.fixtures)
	if (!options.fixtures || !util.existsSync(p)) return {}
	const contents = fs.readFileSync(p, 'utf8')
	return util.parseFileContents(contents, p)
}

function describeApi(api, operations, options) {
	describe(api.info.title, function () {
		this.slow(options.slowTime || 2000)
		this.timeout(options.maxTimeout || 10000)

		before(done => options.startServer(done))
		after(done => {
			fileUtil.disableOldOperationFiles(operations, 'specs', options)
			options.stopServer(done)
		})
		describeOperations(operations, options)
	})
}

function describeOperations(operations, options) {
	operations.forEach(op => {
		const description = `${op.method.toUpperCase()}: ${op.path} (${op.id})`
		describe(description, () => {
			describeOperationSpecs(op, operations, options)
		})
	})
}

function describeOperationSpecs(op, operations, options) {
	const specs = getSpecs(op, options)
	Object.keys(specs).forEach(id => {
		const specInfo = getSpecInfo(id)
		specInfo.it(specInfo.summary, () => {
			const spec = specs[id]
			const steps = Array.isArray(spec) ? spec : [ spec ]
			return runSteps(steps, op, operations, options, specInfo.verbose)
		})
	})
}

function runSteps(steps, op, operations, options, verbose) {
	const fixtures = { fixtures: options.fixtures }
	return steps.reduce((prev, step) => {
		return prev.then(acc => {
			step = util.resolveSchemaRefs(step, fixtures)
			if (!step.request) step.request = {}
			if (!step.response) step.response = {}
			const stepOp = getStepOperation(step, operations, op)
			return runStep(step, stepOp, options, verbose, acc)
		})
	}, Promise.resolve([]))
}

function getStepOperation(step, operations, primaryOp) {
	return operations.find(opt => opt.id === step.request.operationId) || primaryOp
}

function runStep(step, op, options, verbose, acc) {
	const req = createRequest(op, step.request, options, acc)
	if (expectsValidRequest(step)) {
		validateRequest(req, step, op, verbose)
	}
	return request(req)
		.then(
			res => validateResponse(req, res, step, op, verbose),
			res => validateResponse(req, res, step, op, verbose)
		)
		.then(res => (acc || []).concat({ req, res }))
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
	try {
		return util.parseFileContents(fs.readFileSync(fileInfo.path), fileInfo.path)
	} catch(e) {
		if (e.name === 'YAMLException') throw e
		return {}
	}
}

function getSpecInfo(id) {
	if (id.startsWith(ONLY_SPEC_MARKER)) {
		return { it: it.only, summary: id.substr(ONLY_SPEC_MARKER.length).trim(), verbose: false }
	} else if (id.startsWith(ONLY_VERBOSE_SPEC_MARKER)) {
		return { it: it.only, summary: id.substr(ONLY_VERBOSE_SPEC_MARKER.length).trim(), verbose: true }
	} else {
		return { it, summary: id.trim(), verbose: false }
	}
}

function createRequest(op, testReqData, options, acc) {
	testReqData = populateProperties(testReqData, acc)
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

function populateProperties(source, acc) {
	if (Array.isArray(source)) {
		source.forEach((v, i) => source[i] = populateProperties(v, acc))
	} else if (typeof source === 'object') {
		Object.keys(source || {}).forEach(key => source[key] = populateProperties(source[key], acc))
	} else if (typeof source === 'string') {
		const stepAcc = { step: acc }
		if (source.startsWith('step[')) {
			return parseProperty(source.split('.'), stepAcc)
		} else {
			const tokenMatch = source.match(/\$\{(step\[\d+\][\w\[\d\]\.]+)\}/g)
			if (tokenMatch) {
				return tokenMatch.reduce((str, token) => {
					const path = token.slice(2, -1)
					const value = parseProperty(path.split('.'), stepAcc)
					return str.split(token).join(value)
				}, source)
			}
		}
	}
	return source
}

function parseProperty(segments, source) {
	if (!segments.length || (typeof source !== 'object' && !Array.isArray(source))) {
		return source
	}
	const segment = segments.shift()
	const arrayMatch = segment.match(/([\w]*)\[(\d+)\]$/m)
	if (arrayMatch) {
		const name = arrayMatch[1]
		const index = Number(arrayMatch[2])
		const array = name ? source[name] : source

		assert.ok(Array.isArray(array), `Expected array at ${segment}`)
		assert.ok(index >= 0 && index < array.length, `Invalid step index '${index}', range [0-${array.length - 1}]`)

		return parseProperty(segments, source[name][index])
	} else {
		return parseProperty(segments, source[segment])
	}
}

function validateRequest(req, spec, op, verbose) {
	const groupSchema = op.paramGroupSchemas
	swaggerSpec.PARAM_GROUPS.forEach(groupId => {
		if (groupSchema[groupId]) {
			try {
				jsonSchema.validate(spec.request[groupId], groupSchema[groupId], { throwError: true })
			} catch(e) {
				if (verbose) e.message = `${e.toString()}\Request: ${JSON.stringify(req, null, 2)}`
				throw e
			}
		}
	})
}

function validateResponse(req, res, spec, op, verbose) {
	const responseSpec = getResponseSpec(spec)
	const responseSchema = op.responseSchemas[responseSpec.status]

	assert.ok(responseSchema, `No response schema found for response status '${responseSpec.status}'`)

	try {
		validateStatus(res, responseSchema.id)
		validateHeaders(res, responseSchema.headersSchema, responseSpec)
		validateBody(res, responseSchema.bodySchema, responseSpec)
		validateContentType(res, op)
	} catch (e) {
		if (verbose) e.message = `${e.toString()}\nRequest: ${JSON.stringify(req, null, 2)}\nResponse: ${JSON.stringify(res, null, 2)}`
		throw e
	}
	return res
}

function getResponseSpec(spec) {
	if (typeof spec.response === 'object') {
		return spec.response
	} else {
		return { status: spec.response }
	}
}

function validateStatus(res, id) {
	const status = Number(id)
	if (Number.isInteger(status)) {
		assert.strictEqual(res.status, status, `HTTP response code ${res.status} was expected to be ${status}`)
	}
}

function validateHeaders(res, headersSchema, responseSpec) {
	if (headersSchema) {
		jsonSchema.validate(res.headers, headersSchema, { throwError: true })
	}
	if (responseSpec.header) {
		// Check that any expect header values are indeed present.
		const h = responseSpec.header
		Object.keys(h)
			.map(k => k.toLowerCase())
			.every(k => assert.equal(`${res.headers[k]}`.toLowerCase(), `${h[k]}`.toLowerCase()))
	}
}
function validateBody(res, bodySchema, responseSpec) {
	if (bodySchema) {
		jsonSchema.validate(res.data, bodySchema, { throwError: true })
	}
	if (responseSpec.body) {
		assert.deepEqual(res.data, responseSpec.body)
	}
}

function validateContentType(res, op) {
	const contentType = res.headers['content-type']
	assert.notEqual(op.produces.indexOf(contentType), -1, `Response content type '${contentType}' was not expected`)
}

function expectsValidRequest(step) {
	return (step.request.valid || (hasSuccessStatus(step.response) && step.request.valid !== false))
}

function hasSuccessStatus(status) {
	status = Number(status)
	return (Number.isInteger(status) && status >= 200 && status < 400)
}
