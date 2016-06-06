var CayleyClient = require('../index').CayleyClient
  , cayley = new CayleyClient();

cayley.connect('http://localhost:64210/', function (err, model) {

    if (err) {
        throw err;
    }

    var exampleDoc = {
        '@context': 'http://json-ld.org/contexts/person.jsonld',
        '@id': 'http://service.jillix.com/johnLennon',
        'name': 'John Lennon',
        'born': '1940-10-09',
        'spouse': 'http://dbpedia.org/resource/Cynthia_Lennon'
    };

    model.insert(exampleDoc, function (err, result) {

        if (err) {
            throw err;
        }

        console.log(JSON.stringify(result, null, 2));
    });
});