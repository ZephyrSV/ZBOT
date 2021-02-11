const { GoogleSpreadsheet } = require('google-spreadsheet');
const Discord = require('discord.js');
const replace = require('replace-in-file');

const { promisify } = require('util');
const client = new Discord.Client();
let Parser = require('rss-parser');
let parser = new Parser();
var List = require("collections/list");

class RssServer {
	constructor(ServerID, ChannelID, RoleID){
		this.ServerID = ServerID;
		this.ChannelID = ChannelID;
		this.RoleID = RoleID;
	}
	sameAs(other){
		if (this.ServerID != other.ServerID) return false;
		if (this.ChannelID != other.ChannelID) return false;
		if (this.RoleID != other.RoleID) return false;
		return true;
	}
}


async function accessSpreadsheetCaliber(message, caliber){
	const doc = new GoogleSpreadsheet('14JRGEOwJqbabtBJeu6w6NNbeXW_73nOh50FEcPpN_bc');
	await doc.useServiceAccountAuth(require('./client_secret.json'));
	await doc.getInfo(); 
	console.log(doc.title);
	const sheet = doc.sheetsByIndex[0];
	console.log(`Rows in sheet ${sheet.title} : ${sheet.rowCount}`);

	const rows = await sheet.getRows({
		limit: 121
	});
	
	reply = '';
	rows.forEach(row =>{
		//console.log(`Name = ${row.NAME} and caliber = ${caliber} => ${row.NAME.includes(caliber)}`)
		if (row.NAME.includes(caliber))
			reply = reply + ` * ${row.NAME}\n|${row.DMG}\t\t\t|**${row.PEN}**\t\t|${row.FRAGCHANCE}\t\t\t\t\t|**${row.ACCURACY}**\t\t\t\t\t|${row.RECOIL}\t\t|**${row.SPEED}**\t\t|${row.TRACER}\n`;
	});
	if (reply.length > 1) {
		reply = '\n -----------------------\n|Damage\t|**Pen**\t|Frag. chance\t|**Accuracy**\t|recoil\t|**speed**\t|tracer\n' + reply;
		message.reply(reply);
	}
	else message.reply(`I couldn\'t find any caliber containing \'${caliber}\'on my spreadsheet :/'`);
}

let mapOfMotherChannels = new Map(); // channel id ==> child name template
let setOfChildChannels = new Set()

let MapRSSServers = new Map();
let mapOfRSSUsers = new Map(); // UserId ==> mapOfRSSURLS
let m = '';
/*
let mapOfRSSURLS = new Map(); // URL ==> setOfRSSFilters
let setOfRSSFilters = new Set(); 
*/
client.on('ready', () => {
 	console.log(`Logged in as ${client.user.tag}!`);
	readFileToMap('MotherChannel.txt');
	readFileToSet('ChildChannels.txt')
	ReloadRSS('RSS subscription.txt')
	ReloadRSSServer('RSS servers config.txt')
	client.user.setPresence({
        status: "online",  //You can show online, idle....
        game: {
            name: "!z help",  //The message shown
         //   type: "WATCHING"
        }
    });
 });

