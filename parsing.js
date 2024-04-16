const util = require(`./util`);

/**
 * @typedef { Object.<string, string | number> } EntityData
 */

/**
 * Reads a line from src containing some function call, and attempts to
 * 'zip' the keys in `param_list` with their values, i.e:
 * 
 * `addAbility(NewShipType,"HyperSpaceCommand",0,2,400,800,0,3);`
 * 
 * is added to the `abilities` property on the main obj:
 * 
 * `"abilties": { "HyperspaceCommand": "0,2,400,800,0,3" }`
 * 
 * @param { string } text The line we want to parse
 * @param { string } func_name The function's name (i.e `addAbility`)
 * @param { string[] } param_list The function's parameters, assigned names (official names don't exist).
 * @param { string } obj_type The entity's 'type' in src: `NewShipType`, `NewSubSystemType`, etc.
 */
function getParamVals(text, func_name, param_list, obj_type) {
	const pattern = new RegExp(`(?:^| |\\t)+${func_name}\\(${obj_type},(["\\w,\\s.*/]+)\\)`, `m`);
	if (text.match(pattern) === null) {
		return {};
	}
	const vals = text.match(pattern)[1].split(`,`);
	return param_list.reduce((acc, param, index) => {
		if (typeof vals[index] === `string`) {
			vals[index] = util.stripQuotes(vals[index].toLowerCase());
		}
		const is_empty_str = (typeof vals[index] === `string` && vals[index].length === 0);
		if (!vals[index] || is_empty_str) {
			acc[param] = null;
		} else {
			if (is_empty_str) {
				vals[index] = null;
			}
			acc[param] = vals[index];
		}
		return acc;
	}, {});
}

const usage_records = {
	subs: {},
	wepn: {}
};

const linkUsedBy = (formatted_data) => {
	for (const entity of [...(formatted_data.subs ?? []), ...(formatted_data.wepn ?? [])]) {
		entity.used_by = {
			ship: null,
			subs: null
		};
		switch (entity.category) {
			case `wepn`:
				entity.used_by.subs = usage_records.wepn[entity.name]?.subs ?? null;
				entity.used_by.ship = usage_records.wepn[entity.name]?.ship ?? null;
				break;
			case `subs`:
				entity.used_by.ship = usage_records.subs[entity.name]?.ship ?? null;
				break;
		}
		if (Object.values(entity.used_by).every(val => val === null)) {
			entity.used_by = null;
		}
	}
	return formatted_data;
};

/**
 * The main workhorse of the package.
 * 
 * This function takes a target category (so it knows the 'shape' of the data),
 * and the raw string contents of an entity file (i.e `hgn_interceptor.ship`) and
 * parses it into structured json format.
 * 
 * @param { string } category Category ('type') being serialised
 * @param { string } data The raw data from the read-in file (.lua)
 * 
 * @return { EntityData }
 */
