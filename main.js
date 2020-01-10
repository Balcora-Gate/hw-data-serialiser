require('dotenv').config();
const readline = require("readline");
const readdir = require("recursive-readdir");
const fs = require("fs");
const mongodb = require("mongodb");


const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

function makeReader(root_dir, valid_extensions) {
	return (file_paths) => {
		return Promise.all(file_paths.filter(fp => {
			const pattern = /\.([\w.]+)$/gm;
			const extension = pattern.exec(fp)[0];
			return valid_extensions.includes(extension);
		}).map(path => {
			const pattern = /\.([\w.]+)$/gm;
			return new Promise((res, rej) => {
				fs.readFile(path, `utf8`, (err, contents) => {
					if (err) {
						rej(err);
						console.log(`WARNING:`);
						console.log(err);
					}
					console.log(`\t${path}`);
					const cat = pattern.exec(path)[1];
					res({ name: path.match(/(\w+)\.\w+$/m)[1], category: cat, ...rawToJson(cat, contents) });
				});
			});
		}));
	};
}

function makeLister(root_dir) {
	return (sub_dir) => {
		return readdir(`${root_dir}/${sub_dir}`);
	};
}

function makeDataGetter(list, read) {
	return async (sub_dirs) => {
		return Promise.all(sub_dirs.map(async sd => {
			console.log(`Compiling: ${sd}`);
			return read(await list(sd));
		}));
	};
}

function getParamVals(text, func_name, param_list, obj_type) {
	const pattern = new RegExp(`${func_name}\\(${obj_type},(["\\w,\\s.]+)\\);`, `m`);
	if (text.match(pattern) === null) {
		return {};
	}
	const vals = text.match(pattern)[1].split(`,`);
	return param_list.reduce((acc, param, index) => {
		acc[param] = vals[index];
		return acc;
	}, {});
}

