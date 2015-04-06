var http      = require('http');
var httpProxy = require('http-proxy');
var exec = require('child_process').exec;
var request = require("request");
var redis = require('redis');

var GREEN = 'http://0.0.0.0:5060';    //redis servers are at http://0.0.0.0:50601 and http://0.0.0.0:90901
var BLUE  = 'http://0.0.0.0:9090';
var GREENCLIENT = redis.createClient(50601, '0.0.0.0', {});
var BLUECLIENT = redis.createClient(90901, '0.0.0.0', {});

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

      if(req.url == '/switch')
    {
        if (TARGET === BLUE) {
          TARGET = GREEN;
          BLUECLIENT.lrange("imageList", 0,-1,function(err,list){
          if (err) throw err;
            GREENCLIENT.rpush("imageList", list);
            BLUECLIENT.ltrim("imageList",0,-1);
          });
        } else {
          TARGET = BLUE;
          GREENCLIENT.lrange("imageList", 0,-1,function(err,list){
          if (err) throw err;
            BLUECLIENT.rpush("imageList", list);
            GREENCLIENT.ltrim("imageList",0,-1);
          });
        }
    }

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
          TARGET = BLUE;    //fall back
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