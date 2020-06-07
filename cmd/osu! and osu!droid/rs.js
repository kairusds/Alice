const Discord = require('discord.js');
const config = require('../../config.json');
const osudroid = require('osu-droid');

function rankEmote(input) {
	if (!input) return;
	switch (input) {
		case 'A': return '611559473236148265';
		case 'B': return '611559473169039413';
		case 'C': return '611559473328422942';
		case 'D': return '611559473122639884';
		case 'S': return '611559473294606336';
		case 'X': return '611559473492000769';
		case 'SH': return '611559473361846274';
		case 'XH': return '611559473479155713';
		default : return
	}
}

module.exports.run = (client, message, args, maindb, alicedb, current_map) => {
    let ufind = message.author.id;
    if (args[0]) ufind = args[0].replace("<@!", "").replace("<@", "").replace(">", "");
    let binddb = maindb.collection("userbind");
    let query = {discordid: ufind};
    binddb.findOne(query, async (err, res) => {
        if (err) {
            console.log(err);
            return message.channel.send("❎ **| I'm sorry, I'm having trouble receiving response from database. Please try again!**")
        }
        if (!res) return message.channel.send("❎ **| I'm sorry, the account is not binded. He/she/you need to use `a!userbind <uid>` first. To get uid, use `a!profilesearch <username>`.**");
        let uid = res.uid;
        const player = await new osudroid.PlayerInfo().get({uid: uid});
        if (player.error) {
			if (args[0]) message.channel.send("❎ **| I'm sorry, I couldn't fetch the user's profile! Perhaps osu!droid server is down?**");
			else message.channel.send("❎ **| I'm sorry, I couldn't fetch your profile! Perhaps osu!droid server is down?**");
			return
		}
		if (!player.name) {
			if (args[0]) message.channel.send("❎ **| I'm sorry, I couldn't find the user's profile!**");
			else message.channel.send("❎ **| I'm sorry, I couldn't find your profile!**");
			return
		}
        if (player.recent_plays.length === 0) return message.channel.send("❎ **| I'm sorry, this player hasn't submitted any play!**");

        let name = player.name;
        let play = player.recent_plays[0];
        let title = `${play.title} +${play.mods ? play.mods : "No Mod"}`;
        let score = play.score.toLocaleString();
        let combo = play.combo;
        let rank = client.emojis.cache.get(rankEmote(play.rank));
        let ptime = play.date;
        let acc = play.accuracy;
        let miss = play.miss;
        let mod = play.mods;
        let hash = play.hash;

        let rolecheck;
        try {
            rolecheck = message.member.roles.highest.hexColor
        } catch (e) {
            rolecheck = 8311585
        }
        const footer = config.avatar_list;
        const index = Math.floor(Math.random() * footer.length);
        const embed = new Discord.MessageEmbed()
            .setAuthor(title, player.avatarURL)
            .setColor(rolecheck)
            .setFooter(`Achieved on ${ptime.toUTCString()} | Alice Synthesis Thirty`, footer[index]);

        let entry = [message.channel.id, hash];
        let map_index = current_map.findIndex(map => map[0] === message.channel.id);
        if (map_index === -1) current_map.push(entry);
        else current_map[map_index][1] = hash;

        const mapinfo = await new osudroid.MapInfo().get({hash: hash});
        let n300, n100, n50;
        if (message.isOwner) {
            const score_data = await play.getFromHash();
            const data = await new osudroid.ReplayAnalyzer({score_id: score_data.score_id}).analyze();
            if (data.odr) {
                n300 = data.data.hit300;
                n100 = data.data.hit100;
                n50 = data.data.hit50
            }
        }
        
        if (mapinfo.error || !mapinfo.title || !mapinfo.objects || !mapinfo.osu_file) {
            embed.setDescription(`▸ ${rank} ▸ ${acc}%\n▸ ${score} ▸ ${combo}x ▸ ${n300 ? `[${n300}/${n100}/${n50}/${miss}]` : `${miss} miss(es)`}`);
            return message.channel.send(`✅ **| Most recent play for ${name}:**`, {embed: embed})
        }
        const star = new osudroid.MapStars().calculate({file: mapinfo.osu_file, mods: mod});
        const starsline = parseFloat(star.droid_stars.total.toFixed(2));
        const pcstarsline = parseFloat(star.pc_stars.total.toFixed(2));

        title = `${mapinfo.full_title} +${play.mods ? play.mods : "No Mod"} [${starsline}★ | ${pcstarsline}★]`;
        embed.setAuthor(title, player.avatarURL, `https://osu.ppy.sh/b/${mapinfo.beatmap_id}`)
            .setThumbnail(`https://b.ppy.sh/thumb/${mapinfo.beatmapset_id}l.jpg`)
            .setImage(`https://assets.ppy.sh/beatmaps/${mapinfo.beatmapset_id}/covers/cover.jpg`);

        const npp = osudroid.ppv2({
            stars: star.droid_stars,
            combo: combo,
            acc_percent: acc,
            miss: miss,
            mode: "droid"
        });

        const pcpp = osudroid.ppv2({
            stars: star.pc_stars,
            combo: combo,
            acc_percent: acc,
            miss: miss,
            mode: "osu"
        });

        const ppline = parseFloat(npp.total.toFixed(2));
        const pcppline = parseFloat(pcpp.total.toFixed(2));

        if (miss > 0 || combo < mapinfo.max_combo) {
            const fc_acc = new osudroid.Accuracy({
                n300: (n300 ? n300 : npp.computed_accuracy.n300) + miss,
                n100: n100 ? n100 : npp.computed_accuracy.n100,
                n50 : n50 ? n50 : npp.computed_accuracy.n50,
                nmiss: 0,
                nobjects: mapinfo.objects
            }).value() * 100;

            const fc_dpp = osudroid.ppv2({
                stars: star.droid_stars,
                combo: mapinfo.max_combo,
                acc_percent: fc_acc,
                miss: 0,
                mode: "droid"
            });

            const fc_pp = osudroid.ppv2({
                stars: star.pc_stars,
                combo: mapinfo.max_combo,
                acc_percent: fc_acc,
                miss: 0,
                mode: "osu"
            });

            const dline = parseFloat(fc_dpp.total.toFixed(2));
            const pline = parseFloat(fc_pp.total.toFixed(2));

            embed.setDescription(`▸ ${rank} ▸ **${ppline}DPP** | **${pcppline}PP** (${dline}DPP, ${pline}PP for ${fc_acc.toFixed(2)}% FC) ▸ ${acc}%\n▸ ${score} ▸ ${combo}x/${mapinfo.max_combo}x ▸ ${n300 ? `[${n300}/${n100}/${n50}/${miss}]` : `${miss} miss(es)`}`);
        } else embed.setDescription(`▸ ${rank} ▸ **${ppline}DPP** | **${pcppline}PP** ▸ ${acc}%\n▸ ${score} ▸ ${combo}x/${mapinfo.max_combo}x ▸ ${n300 ? `[${n300}/${n100}/${n50}/${miss}]` : `${miss} miss(es)`}`);

        message.channel.send(`✅ **| Most recent play for ${name}:**`, {embed: embed})
    })
};

module.exports.config = {
    name: "rs",
    description: "Retrieves a user's most recent play.",
    usage: "rs [user]",
    detail: "`user`: The user to retrieve [UserResolvable (mention or user ID)]",
    permission: "None"
};
