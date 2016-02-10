'use strict'

const expect = require('expect')
const SwaggerApis = require('../src/SwaggerApis')
const HOST = 'api.domain.com'

describe('SwaggerApis', () => {
  it('should update host of all registered apis', () => {
    const api1 = {}
    const api2 = {}
    const apis = new SwaggerApis().add(api1).add(api2)
    apis.host = HOST

    expect(apis.host).toBe(HOST)
    expect(api1.host).toBe(HOST)
    expect(api2.host).toBe(HOST)
  })

  it('should update host of all registered apis with API_HOST env variable', () => {
    process.env.API_HOST = HOST
    const api1 = {}
    const api2 = {}
    const apis = new SwaggerApis().add(api1).add(api2)

    expect(apis.host).toBe(HOST)
    expect(api1.host).toBe(HOST)
    expect(api2.host).toBe(HOST)

    delete process.env.API_HOST
  })

  it('should prioritize a set host over API_HOST env variable', () => {
    process.env.API_HOST = 'host1'
    const api1 = {}
    const apis = new SwaggerApis().add(api1)
    apis.host = 'host2'

    expect(apis.host).toBe('host2')
    expect(api1.host).toBe(apis.host)

    delete process.env.API_HOST
  })
})