client.on('message', async message => {
  if (message.content.includes('!z')){
  	switch  (message.content)
  	{
  		case '!z ping':
  			message.reply('pong!');
  			break;
  		case '!z help':
  		 	message.reply('commands : \n - !z addMotherChannel *Voice_channel_id* *namescheme* (requires admin)\n - !z removeMotherChannel *Voice_channel_id* (requires admin)'
		  		+ '\nclone channel commands : \n - !z close\n - !z open \n - !z rename \n - !z rss help');
  		 	break;
  		 case '!z rss help':
    		message.reply('This feature allows to get notified of new articles from your RSS feed (these are sent as DMs) \n' +
    			'- !z rss add *[url]* - subscribes you up to recieve messages of the specified RSS feed \n' +
    			'- !z rss remove *[url]* - unsubscribes you from the RSS feed \n' + 
    			'- !z rss list - lists all RSS feeds you are subscribed to \n' +
    			'- !z rss server add *[url] [txtChannelID] [roleID]* (requires admin) \n' +
    			'- !z rss server remove *[url] [txtChannelID] [roleID]* (requires admin)\n' +
    			'- !z rss server list [txtChannelID]\n');
    		break;
  		case '!z close':
  		 	if (message.member.voice.channel){
    			if (!setOfChildChannels.has(message.member.voice.channel.id))
    				message.reply('you can\'t do this in this channel');
    			else 
   					message.member.voice.channel.setUserLimit(message.member.voice.channel.members.size);
    		}
    		else message.reply('you aren\'t connected to any channel');
    		break;
    	case '!z open':
    		if (message.member.voice.channel){
	    		if (!setOfChildChannels.has(message.member.voice.channel.id))
	    			message.reply('you can\'t do this in this channel');
	    		else 
	   				message.member.voice.channel.setUserLimit(0);
    		}
    		else message.reply('you aren\'t connected to any channel');
    		break;
    	case '!z now':
    		message.reply(Date.now()/1000);
    		break;
    	case '!z test':
    		sendRSSFeed(message.author.id);
    		break;
    	case '!z test server':
    		console.log("testing server rss \n");
    		console.log('Schedule RSSserver');
			MapRSSServers.forEach((list, link)=>{
				console.log(link);
			sendRSSFeedServer(list, link); 
			});
			break;
    	case '!z rss list':
    		if (mapOfRSSUsers.has(message.author.id)) {
    				m ='';
    				mapOfRSSUsers.get(message.author.id).forEach(listURLS);
    				message.reply(m);
       		}
    		else message.reply('You aren\'t subscribed to any feed!')
    		break;
  	}
    if (message.content.startsWith('!z caliber')){
    	if (message.content === ('!z caliber'))
    		message.reply('correct usage : !z caliber *Search_Word*');
    	else {
	    	caliber = '!z caliber ';
	    	caliber = message.content.substring(caliber.length);
	    	accessSpreadsheetCaliber(message, caliber);
    	}
    }
    //RSS stuff
    else if (message.content.startsWith('!z rss add')){
    	url = message.content.substring('!z rss add '.length);
    	if (url.length > 0){
    		let setOfRSSFilters = new Set();
    		if (mapOfRSSUsers.has(message.author.id)) {
    			mapOfRSSUsers.get(message.author.id).set(url, setOfRSSFilters)
    		} 
    		else {
	    		let mapOfRSSURLS = new Map();
	    		mapOfRSSURLS.set(url, setOfRSSFilters);
	    		mapOfRSSUsers.set(message.author.id, mapOfRSSURLS);
    		}
    		saveToFile('RSS subscription.txt', message.author.id + ' ' + url+ '\n');
    		message.reply('Success!');
    	}
    	else message.reply('incorrect syntax : missing url \n correct syntax : !z rss add *[url]*')
    }
    else if (message.content.startsWith('!z rss remove')) {
    	url = message.content.substring('!z rss remove '.length);
    	if (url.length > 0){
    		 if (mapOfRSSUsers.has(message.author.id)) {
    		 	if (mapOfRSSUsers.get(message.author.id).has(url)) {
    		 		m = ''; 
    		 		if (mapOfRSSUsers.get(message.author.id).get(url).length >0)
    		 			mapOfRSSUsers.get(message.author.id).get(url).forEach(mlistfilters);
    		 		mapOfRSSUsers.get(message.author.id).delete(url);
    		 		console.log(message.author.id + ' ' + url + m);
	    		 	removeFromFile('RSS subscription.txt', message.author.id + ' ' + url + m+'\n');
	    		 	message.reply('Success!')
    		 	}
    		 	else message.reply('You weren\'t subscribed to this feed in the first place')
    		 }
    		 else message.reply('You aren\'t subscribed to any RSS feeds')
    	}
    	else message.reply('incorrect syntax : missing url \n correct syntax : !z rss remove *[url]*')
    }
	else if (message.content.startsWith('!z rss filter add')){
		words = message.content.split(' ');
		if (words.length >= 6){
			url = words[4]; 
			filter = message.content.substring('!z rss filter add  '.length+url.length);
			filters = filter.split(' ');
			for (i = 0; i < filters.length; ++i){
				mapOfRSSUsers.get(message.author.id).get(url).add(filters[i]);
				console.log(`added filter \'${filters[i]} \'`); 
			}
			const results = replace.sync({
				files: 'RSS subscription.txt',
				from: message.author.id + ' ' + url,
				to: message.author.id + ' ' + url + ' ' + filter,
			});
			console.log(results);
			message.reply('Success!');

		}
		else {
			message.reply('incorrect syntax : missing arguments \n correct syntax : !z rss filter add *[url]* *[filters]*')
		}
	}
	else if (message.content.startsWith('!z rss filter list')){
		url = message.content.substring('!z rss filter list '.length);
		if (url < 1) message.reply('incorrect syntax : missing arguments \n correct syntax : !z rss filter list *[url]*')
		else if (mapOfRSSUsers.has(message.author.id) && mapOfRSSUsers.get(message.author.id).has(url)) {
			m = 'filters : ';
			mapOfRSSUsers.get(message.author.id).get(url).forEach((filter)=>{
				m = m + filter + ' ';
			})
			message.reply(m);
		}
		else {
			message.reply('You aren\'t subscribed to this feed');
		}
	}
	else if (message.content.startsWith('!z rss filter remove')){
		words =message.content.split(' ');
		if (words.length >= 6){
			url = words[4]; 
			filter = words[5];
			if (mapOfRSSUsers.has(message.author.id)){
				if (mapOfRSSUsers.get(message.author.id).has(url)){
					if (mapOfRSSUsers.get(message.author.id).get(url).has(filter)){
						const readline = require('readline');
						const fs = require('fs');

						// create instance of readline
						// each instance is associated with single input stream
						let rl = readline.createInterface({
						    input: fs.createReadStream('RSS subscription.txt')
						});
						// event is emitted after each line
						rl.on('line', function(line) {
							if (line.startsWith(message.author.id + ' ' +  url) && line.includes(filter)){
								const results = replace.sync({
									files: 'RSS subscription.txt',
									from: line,
									to: line.replace(' ' + filter, ''),
								});
								console.log(results);
								mapOfRSSUsers.get(message.author.id).get(url).delete(filter);
							}
						});
						message.reply('Success!');
					}
					else message.reply('This filter wasn\'t associated with that RSS stream');
				}
				else message.reply('You aren\'t subscribed to that RSS stream');
			}
			else message.reply('You are\'t subscribed to any RSS stream');
			
		}
		else {
			message.reply('incorrect syntax : missing arguments \n correct syntax : !z rss filter remove *[url]* *[filter]*')
		}
	}
	//clone channel stuff
    else if (message.content.startsWith('!z rename ')){
    	if (message.member.voice.channel){
    		if (setOfChildChannels.has(message.member.voice.channel.id)){
    			words = message.content.split(' ');
    			if (words.length >= 3) {
					new_name = '!z rename ';
					new_name = message.content.substring(new_name.length);
					message.member.voice.channel.setName(new_name);
					console.log(`rename request to \'${new_name}\'`);
					message.reply(`Success! I set your channel name to : ${new_name}`);
				}
    		}
    		else 
   				message.reply('you can\'t do this in this channel');


    	}
    	else message.reply('you aren\'t connected to any channel');
    }
    else if (message.content.startsWith('!z addMotherChannel')){
    	if (message.member.hasPermission(8)){ // CHECKS IF ADMIN
	        words = message.content.split(' ');
	        if (words.length >= 4) {
	        	if (message.guild.channels.cache.has(words[2])){
					childname = '!z addMotherChannel '+ words[2] + ' ';
					childname = message.content.substring(childname.length);
			        	mapOfMotherChannels.set(words[2], childname);
			          saveToFile('MotherChannel.txt', words[2] + ' ' + childname + '\n');
			        	message.reply('added '+ words[2] + ' - ' + childname);
				}
				else message.reply('This channel id doesn\'t exist in this server');
			}
			else message.reply('not enough info');
      	}
      	else message.reply('you don\'t have the required permissions');
    }
    else if (message.content.startsWith('!z removeMotherChannel')){
    	if (message.member.hasPermission(8)){ // CHECKS IF ADMIN
    		words = message.content.split(' ');
    		if (words.length >= 3) {
				if (mapOfMotherChannels.has(words[2])){
					removeFromFile('MotherChannel.txt', words[2] + ' ' + mapOfMotherChannels.get(words[2]) + '\n')
					mapOfMotherChannels.delete(words[2]);
					message.reply('Success!');
				}
				else message.reply('this channel wasn\'t a mother channel in the first place');
			}
			else message.reply('not enough info');
    	}
    	else message.reply('you don\'t have the required permissions');
    }
 	else if (message.content.startsWith('!z rss server add')) {
	  	if (message.member.hasPermission(8)){ // CHECKS IF ADMIN
	  		words = message.content.split(' ');
			if (words.length >= 7) {
				obj = new RssServer(message.guild.id, words[5], words[6]);
				if (! MapRSSServers.has(words[4]))
					MapRSSServers.set(words[4], new List());
				if (!MapRSSServers.get(words[4]).has(obj, function (a, b) {
    				if (a.ServerID != b.ServerID) return false;
					if (a.ChannelID != b.ChannelID) return false;
					return (a.RoleID == b.RoleID);
					})
					){
					MapRSSServers.get(words[4]).push(obj);
					saveToFile('RSS servers config.txt', words[4] + ' ' + message.guild.id + ' ' + words[5] + ' ' + words[6] + '\n');
					message.reply('Success!');
				}
				else {
					message.reply('this feed config already exists');
				}
				
			}
			else message.reply('incorrect syntax, refer to !z help rss');
	  	}
	  	else message.reply('you don\'t have the required permissions');
  	}
  	else if (message.content.startsWith('!z rss server list')) {
	  	if (message.member.hasPermission(8)){ // CHECKS IF ADMIN
	  		MapRSSServers.forEach((list, url) => {
	  			list.forEach(obj => {
	  				if (obj.ServerID == message.guild.id)
	  					message.reply(`- ${url} <@&${obj.RoleID}> in ${message.guild.channels.cache.get(obj.ChannelID)}`);
	  			})
	  		});

	  	}
	  	else message.reply('you don\'t have the required permissions');
  	}
  	else if (message.content.startsWith('!z rss server remove')) {
	  	if (message.member.hasPermission(8)){ // CHECKS IF ADMIN
	  		words = message.content.split(' ');
			if (words.length >= 7) {
				obj = new RssServer(message.guild.id, words[5], words[6]);
				newobj = new RssServer(message.guild.id, words[5], words[6]);
				if (obj.sameAs(newobj)) message.reply("nice");
				else message.reply("not nice");
				if (MapRSSServers.has(words[4])){
					found = false;
					MapRSSServers.get(words[4]).forEach(obj1=>{
						if(obj1.sameAs(obj)){
							MapRSSServers.get(words[4]).delete(obj1);
							found  = true;
							removeFromFile('RSS servers config.txt', words[4] + ' ' + message.guild.id + ' ' + words[5] + ' ' + words[6] + '\n');
							message.reply("done");
						}
						if (!found) 
							message.reply("This is not in my database");
					});
				}
				else
					message.reply("This is not in my database");
			}
			else message.reply('incorrect syntax, refer to !z help rss');
	  	}
	  	else message.reply('you don\'t have the required permissions');
  	}
 }
});


