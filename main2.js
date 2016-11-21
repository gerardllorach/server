// Kristina server
// ps -e | grep nodejs
// nohup nodejs main2.js &

// Functionalities
// 1. Websockets to web app
// 2. HTTP for display info
// 3. REST server to receive data and forward to web app through websocket
// 4. REST client to recieve data from websocket and forward to URI

const PORTHTTP = 8080;


// Websocket + REST + HTTP
var WebSocket = require('ws').Server;
var http = require('https');
var express = require('express');
var RESTapp = express();
var fs = require('fs');
var options = {
	key: fs.readFileSync('/etc/letsencrypt/live/webglstudio.org/privkey.pem'),
	cert: fs.readFileSync('/etc/letsencrypt/live/webglstudio.org/cert.pem')
};

var server = http.createServer(options, RESTapp);



var bodyParser = require('body-parser');
require('body-parser-xml')(bodyParser);
//var xmlparser = require('express-xml-bodyparser');
//var xmlparser = require('xml2js').parseString;


RESTapp.use(bodyParser.urlencoded({limit: '2mb', extended: false }));
RESTapp.use(bodyParser.json({limit: '2mb'}));
RESTapp.use(bodyParser.xml({xmlParseOptions: {strict:false}}));

//RESTapp.use(bodyParser.text()); // Use text/plain
//RESTapp.use(xmlparser());

RESTapp.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});


RESTapp.post('/idle', function(req, res, next){
	
	res.setHeader("Content-Type","application/json");
 	
	var id = req.body.meta.avatar;

	console.log("Request for: " + id + "--->" + JSON.stringify(req.body));

	req.body.data.id = req.body.uuid;
	
	writeToWS(id, JSON.stringify(req.body.data), res, req.body.uuid);

	if (req.body.uuid === undefined)
		res.send("{ok:true}");

});
/*
RESTapp.post('/verbal', function(req, res, next){

	console.log("Request for: " + req.query.id + "--->" + JSON.stringify(req.body));

	var id = req.query.id;
	writeToWS(id, JSON.stringify(req.body), res, req.body.id);

	if (req.body.id === undefined)
		res.send("OK");

});
*/
RESTapp.post('/turn', function(req, res, next){
	res.setHeader("Content-Type","application/json");

	var id = req.body.meta.avatar;

	console.log("Request for: " + id + "--->" + JSON.stringify(req.body));

	if (req.body.data["language-generation"]){
		var keys = Object.keys(req.body.data["language-generation"]);
		if (keys.length != 0){
			var msg = req.body.data["language-generation"][keys.length-1];
			msg.cmdId = req.body.uuid;
			msg["vocapia-data"] = req.body.data["vocapia-data"];
			writeToWS(id, JSON.stringify(msg), res, req.body.uuid);
		} else
			res.send("{ok:true}");
	}if (req.body.uuid === undefined)
		res.send("{ok:true}");


});
/*
// Old POST implementation
RESTapp.post('/nonVerbal', function(req, res, next){

	console.log("Request nonVerbal for: " + req.query.id + "--->" + JSON.stringify(req.body));

	var id = req.query.id;

	writeToWS(id, JSON.stringify(req.body)); // Immediate response

	res.send("OK");
});

RESTapp.post('/non_verbal', function(req, res, next){

	console.log("Request nonVerbal for: " + req.query.id + "--->" + JSON.stringify(req.body));

	var id = req.query.id;

	writeToWS(id, JSON.stringify(req.body)); // Immediate response

	res.send("OK");
});
*/

RESTapp.get('/', function(req, res, next){
	res.send('GTI service is up.<br><br>Services:<br>'+
		'https://webglstudio.org:8080/idle ---- application/json<br> '+
		'https://webglstudio.org:8080/turn ---- application/json<br>'+

		'<br><br>'+
		'BML example syntax: <br>' +
		'{<br>' +
		'"id": Math.floor(Math.random()*1000),<br>' +
		'"face": {<br>' +
		'"start": 0,<br>' +
		'"end": 1,<br>' +
		'"valaro": [0.5, 0.5]<br>' +
		'},<br>' +
		'"blink": true<br>' +
		'}<br>');
	
});



