var express     = require("express");
var bodyParser  = require("body-parser");
var mongoose    = require("mongoose");

var app = express();

// serves static files (HTML, javascript, images) from the 'public' directory
app.use(express.static("public"));

// attaching body-parser middleware
//app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

//
mongoose.connect("mongodb://localhost/mydb");


// This is to enable cross-origin access
app.use(function (req, res, next) {
    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', '*');
    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);
    // Pass to next layer of middleware
    next();
});



var gpsSchema = new mongoose.Schema({
    time:   { type: Date, default: Date.now },
    latitude:   String,
    longitude:  String
});

var GPS_Entry = mongoose.model("GPS_Entry", gpsSchema);



var uvSchema = new mongoose.Schema({
    time:   { type: Date, default: Date.now },
    value:  Number
});

var UV_Entry = mongoose.model("UV_Entry", uvSchema);



var userSchema = new mongoose.Schema({
    deviceIds:  [String],
    email:      String,
    password:   String
});

var userEntry = mongoose.model("userEntry", userSchema);


app.post("/user/register", function(req, res) {
    var responseJSON = {
        success: false,
        message: ""
    };
    
    if (req.body.email && req.body.password && req.body.deviceId) {

    }

    //missing parameter
    else {
        console.log(req.body);
        responseJSON.message = "Missing registration field(s)";
        res.status(400).json(responseJSON);
    }
});





app.get("/uv/all", function(req, res){
    UV_Entry.find({}, function(err, entries) {
        if (err) {
            var errorMsg = {
                "message": err
            };

            res.status(400).send(JSON.stringify(errorMsg));
        }
        else {
            var response = { 
                uv_entries: []
            };

            for (var entry of entries) {
                response.uv_entries.push(entry);
            }

            res.status(200).send(JSON.stringify(response));
        }
    });
});




app.get("/gps/all", function(req, res) {
    GPS_Entry.find({}, function(err, entries) {
        if (err) {
            var errorMsg = {
                "message": err
            };

            res.status(400).send(JSON.stringify(errorMsg));
        }
        else {
            var response = {
                gps_entries: []
            };

            for (var entry of entries) {
                response.gps_entries.push(entry);
            }

            res.status(200).send(JSON.stringify(response));
        }
    });
});




app.post("/uv/register", function(req, res){
    var responseJSON = {
        success: false,
        message: ""
    };

    if (req.body.value) {
        var uv_entry = new UV_Entry({
            value: req.body.value
        });

        uv_entry.save(function(err, uv_entry) {
            // couldn't save to DB
            if (err) {
                console.log("Error: " + err);
                responseJSON.message = err;
                res.status(400).send(JSON.stringify(responseJSON));
            }
            
            // SUCCESS
            else {
                responseJSON.success = true;
                responseJSON.message = "UV value of " + uv_entry.value + 
                                        " was saved with ID " + uv_entry._id;
                res.status(201).send(JSON.stringify(responseJSON));
            }
        });
    }

    //missing parameter
    else {
        console.log(req.body);
        responseJSON.message = "Missing value property";
        res.status(400).send(JSON.stringify(responseJSON));
    }
});




app.post("/gps/register", function(req, res){
    var responseJSON = {
        success: false,
        message: ""
    };

    if (req.body.latitude && req.body.longitude) {
        var gps_entry = new GPS_Entry({
            latitude: req.body.latitude,
            longitude: req.body.longitude
        });

        gps_entry.save(function(err, gps_entry) {
            // couldn't save to DB
            if (err) {
                console.log("Error: " + err);
                responseJSON.message = err;
                res.status(400).send(JSON.stringify(responseJSON));
            }
            
            // SUCCESS
            else {
                responseJSON.success = true;
                responseJSON.message = "GPS value with (latitude, longitude): (" + 
                                        gps_entry.latitude + ", " + gps_entry.longitude +
                                        ") was saved with ID " + gps_entry._id;
                res.status(201).send(JSON.stringify(responseJSON));
            }
        });
    }

    //missing parameter
    else {
    console.log(req.body);
        responseJSON.message = "Missing latitude or longitude property";
        res.status(400).send(JSON.stringify(responseJSON));
    }
});





app.listen(3000);
