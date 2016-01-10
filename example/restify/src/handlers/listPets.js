/**
 * List all pets
 *
 * GET: /v1/pets
 * 
 * query:
 *   limit {int32} How many items to return at one time (max 100).
 *   
 */
exports.handler = function listPets(req, res, next) {
	res.send('listPets')
	next()
}
