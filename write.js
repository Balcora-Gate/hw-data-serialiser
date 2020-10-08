const writeToFile = async (data) => {
	const fs = require(`fs`);
	console.log(Object.keys(data));
	console.log(`Attempting to write...`);
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
};

const writeToDb = async (data) => {
	const mongodb = require(`mongodb`);
	console.log(`Attempting to insert to db...`);
	const MongoClient = mongodb.MongoClient;
	const uri = `mongodb+srv://${process.env.CLUSTER_USER_NAME}:${process.env.CLUSTER_USER_PASS}@${process.env.CLUSTER_STR}`;
	console.log(uri);
	const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
	
	return new Promise((res, rej) => {
		client.connect(async err => {
			if (err !== null) {
				console.error(err);
				rej(err);
			}
			const db = client.db(process.env.CLUSTER_DB_NAME);
			db.on(`error`, (err) => {
				console.error(err);
				rej(err);
			});
			for (const [cat, cat_data] of Object.entries(data)) {
				console.group(cat);
				if (cat === `default`) continue;
				const collection = db.collection(cat, (err, resu) => {
					if (err) console.error(err);
					else console.log(resu);
				});
				await collection.deleteMany({}); // clear old data
				await collection.insertMany(cat_data, (err) => {
					if (err) {
						console.group(`err:`);
						console.error(err);
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
};

module.exports = {
	writeToFile,
	writeToDb
};