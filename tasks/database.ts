import { task } from "hardhat/config";
import * as sqlite3 from 'sqlite3'
import * as sqlite from 'sqlite'
import { p256k1_key721_id_to_addresses, SupportedCurves } from "./pubkeys";

export type Sqlite3DB = sqlite.Database<sqlite3.Database, sqlite3.Statement>;

export class Db
{
    public key721: DbManagerKey721;
    public balance: DbManagerBalance;
    public token: DbManagerToken;
    public fetchers: DbManagerFetchers;
    public keychecks: DbManagerKeychecks;

    constructor(public _handle:Sqlite3DB)
    {
        this.key721 = new DbManagerKey721(this);
        this.balance = new DbManagerBalance(this);
        this.token = new DbManagerToken(this);
        this.fetchers = new DbManagerFetchers(this);
        this.keychecks = new DbManagerKeychecks(this);
    }

    public async setup()
    {
        this.token.setup();
        this.balance.setup();
        this.token.setup();
        this.fetchers.setup();
        this.keychecks.setup();
    }

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
        return new Db(db);
    }

    public prop(name:string) {
        return new DbProp(name, this._handle);
    }
}

// ------------------------------------------------------------------

class DbManagerKeychecks
{
    private _handle:Sqlite3DB;
    constructor(db:Db) {
        this._handle = db._handle;
    }
    public async setup() {
        // Fetchers keep track of their key checks
        await this._handle.run(`
            CREATE TABLE IF NOT EXISTS keychecks
            (
                api TEXT NOT NULL,
                chain TEXT NOT NULL,
                key721_id TEXT NOT NULL,

                next_check INTEGER NOT NULL,
                last_check INTEGER NOT NULL,

                PRIMARY KEY(api,chain,key721)
            );
        `);
    }
    public async delete(key721_id:string) {
        this._handle.run(`
            DELETE FROM keychecks WHERE key721_id = ?
        `, key721_id);
    }
    public async sync(api:string, key721_id:string, next_check:number, last_check:number) {
        // TODO: UPSERT WHERE last_check less recent only
        await this._handle.run(`
            INSERT OR REPLACE INTO keychecks (
                api, key721_id, last_check, next_check
            ) VALUES (
                ?    ?,         ?,          ?
            ) ON CONFLICT UPDATE
            SET last_check = ?, next_check = ?
        `,      api, key721_id, last_check, next_check,
                last_check, next_check
        );
    }
}

// ------------------------------------------------------------------

interface DbFetcher {
    api:string;
    chain:string;
    height:number;
}
class DbManagerFetchers
{
    private _handle:Sqlite3DB;

    constructor(db:Db) {
        this._handle = db._handle;
    }

    public async setup() {
        // API fetchers run per-chain, across (potentially) multiple contracts
        await this._handle.run(`
            CREATE TABLE IF NOT EXISTS fetchers
            (
                api TEXT NOT NULL,
                chain TEXT NOT NULL,
                height INTEGER NOT NULL,
                PRIMARY KEY(api,chain)
            );
        `);
    }

    public async all()
    {
        return await this._handle.all<DbFetcher[]>('SELECT * FROM fetchers');
    }

    public async sync(api:string, chain:string, height:number=0)
    {
        await this._handle.run(`
            INSERT INTO fetchers VALUES (?,?,?) ON CONFLICT DO UPDATE SET height = ? WHERE height < ?;
        `, api, chain, height, height, height);

        const resp = await this._handle.get<{height:number}>(`
            SELECT height FROM fetchers WHERE api = ? AND chain = ?
        `, api, chain);

        if( ! resp ) {
            throw Error("Couldn't sync fetchers");
        }

        return resp.height;
    }
}

// ------------------------------------------------------------------

export interface DbToken {
    chain:string,
    contract:string|null,

    name:string|null,
    decimals:number,
    symbol:string|null,
    description:string,
    website:string
}

class DbManagerToken
{
    private _handle:Sqlite3DB;

