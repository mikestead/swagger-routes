'use strict'

/**
 * Store and maintain the set of registered Swagger API Specs.
 *
 * Exposes a setter to update the host of all registered apis.
 */
class SwaggerApis {
  constructor() {
    this._apis = []
  }

  add(api) {
    this._apis.push(api)
    this._updateHost(api)
    return this
  }

  atIndex(index) {
    return this._apis[index]
  }

  last() {
    return this._apis[this._apis.length - 1]
  }

  get size() {
    return this._apis.length
  }

  get host() {
    return this._host || process.env.API_HOST
  }

  set host(value) {
    this._host = value
    this.updateApis()
  }

  get schemes() {
    return this._schemes
  }

  set schemes(value) {
    if (typeof value === 'string') value = [ value ]
    this._schemes = value
    this.updateApis()
  }

  updateApis() {
    for (let api of this._apis) {
      this._updateHost(api)
      this._updateSchemes(api)
    }
  }

  _updateHost(api) {
    api.host = this.host || api.host
  }

  _updateSchemes(api) {
    api.schemes = this.schemes || api.schemes
  }
}

module.exports = SwaggerApis
