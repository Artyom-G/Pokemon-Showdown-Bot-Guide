/*
	Battle commands (challenges, tours, ladder)
*/

Settings.addPermissions(['challenge', 'searchbattle', 'jointour']);

exports.commands = {
	jsbattle: 'evalbattle',
	eb: 'evalbattle',
	evalbattle: function (arg, by, room, cmd) {
		if (!this.isExcepted) return false;
		this.sclog();
		var tarRoom = room;
		var tarObj = Tools.getTargetRoom(arg);
		if (tarObj) {
			arg = tarObj.arg;
			tarRoom = tarObj.room;
		}
		if (!Features['battle'] || !Features['battle'].BattleBot || !Features['battle'].BattleBot.data) return false;
		if (!Features['battle'].BattleBot.data[tarRoom]) return this.reply('Battle "' + tarRoom + '" not found');
		var battleContext = {
			id: tarRoom,
			room: room,
			data: Features['battle'].BattleBot.data[tarRoom],
			request: Features['battle'].BattleBot.data[tarRoom].request,
			status: Features['battle'].BattleBot.data[tarRoom].statusData,
			opponentTeamData: Features['battle'].BattleBot.data[tarRoom].oppTeamOffSet,
			opponentTeam: Features['battle'].BattleBot.data[tarRoom].oppTeam,
			system: Features['battle'].BattleBot,
			sendBattle: function (data) {
				return Bot.say(this.id, data);
			},
			report: function (data) {
				Bot.say(this.room, data);
				return '';
			},
			manual: function (flag) {
				if (flag === undefined) flag = true;
				this.data['manual'] = flag;
				if (flag) this.sendBattle('/undo');
				return this.data['manual'];
			},
			timer: function (flag) {
				if (flag === undefined) flag = true;
				if (flag) this.sendBattle('/timer on');
				else this.sendBattle('/timer off');
				return !!flag;
			},
			decision: function (decision) {
				var rqid = 0;
				if (this.request) rqid = parseInt(this.request.rqid);
				if (decision.length === undefined) decision = [decision];
				return this.system.sendDecision(this.id, decision, rqid);
			},
			moves: function (num) {
				if (!num) num = 0;
				if (!this.request.active || !this.request.active[num] || !this.request.active[num].moves) return [];
				var poke = this.request.active[num];
				var moves = [];
				for (var i in poke.moves) {
					moves.push(poke.moves[i].move);
				}
				return moves;
			},
			pokemon: function () {
				var pokes = [];
				if (this.request && this.request.side && this.request.side.pokemon) {
					var poke;
					for (var i = 0; i < this.request.side.pokemon.length; i++) {
						if (this.request.side.pokemon[i].details.indexOf(",") > -1) poke = this.request.side.pokemon[i].details.substr(0, this.request.side.pokemon[i].details.indexOf(","));
						else poke = this.request.side.pokemon[i].details;
						pokes.push(poke);
					}
				}
				return pokes;
			},
			move: function (move, mega, target, poke) {
				if (typeof move === 'string') {
					var moves = this.moves(poke || 0);
					for (var i = 0; i < moves.length; i++) moves[i] = toId(moves[i]);
					return {type: 'move', move: (moves.indexOf(toId(move)) + 1), mega: mega, target: target};
				} else {
					return {type: 'move', move: parseInt(move), mega: mega, target: target};
				}
			},
			"switch": function (pokemon) {
				var side = this.pokemon();
				for (var i = 0; i < side.length; i++) side[i] = toId(side[i]);
				if (typeof pokemon === "string" && side.indexOf(toId(pokemon)) >= 0) {
					return {type: 'switch', switchIn: (side.indexOf(toId(pokemon)) + 1)};
				} else {
					return {type: 'switch', switchIn: parseInt(pokemon)};
				}
			},
			pass: function () {
				return {type: 'pass'};
			},
			team: function (team) {
				return {type: 'team', team: team};
			},
			random: function () {
				return this.system.getRandomMove(this.id);
			},
			cancel: function () {
				this.sendBattle('/undo');
				return true;
			},
			rejoin: function () {
				this.system.rejoin(this.id);
				return '';
			},
			forfeit: function () {
				this.sendBattle('/forfeit');
				return '';
			}
		};
		var evalFunction = function (txt) {
			try {
				var battle = this;

				/* Fast access methods - decisions */
				var choose = this.decision.bind(this);
				var move = this.move.bind(this);
				var sw = this.switch.bind(this);
				var pass = this.pass.bind(this);
				var team = this.team.bind(this);
				var cancel = this.cancel.bind(this);

				/* Eval */
				var result = eval(txt.trim());
				if (result !== '') Bot.say(room, '``' + JSON.stringify(result) + '``');
			} catch (e) {
				Bot.say(room, e.name + ": " + e.message);
			}
		};
		evalFunction.call(battleContext, arg);
	},

	reloadteams: function (arg, by, room, cmd) {
		if (!this.isExcepted) return false;
		this.sclog();
		if (Features['battle'].TeamBuilder.loadTeamList(true)) {
			this.reply(this.trad('s'));
		} else {
			this.reply(this.trad('e'));
		}
	},

	reloadbattle: function (arg, by, room, cmd) {
		if (!this.isExcepted) return false;
		this.sclog();
		try {
			var data = Features['battle'].BattleBot.data;
			Tools.uncacheTree('./features/battle/battle-bot.js');
			Features['battle'].BattleBot = require('./../features/battle/battle-bot.js');
			Features['battle'].BattleBot.init();
			Features['battle'].BattleBot.data = data;
			Features['battle'].BattleBot.battlesCount = Object.keys(data).length;
			this.reply("Battle modules hotpatched");
		} catch (e) {
			this.reply("Error: " + sys.inspect(e));
		}
	},

	unblockchallenges: 'blockchallenges',
	blockchallenges: function (arg, by, room, cmd) {
		if (!this.isRanked(Tools.getGroup('admin'))) return;
		this.sclog();
		if (cmd === "blockchallenges") {
			this.say('', '/blockchallenges');
			this.say(room, this.trad('b'));
		} else {
			this.say('', '/unblockchallenges');
			this.say(room, this.trad('nb'));
		}
	},

	move: function (arg, by, room, cmd) {
		if (!this.isExcepted) return false;
		this.sclog();
		if (this.roomType !== 'battle') return this.reply(this.trad('notbattle'));
		try {
			if (!arg) Features['battle'].BattleBot.receive(room, "|forcemove|");
			else if (arg === "random") Features['battle'].BattleBot.receive(room, "|forcemoverandom|");
			else this.say(room, '/choose ' + arg);
		} catch (e) {
			this.reply('Error: ' + sys.inspect(e));
		}
	},

	jointours: function (arg, by, room, cmd) {
		if (!this.can('jointour')) return false;
		if (this.roomType !== 'chat') return this.reply(this.trad('notchat'));
		if (!Settings.settings['jointours']) Settings.settings['jointours'] = {};
		if (toId(arg) === "off") {
			if (!Settings.settings['jointours'][room]) return this.reply(this.trad('ad') + ' ' + room);
			delete Settings.settings['jointours'][room];
			Settings.save();
			this.sclog();
			this.reply(this.trad('d') + ' ' + room);
		} else {
			if (Settings.settings['jointours'][room]) return this.reply(this.trad('ae') + ' ' + room);
			Settings.settings['jointours'][room] = 1;
			Settings.save();
			this.sclog();
			this.reply(this.trad('e') + ' ' + room);
		}
	},

	sb: 'searchbattle',
	searchbattle: function (arg, by, room, cmd) {
		if (!this.can('searchbattle')) return false;
		if (Settings.lockdown) return;
		if (!arg || !arg.length) return this.reply(this.trad('e1'));
		var format = Tools.parseAliases(arg);
		if (!Formats[format] || !Formats[format].ladder) return this.reply(this.trad('e21') + ' ' + format + ' ' + this.trad('e22'));
		if (Formats[format].team && !Features['battle'].TeamBuilder.hasTeam(format)) return this.reply(this.trad('e31') + ' ' + format + '. ' + this.trad('e32'));
		Features['battle'].LadderManager.reportsRoom = room;
		var cmds = [];
		var team = Features['battle'].TeamBuilder.getTeam(format);
		if (team) cmds.push('|/useteam ' + team);
		cmds.push('|/search ' + arg);
		this.send(cmds);
	},

	ladderstop: 'ladderstart',
	ladderstart: function (arg, by, room, cmd) {
		if (!this.isRanked(Tools.getGroup('admin'))) return false;
		if (cmd === 'ladderstop') {
			this.sclog();
			if (Features['battle'].LadderManager.stop()) this.reply(this.trad('stop'));
			return;
		}
		var format = Tools.parseAliases(arg);
		if (!Formats[format] || !Formats[format].ladder) return this.reply(this.trad('e21') + ' ' + format + ' ' + this.trad('e22'));
		if (Formats[format].team && !Features['battle'].TeamBuilder.hasTeam(format)) return this.reply(this.trad('e31') + ' ' + format + '. ' + this.trad('e32'));
		if (Features['battle'].LadderManager.start(format)) {
			this.reply(this.trad('start') + ' ' + format);
			this.sclog();
		}
	},

	challme: 'challenge',
	challengeme: 'challenge',
	chall: 'challenge',
	challenge: function (arg, by, room, cmd) {
		if (!this.can('challenge')) return false;
		if (Settings.lockdown) return;
		var args = arg.split(",");
		if (cmd in {'challme': 1, 'challengeme': 1}) {
			args = [by, arg];
		}
		if (args.length < 2) return this.reply(this.trad('e11') + ': ' + this.cmdToken + cmd + " " + this.trad('e12'));
		var format = Tools.parseAliases(args[1]);
		if (!format || !Formats[format] || !Formats[format].chall) return this.reply(this.trad('e21') + ' "' + format + '" ' + this.trad('e22'));
		if (Formats[format].team && !Features['battle'].TeamBuilder.hasTeam(format)) return this.reply(this.trad('e31') + ' ' + format + '. ' + this.trad('e32'));
		var cmds = [];
		var team = Features['battle'].TeamBuilder.getTeam(format);
		if (team) cmds.push('|/useteam ' + team);
		cmds.push('|/challenge ' + toId(args[0]) + ", " + format);
		this.send(cmds);
	},

	checktour: 'jointour',
	tourjoin: 'jointour',
	jt: 'jointour',
	jointour: function (arg, by, room, cmd) {
		if (!this.can('jointour')) return false;
		if (Settings.lockdown) return;
		if (this.roomType !== 'chat') return this.reply(this.trad('notchat'));
		if (!Features['battle'].TourManager.tourData[room] || !Features['battle'].TourManager.tourData[room].format) return this.reply(this.trad('e1'));
		if (cmd === 'checktour') {
			return this.say(room, '/tour getupdate');
		}
		if (Features['battle'].TourManager.tourData[room].isJoined) return this.reply(this.trad('e2'));
		if (Features['battle'].TourManager.tourData[room].isStarted) return this.reply(this.trad('e3'));
		var format = toId(Features['battle'].TourManager.tourData[room].format);
		if (Formats[format] && Formats[format].team && !Features['battle'].TeamBuilder.hasTeam(format)) return this.reply(this.trad('e41') + ' ' + format + '. ' + this.trad('e42'));
		this.reply("/tour join");
	},

	leavetour: function (arg, by, room, cmd) {
		if (!this.can('jointour')) return false;
		if (this.roomType !== 'chat') return this.reply(this.trad('notchat'));
		if (!Features['battle'].TourManager.tourData[room] || !Features['battle'].TourManager.tourData[room].format) return this.reply(this.trad('e1'));
		if (!Features['battle'].TourManager.tourData[room].isJoined) return this.reply(this.trad('e2'));
		this.reply("/tour leave");
	},

	botteams: 'team',
	teams: 'team',
	team: function (arg, by, room, cmd) {
		if (!this.isRanked(Tools.getGroup('admin'))) return false;
		if (!arg) return this.reply(this.trad('u1') + ': ' + this.cmdToken + cmd + ' ' + this.trad('u2'));
		arg = arg.split(',');
		var opt = toId(arg[0]);
		var id, name;
		switch (opt) {
			case 'add':
			case 'new':
				if (arg.length < 4) return this.reply(this.trad('u1') + ': ' + this.cmdToken + cmd + ' ' + this.trad('u3'));
				name = toId(arg[1]);
				var format = Tools.parseAliases(arg[2]);
				var link = arg[3].trim();
				if (!link) return this.reply(this.trad('u1') + ': ' + this.cmdToken + cmd + ' ' + this.trad('u2'));
				if (link.substr(-1) === '/') link = link.substr(0, link.length - 1);
				var splitedLink = link.split('/');
				link = 'http://hastebin.com/raw/' + splitedLink[splitedLink.length - 1];
				if (!Formats[format]) return this.reply(this.trad('format') + " __" + format + "__ " + this.trad('notexists'));
				this.reply(this.trad('download') + '... (' + link + ')');
				var http = require('http');
				http.get(link, function (res) {
					var data = '';
					res.on('data', function (part) {
						data += part;
					}.bind(this));
					res.on('end', function (end) {
						if (data === '{"message":"Document not found."}') {
							this.reply(this.trad('err1'));
							return;
						}
						var team, packed;
						try {
							team = Tools.teamToJSON(data);
							packed = Tools.packTeam(team);
						} catch (e) {
							errlog(e.stack);
							this.reply(this.trad('err2'));
							return;
						}
						if (Features['battle'].TeamBuilder.addTeam(name, format, packed)) {
							this.sclog();
							this.reply(this.trad('team') + " __" + name + "__ " + this.trad('added'));
						} else {
							this.reply(this.trad('err3'));
						}
					}.bind(this));
					res.on('error', function (end) {
						this.reply(this.trad('err4'));
					}.bind(this));
				}.bind(this)).on('error', function (e) {
					this.reply(this.trad('err4'));
				}.bind(this));
				break;
			case 'get':
				if (arg.length < 2) return this.reply(this.trad('u1') + ': ' + this.cmdToken + cmd + ' ' + this.trad('u5'));
				id = toId(arg[1]);
				if (!Features['battle'].TeamBuilder.dynTeams[id]) return this.reply(this.trad('team') + " __" + name + "__ " + this.trad('notexists'));
				try {
					var data = Tools.exportTeam(Features['battle'].TeamBuilder.dynTeams[id].packed);
					Tools.uploadToHastebin(data, function (r, link) {
						if (r) return this.pmReply(id + ': ' + link);
						else this.pmReply(this.trad('err'));
					}.bind(this));
				} catch (e) {
					errlog(e.stack);
					this.pmReply(this.trad('err2'));
				}
				break;
			case 'check':
				if (arg.length < 2) return this.reply(this.trad('u1') + ': ' + this.cmdToken + cmd + ' ' + this.trad('u6'));
				id = toId(arg[1]);
				if (!Features['battle'].TeamBuilder.dynTeams[id]) return this.reply(this.trad('team') + " __" + name + "__ " + this.trad('notexists'));
				var cmds = [];
				var team = Features['battle'].TeamBuilder.dynTeams[id].packed;
				if (team) cmds.push('|/useteam ' + team);
				cmds.push('|/challenge ' + toId(arg[2] || by) + ", " + Features['battle'].TeamBuilder.dynTeams[id].format);
				this.sclog();
				this.send(cmds);
				break;
			case 'delete':
			case 'remove':
				if (arg.length < 2) return this.reply(this.trad('u1') + ': ' + this.cmdToken + cmd + ' ' + this.trad('u4'));
				name = toId(arg[1]);
				if (Features['battle'].TeamBuilder.removeTeam(name)) {
					this.sclog();
					this.reply(this.trad('team') + " __" + name + "__ " + this.trad('removed'));
				} else {
					this.reply(this.trad('team') + " __" + name + "__ " + this.trad('notexists'));
				}
				break;
			default:
				return this.reply(this.trad('u1') + ': ' + this.cmdToken + cmd + ' ' + this.trad('u2'));
		}
	},

	viewteamlist: 'teamlist',
	viewteamslist: 'teamlist',
	teamslist: 'teamlist',
	teamlist: function (arg, by, room, cmd) {
		if (!this.isRanked(Tools.getGroup('admin'))) return false;
		var teamsStr = this.trad('list') + ':\n\n';
		var teams = Features['battle'].TeamBuilder.dynTeams;
		var nTeams = 0;
		for (var i in teams) {
			teamsStr += this.trad('id') + ': ' + i + ' | ' + this.trad('format') + ': ' + teams[i].format + ' | ' + this.trad('pokemon') + ': ' + Tools.teamOverview(teams[i].packed) + '\n';
			nTeams++;
		}
		if (!nTeams) return this.pmReply(this.trad('empty'));
		Tools.uploadToHastebin(teamsStr, function (r, link) {
			if (r) return this.pmReply(this.trad('list') + ': ' + link);
			else this.pmReply(this.trad('err'));
		}.bind(this));
	}
};
