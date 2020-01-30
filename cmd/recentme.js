var http = require('http');
var droid = require("./ojsamadroid");
var osu = require("ojsama");
var request = require("request");
var https = require("https");
require("dotenv").config();
var apikey = process.env.OSU_API_KEY;
var droidapikey = process.env.DROID_API_KEY;
let config = require('../config.json');

class MapStats {
	constructor() {
		this.cs = 0;
		this.ar = 0;
		this.od = 0;
		this.hp = 0
	}
	calc(params) {
		let cs = parseFloat(params.cs);
		let ar = parseFloat(params.ar);
		let od = parseFloat(params.od);
		let hp = parseFloat(params.hp);
		let mods = params.mods;
		let speed_mul = 1;
		if (mods.includes("d")) speed_mul = 1.5;
		if (mods.includes("c")) speed_mul = 1.39;
		if (mods.includes("t")) speed_mul *= 0.75;

		let od_ar_hp_multiplier = 1;
		if (mods.includes("r")) od_ar_hp_multiplier = 1.4;
		if (mods.includes("e")) od_ar_hp_multiplier *= 0.5;
		if (cs) {
			if (mods.includes("r")) cs *= 1.3;
			if (mods.includes("e")) cs *= 0.5;
			cs = Math.min(10, cs)
		}
		if (hp) {
			hp *= od_ar_hp_multiplier;
			hp = Math.min(10, hp)
		}
		if (ar) ar = this.modify_ar(ar, speed_mul, od_ar_hp_multiplier);
		if (od) od = this.modify_od(od, speed_mul, od_ar_hp_multiplier);

		this.cs = parseFloat(cs.toFixed(2));
		this.ar = parseFloat(ar.toFixed(2));
		this.od = parseFloat(od.toFixed(2));
		this.hp = parseFloat(hp.toFixed(2));
		return this
	}
	modify_ar(base_ar, speed_mul, multiplier) {
		let AR0_MS = 1800.0;
		let AR5_MS = 1200.0;
		let AR10_MS = 450.0;
		let AR_MS_STEP1 = (AR0_MS - AR5_MS) / 5.0;
		let AR_MS_STEP2 = (AR5_MS - AR10_MS) / 5.0;
		let ar = base_ar * multiplier;
		let arms = (
			ar < 5.0 ?
				AR0_MS-AR_MS_STEP1 * ar
				: AR5_MS - AR_MS_STEP2 * (ar - 5)
		);
		arms = Math.min(AR0_MS, Math.max(AR10_MS, arms));
		arms /= speed_mul;

		ar = (
			arms > AR5_MS ?
				(AR0_MS - arms) / AR_MS_STEP1
				: 5 + (AR5_MS - arms) / AR_MS_STEP2
		);
		return ar
	}
	modify_od(base_od, speed_mul, multiplier) {
		let OD0_MS = 80;
		let OD10_MS = 20;
		let OD_MS_STEP = (OD0_MS - OD10_MS) / 10.0;
		let od = base_od * multiplier;
		let odms = OD0_MS - Math.ceil(OD_MS_STEP * od);
		odms = Math.min(OD0_MS, Math.max(OD10_MS, odms));
		odms /= speed_mul;
		od = (OD0_MS - odms) / OD_MS_STEP;
		return od
	}
}

function time(second) {
	return [Math.floor(second / 60), Math.ceil(second - Math.floor(second / 60) * 60).toString().padStart(2, "0")].join(":")
}

