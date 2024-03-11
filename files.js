const readdir = require("recursive-readdir");
const fs = require("fs");

const rawToJson = require(`./parsing`).rawToJson;

/**
 * A `Reader` is just a function
 * which takes an array of file paths, filters them according to its config
 * (the params of this function), then asynchronously reads all the filtered
 * files into json format.
 * 
 * @callback Reader
 * @param { string[] } file_paths The files to serialise
 * @return { Promise.<(EntityData | string)[]> }
 */

/**
 * Function which creates a `Reader`.
 * 
 * @param { string } root_dir The root directory to index from
 * @param { string[] } valid_extensions Any valid file extensions to include
 * 
 * @return { Reader }
 */
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
					const name =  path.match(/(\w+)\.\w+$/m)[1];
					const cat = pattern.exec(path)[1];
					res(rawToJson(name, cat, contents));
				});
			});
		}));
	};
}

/**
 * A `Lister` is just a function which lists all the files in it's specified `sub_dir`
 * (which must be a subdir of `root_dir` used when creating the `Lister` via `makeLister`.
 * 
 * @callback Lister
 * @param { string } sub_dir The subdirectory to list files from
 * @return { Promise.<string[]> }
 */

/**
 * Function which creates a `Lister`.
 * 
 * @param { string } root_dir The root directory to index against
 * 
 * @return { Lister }
 */
function makeLister(root_dir) {
	return (sub_dir) => {
		return readdir(`${root_dir}/${sub_dir}`);
	};
}


/**
 * @callback DataGetter
 * @param { string[] } sub_dirs
 * @return { Promise.<( EntityData | string )[]> }
 */

/**
 * Function which just returns a `DataGetter`
 * 
 * @param { Lister } list `Lister` to list files from
 * @param { Reader } read `Reader` to read the listed files
 * 
 * @return { DataGetter }
 */
function makeDataGetter(list, read) {
	return async (sub_dirs) => {
		return Promise.all(sub_dirs.map(async sd => {
			console.log(`Compiling: ${sd}`);
			return read(await list(sd));
		}));
	};
}

module.exports = {
	makeReader,
	makeLister,
	makeDataGetter
};