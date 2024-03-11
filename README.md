# hw-data-compiler

Real simple tool for compiling extracted mod data into JSON format. Point the script to the root of the mod, specify entity types to compile, watch it go.

<p align="center"><img src="https://i.imgur.com/uMvwk6r.png" alt="BALCORA" /></p>

---

## Usage
Execution syntax:
```shell
npm run compile -- [-w] [-db]
```
Quick example writing to file:
```shell
npm run compile -- -w
```
Details:
1. Clone this repo somewhere (`git clone https://github.com/HW-PlayersPatch/hw-data-compiler.git`)
    1. If you want to use this within your own project, `npm install hw-data-compiler`
2. Navigate into the cloned repo (probably with `cd hw-data-compiler`) and run `npm install`
3. `npm run compile` is the command to run the script, **it can take two flags:**
    1. `-w`: 'Write to file', writes the compiled data into a file called `dump.json`
    2. `-db`: 'Write to database', writes the compiled data into an [Atlas](https://www.mongodb.com/cloud/atlas) database according to variables in your `.env` file (see below).
4. Follow the prompts:
    1. Enter the root of the mod you want to compile (the directory containing the `keeper.txt` file)
    2. Indicate which data categories you're interested in (comma seperated), valid arguments are `ship`, `weapon`, `subsystem`
5. Data will be parsed and compiled, and written to the flagged destinations.

Demonstration of writing mod contents to file:
```shell
fear$ npm run compile -- -w

> hw-data-compiler@1.0.0 compile /path/to/script/dir
> node ./main.js "-w"

Enter the root of the mod directory: /path/to/mod/root
Attempting to compile data from /path/to/mod/root
Which subdirectories? (Default is 'ship, subsystem, weapon'): <ENTER>
(lots of output...)
[ 'ship', 'subs', 'wepn' ]
Attempting to write...
File write success (at ./dump.json)!
fear$
```
Everything will be dumped into a file in the same directory as the script called `dump.json`.

### .env

First, create a copy of the `.env.example` file and call it `.env`.

Inside `.env`, you need to supply four variables:
- `CLUSTER_USER_NAME`, the name of the cluster user
- `CUSTER_USER_PASS`, the password of the cluster user
- `CLUSTER_STR`, the connection string of the cluster
- `CLUSTER_DB_NAME` the database to use
