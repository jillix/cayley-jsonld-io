var CayleyClient = require('../index').CayleyClient
  , cayley = new CayleyClient();

cayley.connect('http://localhost:64210/', function (err, model) {

    if (err) {
        throw err;
    }

    model.remove([
        'http://service.jillix.com/johnLennon'
    ],  function (err, result) {

        if (err) {
            throw err;
        }

        console.log(JSON.stringify(result, null, 2));
    });
});