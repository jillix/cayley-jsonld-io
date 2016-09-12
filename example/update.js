var cayleyJsonldIO = require('../index.js');
var client = new cayleyJsonldIO.Client({
    url: 'http://localhost:64210/'
});

var updateDoc = {
    '@context': 'http://json-ld.org/contexts/person.jsonld',
    '@id': 'http://service.jillix.com/johnLennon',
    'name': 'Mike Lennon'
};

client.update(updateDoc, function (err, result) {

    if (err) {
        throw err;
    }

    console.log(result);
});