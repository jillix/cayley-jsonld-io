var CayleyClient = require('../index').CayleyClient
  , cayley = new CayleyClient();

cayley.connect('http://localhost:64210/', function (err, model) {

    if (err) {
        throw err;
    }

    model.find([
        'http://service.jillix.com/johnLennon'
    ], 'http://json-ld.org/contexts/person.jsonld', function (err, result) {

        if (err) {
            throw err;
        }

        console.log(JSON.stringify(result, null, 2));
    });
});