function rawToJson(name, category, data) {
	const genKeyVals = (data, pattern) => {
		const obj = {};
		let match;
		while ((match = pattern.exec(data)) != null) {
			let [key, value] = [...match.slice(1)];
			key = util.stripQuotes(key);
			if (value && value.length) {
				value = util.tryParseFloat(util.stripQuotes(value));
			} else {
				value = null;
			}
			obj[key] = value;
		}
		return obj;
	};
	// The idea is to define the JSON structure in code, and provide
	// 'generators' for each property. The generator can be run to 'resolve'
	// the correct data for that property. Looping through the generators for
	// each category (see below), it's simple to convert raw lua into parsed json.
	const generators = {
		ship: {
			attribs: (data) => {
				return genKeyVals(data, /(?:^| |\t+)\w+\.(\w+)\s*=\s*(?:getShipNum\(NewShipType,\s*\S+\s*)?(?:getShipStr\(NewShipType,\s*\S+,\s*)?([\w."$]+)/gm);
			},
			abilities: (data) => {
				return genKeyVals(data, /(?:^| |\t+)addAbility\(NewShipType,\s*([\"\w]+)(?:,\s*([\d\.*\,*\s*]+))?([\"\w,\s]*)([\{\s\w\=\"\},]*)\)?/gm);
			},
			emp: (data) => {
				// return genKeyVals(data, /addShield\(NewShipType,\s*[\w"]+,(\d+),(\d+)\)/gm);
				const pattern = /(?:^| |\t+)addShield\(NewShipType,\s*[\w"]+,\s*(\d+),\s*(\d+)\)/m;
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
				const pattern = /(?:^| |\t+)StartShipWeaponConfig\(NewShipType,([\w\s"]+),.+\)/gm;
				const weapon_list = [];
				let match;
				while ((match = pattern.exec(data)) != null) {
					weapon_list.push(util.stripQuotes(match[1]).toLowerCase());
				}
				return weapon_list;
			},
			hardpoints: (data) => {
				const args_pattern = /(?:^| |\t+)(StartShipHardPointConfig\([\w\s,"]*\))/gm;
				const config_instances = Object.keys(genKeyVals(data, args_pattern));
				const hardpoint_conf_params = [
					`name`,
					`joint_name`,
					`type`,
					`family`,
					`destructability`,
					`default_subs`,
					`potential_subs_0`,
					`potential_subs_1`,
					`potential_subs_2`,
					`potential_subs_3`,
					`potential_subs_4`,
					`potential_subs_5`,
					`potential_subs_6`,
					`potential_subs_7`,
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
				if (data.match(/(?:^| |\t+)setPenetration/m) === null) {
					return {};
				}
				const wepn_pen_values = data.match(/(?:^| |\t+)setPenetration\(NewWeaponType,(["\w\s,.]+)/m)[1].split(`,`);
				const wepn_pen_params = [
					`field_penetration_percent`,
					`default_damage_mult`
				];
				const wepn_pen_data = wepn_pen_params.reduce((acc, param, index) => {
					if (wepn_pen_values[index]) acc[param] = wepn_pen_values[index].trim();
					return acc;
				}, {});
				if (data.match(/(?:^| |\t+)setPenetration\(NewWeaponType,["\w\s,.]+,([\w\s={}.,*]+)/m) === null) {
					return {};
				}
				const wepn_pen_exceptions = data
					.match(/(?:^| |\t+)setPenetration\(NewWeaponType,["\w\s,.]+,([\w\s={}.,*]+)/m)[1]
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
				if (data.match(/(?:^| |\t+)setAccuracy/m) === null) {
					return {};
				}
				const wepn_acc_data = {
					default_acc_mult: data.match(/(?:^| |\t+)setAccuracy\(NewWeaponType,(["\w\s.]+)/m)[1].trim()
				};
				if (data.match(/(?:^| |\t+)setAccuracy\(NewWeaponType,["\w\s,.]+,([\w\s={}.,*/]+)/m) === null) {
					return {};
				}
				const wepn_acc_exceptions = data
					.match(/(?:^| |\t+)setAccuracy\(NewWeaponType,["\w\s,.]+,([\w\s={}.,*/]+)/m)[1]
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
			// },
		},
		subs: {
			attribs: (data) => {
				return genKeyVals(data, /(?:^| |\t+)\w+\.(\w+)\s*=\s*(?:getShipNum\(NewShipType,\s*\S+\s*)?(?:getShipStr\(NewShipType,\s*\S+,\s*)?([\w."$]+)/gm);
			},
			weapon: (data) => {
				const pattern = /(?:^| |\t+)StartSubSystemWeaponConfig\(NewSubSystemType,([\w\s"]+)/gm;
				const result = pattern.exec(data);
				if (result) {
					return util.stripQuotes(result[1].toLowerCase());
				} else {
					return undefined;
				}
			}
		}
	};
	const formatted = {
		name,
		category
	};
	if (generators[category] === undefined) {
		throw new Error(`Unknown data category: ${category}`);
	}
	// for each subcat (i.e, 'attribs', 'innate_weapons' etc), run its generator to grab the
	// data from file, assigning it to the subcat key:
	for (const [subcat, generator] of Object.entries(generators[category])) {
		formatted[subcat] = generator(data);
		switch (category) {
			case `ship`:
				// link ships to weapons...
				if (subcat === `innate_weapons`) {
					const weapons = [...new Set(formatted[subcat])];
					for (const wepn_name of weapons) {
						usage_records.wepn[wepn_name] = {
							...usage_records.wepn[wepn_name],
							ship: [...new Set([
								...(usage_records.wepn[wepn_name]?.ship ?? []),
								formatted.name
							])]
						};
					}
				}
				// link ships to subs...
				if (subcat === `hardpoints`) {
					const hardpoints = formatted[subcat];
					for (const hardpoint of hardpoints) {
						const hp_subs = [
							hardpoint.default_subs,
							hardpoint.potential_subs_0,
							hardpoint.potential_subs_1,
							hardpoint.potential_subs_2,
							hardpoint.potential_subs_3,
							hardpoint.potential_subs_4,
							hardpoint.potential_subs_5,
							hardpoint.potential_subs_6,
							hardpoint.potential_subs_7,
						].filter(subs => subs !== null);
						for (const subs_name of hp_subs) {
							usage_records.subs[subs_name] = {
								...usage_records.subs[subs_name],
								ship: [...new Set([
									...(usage_records.subs[subs_name]?.ship ?? []),
									formatted.name
								])]
							};
						}
					}
				}
				break;
			case `subs`:
				if (subcat === `weapon`) {
					const wepn_name = formatted[subcat];
					if (wepn_name) {
						usage_records.wepn[wepn_name] = {
							...usage_records[wepn_name],
							subs: [...new Set([
								...(usage_records[wepn_name]?.subs ?? []),
								formatted.name
							])]
						};
					}
				}
		}
	}
	return formatted;
}

module.exports = {
	rawToJson,
	linkUsedBy
};
