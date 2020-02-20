const Discord = require('discord.js');
const https = require('https');
const apikey = process.env.OSU_API_KEY;
const config = require('../config.json');
const osudroid = require('../modules/osu!droid');

module.exports.run = (client, message, args, mapset = false) => {
	let beatmapid;
	let combo;
	let acc = 100;
	let missc = 0;
	let mod = '';
	let ndetail = false;
	let pcdetail = false;
	if (!args[0]) return;
	let a = args[0].split("/");
	beatmapid = a[a.length-1];
	for (let i = 1; i < args.length; i++) {
		if (args[i].endsWith("%")) acc = parseFloat(args[i]);
		if (args[i].endsWith("m")) missc = parseInt(args[i]);
		if (args[i].endsWith("x")) combo = parseInt(args[i]);
		if (args[i].startsWith("+")) mod = args[i].replace("+", "").toUpperCase();
		if (args[i].startsWith("-d")) ndetail = true;
		if (args[i].startsWith("-p")) pcdetail = true
	}
	if (mapset) {
		let options = new URL(`https://osu.ppy.sh/api/get_beatmaps?k=${apikey}&s=${beatmapid}`);
		let content = '';
		let req = https.get(options, res => {
			res.setEncoding("utf8");
			res.setTimeout(10000);
			res.on("data", chunk => {
				content += chunk
			});
			res.on("error", err => {
				console.log("Error retrieving map info");
				return console.log(err)
			});
			res.on("end", () => {
				let obj;
				try {
					obj = JSON.parse(content)
				} catch (e) {
					console.log("Error retrieving map info");
					return console.log(e)
				}
				if (!obj[0]) return console.log("Map not found");
				let i = 0;
				let map_entries = [];
				let total_map = obj.length;
				obj.sort((a, b) => {return parseFloat(b.difficultyrating) - parseFloat(a.difficultyrating)});
				while (obj.length > 3) obj.pop();

				obj.forEach(map => {
					new osudroid.MapInfo().get({beatmap_id: map.beatmap_id}, mapinfo => {
						i++;
						let max_score = mapinfo.max_score(mod);
						let star = new osudroid.MapStars().calculate({file: mapinfo.osu_file, mods: mod});
						let starsline = parseFloat(star.droid_stars.toString().split(" ")[0]);
						let pcstarsline = parseFloat(star.pc_stars.toString().split(" ")[0]);
						let npp = osudroid.ppv2({
							stars: star.droid_stars,
							combo: combo,
							miss: missc,
							acc_percent: acc,
							mode: "droid"
						});
						let pcpp = osudroid.ppv2({
							stars: star.pc_stars,
							combo: combo,
							miss: missc,
							acc_percent: acc,
							mode: "osu"
						});
						let ppline = parseFloat(npp.toString().split(" ")[0]);
						let pcppline = parseFloat(pcpp.toString().split(" ")[0]);
						let entry = [mapinfo, starsline, pcstarsline, max_score, ppline, pcppline];
						map_entries.push(entry);
						if (i === obj.length) {
							map_entries.sort((a, b) => {return b[2] - a[2]});
							let footer = config.avatar_list;
							const index = Math.floor(Math.random() * (footer.length - 1) + 1);
							let embed = new Discord.RichEmbed()
								.setFooter("Alice Synthesis Thirty", footer[index])
								.setTitle(`${mapinfo.artist} - ${mapinfo.title} by ${mapinfo.creator}`)
								.setColor(mapinfo.statusColor())
								.setURL(`https://osu.ppy.sh/s/${mapinfo.beatmapset_id}`)
								.setThumbnail(`https://b.ppy.sh/thumb/${mapinfo.beatmapset_id}.jpg`)
								.setDescription(`${mapinfo.showStatistics("", 1)}\nBPM: ${mapinfo.bpmConvert(mod)} - Length: ${mapinfo.timeConvert(mod)}`);

							for (let i = 0; i < map_entries.length; i++) {
								let star_rating = map_entries[i][2];
								let diff_icon = '';
								switch (true) {
									case star_rating < 2: diff_icon = client.emojis.get("679325905365237791"); break; // Easy
									case star_rating < 2.7: diff_icon = client.emojis.get("679325905734205470"); break; // Normal
									case star_rating < 4: diff_icon = client.emojis.get("679325905658708010"); break; // Hard
									case star_rating < 5.3: diff_icon = client.emojis.get("679325905616896048"); break; // Insane
									case star_rating < 6.5: diff_icon = client.emojis.get("679325905641930762"); break; // Expert
									default: diff_icon = client.emojis.get("679325905645993984") // Extreme
								}
								let description = `${map_entries[i][0].showStatistics("", 2)}\n**Max score**: ${map_entries[i][3].toLocaleString()} - **Max combo**: ${map_entries[i][0].max_combo}x\n\`${map_entries[i][1]} droid stars - ${map_entries[i][2]} PC stars\`\n**${map_entries[i][4]}**dpp - ${map_entries[i][5]}pp`;
								embed.addField(`${diff_icon} __${map_entries[i][0].version}__`, description)
							}

							message.channel.send(total_map > 3 ? `✅ **| I found ${total_map} maps, but only displaying 3 due to my limitations.**` : "", {embed: embed})
						}
					})
				})
			})
		});
		return req.end()
	}
	new osudroid.MapInfo().get({beatmap_id: beatmapid}, mapinfo => {
		if (!mapinfo.title || !mapinfo.objects || mapinfo.mode != 0) return;
		if (!combo) combo = mapinfo.max_combo;
		let max_score = mapinfo.max_score(mod);
		let star = new osudroid.MapStars().calculate({file: mapinfo.osu_file, mods: mod});
		let starsline = parseFloat(star.droid_stars.toString().split(" ")[0]);
		let pcstarsline = parseFloat(star.pc_stars.toString().split(" ")[0]);
		let npp = osudroid.ppv2({
			stars: star.droid_stars,
			combo: combo,
			miss: missc,
			acc_percent: acc,
			mode: "droid"
		});
		let pcpp = osudroid.ppv2({
			stars: star.pc_stars,
			combo: combo,
			miss: missc,
			acc_percent: acc,
			mode: "osu"
		});
		let ppline = parseFloat(npp.toString().split(" ")[0]);
		let pcppline = parseFloat(pcpp.toString().split(" ")[0]);

		let footer = config.avatar_list;
		const index = Math.floor(Math.random() * (footer.length - 1) + 1);
		let embed = new Discord.RichEmbed()
			.setFooter("Alice Synthesis Thirty", footer[index])
			.setThumbnail(`https://b.ppy.sh/thumb/${mapinfo.beatmapset_id}.jpg`)
			.setColor(mapinfo.statusColor())
			.setAuthor("Map Found", "https://image.frl/p/aoeh1ejvz3zmv5p1.jpg")
			.setTitle(mapinfo.showStatistics(mod, 0))
			.setDescription(mapinfo.showStatistics(mod, 1))
			.setURL(`https://osu.ppy.sh/b/${mapinfo.beatmap_id}`)
			.addField(mapinfo.showStatistics(mod, 2), `${mapinfo.showStatistics(mod, 3)}\n**Max score**: ${max_score.toLocaleString()}`)
			.addField(mapinfo.showStatistics(mod, 4), `${mapinfo.showStatistics(mod, 5)}\n**Result**: ${combo}/${mapinfo.max_combo}x / ${acc}% / ${missc} miss(es)`)
			.addField(`**Droid pp (Experimental)**: __${ppline} pp__ - ${starsline} stars`, `**PC pp**: ${pcppline} pp - ${pcstarsline} stars`);

		if (ndetail) message.channel.send(`Raw droid pp: ${npp.toString()}`);
		if (pcdetail) message.channel.send(`Raw PC pp: ${pcpp.toString()}`);
		message.channel.send({embed: embed}).catch(console.error)
	})
};

module.exports.config = {
	name: "autocalc",
	description: "Automatically calculates pp for an osu!standard map.",
	usage: "None",
	detail: "None",
	permission: "None"
};