    private _cache:Map<{chain:string,contract:string|null},DbToken>;

    constructor(db:Db) {
        this._handle = db._handle;
        this._cache = new Map<{chain:string,contract:string|null},DbToken>();
    }

    public async setup() {
        // 'contract' is NULL when it's the native token (e.g. ETH, BTC)
        await this._handle.run(`
            CREATE TABLE IF NOT EXISTS token
            (
                chain TEXT NOT NULL,
                contract TEXT,

                name TEXT,
                decimals INTEGER,
                symbol TEXT,
                description TEXT,
                website TEXT,

                PRIMARY KEY(chain,contract)
            );
        `);
    }

    public async all() {
        return await this._handle.all<DbToken[]>('SELECT * FROM token');
    }

    public async get(chain:string, contract:string|null=null)
    {
        const idx = {chain:chain, contract:contract};
        if( this._cache.has(idx) ) {
            return this._cache.get(idx);
        }

        let value : DbToken | undefined;

        if( ! contract ) {
            value = await this._handle.get<DbToken>(
                'SELECT * FROM token WHERE chain = ? AND contract IS NULL',
                chain);
        }
        else {
            value = await this._handle.get<DbToken>(
                'SELECT * FROM token WHERE chain = ? AND contract = ?',
                chain, contract);
        }

        if( value ) {
            this._cache.set(idx, value);
        }
        return value;
    }

    public async create(x:DbToken)
    {
        const idx = {chain:x.chain, contract:x.contract};
        if( this._cache.has(idx) ) {
            const x = this._cache.get(idx);
            if( ! x ) {
                throw Error("Couldn't get from cache!");
            }
            return x;
        }

        await this._handle.run(`
            INSERT INTO token (
                chain,    contract,      name,     decimals,
                symbol,   description,   website
            ) VALUES (
                ?,        ?,             ?,        ?,
                ?,        ?,             ?
            );`,
              x.chain,  x.contract,    x.name,   x.decimals,
              x.symbol, x.description, x.website);

        this._cache.set(idx, x);
        return x;
    }

    public async sync(x:DbToken) {
        const y = await this.get(x.chain, x.contract);
        if( y ) {
            return y;
        }
        return this.create(x);
    }
}

// ------------------------------------------------------------------

export interface DbBalance {
    api:string;
    key721_id:string;

    chain:string;
    token_contract:string|null;
    amount:string;
    stamp:number;
}

class DbManagerBalance
{
    private _handle:Sqlite3DB;

    constructor(db:Db) {
        this._handle = db._handle;
    }

    public async setup() {
        await this._handle.run(`
            CREATE TABLE IF NOT EXISTS balance
            (
                api TEXT NOT NULL,
                key721_id TEXT NOT NULL,

                chain TEXT NOT NULL,
                token_contract TEXT,
                amount TEXT NOT NULL,
                stamp INTEGER NOT NULL,

                PRIMARY KEY(api,key721_id)
        `);
    }

    public async all(token_id:string) {
        return await this._handle.all<DbBalance[]>('SELECT * FROM balance WHERE key721_id = ?', token_id);
    }

    public async create(x:DbBalance) {
        await this._handle.run(`
            INSERT INTO balance (
                  api,      key721_id,   chain,   token_contract,
                  amount,   stamp
            ) VALUES (
                  ?,        ?,           ?,       ?,
                  ?,        ?
            );`,
                x.api,    x.key721_id, x.chain, x.token_contract,
                x.amount, x.stamp);
        return x;
    }

    public async delete_all(key721_id:string, api:string|null=null) {
        if( api !== null )  {
            return await this._handle.run(`
                DELETE FROM balance WHERE api = ? AND key721_id = ?
            `, api, key721_id);
        }
        else {
            return await this._handle.run(`
                DELETE FROM balance WHERE key721_id = ?
            `, key721_id);
        }
    }