var schedule = require('node-schedule');
 
var j = schedule.scheduleJob('0 * * * *', function(){
	console.log('Schedule RSS');
  mapOfRSSUsers.forEach((RSS,userid)=>{
  	sendRSSFeed(userid); 
  })
});

var jserver = schedule.scheduleJob('* * * * *', function(){
	console.log('Schedule RSSserver');
  MapRSSServers.forEach((list, link)=>{
  	sendRSSFeedServer(list, link); 
  })
});


client.on('voiceStateUpdate', (oldState, newState) => {
	//setting key variables
	let newUserChannel = newState.channel
  	let oldUserChannel = oldState.channel
	//Seeing what caused the code to be called
  	if(newUserChannel === null){
  		console.log(`user left ${oldUserChannel}`);
  		//stuff that gets done if a user leaves a voice channel////////////////////////////////////////////
  		if (setOfChildChannels.has(oldUserChannel.id))
  			deleteEmptyClone(oldUserChannel);



  } else if(oldUserChannel !== newUserChannel){
  	console.log(`user joined ${newUserChannel.id}`);
  	//stuff that gets done if a user joins or switches voice channels/////////////////////////////////////////////
    if (mapOfMotherChannels.has(newUserChannel.id)){
      CloneChannelAndTransfer(newUserChannel,mapOfMotherChannels.get(newUserChannel.id),newUserChannel.userLimit,newState);
    }
    if (oldUserChannel !== null && setOfChildChannels.has(oldUserChannel.id))
  		deleteEmptyClone( oldUserChannel);
  }

})

