var express = require("express");
var bodyParser = require("body-parser");

var app = express();

// serves static files (HTML, javascript, images) from the 'public' directory
app.use(express.static("public"));

// attaching body-parser middleware
app.use(bodyParser.urlencoded({ extended: false }));


app.get("/testing", function(req, res) {
    res.send("it worked");
});


app.listen(3000);