/**
 * Info for a specific pet or
 * a long sentance over a few
 * lines
 * 
 *
 * GET: /v1/pets/{petId}
 * 
 * path:
 *   petId {array} The id of the pet to retrieve.
 *   
 */
exports.handler = function showPetById(req, res, next) {
  console.log(req.params.petId[0], req.params.petId)
  res.send('showPetById')
  next()
}