async function sendRSSFeedServer(list, link){
		TimeNow = Date.now();
		console.log(TimeNow);
		TimeNow = Math.floor(TimeNow/60000); //60000
		TimeNow *=60000;
		let feed = await parser.parseURL(link);
		console.log(feed.title);
		console.log("hey");
		console.log(list.length);
		list.forEach((obj)=> {
			guild = client.guilds.cache.get(obj.ServerID);
			console.log(guild.name);
			feed.items.forEach(item => {
				Publication = new Date(item.pubDate);
				if (Publication > TimeNow - 60000) {
					console.log(item.title  + '\n' + Publication + '\n' + Date.now()); 
					guild.channels.cache.get(obj.ChannelID).send(`<@&${obj.RoleID}> `+ item.title  + '\n' + item.pubDate + '\n' + item.link); 
				}
			});
		});
}

function sendRSSFeed(id){
	mapOfRSSURLS = mapOfRSSUsers.get(id);
	author = client.users.resolve(id);
	TimeNow = Date.now();
	console.log(TimeNow);
	TimeNow = Math.floor(TimeNow/3600000);
	console.log(TimeNow);
	TimeNow *=3600000;
	console.log(TimeNow);
	mapOfRSSURLS.forEach((filters,url)=>{ 
		(async () => {
			console.log('Date.now is :' + Date.now());
		  	let feed = await parser.parseURL(url);
		  	console.log(feed.title);
		 	console.log(filters.size);
		 	if (filters.size > 0){
		 		feed.items.forEach(item => {
		 			allowed = false;
		 			filters.forEach((value)=>{
			 			if (item.title.includes(value))
			    			allowed = true;
					});
					if (allowed){
						if (Publication > TimeNow - 3600000) {
				 			console.log(item.title  + '\n' + Publication + '\n' + Date.now()); 
				 			author.send(item.title  + '\n' + item.pubDate + '\n' + item.link); 
			 			}
					}
			 	});
		 	}
		 	else {
		 		feed.items.forEach(item => {
		 			Publication = new Date(item.pubDate);
		 			if (Publication > TimeNow - 3600000) {
			 			console.log(item.title  + '\n' + Publication + '\n' + Date.now()); 
			 			author.send(item.title  + '\n' + item.pubDate + '\n' + item.link); 
			 		}
		 		});
		 	}
		})();
	})
}