    public async replace(key721_id:string, api:string, balances:DbBalance[])
    {
        await this._handle.run('BEGIN TRANSACTION;');
        await this.delete_all(key721_id, api);
        for( const b of balances ) {
            await this.create(b);
        }
        await this._handle.run('COMMIT TRANSACTION;');
    }

    public async exists(api:string, key721_id:string)
    {
        return (await this._handle.get<{count:number}>(
            'SELECT COUNT(api) AS count FROM balance WHERE api = ? AND key721_id = ?',
            api, key721_id))?.count != 0;
    }
}

// ------------------------------------------------------------------

export class DbKey721
{
    constructor(
        public chain:string,
        public contract:string,
        public key721_id:string,

        public alg:SupportedCurves,
        public created_height:number,
        public tx:string,
        public owner:string,
        public txfer_height:number,
        public txfer_count:number)
    { }

    public addresses() {
        return p256k1_key721_id_to_addresses(this.key721_id);
    }
}

class DbManagerKey721
{
    private _handle:Sqlite3DB;

    constructor(db:Db) {
        this._handle = db._handle;
    }

    public async setup() {
        await this._handle.run(`
            CREATE TABLE IF NOT EXISTS key721
            (
                key721_id TEXT NOT NULL PRIMARY KEY,

                chain TEXT NOT NULL,
                contract TEXT NOT NULL,

                alg TEXT NOT NULL,
                created_height NUMBER NOT NULL,
                tx TEXT NOT NULL,
                owner TEXT NOT NULL,
                txfer_height NUMBER NOT NULL,
                txfer_count NUMBER NOT NULL
            );
        `);
    }

    public async create(x:DbKey721) {
        await this._handle.run(
            `INSERT INTO key721 (
                key721_id,   chain,   contract,       alg,   created_height,
                tx,          owner,   txfer_height,   txfer_count
            ) VALUES (
                ?,           ?,       ?,              ?,     ?,
                ?,           ?,       ?,              ?
            );`,
              x.key721_id, x.chain, x.contract,     x.alg, x.created_height,
              x.tx,        x.owner, x.txfer_height, x.txfer_count);
        return x;
    }

    public async get(token_id:string) {
        return this._handle.get<DbKey721>('SELECT * FROM key721 WHERE token_id = ?', token_id);
    }

    public async since(height:number) {
        return this._handle.all<DbKey721[]>('SELECT * FROM key721 WHERE created_height >= ?', height);
    }

    public async exists(token_id:string) {
        return (await this._handle.get<{count:number}>('SELECT COUNT(token_id) AS count FROM key721 WHERE token_id = ?', token_id))?.count != 0;
    }

    public async delete(token_id:string) {
        return await this._handle.run('DELETE FROM key721 WHERE token_id = ?', token_id);
    }

    public async update_owner(token_id:string, owner:string, height:number) {
        await this._handle.run('UPDATE key721 SET owner = ?, txfer_height = ?, txfer_count = txfer_count + 1 WHERE token_id = ?',
                                owner, height, token_id);
    }

    public async find_unchecked(api:string, chain:string, after_height:number=0)
    {
        return await this._handle.all<DbKey721[]>(`
        SELECT a.*
          FROM key721 AS a
     LEFT JOIN keychecks AS b ON(
                        b.api = ?
                    AND b.chain = ?
                    AND a.key721_id = b.key721_id)
         WHERE a.chain = ?
           AND a.created_height >= ?
           AND b.key721_id IS NULL
             ;
        `);
    }
}

// ------------------------------------------------------------------

export class DbProp
{
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

// ------------------------------------------------------------------

task('key721-database')
    .addPositionalParam("dbfile", 'Database file')
    .addPositionalParam("subcommand", 'Which command?')
    .setDescription('Run NFT (Key721) database utilities')
    .setAction(main);

interface MainArgs {
    dbfile: string;
    subcommand: string;
}

async function main(args: MainArgs)
{
    const db = await Db.open(args.dbfile);

    console.log('TODO: implement useful functions here!');
}
