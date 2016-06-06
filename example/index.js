var CayleyClient = require('../index').CayleyClient
  , cayley = new CayleyClient();

cayley.connect('http://localhost:64210/', function (err, model) {

    if (err) {
        throw err;
    }

    var exampleDoc = {
        '@context': 'http://json-ld.org/contexts/person.jsonld',
        '@id': 'http://service.jillix.com/calMaro',
        'name': 'John Lennon',
        'born': '1940-10-09',
        'spouse': 'http://dbpedia.org/resource/Cynthia_Lennon'
    };

    model.insert(exampleDoc, function (err, doc) {

        if (err) {
            throw err;
        }

        model.find([
            'John Lennon',
            ['In', 'name']
        ], 'http://json-ld.org/contexts/person.jsonld', function (err, result) {

            if (err) {
                throw err;
            }

            console.log(JSON.stringify(result, null, 2));
        });
    });
});