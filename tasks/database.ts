import { task } from "hardhat/config";
import * as sqlite3 from 'sqlite3'
import * as sqlite from 'sqlite'
import { p256k1_tokenId_to_addresses } from "./pubkeys";

export type Sqlite3DB = sqlite.Database<sqlite3.Database, sqlite3.Statement>;

export class Db {
    public static async open(dbfile:string) {
        const db = await sqlite.open({
            filename: dbfile,
            driver: sqlite3.Database
        });
        await db.run(`
            CREATE TABLE IF NOT EXISTS props (
                name TEXT NOT NULL PRIMARY KEY,
                value TEXT
            );
        `);
        await db.run(`
            CREATE TABLE IF NOT EXISTS key721 (
                key721_id TEXT NOT NULL PRIMARY KEY,
                chain TEXT NOT NULL,
                contract TEXT NOT NULL,
                created_height NUMBER NOT NULL,
                tx TEXT NOT NULL,
                owner TEXT NOT NULL,
                txfer_height NUMBER NOT NULL,
                txfer_count NUMBER NOT NULL
            );
        `);
        await db.run(`
            CREATE TABLE IF NOT EXISTS token (
                token_id INTEGER PRIMARY KEY AUTOINCREMENT,
                chain TEXT NOT NULL,
                contract TEXT,
                name TEXT,
                decimals INTEGER NOT NULL,
                symbol TEXT,
                description TEXT,
                website TEXT,
                UNIQUE(chain,contract)
            );
        `);
        await db.run(`
            CREATE TABLE IF NOT EXISTS deposit (
                deposit_id INTEGER PRIMARY KEY AUTOINCREMENT,
                key721_id TEXT NOT NULL,
                token_id INTEGER NOT NULL,
                chain TEXT NOT NULL,
                txid TEXT NOT NULL,         
                amount TEXT NOT NULL,
                next_update INTEGER NOT NULL,
                UNIQUE(chain,txid)
            );
        `);
        return new Db(db);
    }

    constructor(public _handle:Sqlite3DB) {}

    public prop(name:string) {
        return new DbProp(name, this._handle);
    }

    public async key721_get(token_id:string) {
        return DbKey721.get(this, token_id);
    }
    public async key721_since(height:number) {
        return this._handle.all<DbKey721[]>('SELECT * FROM key721 WHERE created_height >= ?', height);
    }
    public async key721_exists(token_id:string) {
        return (await this._handle.get<{count:number}>('SELECT COUNT(token_id) AS count FROM key721 WHERE token_id = ?', token_id))?.count != 0;
    }
    public async key721_delete(token_id:string) {
        return await this._handle.run('DELETE FROM key721 WHERE token_id = ?', token_id);
    }
    public async key721_update_owner(token_id:string, owner:string, height:number) {
        await this._handle.run('UPDATE key721 SET owner = ?, txfer_height = ?, txfer_count = txfer_count + 1 WHERE token_id = ?',
                                owner, height, token_id);
    }

    public async token_get(chain:string, contract:string|null) {
        // TODO: cache results, these objects rarely change
        if( contract === null ) {
            return await this._handle.get<DbToken>(
                'SELECT * FROM token WHERE chain = ? AND contract IS NULL',
                chain);
        }
        else {
            return await this._handle.get<DbToken>(
                'SELECT * FROM token WHERE chain = ? AND contract = ?',
                chain, contract);
        }
    }
    public async token_create(x:DbToken) {
        return await this._handle.run(`
            INSERT INTO token (
                chain, contract, name, decimals,
                symbol, description, website
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
            x.chain, x.contract, x.name, x.decimals,
            x.symbol, x.description, x.website);
    }
}

export class DbToken {
    constructor(
        public tokenId:number,
        public chain:string,
        public contract:string|null,
        public name:string|null,
        public decimals:number,
        public symbol:string|null,
        public description:string,
        public website:string
    )
    { }
}

export class DbKey721 {
    constructor(
        public key721_id:string,
        public chain:string,
        public contract:string,
        public created_height:number,
        public tx:string,
        public owner:string,
        public txfer_height:number,
        public txfer_count:number)
    { }
    public async create(db:Db) {
        await db._handle.run('INSERT INTO key721 VALUES (?,?,?,?,?,?,?,?)',
                            this.key721_id, this.chain, this.contract, this.created_height, this.tx, this.owner, this.txfer_height, this.txfer_count);
    }
    public static async get(db:Db, token_id:string) {
        return db._handle.get<DbKey721>('SELECT * FROM key721 WHERE token_id = ?', token_id);
    }
    public addresses() {
        return p256k1_tokenId_to_addresses(this.key721_id);
    }
}

export class DbProp {
    constructor(public name:string, private _db:Sqlite3DB) {}    
    public async value() {
        return (await this._db.get<{value:string}>('SELECT value FROM props WHERE name = ?', this.name))?.value;
    }
    public async exists() {
        return (await this._db.get<{count:number}>('SELECT COUNT(name) AS count FROM props WHERE name = ?', this.name))?.count != 0;
    }
    public async set(value:string) {
        await this._db.run('INSERT INTO props (name,value) VALUES (?,?) ON CONFLICT(name) DO UPDATE SET value=?', this.name, value, value);
        return value;
    }
}

task('key721-database')
    .addPositionalParam("dbfile", 'Database file')
    .addPositionalParam("subcommand", 'Which command?')
    .setDescription('Run NFT (Key721) database utilities')
    .setAction(async (taskArgs) => {
        return await main(taskArgs);
    });

interface MainArgs {
    dbfile: string;
    subcommand: string;
}

async function main(args: MainArgs)
{
    const db = await Db.open(args.dbfile);

    console.log('TODO: implement useful functions here!');
}
