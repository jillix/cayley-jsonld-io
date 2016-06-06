var CayleyClient = require('../index').CayleyClient
  , cayley = new CayleyClient();

cayley.connect('http://localhost:64210/', function (err, model) {

    if (err) {
        throw err;
    }

    var updateDoc = {
        '@context': 'http://json-ld.org/contexts/person.jsonld',
        '@id': 'http://service.jillix.com/johnLennon',
        'name': 'Mike Lennon'
    };

    model.update(updateDoc, function (err, result) {

        if (err) {
            throw err;
        }

        console.log(result);
    });
});