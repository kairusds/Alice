module.exports.run = (client, message, args, maindb) => {
	if (message.member == null || message.member.roles == null || !message.member.roles.cache.get("325613708673810433")) return message.channel.send("❎ **| You don't have enough permission to use this.**");
	let uid = args[0];
	if (isNaN(parseInt(uid))) return message.channel.send("❎ **| I'm sorry, that uid is invalid!**");
	let trackdb = maindb.collection("tracking");
	let query = {uid: uid};
	trackdb.find(query).toArray(function(err, res) {
		if (err) {
			console.log(err);
			return message.channel.send("❎ **| I'm sorry, I'm having trouble receiving response from database. Please try again!**")
		}
		if (res[0]) return message.channel.send("❎ **| I'm sorry, this uid is already being tracked!**");
		trackdb.insertOne(query, function(err) {
			if (err) {
				console.log(err);
				return message.channel.send("❎ **| I'm sorry, I'm having trouble receiving response from database. Please try again!**")
			}
			message.channel.send(`✅ **| Now tracking uid ${uid}.**`);
		})
	})
};

module.exports.config = {
	name: "addtrack",
	description: "Adds a uid into tracking list.",
	usage: "addtrack <uid>",
	detail: "`uid`: The uid to track [Integer]",
	permission: "Specific person (<@132783516176875520> and <@386742340968120321>)"
};