function listURLS(value, key){
	m = m +'- '+ key+ '\n';
}

function mlistfilters(value, key){
	m = m + ' ' + value;
}

function ReloadRSSServer(file) {
	const readline = require('readline');
	const fs = require('fs');

	// create instance of readline
	// each instance is associated with single input stream
	let rl = readline.createInterface({
	    input: fs.createReadStream(file)
	});

	// event is emitted after each line
	rl.on('line', function(line) {
		words = line.split(' ');
		let obj = new RssServer(words[1], words[2], words[3]);
		if (! MapRSSServers.has(words[0]))
			MapRSSServers.set(words[0], new List());
		if (!MapRSSServers.get(words[0]).has(obj, function (a, b) {
			if (a.ServerID != b.ServerID) return false;
			if (a.ChannelID != b.ChannelID) return false;
			return (a.RoleID == b.RoleID);
			}))
			{
				MapRSSServers.get(words[0]).push(obj);
			}
	});
}

function ReloadRSS(file) {
	const readline = require('readline');
	const fs = require('fs');

	// create instance of readline
	// each instance is associated with single input stream
	let rl = readline.createInterface({
	    input: fs.createReadStream(file)
	});

	// event is emitted after each line
	rl.on('line', function(line) {
		words = line.split(' ');
		let setOfRSSFilters = new Set();
		for (i = 2; i < words.length; ++i){
			setOfRSSFilters.add(words[i]);
			console.log(words[i]);
		}
		console.log(words[0] + ' - ' + words[1]);
		if (mapOfRSSUsers.has(words[0])){
			mapOfRSSUsers.get(words[0]).set(words[1], setOfRSSFilters)
		} else { 
			let mapOfRSSURLS = new Map();
			mapOfRSSURLS.set(words[1], setOfRSSFilters);
			mapOfRSSUsers.set(words[0], mapOfRSSURLS);
		}
	});
}

