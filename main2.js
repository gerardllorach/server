
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
var path = require('path');
var options = {
	key: fs.readFileSync('/etc/letsencrypt/live/webglstudio.org/privkey.pem'),
	cert: fs.readFileSync('/etc/letsencrypt/live/webglstudio.org/cert.pem')
};

var server = http.createServer(options, RESTapp);



var bodyParser = require('body-parser');
require('body-parser-xml')(bodyParser);



RESTapp.use(bodyParser.urlencoded({limit: '2mb', extended: false }));
RESTapp.use(bodyParser.json({limit: '2mb'}));
// https://github.com/Leonidas-from-XIV/node-xml2js#options
RESTapp.use(bodyParser.xml({
	xmlParseOptions: {
		strict:false,
		mergeAttrs: true,
		normalizeTags: true,
		explicitArray: false
	}
}));



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




RESTapp.post('/bml', function(req, res, next){
	
	res.setHeader("Content-Type", "application/json");
	var msg = {};

	// XML
	if (req.body.bml){
		block = req.body.bml;
		//console.log(JSON.stringify(block));
		//console.log("\n\n");

		reparseXML(block);

		msg = block;
		msg.character = msg.character || msg.caracterid;
	} else {
		console.log("Message not identified");
		console.log(JSON.stringify(req.body));
		res.send("{Error: Message not identified}");
	}

	console.log("Request for: " + msg.character + "--->" + JSON.stringify(msg));

	var id = msg.character || "KRISTINA";
	writeToWS(id, JSON.stringify(msg), res, msg.ID);

});

reparseXML = function(variable){
	var type  = Object.prototype.toString.call(variable);
	// Is an array
	if (type === '[object Array]'){
		//console.log("ARRAY1", JSON.stringify(variable));
		for (var i = 0; i<variable.length; i++){
			//console.log("ARRAY2", JSON.stringify(variable[i]));
			var out = reparseXML(variable[i]);
			if (out !== 'undefined')
				variable[i] = out;
			//console.log("ARRAY3", JSON.stringify(variable[i]));
		}
		//console.log("ARRAY4", JSON.stringify(variable));
	}
	// Is an object
	else if (type === '[object Object]'){
		//console.log("OBJ1", JSON.stringify(variable));
		var keys = Object.keys(variable);
		for (var i = 0; i<keys.length; i++){
			// Reassign value with lower case key
			var obj = variable[keys[i]];
			//console.log("OBJ2", JSON.stringify(obj));
			// Reparse
			var out = reparseXML(obj);
			if (out !== undefined)
				obj = out;
			// Delete from variable
			delete variable[keys[i]];
			// Reassign
			variable[keys[i].toLowerCase()] = obj;
			//console.log("OBJ3", JSON.stringify(obj));
		}
		return variable;
		//console.log("OBJ4", JSON.stringify(variable));
	}
	// Is a string
	else if (type === '[object String]'){
		return variable.toLowerCase();
	}
}
//var a = '{"XMLNS":"http://www.mindmakers.org/projects/BML","CHARACTER":"Greta","COMPOSITION":"replace","ID":"bml1","REACTION_DURATION":"NONE","REACTION_TYPE":"NONE","speech":{"_":"No no no.","XMLNS":"","ID":"s1","LANGUAGE":"english","START":"0.0","TEXT":"","VOICE":"cereproc","description":{"LEVEL":"1","TYPE":"gretabml","reference":"tmp/from-fml-apml.pho"},"tm":[{"ID":"tm0"},{"ID":"tm1"},{"ID":"tm2"},{"ID":"tm3"}]},"face":[{"AMOUNT":"1.000","END":"1.5277291000000002","ID":"em1_0","START":"-0.58","lexeme":{"LEXEME":"neutral"}},{"AMOUNT":"1.000","END":"1.5277291000000002","ID":"p1_2","START":"-0.58","lexeme":{"LEXEME":"Eyebrows_Frown"}},{"AMOUNT":"1.000","END":"1.9890000000000003","ID":"bc1_0","START":"-0.58","lexeme":{"LEXEME":"understand"}}],"head":[{"END":"1.5277291000000002","ID":"p1_0","LEXEME":"SHAKE","START":"-0.41937661495075645","description":{"PRIORITY":"1","TYPE":"gretabml","reference":"ShakeLeftRight","intensity":"1.000","spc.value":"0.000","tmp.value":"0.050","fld.value":"-0.050","pwr.value":"0.100","rep.value":"-0.100","opn.value":"0.000","ten.value":"0.000"}},{"END":"0.46127089999999993","ID":"bc1_1","LEXEME":"NOD","START":"-0.15375696666666708","description":{"PRIORITY":"1","TYPE":"gretabml","reference":"NodUpDown","intensity":"1.000","spc.value":"0.000","tmp.value":"0.050","fld.value":"-0.050","pwr.value":"0.100","rep.value":"-0.100","opn.value":"0.000","ten.value":"0.000"}}],"gesture":{"END":"2.39645854271667","ID":"p1_1","LEXEME":"Refuse_Ges_R","START":"-0.4344188283206015","description":{"PRIORITY":"1","TYPE":"gretabml","reference":"performative=Refuse_Ges_R","intensity":"1.000","spc.value":"0.000","tmp.value":"0.050","fld.value":"-0.050","pwr.value":"0.100","rep.value":"-0.100","opn.value":"0.000","ten.value":"0.000"}}}';
//a = JSON.parse(a);
//reparseXML(a)




