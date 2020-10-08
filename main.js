require('dotenv').config();
const readline = require("readline");

const writers = require(`./write`);
const { makeLister, makeReader, makeDataGetter } = require(`./files`);
const { linkUsedBy } = require('./parsing');
const { link } = require('fs');

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});


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
			const data = linkUsedBy((await dataGetter(subdirs)).reduce((acc, arr) => {
				acc[arr[0].category] = arr;
				return acc;
			}, {}));
			if (process.argv.slice(2).includes(`-w`)) {
				await writers.writeToFile(data);
			}
			if (process.argv.slice(2).includes(`-db`)) {
				await writers.writeToDb(data);
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