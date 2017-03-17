'use strict'

const Options = require('./options')
const fileSpecs = require('./fileSpecs')
const util = require('./util')
const fs = require('fs')
const path = require('path')
const assert = require('assert')
const jsonSchema = require('jsonschema')
const url = require('url')
const request = require('axios')
const swaggerSpec = require('./swaggerSpec')
const expect = require('expect')

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
 *  - `host` server host + port where your tests will run e.g. `localhost:3453`.
 *  - `specs` path to specs dir, or function to return the set of specs for an operation.
 *  - `maxTimeout` maximum time a test can take to complete.
 *  - `slowTime` time taken before a test is marked slow. Defaults to 1 second.
 *  - `startServer(done)` function called before all tests where you can start your local server.
 *  - `stopServer(done)`function called after all tests where you can stop your local server.
 *  - `fixtures`: path to a yaml file with test fixtures.
 *  - `sortByStatus`: Sort specs by response status, lowest to highest. Defaults to true.
 *  - `prefetch`: path to a yaml file with requests to prefetch values into fixtures before
 *                executing specs, e.g. auth tokens
 * @return {void}
 */
function apiSpecs(options) {
  options = Options.applyDefaultSpecOptions(options)
  if (options.headers) {
    request.defaults.headers.common = Object.assign({}, request.defaults.headers.common, options.headers)
  }
  const api = swaggerSpec.getSpecSync(options.api)
  const operations = swaggerSpec.getAllOperations(api)
  options.fixtures = getJsonFile(options.fixtures)
  describeApi(api, operations, options)
}

function describeApi(api, operations, options) {
  describe(api.info.title, function () {
    this.slow(options.slowTime || 1500)
    this.timeout(options.maxTimeout || 10000)

    before(done => {
      options.startServer(e => {
        if (e) done(e)
        else prefetch(operations, options).then(() => done(), e => done(e))
      }, options)
    })
    after(done => {
      fileSpecs.disableOldSpecs(operations, options)
      options.stopServer(done, options)
    })
    describeOperations(operations, options)
  })
}

function prefetch(operations, options) {
  const prefetch = getJsonFile(options.prefetch)
  return Promise.all(Object.keys(prefetch).map(id => {
    const data = prefetch[id]
    const steps = Array.isArray(data) ? data : [ data ]
    const specInfo = getSpecInfo(id)
    return runSteps(steps, {}, operations, specInfo, options)
      .catch(e => { e.message = `${e.message} in '${id}'`; throw e })
  }))
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
  normalizeSpecs(specs, options).forEach(spec => {
    const specInfo = getSpecInfo(spec.id)
    specInfo.it(specInfo.summary, () => {
      return runSteps(spec.steps, op, operations, specInfo, options)
    })
  })
}

function normalizeSpecs(specs, options) {
  const normSpecs = Object.keys(specs)
    .map(id => {
      const spec = specs[id]
      const steps = Array.isArray(spec) ? spec : [ spec ]
      steps.forEach(step => {
        if (step.response && typeof step.response !== 'object') {
          step.response = { status: step.response }
        }
      })
      const lastStep = steps[steps.length - 1]
      if (lastStep.response === undefined) throw new Error(`Missing response status for spec: '${id}`)
      return { id, steps, lastStep }
    })

  if (options.sortByStatus) {
    normSpecs.sort((a, b) => a.lastStep.response.status - b.lastStep.response.status)
  }
  return normSpecs
}

function runSteps(steps, op, operations, specInfo, options) {
  const fixtures = { fixtures: options.fixtures }
  return steps.reduce((prev, step, i) => {
    return prev.then(acc => {
      step = util.resolveSchemaRefs(step, fixtures)
      step.index = i
      if (!step.request) step.request = {}
      if (!step.response) step.response = {}
      const stepOp = getStepOperation(step, operations, op)
      return runStep(step, stepOp, specInfo, options, acc)
    })
  }, Promise.resolve([]))
}

function getStepOperation(step, operations, primaryOp) {
  return operations.find(opt => opt.id === step.request.operationId) || primaryOp
}

function runStep(step, op, specInfo, options, acc) {
  if (!acc) acc = []
  const req = createRequest(op, step.request, options, acc)

  if (expectsValidRequest(step)) {
    validateRequest(req, step, op)
  }
  return request(req)
    .then(res => {
      acc.push({ req, res })
      if (specInfo.verbose) {
        const msg = `[${step.index}]${specInfo.summary}\n` +
          `${prettyJson('Request:', req)}\n${prettyJson('Response:', res)}`
        console.log(msg)
      }
      return res
    }, res => {
      acc.push({ req, res })
      return res
    })
    .then(
      res => validateResponse(req, res, step, op, options, acc),
      res => validateResponse(req, res, step, op, options, acc)
    )
    .then(() => acc)
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
  return fileSpecs.disableSpec(op, options)
}

function requireSpecsFile(op, options) {
  const fileInfo = fileSpecs.enableSpec(op, options)
  const data = getJsonFile(fileInfo.path)
  return resolveImports(data)
}

