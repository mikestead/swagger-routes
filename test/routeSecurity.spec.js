const expect = require('expect')
const swaggerSpec = require('../src/swaggerSpec')
const routeSecurity = require('../src/routeSecurity')
const applyDefaultOptions = require('../src/options').applyDefaultOptions

const secureApi = swaggerSpec.getSpecSync('./test/_fixture/secure-petstore.yml')
const securityDefinitions = secureApi.securityDefinitions

const options = applyDefaultOptions({
	authorizers: () => () => {}
})

describe('routeSecurity', () => {
	describe('getAuthorizers', () => {
		it('should return map of security scheme id => authorizer function', () => {
			const map = routeSecurity.getAuthorizers(securityDefinitions, options)

			expect(map).toExist()
			expect(map.size).toBe(2)
			expect(map.get('petstore_auth')).toBeA('function')
			expect(map.get('petstore_auth2')).toBeA('function')
		})
	})
})
