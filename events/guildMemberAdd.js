module.exports.run = (client, member, alicedb) => {
    // Welcome message for international server
	client.subevents.get("joinmessage").run(member);

	// Lounge ban detection
	client.subevents.get("newmemberloungeban").run(client, member, alicedb)
}

module.exports.config = {
    name: "guildMemberAdd"
};