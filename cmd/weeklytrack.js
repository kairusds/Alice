let Discord = require('discord.js');
let https = require('https');
let apikey = process.env.OSU_API_KEY;
let config = require('../config.json');

function mapstatus(status) {
	switch (status) {
		case -2: return "Graveyard";
		case -1: return "WIP";
		case 0: return "Pending";
		case 1: return "Ranked";
		case 2: return "Approved";
		case 3: return "Qualified";
		case 4: return "Loved";
		default: return "Unspecified"
	}
}

function mapstatusread(status) {
	switch (status) {
		case -2: return 16711711;
		case -1: return 9442302;
		case 0: return 16312092;
		case 1: return 2483712;
		case 2: return 16741376;
		case 3: return 5301186;
		case 4: return 16711796;
		default: return 0
	}
}

function time(second) {
	return [Math.floor(second / 60), Math.ceil(second - Math.floor(second / 60) * 60).toString().padStart(2, "0")].join(":")
}

module.exports.run = (client, message = "", args = {}, maindb, alicedb) => {
    let dailydb = alicedb.collection("dailychallenge");
    let query = {status: "w-ongoing"};
    dailydb.find(query).toArray((err, dailyres) => {
        if (err) return console.log("Cannot access database");
        if (!dailyres[0]) return client.fetchUser("386742340968120321").then(user => user.send("Hey, I need you to start a daily challenge now!")).catch(console.error);
        let timelimit = dailyres[0].timelimit;
        if (Math.floor(Date.now() / 1000) - timelimit < 0) return;
        let pass = dailyres[0].pass;
        let bonus = dailyres[0].bonus;
        let constrain = dailyres[0].constrain.toUpperCase();
        let beatmapid = dailyres[0].beatmapid;
        let options = new URL(`https://osu.ppy.sh/api/get_beatmaps?k=${apikey}&b=${beatmapid}`);
        let content = '';
        let req = https.get(options, res => {
            res.setEncoding("utf8");
            res.on("data", chunk => {
                content += chunk
            });
            res.on("end", () => {
                let obj;
                try {
                    obj = JSON.parse(content)
                } catch (e) {
                    return console.log("JSON error")
                }
                if (!obj[0]) return console.log("Map not found");
                let mapinfo = obj[0];
                let title = `${mapinfo.artist} - ${mapinfo.title} (${mapinfo.creator}) [${mapinfo.version}]`;
                let hitlength = mapinfo.hit_length;
                let maplength = mapinfo.total_length;

                let pass_string = '';
                let bonus_string = '';
                switch (pass[0]) {
                    case "score": {
                        pass_string = `Score V1 above **${pass[1].toLocaleString()}**`;
                        break
                    }
                    case "acc": {
                        pass_string = `Accuracy above **${pass[1]}%**`;
                        break
                    }
                    case "scorev2": {
                        pass_string = `Score V2 above **${pass[1].toLocaleString()}**`;
                        break
                    }
                    case "miss": {
                        pass_string = pass[1] == 0?"No misses":`Miss count below **${pass[1]}**`;
                        break
                    }
                    case "combo": {
                        pass_string = `Combo above **${pass[1]}**`;
                        break
                    }
                    case "rank": {
                        pass_string = `**${pass[1].toUpperCase()}** rank or above`;
                        break
                    }
                    default: pass_string = 'No pass condition'
                }
                switch (bonus[0]) {
                    case "score": {
                        bonus_string += `Score V1 above **${bonus[1].toLocaleString()}** (__${bonus[2]}__ ${bonus[2] == 1?"point":"points"})`;
                        break
                    }
                    case "acc": {
                        bonus_string += `Accuracy above **${parseFloat(bonus[1]).toFixed(2)}%** (__${bonus[2]}__ ${bonus[2] == 1?"point":"points"})`;
                        break
                    }
                    case "scorev2": {
                        bonus_string += `Score V2 above **${bonus[1].toLocaleString()}** (__${bonus[3]}__ ${bonus[3] == 1?"point":"points"})`;
                        break
                    }
                    case "miss": {
                        bonus_string += `${bonus[1] == 0?"No misses":`Miss count below **${bonus[1]}**`} (__${bonus[2]}__ ${bonus[2] == 1?"point":"points"})`;
                        break
                    }
                    case "mod": {
                        bonus_string += `Usage of **${bonus[1].toUpperCase()}** mod (__${bonus[2]}__ ${bonus[2] == 1?"point":"points"})`;
                        break
                    }
                    case "combo": {
                        bonus_string += `Combo above **${bonus[1]}** (__${bonus[2]}__ ${bonus[2] == 1?"point":"points"})`;
                        break
                    }
                    case "rank": {
                        bonus_string += `**${bonus[1].toUpperCase()}** rank or above (__${bonus[2]}__ ${bonus[2] == 1?"point":"points"})`;
                        break
                    }
                    default: bonus_string += "No bonuses available"
                }
                let constrain_string = constrain == ''?"Any mod is allowed":`**${constrain}** only`;

                let footer = config.avatar_list;
                const index = Math.floor(Math.random() * (footer.length - 1) + 1);
                let embed = new Discord.RichEmbed()
                    .setAuthor("osu!droid Weekly Bounty Challenge", "https://image.frl/p/beyefgeq5m7tobjg.jpg")
                    .setColor(mapstatusread(parseInt(mapinfo.approved)))
                    .setFooter(`Alice Synthesis Thirty | Challenge ID: ${dailyres[0].challengeid} | Time left: ${timeconvert(timelimit)}`, footer[index])
                    .setThumbnail(`https://b.ppy.sh/thumb/${mapinfo.beatmapset_id}.jpg`)
                    .setDescription(`**[${title}](https://osu.ppy.sh/b/${beatmapid})**\nDownload: [Google Drive](${dailyres[0].link[0]}) - [OneDrive](${dailyres[0].link[1]})`)
                    .addField(`Map Info`, `CS: ${mapinfo.diff_size} - AR: ${mapinfo.diff_approach} - OD: ${mapinfo.diff_overall} - HP: ${mapinfo.diff_drain}\nBPM: ${mapinfo.bpm} - Length: ${time(hitlength)}/${time(maplength)} - Max Combo: ${mapinfo.max_combo}x\nLast Update: ${mapinfo.last_update} | ${mapstatus(parseInt(mapinfo.approved))}\n❤️ ${mapinfo.favourite_count} - ▶️ ${mapinfo.playcount}`)
                    .addField(`Star Rating: ${"★".repeat(Math.min(10, parseInt(mapinfo.difficultyrating)))} ${parseFloat(mapinfo.difficultyrating).toFixed(2)}`, `**${dailyres[0].points == 1?"Point":"Points"}**: ${dailyres[0].points} ${dailyres[0].points == 1?"point":"points"}\n**Pass Condition**: ${pass_string}\n**Constrain**: ${constrain_string}\n\n**Bonus**\n${bonus_string}`);

                client.channels.get("669221772083724318").send("✅ **| Weekly challenge ended!**", {embed: embed});

                let updateVal = {
                    $set: {
                        status: "finished"
                    }
                };
                dailydb.updateOne(query, updateVal, err => {
                    if (err) return console.log("Cannot update challenge status");
                    console.log("Challenge status updated")
                });
                let nextchallenge = "w" + (parseInt(dailyres[0].challengeid.match(/(\d+)$/)[0]) + 1);
                client.commands.get("dailyautostart").run(client, message, [nextchallenge], maindb, alicedb);
            })
        });
        req.end()
    })
};

module.exports.config = {
	description: "Used to track weekly challenge time limit.",
	usage: "None",
	detail: "None",
	permission: "None"
};

module.exports.help = {
	name: "weeklytrack"
};