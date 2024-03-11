# hw-data-serialiser

Real simple tool for serialising extracted mod data into JSON format. Point the script to the root of the mod, specify entity types to serialise, watch it go.

<p align="center"><img src="https://i.imgur.com/uMvwk6r.png" alt="BALCORA" /></p>

---

## Usage

Execution syntax:
```shell
node ./main.js [-w] [-db]
```
Quick example writing to file:
```shell
node ./main.js -w
```
Details:
1. Clone this repo somewhere (`git clone https://github.com/HW-PlayersPatch/hw-data-serialiser.git`)
    1. If you want to use this within your own project, `npm install hw-data-serialiser`
2. Navigate into the cloned repo (probably with `cd hw-data-serialiser`) and run `npm install`
3. `node ./main.js` is the command, **it can take two flags:**
    1. `-w`: 'Write to file', writes the serialised data into a file called `dump.json`
    2. `-db`: 'Write to database', writes the serialised data into an [Atlas](https://www.mongodb.com/cloud/atlas) database according to variables in your `.env` file (see below).
4. Follow the prompts:
    1. Enter the root of the mod you want to serialise (the directory containing the `keeper.txt` file)
    2. Indicate which data categories you're interested in (comma seperated), valid arguments are `ship`, `weapon`, `subsystem`
5. Data will be parsed and serialised, and written to the flagged destinations.

Demonstration of writing mod contents to file:
```shell
❯ node .\main.js -w

Enter the root of the mod directory: /path/to/mod/root
Attempting to serialise data from /path/to/mod/root
Which subdirectories? (Default is 'ship, subsystem, weapon'): <ENTER>
(lots of output...)
[ 'ship', 'subs', 'wepn' ]
Attempting to write...
File write success (at ./dump.json)!

❯ 
```
Everything will be dumped into a file in the same directory as the script called `dump.json`.

### .env (optional for writing to db)

First, create a copy of the `.env.example` file and call it `.env`.

Inside `.env`, you need to supply four variables:
- `CLUSTER_USER_NAME`, the name of the cluster user
- `CUSTER_USER_PASS`, the password of the cluster user
- `CLUSTER_STR`, the connection string of the cluster
- `CLUSTER_DB_NAME` the database to use
