/**
 * Info for a specific pet or
 * a long sentance over a few
 * lines
 * 
 *
 * GET: /v1/pets/{petId}
 * 
 * path:
 *   petId {string} The id of the pet to retrieve.
 *   
 */
exports.handler = function showPetById(req, res, next) {
	res.send('showPetById')
	next()
}
