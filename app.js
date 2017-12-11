var express     = require("express");
var bodyParser  = require("body-parser");
var mongoose    = require("mongoose");
var jwt         = require("jwt-simple");
var request 	= require("request");

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
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,x-auth');
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
    email:      String,
    password:   String,
    apiKey:     String,
    deviceIds:  [String]
});

var User = mongoose.model("User", userSchema);



var dataSchema = new mongoose.Schema({
    userId:     String,
    deviceId:   String,
    time:       { type: Date, default: Date.now },
    uv:         Number,
    zip:        String
});

var Data = mongoose.model("Data", dataSchema);






app.post("/user/register", function(req, res) {
    if (req.body.email && req.body.password && req.body.deviceId) {

        if (!strongPassword(req.body.password)) {
            return sendResponse(res, 401, false, "Password not strong enough");
        }

    	else {
            User.findOne({ email: req.body.email }, function(err, user) {
                if (err) return sendResponse(res, 401, false, err);
                
                else if (user) return sendResponse(res, 401, false, "User " + user.email + 
                    " already exists", { alreadyExists: true });

                // user does not already exist -- good
                else {
                    var user = new User({
                        email: req.body.email,
                        password: req.body.password,
                        apiKey: getNewApiKey(),
                        deviceIds: [req.body.deviceId]
                    });

                    user.save(function(err, user) {
                        // couldn't save to DB
                        if (err) return sendResponse(res, 401, false, err);
                        
                        // SUCCESS
                        else {
                            var responseJSON = {
                                token: createToken(user.email),
                                apiKey: user.apiKey,
                                redirect: "AccountHomePage.html"
                            };
                            
                            return sendResponse(res, 201, true, user.email + " has registered device " + 
                                user.deviceIds[0], responseJSON);
                        }
                    });
                }
            });
    	}
    }

    //missing parameter
    else return sendResponse(res, 401, false, "Missing registration field(s)");
});




app.post("/user/login", function(req, res) {
    
    if (req.body.email && req.body.password) {
        User.findOne({ email: req.body.email, password: req.body.password }, 
            function(err, user) {
                if (err) return sendResponse(rs, 401, false, err);
                
                else if (user) {
                    var responseJSON = {
                        token: createToken(user.email),
                        redirect: "AccountHomePage.html"
                    };

                    return sendResponse(res, 201, true, "Logged in as " + user.email, responseJSON);
                }

                else return sendResponse(res, 401, false, "Email or password are incorrect");
            }   
        );
    }

    //missing parameter
    else return sendResponse(res, 401, false, "Missing login field(s)");
});




app.put("/user/update", function(req, res) {

    // Check if the X-Auth header is set
    if (!req.headers["x-auth"]) {
        return res.status(401).json({error: "Missing X-Auth header"});
    }

    // X-Auth should contain the token value
    var token = req.headers["x-auth"];
    try {
        var decoded = jwt.decode(token, secret);

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

                        user.save(function(err, user) {
                            if (err) return sendResponse(res, 401, false, err);
                            else {
                                var responseJSON = {
                                    token: createToken(user.email)
                                };

                                return sendResponse(res, 201, true, decoded.email + 
                                    " successfully changed email to " + user.email, responseJSON);
                            }
                        });
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
                        
                        User.find({ deviceIds: req.body.deviceId }, function(err, users) {
                            if (err) return sendResponse(res, 401, false, err);
                            else if (users) return sendResponse(res, 401, false, req.body.deviceId + 
                                " has already been registered", { alreadyExists: true });
                            else {
                                // manually insert new device ID
                                var ids = user.deviceIds;
                                ids.push(req.body.deviceId);
                                user.deviceIds = ids;

                                user.markModified('deviceIds');
                                
                                return saveData(res, user, req.body.deviceId + " has been added to " + 
                                    user.email + "'s list of devices");
                            }
                        });
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
                            return sendResponse(res, 401, false, req.body.deviceId + 
                                " was not found in your device list", { alreadyExists: true });
                        }
                    }

                }

                // user was not in DB
                else return sendResponse(res, 401, false, "User " + decoded.email + " not found");
        });
    }
    catch (ex) {
        return sendResponse(res, 401, false, "Invalid JWT");
    }
});











app.post("/data/register", function(req, res) {
    // weird webhook glitch
    if (req.body.data) {
        req.body.data = JSON.parse(req.body.data);
        req.body = req.body.data;
    }

    // check for all fields
    if (!req.body.uv || !req.body.latitude || !req.body.longitude || 
        !req.body.apiKey || !req.body.deviceId) {
        return sendResponse(res, 401, false, "Missing input field(s)");
    }

    else {
        User.findOne({ apiKey: req.body.apiKey }, function(err, user) {
            if (user) {
                var url = "http://dev.virtualearth.net/REST/v1/Locations/";
                var apiKey = "AprFzriYjy7Wd0qpfNirDiGrnskcIccyO9UCI98Lz69OodGCH-XrXDvS9FEuPtBf";
                var latitude = req.body.latitude;
                var longitude = req.body.longitude;

                var queryString = url + latitude + "," + longitude + "/?key=" + apiKey;

        		request({
        		    method: "GET",
        		    uri: queryString,
        		    qs: {}
        		}, function(error, response, body) {
                    if (error) {
                        return sendResponse(res, 401, false, error);
                    }

                    // found the zip code
                    else {
                        var data = JSON.parse(body);
                        var zip = data.resourceSets[0].resources[0].address.postalCode;

                        var dataEntry = new Data ({
                            userId: user._id,
                            deviceId: req.body.deviceId,
                            uv: req.body.uv,
                            zip: zip
                        });

                        // save new data point to DB
                        dataEntry.save(function(err, dataEntry) {
                            if (err) {
                                return sendResponse(res, 401, false, err);
                            }

                            else {
                                console.log(dataEntry);
                                return sendResponse(res, 201, true, "data from zip code " + 
                                    dataEntry.zip + " saved successfully");
                            }
                        });
                    }
        		});

            }

            // no user could be found
            else {
                return sendResponse(res, 401, false, "No user could be found with that api key");
            }
        });
    }
});




app.get("/data/user/all", function(req, res) {
    // Check if the X-Auth header is set
    if (!req.headers["x-auth"]) {
        return res.status(401).json({error: "Missing X-Auth header"});
    }

    var token = req.headers["x-auth"];
    try {
        var decoded = jwt.decode(token, secret);

        User.findOne({ email: decoded.email }, findUser);

        function findUser(err, user) {
            if (user) {
                Data.find({ userId: user._id }, findData);
            }
            else return sendResponse(res, 401, false, err);
        }

        function findData (err, dataEntries) {
            if (dataEntries) {
                var responseJSON = {
                    data: []
                };

                for (var entry of dataEntries) {
                    var dataPoint = {
                        deviceId: entry.deviceId,
                        uv: entry.uv,
                        zip: entry.zip
                    };

                    responseJSON.data.push(dataPoint);
                }

                return sendResponse(res, 201, true, "Data for " + decoded.email, responseJSON);
            }
            else return sendResponse(res, 401, false, err);
        }
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
            return sendResponse(res, 401, false, err);
        }
        else {
            return sendResponse(res, 201, true, successMessage);
        }
    });
}



// Function to generate a random apikey consisting of 32 characters
function getNewApiKey() {
    var newApikey = "";
    var alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    
    for (var i = 0; i < 32; i++) {
        newApikey += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }

    return newApikey;
}


function createToken(email) {
    var payload = { email: email };
    return jwt.encode(payload, secret);
}





app.listen(3000);
