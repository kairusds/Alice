const Discord = require('discord.js');
const { Db } = require('mongodb');
const config = require('../../config.json');

/**
 * @param {Discord.Guild} guild 
 * @param {Discord.User} user 
 * @param {Db} alicedb 
 */
module.exports.run = async (guild, user, alicedb) => {
    const banInfo = await guild.fetchBan(user).catch(console.error);
	const reason = banInfo.reason;
	const footer = config.avatar_list;
	const index = Math.floor(Math.random() * footer.length);
	const embed = new Discord.MessageEmbed()
		.setTitle("Ban executed")
		.setThumbnail(user.avatarURL({dynamic: true}))
		.setFooter("Alice Synthesis Thirty", footer[index])
		.setTimestamp(new Date())
		.addField(`Banned user: ${user.tag}`, `User ID: ${user.id}`)
		.addField("=========================", `Reason: ${reason}`);
		
	const loungeDb = alicedb.collection("loungelock");
	const channelDb = alicedb.collection("mutelogchannel");

	channelDb.findOne({guildID: guild.id}, (err, log) => {
		if (err) {
			console.log(err);
			console.log("Unable to retrieve lounge ban data");
		}
		if (!log) {
			return;
		}
		const channel = guild.channels.resolve(log.channelID);
		channel.send({embed: embed});
		loungeDb.findOne({discordid: user.id}, (err, res) => {
			if (err) {
				console.log(err);
				console.log("Unable to retrieve lounge ban data");
			}
			if (res) {
				return;
			}
	
			loungeDb.insertOne({discordid: user.id}, err => {
				if (err) {
					console.log(err);
					console.log("Unable to insert ban data");
				}
				channel.send("✅ **| Successfully locked user from lounge.**");
			});
		});
	});
};

module.exports.config = {
	name: "bannedUserLoungeBan"
};