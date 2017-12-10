var express     = require("express");
var bodyParser  = require("body-parser");
var mongoose    = require("mongoose");
var jwt         = require("jwt-simple");

var app = express();

// serves static files (HTML, javascript, images) from the 'public' directory
app.use(express.static("public"));

// attaching body-parser middleware
//app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

mongoose.connect("mongodb://localhost/mydb");

var secret = "Zman is Alpha";

const CHANGE_EMAIL      = 0;
const CHANGE_PASSWORD   = 1;
const ADD_DEVICE        = 2;
const REMOVE_DEVICE     = 3;


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

var User = mongoose.model("User", userSchema);


app.post("/user/register", function(req, res) {
    var responseJSON = {
        success: false,
        message: "",
        redirect: ""
    };

    if (req.body.email && req.body.password && req.body.deviceId) {
        var capitalRE =     /[A-Z]/;
        var lowercaseRE =   /[a-z]/;
        var numberRE =      /\d/;
        var symbolRE =      /[.,;:<>\/\\!@#$%^&*()\-`~_=+]/;

        // check for strong password
        if (!capitalRE.test(req.body.password) || !lowercaseRE.test(req.body.password) ||
            !numberRE.test(req.body.password) || !symbolRE.test(req.body.password)) {

            responseJSON.message = "password not strong enough";
            res.status(401).json(responseJSON);
        }

    	else {
            User.findOne({ email: req.body.email }, function(err, user) {
                if (err) {
                    return sendResponse(res, 401, false, err);
                }
                else if (user) {
                    return sendResponse(res, 401, false, "User " + user.email + " already exists", { alreadyExists: true });
                }

                // user does not exist -- good
                else {
                    var user = new User({
                        email: req.body.email,
                        password: req.body.password,
                        deviceIds: [req.body.deviceId]
                    });

                    user.save(function(err, user) {
                        // couldn't save to DB
                        if (err) {
                            responseJSON.message = err;
                            res.status(401).json(responseJSON);
                        }
                        
                        // SUCCESS
                        else {
                            var payload = { email: user.email };
                            var token = jwt.encode(payload, secret);
                            
                            responseJSON.token = token;
                            responseJSON.success = true;
                            responseJSON.message = user.email + " has registered device " + 
                                user.deviceIds[0];
                            responseJSON.redirect = "AccountHomePage.html";

                            res.status(201).json(responseJSON);
                        }
                    });
                }
            });
    	}
    }

    //missing parameter
    else {
        responseJSON.message = "Missing registration field(s)";
        res.status(401).json(responseJSON);
    }
});




app.post("/user/login", function(req, res) {
    var responseJSON = {
        success: false,
        token: "",
        message: "",
        redirect: ""
    };

    var sentResponse = false;

    if (req.body.email && req.body.password) {
        User.findOne({ email: req.body.email, password: req.body.password }, 
            function(err, user) {

                // FIX ME FIX ME

                // STILLLLL FIX ME
                if (err) {
                    responseJSON.message = "Email or password are incorrect\n" + err;
                    if (!sentResponse) res.status(401).json(responseJSON);
                    sentResponse = true;
                }

                else if (user) {
                    var payload = { email: user.email };
                    var token = jwt.encode(payload, secret);
                    
                    responseJSON.token = token;
                    responseJSON.message = "Logged in as " + user.email;
                    responseJSON.success = true;
                    responseJSON.redirect = "AccountHomePage.html";
                    
                    if (!sentResponse) res.status(201).json(responseJSON);
                    sentResponse = true;
                }

                else {
                    responseJSON.message = "Email or password are incorrect\n"
                    if (!sentResponse) res.status(401).json(responseJSON);
                    sentResponse = true;
                }
            }   
        );
    }

    //missing parameter
    else {
        responseJSON.message = "Missing login field(s)";
        if (!sentResponse) res.status(401).json(responseJSON);
        sentResponse = true;
    }
});




app.put("/user/update", function(req, res) {
    var responseJSON = {
        success: false,
        message: ""
    };

    // Check if the X-Auth header is set
    if (!req.headers["x-auth"]) {
        return res.status(401).json({error: "Missing X-Auth header"});
    }

    // X-Auth should contain the token value
    var token = req.headers["x-auth"];
    try {
        var decoded = jwt.decode(token, secret);

        User.find({ email: decoded.email }, function(err, users) {
            for (var user of users) {
                console.log(user);
            }
        });

        // find specific user
        User.findOne({ email: decoded.email }, 
            function(err, user) {
                if (user) {

                    // they must include which operation they would like
                    // to perform in their request
                    if (!req.body.operation) {
                        return sendResponse(res, 401, false, "Missing operation field");
                    }

                    else if (req.body.operation == CHANGE_EMAIL) {
                        if (!req.body.newEmail) {
                            return sendResponse(res, 401, false, "Missing email field");
                        }

                        user.email = req.body.newEmail;

                        return saveData(res, user, "New email has been set");
                    }

                    else if (req.body.operation == CHANGE_PASSWORD) {
                        if (!req.body.newPassword) {
                            return sendResponse(res, 401, false, "Missing password field");
                        }

                        user.password = req.body.newPassword;

                        return saveData(res, user, user.email + "'s new password has been saved");
                    }
                    else if (req.body.operation == ADD_DEVICE) {
                        if (!req.body.deviceId) {
                            return sendResponse(res, 401, false, "Missing device ID field");
                        }

                        console.log(user);
            			var ids = user.deviceIds;
            			console.log(ids);
            			console.log(req.body.deviceId);
            			ids.push(req.body.deviceId);
                        // user.deviceIds.push(req.body.deviceId);
                        console.log(ids);

                        User.update({ _id: user._id }, { $push: { deviceIds: req.body.deviceId+"" } });
            			user.markModified('deviceIds');
            			user.save(function(err, user) {
            			    console.log("saved: " + err);
            			});
            			User.findOne({email: user.email}, function(err, user) {
            			    console.log(user);
            			});
                        //console.log(user);
                        return sendResponse(res, 201, true, user.email + "'s new device has been added");
                        //return saveData(res, user, user.email + "'s new device has been added");
                    }
                    else if (req.body.operation == REMOVE_DEVICE) {
                        if (!req.body.deviceId) {
                            return sendResponse(res, 401, false, "Missing device ID field");
                        }

                        var index = user.deviceIds.indexOf(req.body.deviceId);

                        if (index > -1) {
                            user.deviceIds.splice(index, 1);

                            return saveData(res, user, req.body.deviceId + " has been removed from " + 
                                user.email + "'s list of devices");
                        }
                        else {
                            return sendResponse(res, 401, false, req.body.deviceId + " was not found in your device list");
                        }
                    }

                }

                // user was not in DB
                else {
                    return sendResponse(res, 401, false, "User " + decoded.email + " not found");
                }
        });
    }
    catch (ex) {
        return sendResponse(res, 401, false, "Invalid JWT");
    }
});





app.get("/uv/all", function(req, res){
    UV_Entry.find({}, function(err, entries) {
        if (err) {
            var errorMsg = {
                "message": err
            };

            res.status(401).send(JSON.stringify(errorMsg));
        }
        else {
            var response = { 
                uv_entries: []
            };

            for (var entry of entries) {
                response.uv_entries.push(entry);
            }

            res.status(201).send(JSON.stringify(response));
        }
    });
});




app.get("/gps/all", function(req, res) {
    GPS_Entry.find({}, function(err, entries) {
        if (err) {
            var errorMsg = {
                "message": err
            };

            res.status(401).send(JSON.stringify(errorMsg));
        }
        else {
            var response = {
                gps_entries: []
            };

            for (var entry of entries) {
                response.gps_entries.push(entry);
            }

            res.status(201).send(JSON.stringify(response));
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
                res.status(401).send(JSON.stringify(responseJSON));
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
        res.status(401).send(JSON.stringify(responseJSON));
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
                res.status(401).send(JSON.stringify(responseJSON));
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
        res.status(401).send(JSON.stringify(responseJSON));
    }
});



function strongPassword(password) {
    var capitalRE =     /[A-Z]/;
    var lowercaseRE =   /[a-z]/;
    var numberRE =      /\d/;
    var symbolRE =      /[.,;:<>\/\\!@#$%^&*()\-`~_=+]/;

    if (!capitalRE.test(password) || !lowercaseRE.test(password) ||
        !numberRE.test(password) || !symbolRE.test(password)) {

        return false;
    }

    else return true;
}




function sendResponse(res, status, success, message, extraFields = {}) {
    var responseJSON = {
        success: success,
        message: message
    };

    for (var field in extraFields) {
        responseJSON[field] = extraFields[field];
    }

    return res.status(status).json(responseJSON);
}



function saveData(res, user, successMessage) {
    user.save(function(err, user) {
        if (err) {
            return sendResponse(res, 401, false, "Error: " + err);
        }
        else {
            return sendResponse(res, 201, true, successMessage);
        }
    });
}





app.listen(3000);