function rankread(imgsrc) {
	let rank="";
	switch(imgsrc) {
		case 'S':rank="http://ops.dgsrz.com/assets/images/ranking-S-small.png";break;
		case 'A':rank="http://ops.dgsrz.com/assets/images/ranking-A-small.png";break;
		case 'B':rank="http://ops.dgsrz.com/assets/images/ranking-B-small.png";break;
		case 'C':rank="http://ops.dgsrz.com/assets/images/ranking-C-small.png";break;
		case 'D':rank="http://ops.dgsrz.com/assets/images/ranking-D-small.png";break;
		case 'SH':rank="http://ops.dgsrz.com/assets/images/ranking-SH-small.png";break;
		case 'X':rank="http://ops.dgsrz.com/assets/images/ranking-X-small.png";break;
		case 'XH':rank="http://ops.dgsrz.com/assets/images/ranking-XH-small.png";break;
		default: rank="unknown"
	}
	return rank
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

function modenum(mod) {
	var res = 4;
	if (mod.includes("r")) res += 16;
	if (mod.includes("h")) res += 8;
	if (mod.includes("d")) res += 64;
	if (mod.includes("c")) res += 576;
	if (mod.includes("n")) res += 1;
	if (mod.includes("e")) res += 2;
	if (mod.includes("t")) res += 256;
	return res
}

function modname(mod) {
	var res = '';
	var count = 0;
	if (mod.includes("-")) {res += 'None '; count++}
	if (mod.includes("n")) {res += 'NoFail '; count++}
	if (mod.includes("e")) {res += 'Easy '; count++}
	if (mod.includes("t")) {res += 'HalfTime '; count++}
	if (mod.includes("r")) {res += 'HardRock '; count++}
	if (mod.includes("h")) {res += 'Hidden '; count++}
	if (mod.includes("d")) {res += 'DoubleTime '; count++}
	if (mod.includes("c")) {res += 'NightCore '; count++}
	if (count > 1) return res.trimRight().split(" ").join(", ");
	else return res.trimRight()
}

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

function getMapPP(input, pcombo, pacc, pmissc, pmod = "", message, footer, index) {

	var options = new URL("https://osu.ppy.sh/api/get_beatmaps?k=" + apikey + "&h=" + input);

	var content = "";   

	var req = https.get(options, function(res) {
		res.setEncoding("utf8");
		res.on("data", function (chunk) {
			content += chunk;
		});
		res.on("error", err => {
			console.log(err);
			return console.log("Empty API response")
		});
		res.on("end", function () {
			var obj;
			try {
				obj = JSON.parse(content);
			} catch (e) {
				return message.channel.send("❎ **| I'm sorry, I'm having trouble receiving response from osu! API now. Please try again later!**")
			}
			if (!obj[0]) {console.log("Map not found"); return;}
			var mapinfo = obj[0];
			var mapid = mapinfo.beatmap_id;
			if (mapinfo.mode !=0) return;
			//console.log(obj.beatmaps[0])
			if (pmod) var mods = modenum(pmod);
			else var mods = 4;
			if (pacc) var acc_percent = parseFloat(pacc);
			else var acc_percent = 100;
			if (pcombo) var combo = parseInt(pcombo);
			else var combo;
			if (pmissc) var nmiss = parseInt(pmissc);
			else var nmiss = 0;
			var nparser = new droid.parser();
			var pcparser = new osu.parser();
			console.log(acc_percent);
			var url = 'https://osu.ppy.sh/osu/' + mapid;
			request(url, function (err, response, data) {
					nparser.feed(data);
					pcparser.feed(data);
					var pcmods = mods - 4;
					var nmap = nparser.map;
					var pcmap = pcparser.map;
					var cur_od = nmap.od - 5;
					var cur_ar = nmap.ar;
					var cur_cs = nmap.cs - 4;
					if (pmod.includes("r")) {
						mods -= 16; 
						cur_ar = Math.min(cur_ar*1.4, 10);
						cur_od = Math.min(cur_od*1.4, 5);
						cur_cs += 1;
					}
                                        var hitlength = mapinfo.hit_length;
                                        var maplength = mapinfo.total_length;
                                        if (pmod.includes("d") || pmod.includes("c")) {
                                                hitlength = Math.floor(hitlength / 1.5);
                                                maplength = Math.floor(maplength / 1.5)
                                        }
					if (pmod.includes("t")) {
						hitlength = Math.ceil(hitlength * 4/3);
						maplength = Math.ceil(maplength * 4/3)
					}

					if (pmod.includes("PR")) { cur_od += 4; }

					nmap.od = cur_od; nmap.ar = cur_ar; nmap.cs = cur_cs;
                    
                    			if (nmap.ncircles == 0 && nmap.nsliders == 0) {
						console.log(target[0] + ' - Error: no object found'); 
						return;
                    			}
                    
					var nstars = new droid.diff().calc({map: nmap, mods: mods});
					var pcstars = new osu.diff().calc({map: pcmap, mods: pcmods});

                    			var npp = droid.ppv2({
						stars: nstars,
						combo: combo,
						nmiss: nmiss,
						acc_percent: acc_percent,
					});

					var pcpp = osu.ppv2({
						stars: pcstars,
						combo: combo,
						nmiss: nmiss,
						acc_percent: acc_percent,
					});
					
					nparser.reset();
					if (pmod.includes("r")) { mods += 16 }
                    
					console.log(nstars.toString());
                    			console.log(npp.toString());
					var starsline = nstars.toString().split("(");
					var ppline = npp.toString().split("(");
					var pcstarsline = pcstars.toString().split("(");
					var pcppline = pcpp.toString().split("(");
					let mapstat = new MapStats().calc({cs: mapinfo.diff_size, ar: mapinfo.diff_approach, od: mapinfo.diff_overall, hp: mapinfo.diff_drain, mods: pmod});
					const embed = {
						"title": mapinfo.artist + " - " + mapinfo.title + " (" + mapinfo.creator + ") [" + mapinfo.version + "] " + ((mods == 4 && (!pmod.includes("PR")))? " " : "+ ") + osu.modbits.string(mods - 4) + ((pmod.includes("PR")? "PR": "")),
						"description": "Download: [osu!](https://osu.ppy.sh/beatmapsets/" + mapinfo.beatmapset_id + "/download) ([no video](https://osu.ppy.sh/beatmapsets/" + mapinfo.beatmapset_id + "/download?noVideo=1)) - [Bloodcat](https://bloodcat.com/osu/_data/beatmaps/" + mapinfo.beatmapset_id + ".osz) - [sayobot](https://osu.sayobot.cn/osu.php?s=" + mapinfo.beatmapset_id + ")",
						"url": "https://osu.ppy.sh/b/" + mapinfo.beatmap_id ,
						"color": mapstatusread(parseInt(mapinfo.approved)),
						"footer": {
							"icon_url": footer[index],
							"text": "Alice Synthesis Thirty"
						},
						"author": {
							"name": "Map Found",
							"icon_url": "https://image.frl/p/aoeh1ejvz3zmv5p1.jpg"
						},
						"thumbnail": {
							"url": "https://b.ppy.sh/thumb/" + mapinfo.beatmapset_id + ".jpg"
						},
						"fields": [
							{
								"name": `CS: ${pcmap.cs}${mapstat.cs == pcmap.cs?"":` (${mapstat.cs})`} - AR: ${pcmap.ar}${mapstat.ar == pcmap.ar?"":` (${mapstat.ar})`} - OD: ${pcmap.od}${mapstat.od == pcmap.od?"":` (${mapstat.od})`} - HP: ${pcmap.hp}${mapstat.hp == pcmap.hp?"":` (${mapstat.hp})`}`,
								"value": "BPM: " + mapinfo.bpm + " - Length: " + time(hitlength) + "/" + time(maplength) + " - Max Combo: " + mapinfo.max_combo + "x"
							},
							{
								"name": "Last Update: " + mapinfo.last_update + " | " + mapstatus(parseInt(mapinfo.approved)),
								"value": "❤️ " + mapinfo.favourite_count + " - ▶️ " + mapinfo.playcount
							},
							{
								"name": "Droid pp (Experimental): __" + ppline[0] + "__ - " + starsline[0] ,
								"value": "PC pp: " + pcppline[0] + " - " + pcstarsline[0]
							}
						]
					};
					message.channel.send({embed})
				}
			)
		})
	});
	req.end()
}

module.exports.run = (client, message, args, maindb) => {
	let ufind = message.author.id;
	if (args[0]) {
		ufind = args[0];
		ufind = ufind.replace('<@!','');
		ufind = ufind.replace('<@','');
		ufind = ufind.replace('>','');
	}
	console.log(ufind);
	let binddb = maindb.collection("userbind");
	let query = { discordid: ufind };
	binddb.find(query).toArray(function(err, res) {
		if (err) {
			console.log(err);
			return message.channel.send("Error: Empty database response. Please try again!")
		}
		if (res[0]) {
			let uid = res[0].uid;
			var options = {
				host: "ops.dgsrz.com",
				port: 80,
				path: "/api/getuserinfo.php?apiKey=" + droidapikey + "&uid=" + uid
			};

			var content = "";   

			var req = http.request(options, function(res) {
			res.setEncoding("utf8");
			res.on("data", function (chunk) {
			content += chunk;
			});
			res.on("error", err1 => {
				console.log(err1);
				return message.channel.send("Error: Empty API response. Please try again!")
			});
			res.on("end", function () {
				var resarr = content.split('<br>');
				var headerres = resarr[0].split(" ");
				if (headerres[0] == 'FAILED') return message.channel.send("❎ **| I'm sorry, it looks like the user doesn't exist!**");
				let name = resarr[0].split(" ")[2];
				var obj;
                                try {
                                        obj = JSON.parse(resarr[1])
                                } catch (e) {
                                        return message.channel.send("❎ **| I'm sorry, I'm having trouble receiving response from osu!droid API. Please try again!**")
                                }
				var play = obj.recent[0];
				let title = play.filename;
				let score = play.score.toLocaleString();
				let combo = play.combo;
				let rank = rankread(play.mark);
				let ptime = new Date(play.date * 1000);
				ptime.setUTCHours(ptime.getUTCHours() + 7);
				let acc = (play.accuracy / 1000).toFixed(2);
				let miss = play.miss;
				let mod = play.mode;
				let hash = play.hash;
				let footer = config.avatar_list;
				const index = Math.floor(Math.random() * (footer.length - 1) + 1);
				if (title) getMapPP(hash, combo, acc, miss, mod, message, footer, index);
				const embed = {
					"title": title,
					"description": "**Score**: `" + score + " ` - Combo: `" + combo + "x ` - Accuracy: `" + acc + "%` \n(`" + miss + "` x )\nMod: `" + modname(mod) + "`\nTime: `" + ptime.toUTCString() + "`",
					"color": 8311585,
					"author": {
						"name": "Recent Play for "+ name,
						"icon_url": rank
					},
					"footer": {
						"icon_url": footer[index],
						"text": "Alice Synthesis Thirty"
					}
				};
				message.channel.send({embed})
				})
			});
			req.end()
		}
		else message.channel.send("❎ **| I'm sorry, the account is not binded. He/she/you need to use `a!userbind <uid>` first. To get uid, use `a!profilesearch <username>`.**")
	})
};

module.exports.config = {
	description: "Retrieves a user's most recent play.",
	usage: "recentme [user]",
	detail: "`user`: The user to retrieve [UserResolvable (mention or user ID)]",
	permission: "None"
};

module.exports.help = {
	name: "recentme"
};
