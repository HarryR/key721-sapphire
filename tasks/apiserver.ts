import { task, types } from "hardhat/config";
import * as http from "http";
import { Db, DbBalance, DbKey721 } from "./database";

type HandlerFunction = (url:URL, res:http.ServerResponse) => Promise<any>;

class APIHandler
{
    private routes:Record<string,HandlerFunction>;

    constructor(private db:Db)
    {
        this.routes = {
            '/fetchers': this.api_fetchers,
            '/balance': this.api_balance,
            '/tokens': this.api_tokens,
        }
    }

    async api_tokens (url:URL, res:http.ServerResponse) {
        return {
            ok: 1,
            tokens: await this.db.token.all()
        }
    }

    async api_balance (url:URL, res:http.ServerResponse) {
        const tokens = url.searchParams.get('tokens')
        if( ! tokens ) {
            throw Error("No 'tokens' param specified!");
        }

        const out_resp = new Map<string,{key721:DbKey721,balances:DbBalance[]}>();
        const unknown:string[] = [];
        for( const key721_id of tokens.split(',') )
        {
            const key721 = await this.db.key721.get(key721_id);
            if( key721 ) {
                out_resp.set(key721_id, {
                    key721: key721,
                    balances: await this.db.balance.all(key721_id)
                });
            }
            else {
                unknown.push(key721_id);
            }
        }
        return {
            ok: 1,
            data: out_resp,
            unknown: unknown
        }
    }

    async api_fetchers (url:URL, res:http.ServerResponse) {    
        return {
            ok: 1,
            fetchers: await this.db.fetchers.all()
        }
    }

    public async request_handler (req:http.IncomingMessage, res:http.ServerResponse)
    {
        res.setHeader("Content-Type", "application/json");

        if( req.url && req.url in this.routes )
        {
            const url = new URL(req.url);            
            const handler = this.routes[url.pathname];
            try {
                const data = await handler(url, res);
                res.writeHead(200);
                res.end(JSON.stringify(data));
                return;
            }
            catch( e ) {
                res.writeHead(500);
                res.end(JSON.stringify({
                    message: String(e),
                    error: 1
                }));
                return;
            }
        }
        
        res.writeHead(404);
        res.end(JSON.stringify({
            message: `unknown route ${req.url}`,
            error: 1
        }));
    }
}

// ------------------------------------------------------------------

task('key721-apiserver')
    .addOptionalParam('port', 'HTTP Listen Port', 9183, types.int)
    .addOptionalParam('listen', 'HTTP Listen Address')
    .addParam('dbfile', 'Database File')
    .setDescription('API Server')
    .setAction(main);

interface MainArgs {
    host: string;
    port: number;
    dbfile: string;
}

async function main(args: MainArgs)
{
    const db = await Db.open(args.dbfile);
    const handler = new APIHandler(db);
    const server = http.createServer(handler.request_handler);
    server.listen(args.host, args.port, () => {
        console.log(`Server is running on http://${args.host}:${args.port}`);
    });
}
