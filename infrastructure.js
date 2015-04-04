var http      = require('http');
var httpProxy = require('http-proxy');
var exec = require('child_process').exec;
var request = require("request");

var GREEN = 'http://0.0.0.0:5060';
var BLUE  = 'http://0.0.0.0:9090';

var TARGET = BLUE;

var infrastructure =
{
  setup: function()
  {
    // Proxy.
    var options = {};
    var proxy   = httpProxy.createProxyServer(options);

    var server  = http.createServer(function(req, res)
    {
      proxy.web( req, res, {target: TARGET } );
    });
    server.listen(8080);

    // Launch green slice
    exec('forever --watch start deploy/blue-www/main.js 9090');
    console.log("blue slice");

    // Launch blue slice
    exec('forever --watch start deploy/green-www/main.js 5060');
    console.log("green slice");

    setInterval(function() {
      var options = {
        host: '0.0.0.0',
        path: '/',
        //since we are listening on a custom port, we need to specify it by hand
        port: '9090',
        //This is what changes the request to a POST request
        method: 'GET'
      };

      http.get(options,function(){}).on("error", function(e) {
        if (e.status > 500) {
          TARGET = GREEN;
        }
      });
    }, 30000);

  },

  teardown: function()
  {
    exec('forever stopall', function()
    {
      console.log("infrastructure shutdown");
      process.exit();
    });
  },
}

infrastructure.setup();

// Make sure to clean up.
process.on('exit', function(){infrastructure.teardown();} );
process.on('SIGINT', function(){infrastructure.teardown();} );
process.on('uncaughtException', function(err){
  console.log(err);
  infrastructure.teardown();} );