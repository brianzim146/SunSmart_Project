var express     = require("express");
var bodyParser  = require("body-parser");
var mongoose    = require("mongoose");

var app = express();

// serves static files (HTML, javascript, images) from the 'public' directory
app.use(express.static("public"));

// attaching body-parser middleware
app.use(bodyParser.urlencoded({ extended: false }));

//
mongoose.connect("mongodb://localhost/mydb");


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




app.get("/touch", function(req, res) {
    var uv_entry = new UV_Entry({
        value: 10
    });

    id = -1;

    console.log("arrived");

    uv_entry.save(function(err, uv_entry) {
    	console.log("in the callback function");
    	console.log(uv_entry);
        id = uv_entry._id;
    	res.send("Just created UV entry w/ ID: " + uv_entry._id);
    });

});

app.get("/uv/all", function(req, res){
    UV_Entry.find({}, function(err, entries) {
    	entries.forEach(function(entry) {
    	    console.log(entry);
    	});
    });

    res.send("Did it work?");
});




app.post("/uv/register", function(req, res){
    var responseJSON = {
        success: false,
        message: ""
    };

    if (req.body.hasOwnProperty("value")) {
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
        responseJSON.message = "Missing value property";
        res.status(400).send(JSON.stringify(responseJSON));
    }
});





app.listen(3000);
