/**
 * Create a pet
 *
 * POST: /v1/pets
 * 
 */
exports.handler = function createPets(req, res, next) {
	res.send('createPets')
	next()
}