function saveToFile(file, line) {
  var fs = require('fs')
  fs.appendFile(file, line, function (err) {
    if (err) {
      console.log(`error ${err}!`);
    }
  });
}



function removeFromFile(file, line){
	const results = replace.sync({
	  files: file,
	  from: line,
	  to: '',
	});
	console.log(results);
}

function readFileToMap(file) {
	const readline = require('readline');
	const fs = require('fs');

	// create instance of readline
	// each instance is associated with single input stream
	let rl = readline.createInterface({
	    input: fs.createReadStream(file)
	});

	// event is emitted after each line
	rl.on('line', function(line) {
		words = line.split(' ');
		childname = words[0] + ' ';
		mapOfMotherChannels.set(words[0], line.substring(childname.length));
	});
}

function readFileToSet(file) {
	const readline = require('readline');
	const fs = require('fs');

	// create instance of readline
	// each instance is associated with single input stream
	let rl = readline.createInterface({
	    input: fs.createReadStream(file)
	});

	// event is emitted after each line
	rl.on('line', function(line) {
		setOfChildChannels.add(line);
	});
}



//Make and transfers a user inside a clone voice channel
function CloneChannelAndTransfer( channelToClone, nameScheme, vUserLimit, VoiceState) {
/*
	server : client.guilds.get('Server ID HERE'); 			 					channeltoClone : the channel to clone
	nameScheme : 0 for 'parent name - j', else 'namescheme - j '				 vUserLimit : 1-100 or -1 for the same as the parent channel
	VoiceState : the new VoiceState
*/

	//Counting how many clones already exist
	let serverArray = channelToClone.guild.channels.cache.array();
	var j = 1;
  	for (var i = 0; i < channelToClone.guild.channels.cache.array().length; i++) {
  			if (((serverArray[i].name === `${channelToClone.name} #${j}`) || (serverArray[i].name === `${nameScheme} #${j}`))&& (serverArray[i].parent === channelToClone.parent)) {
  				j++;
  			}
  	}
  	//setting the clone's name
	if (nameScheme ==='0' )
		var new_name  = `${channelToClone.name} #${j}`;
	else
  		var new_name  = `${nameScheme} #${j}`;

  	console.log('i got to here');
	channelToClone.clone().then(CloneChannel =>{//making a clone channel that inherits the parent's permissions 
		setOfChildChannels.add(CloneChannel.id)
		saveToFile('ChildChannels.txt', CloneChannel.id + '\n')
	  	CloneChannel.setParent(`${channelToClone.parentID}`)//setting the channel's category 
		CloneChannel.edit({ name : new_name});
		VoiceState.setChannel(CloneChannel);//moving the user into the clone channel
  	})
}

function deleteEmptyClone(channel) {
  	
	if (channel.members.size === 0) {
		setOfChildChannels.delete(channel.id);
		removeFromFile('ChildChannels.txt', channel.id);
		channel.delete();
	}
}

client.login('This was censored for obvious reasons');