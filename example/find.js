var cayleyJsonldIO = require('../index.js');
var client = new cayleyJsonldIO.Client({
    url: 'http://localhost:64210/'
});

client.find([
    'http://service.jillix.com/johnLennon'
], 'http://json-ld.org/contexts/person.jsonld', function (err, result) {

    if (err) {
        throw err;
    }

    console.log(JSON.stringify(result, null, 2));
});