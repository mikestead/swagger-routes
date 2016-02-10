'use strict'

const expect = require('expect')
const del = require('del')
const fileAuthorizers = require('../src/fileAuthorizers')
const swaggerSpec = require('../src/swaggerSpec')
const util = require('../src/util')
const applyDefaultOptions = require('../src/options').applyDefaultOptions

const api = swaggerSpec.getSpecSync('./test/_fixture/secure-petstore.yml')
const schemeId = 'petstore_auth'
const petstoreAuth = api.securityDefinitions[schemeId]
const options = applyDefaultOptions({
  api,
  handlers: './bin/handlers',
  authorizers: './bin/security'
})

describe('fileAuthorizers', () => {
  afterEach(() => del(options.authorizers.path))

  it('should generate an authorizer file based security schema id', () => {
    const fileInfo = fileAuthorizers.enableAuthorizer(schemeId, petstoreAuth, options)

    expect(fileInfo.gen).toBe(true)
    expect(fileInfo.old).toBe(false)
    expect(util.existsSync(fileInfo.path)).toNotBe(false)
  })

  it('should NOT re-generate existing authorizer files', () => {
    const fileInfoA = fileAuthorizers.enableAuthorizer(schemeId, petstoreAuth, options)
    const fileInfoB = fileAuthorizers.enableAuthorizer(schemeId, petstoreAuth, options)

    expect(fileInfoA.gen).toBe(true)
    expect(fileInfoB.gen).toBe(false)
  })

  it('should prefix underscore to authorizer files no longer in use', () => {
    const fileInfoA = fileAuthorizers.enableAuthorizer(schemeId, petstoreAuth, options)
    const fileInfoB = fileAuthorizers.disableAuthorizer(schemeId, options)

    expect(fileInfoA.gen).toBe(true)
    expect(fileInfoA.old).toBe(false)
    expect(fileInfoA.id).toBe(schemeId)

    expect(fileInfoB.gen).toBe(false)
    expect(fileInfoB.old).toBe(true)
    expect(fileInfoB.id).toBe(`_${schemeId}`)
  })

  it('should renew old authorizer which is in use again', () => {
    fileAuthorizers.enableAuthorizer(schemeId, petstoreAuth, options)
    fileAuthorizers.disableAuthorizer(schemeId, options)
    const fileInfo = fileAuthorizers.enableAuthorizer(schemeId, petstoreAuth, options)

    expect(fileInfo.gen).toBe(false)
    expect(fileInfo.old).toBe(false)
    expect(fileInfo.id).toBe(schemeId)
  })
})
