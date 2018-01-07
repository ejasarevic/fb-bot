var express = require('express');
var router = express.Router();
var request = require('request');
var Promise = require('bluebird');
var rp = require('request-promise');

var config = require('../config/configuration');

router.post('/webhook', (req, res) => {


    let body = req.body;
    console.log("Received request: ", JSON.stringify(body));

// Checks this is an event from a page subscription
    if (body.object === 'page') {
        // Returns a '200 OK' response to all requests
        res.status(200).send('EVENT_RECEIVED');

        // Iterates over each entry - there may be multiple if batched
        body.entry.forEach(function(entry) {

            // Gets the body of the webhook event
            let webhook_event = entry.messaging[0];
            console.log(webhook_event);

            // Get the sender PSID
            let sender_psid = webhook_event.sender.id;
            console.log('Sender PSID: ' + sender_psid);

            GetUserDetails(sender_psid)
                .then((user) => {
                    if (webhook_event.message) {
                        handleMessage(sender_psid, webhook_event.message, user);
                    }
                });
        });

    } else {
        // Returns a '404 Not Found' if event is not from a page subscription
        res.sendStatus(404);
    }

});

function handleMessage(sender_psid, received_message, user) {

    let response;

    // Check if the message contains text
    if (received_message.text) {

        // Create the payload for a basic text message
        response = `Hi ${user.first_name}. CDS bot...You sent the message: "${received_message.text}".`;
    }

    // Sends the response message
    callSendAPI(sender_psid, response);
}

function handlePostback(sender_psid, received_postback) {
    let response;

    // Get the payload for the postback
    let payload = received_postback.payload;

    // Set the response based on the postback payload
    if (payload === 'yes') {
        response = { "text": "Thanks!" }
    } else if (payload === 'no') {
        response = { "text": "Oops, try sending another image." }
    }
    // Send the message to acknowledge the postback
    callSendAPI(sender_psid, response);
}

function callSendAPI(sender_psid, response) {
    // Construct the message body
    let request_body = {
        "recipient": {
            "id": sender_psid
        },
        "message": {
            text: response,
            quick_replies: [
                {
                    "content_type":"text",
                    "title":"Test",
                    "payload":"Test"
                },
                {
                    "content_type":"text",
                    "title":"Eman",
                    "payload":"Eman"
                },
                {
                    "content_type":"text",
                    "title":"Button",
                    "payload":"Button"
                }
            ],
            metadata: "Eman 123"
        }
    };

    // Send the HTTP request to the Messenger Platform
    request({
        "uri": config.fb.apiUrl,
        "qs": { "access_token": config.fb.token },
        "method": "POST",
        "json": request_body
    }, (err, res, body) => {
        if (!err) {
            console.log('message sent!');
            console.log("Message response: ", JSON.stringify(res));
        } else {
            console.error("Unable to send message:" + err);
        }
    });
}

// Adds support for GET requests to our webhook
router.get('/webhook', (req, res) => {

    console.log('Verify webhook...');
    // Your verify token. Should be a random string.
    let VERIFY_TOKEN = "manefacebook";

    // Parse the query params
    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];

    // Checks if a token and mode is in the query string of the request
    if (mode && token) {

        // Checks the mode and token sent is correct
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {

            // Responds with the challenge token from the request
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);

        } else {
            // Responds with '403 Forbidden' if verify tokens do not match
            res.sendStatus(403);
        }
    } else{
        return res.sendStatus(403);
    }
});

var GetUserDetails = function(userid) {
    console.log(`GetUserDetails: ${userid}`);
    return new Promise((resolve, reject) => {

        let options = {
            method: 'GET',
            uri: config.fb.getUserInfoApi + userid + "?access_token=" + config.fb.token,
            headers: {
                'Content-Type': 'application/json'
            },
            json: true
        };

        rp(options)
            .then((user) => {
                console.log("User details: ", JSON.stringify(user));
                return resolve(user);
            }).catch((err) => {
            console.log("Error getting user");
            return reject(err);
        })
    });
};

module.exports = router;