RESTapp.post('/avatar', function(req, res, next){
	processKristina(req,res,next);
});

RESTapp.post('/turn',function(req,res,next){
	processKristina(req,res,next);
});

processKristina = function(req,res,next){
	res.setHeader("Content-Type","application/json");

	var id = "KRISTINA";

	// If no meta
	if (req.body.meta)
		if (req.body.meta.avatar)
			id = req.body.meta.avatar;

	id = id.toLowerCase();
	console.log("Request for: " + id + "--->" + JSON.stringify(req.body));
	
	// If no data
	if (!req.body.data)
		req.body.data = {};

	var msg = {};
	msg.id = req.body.uuid || "noID";
	// Language-generation as "lg"
	if (req.body.data["language-generation"]){
		var lg = req.body.data["language-generation"];
		if (lg.constructor !== Array && !lg["0"]  || lg.constructor === Array ){
			msg.lg = lg;
			msg.control = "SPEAKING";
		}
	}
	// Vocapia transcription as "userText"
	if (req.body.data["vocapia-data"])
		msg.userText = req.body.data["vocapia-data"].text;
	// DialogueAct
	if (req.body.data["mode-selection"]){
		if (req.body.data["mode-selection"]["nonverbal"]){
			// Arrange nonverbal as gestures
			parseNonVerbal(req.body.data["mode-selection"]["nonverbal"], msg);
		}
	}
	// Get meta
	if (req.body.meta)
		msg.meta = req.body.meta;
	// Get time
	if (req.body.time)
		msg.time = req.body.time;
	// Type of turn
	if (req.body.type)
		msg.type = req.body.type;
	// Composition
	if (req.body.data.composition)
		msg.composition = req.body.data.composition;
	// State
	if (req.body.data.state)
		msg.control = req.body.data.state;

	// Send to application
	//writeToWS(id, JSON.stringify(msg), res, msg.id);

	if (req.body.uuid === undefined)
		res.send("{ok:true}");
	else if(msg.type == "control")
		res.send("{"+msg.id +":true}");
	else
		writeToWS(id, JSON.stringify(msg), res, msg.id);
	



}


RESTapp.get('/', function(req, res, next){
	res.sendFile(path.join(__dirname + '/bml.html'));
	
});



var parseNonVerbal = function(nonVerbal, msg){
	var keys = Object.keys(nonVerbal);
	msg.nonVerbal = [];

	for (var i = 0; i<keys.length; i++){
		var bmlInstr = {};
		// Get id (same as language generation)
		bmlInstr.id = "nonVerbal" + keys[i];
		// Get dialogue act
		var rdf = nonVerbal[keys[i]];
		var tmp = rdf.split("dialogue_actions#");
		bmlInstr.dialogueAct = tmp[tmp.length-1].split("\"/")[0];
		bmlInstr.start = "speech" + keys[i];
		// Add to nonVerbal array
		msg.nonVerbal.push(bmlInstr);
	}
}







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
				this.id = data.toLowerCase();

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
			res.send("Error: client doesn't exist!" + id);
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
	// Output (comment if you dont want comments)
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