function resolveImports(root) {
  let imports = (root.imports || []).slice()
  delete root.imports
  const map = new Map()
  const results = []
  while (imports.length) {
    const p = imports.shift()
    if (!map.has(p)) {
      const data = getJsonFile(p)
      map.set(p, data)
      results.push(data)
      if (data.imports) {
        imports = imports.concat(data.imports)
        delete data.imports
      }
    }
  }
  results.forEach(value => Object.assign(root, value))
  return root
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
  testReqData = populateProperties(testReqData, acc, options)

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

function populateProperties(source, acc, options) {
  if (Array.isArray(source)) {
    source.forEach((v, i) => source[i] = populateProperties(v, acc, options))
  } else if (typeof source === 'object') {
    Object.keys(source || {}).forEach(key => source[key] = populateProperties(source[key], acc, options))
  } else if (typeof source === 'string') {
    const stepAcc = { step: acc, fixtures: options.fixtures }
    if (source.startsWith('step[')) {
      return parseProperty(source.split('.'), stepAcc)
    } else {
      const TOKEN_REGEX = /\$\{((step\[\d+\]|fixtures)[\w\[\d\]\.]+)\}/g
      let tokenMatch = source.match(TOKEN_REGEX)
      if (tokenMatch) {
        // if the token isn't nested in a string then we return the raw value
        if (tokenMatch.length === 1 && tokenMatch[0] === source) {
          const path = tokenMatch[0].slice(2, -1)
          source = parseProperty(path.split('.'), stepAcc)
        } else {
          // otherwise replace each token in the string
          while (tokenMatch) {
            source = tokenMatch.reduce((str, token) => {
              const path = token.slice(2, -1)
              const value = parseProperty(path.split('.'), stepAcc)
              return str.split(token).join(value)
            }, source)
            tokenMatch = source.match(TOKEN_REGEX)
          }
        }
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

function validateRequest(req, spec, op) {
  const groupSchema = op.paramGroupSchemas
  swaggerSpec.PARAM_GROUPS.forEach(groupId => {
    if (groupSchema[groupId]) {
      try {
        jsonSchema.validate(spec.request[groupId], groupSchema[groupId], { throwError: true })
      } catch(e) {
        e.message = `${e.toString()}\n${prettyJson('Request:', req)}`
        throw e
      }
    }
  })
}

function validateResponse(req, res, spec, op, options, acc) {
  const responseSpec = getResponseSpec(spec, acc, options)
  const responseSchema = op.responseSchemas[responseSpec.status]

  assert.ok(responseSchema, `No response schema found for response status '${responseSpec.status}'`)

  try {
    validateStatus(res, responseSchema.id)
    validateHeaders(res, responseSchema.headersSchema, responseSpec)
    validateBody(res, responseSchema.bodySchema, responseSpec)
    validateExpectations(responseSpec)
    validateContentType(res, op)
    updateFixtures(responseSpec, options)
  } catch (e) {
    e.message = `${e.toString()}\n${prettyJson('Request:', req)}\n${prettyJson('Response:', res)}`
    throw e
  }
  return res
}

function getResponseSpec(spec, acc, options) {
  if (typeof spec.response === 'object') {
    // Don't attempt to parse properties if we didn't get the expected
    // response as things will tend to blow up
    if (spec.response.status === (acc[acc.length - 1] || { res: {} }).res.status) {
      return populateProperties(spec.response, acc, options)
    } else {
      return spec.response
    }
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
    // We can't use `throwError: true` because of a bug around anyOf and oneOf
    // See https://github.com/tdegrunt/jsonschema/issues/119
    // Instead we capture all errors and then throw the first one found
    const result = jsonSchema.validate(res.data, bodySchema, { throwError: false })
    if (result && result.errors.length) {
      const details = result.errors
        .slice(1)
        .map( e => `\n\t - ${e.property} - ${e.message}`)
        .join('')

      result.errors[0].message += details
      throw result.errors[0]
    }
  }
  if (responseSpec.body) {
    assert.deepEqual(res.data, responseSpec.body)
  }
}

function validateExpectations(responseSpec) {
  if (responseSpec.expect) {
    responseSpec.expect.forEach(expectation => {
      const assertion = Object.keys(expectation)[0]
      const args = expectation[assertion]
      const scope = expect(args.shift())
      scope[assertion].apply(scope, args)
    })
  }
}

function validateContentType(res, op) {
  if (res.status === 204) return

  let contentType = res.headers['content-type'] || ''
  contentType = contentType.split(';')[0].trim()
  assert.notEqual(op.produces.indexOf(contentType), -1, `Response content type '${contentType}' was not expected`)
}

function expectsValidRequest(step) {
  return (step.request.valid || (hasSuccessStatus(step.response) && step.request.valid !== false))
}

function hasSuccessStatus(status) {
  status = Number(status)
  return (Number.isInteger(status) && status >= 200 && status < 400)
}

function updateFixtures(responseSpec, options) {
  if (responseSpec.fixtures) {
    Object.assign(options.fixtures, responseSpec.fixtures)
  }
}

function getJsonFile(jsonPath) {
  if (!jsonPath || typeof jsonPath === 'object') return jsonPath || {}
  const p = path.resolve(jsonPath)
  if (!p || !util.existsSync(p)) return {}
  const contents = fs.readFileSync(p, 'utf8')
  return util.parseFileContents(contents, p) || {}
}

function prettyJson(title, obj) {
  const MAX_LINES = 400
  const lines = JSON.stringify(obj, null, 2).split('\n').slice(0, MAX_LINES).join('\n')
  return `${title}\n${lines}`
}
