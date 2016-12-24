/**
 * Created by oleg on 12/16/16.
 */




const np = process.env.NODE_PATH = process.env.NODE_PATH + ':~/.suman/node_modules';

console.log(np);

const slack = require('slack');

const token = process.env.SLACK_TOKEN =
    'xoxp-108881304352-109674909365-118141079700-0f880d6a01ed1b16ffaf56fea280570e';

// slack.channels.list({
//
//     token: token
// }, function(err, data){
//
//     if (err) {
//         console.log(err.stack || err);
//     }
//     else {
//         console.log(data);
//     }
//
// });


slack.channels.history({

    token: token,
    channel: 'C3GMWAUMU',
    channelx: '#suman-all-commands'

}, (err, data) => {

    if (err) {
        console.log(err.stack || err);
    }
    else {
        console.log(data);
    }

});