// XML REST
/*RESTxml = express();
var serverXML = http.createServer(RESTxml);

var xmlparser = require('express-xml-bodyparser');

RESTxml.use(bodyParser.urlencoded({ extended: false }));
RESTxml.use(xmlparser());*/










// Websocket server
var wss = new WebSocket({server:server});
// Websocket clients
var numClients = 0;
var clients = [];

wss.on('connection', function(ws){

	console.log("New WebSocket connection.");

	// Create response buffer
	ws.res = {};


	// New message arrives
	ws.on('message', function(data, flags){
		console.log("Received: " + data);
		// Init connection
		if (!this.id){
			// Random id
			if (data == "--random--" || data == "")
				this.id = numClients++;
			// Login id
			else
				this.id = data;

			// Add ws to clients list
			clients.push(this);
			// Confirm and send id to websocket
			var idObj = {};
			idObj.clientId = this.id;
			this.send(JSON.stringify(idObj));
			// Send new id to VSM?
			console.log("New client with id: " + this.id);

		} else{
			// Send REST response to VSM
			if (this.res.length != 0){
				var cmdId = data.split(":")[0];

				// If cmdId exists
				if (this.res[cmdId]){
					this.res[cmdId].send("{"+data+"}");//JSON response
					delete this.res[cmdId];
					console.log("Sending: " + data);
				}
			} else
			// Discard message
			console.log("Message from WS discarded (response from REST was already answered: " + data);
		}
	});


	// Connection closed
	ws.on('close', function(){

		console.log("Connection closed.");
		// Remove from clients list
		var index = clients.indexOf(this);
		if (index != -1){
			// Alert VSM that client has disconnected
			console.log("VSM, client has gone!");
			// Delete client from server
			clients.splice(index, 1);

			console.log("Client gone: " + this.id);
		}

	});



});



writeToWS = function(id, data, res, cmdId){
	
	if (clients.length != 0){
		// Should analyse for who is the message
		// Check if any client id matches to id
		var WSclient = clients.filter(function(obj){
			if ('id' in obj && obj.id == id){
				return obj;
			} else
				console.log("Websocket client not found");
		});

		// If clients found
		if(WSclient.length != 0)
			// Send data with clients with idem id
			for (var i = 0; i<WSclient.length; i++){
				WSclient[i].send(data);
				// Assign response. If client is in two devices, only assing one res
				if (res && cmdId && i == 0){
					WSclient[i].res[cmdId] = res;	
					console.log("Response stored with id: " + cmdId);
				}
			}
			
		else{
			res.send("Error: client doesn't exist!");
			console.log("Client doesn't exist: " + id);
		}
		

	} else{
		if(res)
			res.send("Error: there are no clients!");
		console.log("There are no clients.");
	}
}













server.listen(PORTHTTP);
console.log("\n\n**********  Running on :", PORTHTTP, ".");



// Server log
console.logCopy = console.log.bind(console);
var serverLog = [];
console.log = function(data){
	var date = new Date().toUTCString();
	// Output
	//this.logCopy(date + ": " + data);

	serverLog.push(data);
	if (serverLog.length > 50) // Number of logs
		serverLog.shift();
}




/*var express = require('express');
var https = require('https');
var http = require('http');
var fs = require('fs');

// This line is from the Node.js HTTPS documentation.
var options = {
  key: fs.readFileSync('test/fixtures/keys/agent2-key.pem'),
  cert: fs.readFileSync('test/fixtures/keys/agent2-cert.cert')
};

// Create a service (the app object is just a callback).
var app = express();

// Create an HTTP service.
http.createServer(app).listen(80);
// Create an HTTPS service identical to the HTTP service.
https.createServer(options, app).listen(443);*/
