'use strict'

/**
 * Store and maintain the set of registered Swagger API Specs.
 *
 * Exposes a setter to update the host of all registered apis.
 */
class SwaggerApis {
	constructor() {
		this._apis = new Set()
	}

	add(api) {
		this._apis.add(api)
		this._updateApiHost(api)
		return this
	}

	get size() {
		return this._apis.size
	}

	get host() {
		return this._host || process.env.API_HOST
	}

	set host(value) {
		this._host = value
		this._updateApiHosts()
	}

	_updateApiHosts() {
		for (let api of this._apis) {
			this._updateApiHost(api)
		}
	}

	_updateApiHost(api) {
		api.host = this.host || api.host
	}
}

module.exports = SwaggerApis
