var cayleyJsonldIO = require('../index.js');
var client = new cayleyJsonldIO.Client({
    url: 'http://localhost:64210/'
});

client.remove([
    'http://service.jillix.com/johnLennon'
],  function (err, result) {

    if (err) {
        throw err;
    }

    console.log(JSON.stringify(result, null, 2));
});