function rawToJson(category, data) {
	const genKeyVals = (data, pattern) => {
		const obj = {};
		let match;
		while ((match = pattern.exec(data)) != null) {
			obj[match[1]] = match[2];
		}
		return obj;
	};
	const generators = {
		ship: {
			attribs: (data) => {
				return genKeyVals(data, /\w+\.(\w+)\s*=\s*(?:getShipNum\(NewShipType,\s*\S+\s*)?(?:getShipStr\(NewShipType,\s*\S+,\s*)?([\w."$]+)/gm);
			},
			abilities: (data) => {
				return genKeyVals(data, /addAbility\(NewShipType,([\"\w]+)(?:,([\d\.\,]+))?/gm);
			},
			emp: (data) => {
				// return genKeyVals(data, /addShield\(NewShipType,\s*[\w"]+,(\d+),(\d+)\)/gm);
				const pattern = /addShield\(NewShipType,\s*[\w"]+,(\d+),(\d+)\)/m;
				const vals = data.match(pattern);
				if (vals === null) {
					return {};
				}
				return {
					HP: vals[1],
					regen_time: vals[2]
				};
			},
			innate_weapons: (data) => {
				const pattern = /StartShipWeaponConfig\(NewShipType,([\w\s"]+),.+\);/gm;
				const weapon_list = [];
				let match;
				while ((match = pattern.exec(data)) != null) {
					weapon_list.push(match[1]);
				}
				return weapon_list;
			},
			hardpoints: (data) => {
				const args_pattern = /(StartShipHardPointConfig\([\w\s,"]*\);)/gm;
				const config_instances = Object.keys(genKeyVals(data, args_pattern));
				const hardpoint_conf_params = [
					`name`,
					`joint_name`,
					`type`,
					`family`,
					`destructability`,
					`default_sub`,
					`potential_sub_0`,
					`potential_sub_1`,
					`potential_sub_2`,
					`potential_sub_3`,
					`potential_sub_4`,
					`potential_sub_5`,
					`potential_sub_6`,
					`potential_sub_7`,
				];
				return config_instances.map(config_instance => {
					return getParamVals(config_instance, `StartShipHardPointConfig`, hardpoint_conf_params, `NewShipType`);
				});
			}
		},
		wepn: {
			config: (data) => {
				//const wepn_cnfg_values = data.match(/StartWeaponConfig\(NewWeaponType,(["\w,\s.]+)\);/gm)[1].split(`,`);
				const wepn_cnfg_params = [
					`type`,
					`fire_type`,
					`fire_name`,
					`activation_type`,
					`projectile_speed`,
					`fire_range`,
					`burst_radius`,
					`beam_duration`,
					`beam_anticipation`,
					`missile_fire_axis`,
					`max_hit_effect_count`,
					`lead_targets`,
					`check_line_of_fire`,
					`time_between_shots`,
					`fire_burst_duration`,
					`time_between_bursts`,
					`shoot_any_targeted`,
					`shoot_any_in_range`,
					`hor_tracking_speed`,
					`ver_tracking_speed`,
					`speed_mult_when_over_target`,
					`UNUSED_shield_penetration`,
					`track_targets_out_of_range`,
					`wait_until_codered`,
					`beam_penetration_threshold`
				];
				// zip these together into an obj like [param]: value
				return getParamVals(data, `StartWeaponConfig`, wepn_cnfg_params, `NewWeaponType`);
			},
			result: (data) => {
				// const wepn_result_values = data.match(/AddWeaponResult\(NewWeaponType,(["\w,\s.]+)\);/gm)[1].split(`,`);
				const wepn_result_params = [
					`condition`,
					`effect`,
					`target`,
					`min_effect_val`,
					`max_effect_val`,
					`spawned_weapon_effect`
				];
				return getParamVals(data, `AddWeaponResult`, wepn_result_params, `NewWeaponType`);
			},
			penetration: (data) => {
				// if no pen values set, return immediately
				if (data.match(/setPenetration/m) === null) {
					return {};
				}
				const wepn_pen_values = data.match(/setPenetration\(NewWeaponType,(["\w\s,.]+)/m)[1].split(`,`);
				const wepn_pen_params = [
					`field_penetration_percent`,
					`default_damage_mult`
				];
				const wepn_pen_data = wepn_pen_params.reduce((acc, param, index) => {
					if (wepn_pen_values[index]) acc[param] = wepn_pen_values[index].trim();
					return acc;
				}, {});
				if (data.match(/setPenetration\(NewWeaponType,["\w\s,.]+,([\w\s={}.,*]+)/m) === null) {
					return {};
				}
				const wepn_pen_exceptions = data
					.match(/setPenetration\(NewWeaponType,["\w\s,.]+,([\w\s={}.,*]+)/m)[1]
					.split(`,`)
					.map(raw => {
						const kv = raw.match(/{(.+)=(.+)}/m);
						if (kv === null) {
							return {};
						}
						return {
							[kv[1]]: kv[2]
						};
					})
					.reduce((acc, kv_obj) => {
						acc = { ...acc, ...kv_obj };
						return acc;
					}, {});
				return { ...wepn_pen_data, ...wepn_pen_exceptions };
			},
			accuracy: (data) => {
				if (data.match(/setAccuracy/m) === null) {
					return {};
				}
				const wepn_acc_data = {
					default_acc_mult: data.match(/setAccuracy\(NewWeaponType,(["\w\s.]+)/m)[1].trim()
				};
				if (data.match(/setAccuracy\(NewWeaponType,["\w\s,.]+,([\w\s={}.,*/]+)/m) === null) {
					return {};
				}
				const wepn_acc_exceptions = data
					.match(/setAccuracy\(NewWeaponType,["\w\s,.]+,([\w\s={}.,*/]+)/m)[1]
					.split(`,`)
					.map(raw => {
						const kv = raw.match(/{(.+)=([^}]+)/m);
						if (kv === null) {
							return {};
						}
						return {
							[kv[1]]: kv[2]
						};
					})
					.reduce((acc, kv_obj) => {
						acc = { ...acc, ...kv_obj };
						return acc;
					}, {});
				return { ...wepn_acc_data, ...wepn_acc_exceptions };
			},
			// misc: (data) => {
			// 	// ugh, do this later
			// }
		},
		subs: {
			attribs: (data) => {
				return genKeyVals(data, /\w+\.(\w+)\s*=\s*(?:getShipNum\(NewShipType,\s*\S+\s*)?(?:getShipStr\(NewShipType,\s*\S+,\s*)?([\w."$]+)/gm);
			}
		}
	};
	const formatted = {};
	if (generators[category] === undefined) {
		throw new Error(`Unknown data category: ${category}`);
	}
	for (const [subcat, generator] of Object.entries(generators[category])) {
		formatted[subcat] = generator(data);
	}
	return formatted;
}

rl.question(`Enter the root of the mod directory: `, async (answer) => {
	console.log(`Attempting to compile data from ${answer}`);
	const list = makeLister(answer);
	const read = makeReader(answer, [`.ship`, `.subs`, `.wepn`]);
	const dataGetter = makeDataGetter(list, read);
	rl.question(`Which subdirectories? (Default is 'ship, subsystem, weapon'): `, async (subs_answer) => {
		if (subs_answer.length === 0) {
			subs_answer = `ship, subsystem, weapon`;
		}
		const subdirs = subs_answer.split(`,`).map(s => s.trim());
		console.log(`Attempting to source from:`);
		for (const subdir of subdirs) {
			console.log(`\t${subdir}`);
		}
		try {
			const data = (await dataGetter(subdirs)).reduce((acc, arr) => {
				acc[arr[0].category] = arr;
				return acc;
			}, {});
			if (process.argv.slice(2).includes(`-w`)) {
				console.log(Object.keys(data));
				console.log(`Attempting to write...`);
				await (() => {
					return new Promise((res, rej) => {
						fs.writeFile(`dump.json`, JSON.stringify(data), (err) => {
							if (err) {
								console.log(`WARNING: ${err}`);
								rej();
							}
							console.log(`File write success (at ./dump.json)!`);
							res();
						});
					});
				})();
			}
			if (process.argv.slice(2).includes(`-db`)) {
				console.log(`Attempting to insert to db...`);
				const MongoClient = mongodb.MongoClient;
				const uri = `mongodb+srv://${process.env.CLUSTER_USER_NAME}:${process.env.CLUSTER_USER_PASS}@${process.env.CLUSTER_STR}`;
				console.log(uri);
				const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
				
				await new Promise((res, rej) => {
					client.connect(async err => {
						if (err !== null) {
							console.log(err);
							rej(err);
						}
						const db = client.db(process.env.CLUSTER_DB_NAME);
						db.on(`error`, (err) => {
							console.log(err);
							rej(err);
						});
						for (const [cat, cat_data] of Object.entries(data)) {
							console.group(cat);
							if (cat === `default`) continue;
							const collection = db.collection(cat, (err, resu) => {
								if (err) console.log(err);
								else console.log(resu);
							});
							await collection.deleteMany({}); // clear old data
							await collection.insertMany(cat_data, (err, w_res) => {
								if (err) {
									console.group(`err:`);
									console.log(err);
									console.groupEnd(`err:`);
								}
							}); // write new
							console.groupEnd(cat);
						}
						console.log(`DB write success (at ${process.env.CLUSTER_DB_NAME})!`);
						await client.close();
						console.log(`Closed, exiting`);
						res();
					});
				});
			}
		} catch (err) {
			console.log(`Err;`);
			console.log(err);
		}
		rl.close();
		process.stdin.destroy();
		process.exit();
	});
});