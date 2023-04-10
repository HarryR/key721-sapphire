DOCKER_RUN=docker run -v `pwd`:/src:rw --rm -ti -u `id -u`:`id -g`
HARDHAT=pnpm hardhat --network sapphire_local
REPO=key721-sapphire
LABEL=harryr
DEVACCT_PUBLIC=0x6052795666b7B062910AaC422b558445F1E4bcC5
DEVACCT_SECRET=0xef2cebd4fe2ed0045f8b12bea2b9a7245d2db5e9d35eb7234f65c15e8facbecc
DOCKER_RUN=docker run -v `pwd`:/src:rw --rm -ti -u `id -u`:`id -g`
DOCKER_RUN_DEV=$(DOCKER_RUN) --network host -w /src -h key721-dev -e HOME=/src -e HISTFILESIZE=0 -e PRIVATE_KEY=$(DEVACCT_SECRET)

#####################################################################

all:
	@echo ...

sapphire-dev:
	docker run --rm -it -p8545:8545 -p8546:8546 ghcr.io/oasisprotocol/sapphire-dev:local -to $(DEVACCT_PUBLIC)

cache:
	mkdir cache

cache/%.docker: Dockerfile.% cache
	docker build -f $< -t "${REPO}/$*" .
	docker image inspect "${REPO}/$*" > $@

clean:
	rm -rf artifacts cache node_modules typechain-types .bash_history .cache .local

.PHONY:
%-shell: cache/%.docker
	$(DOCKER_RUN_DEV) "${REPO}/$*" /bin/bash

.PHONY:
%-monitor: cache/%.address
	$(HARDHAT) key721-monitor --stats --chain sapphire_local --alg $* --contract `cat cache/$*.address` --deployedHeight `cat cache/$*.height` --dbfile cache/monitor.sqlite3

.PHONY:
%-fetch-ethplorer: cache/%.address
	$(HARDHAT) key721-fetch-ethplorer cache/monitor.$*.sqlite3

#####################################################################

test: $(patsubst %, cache/%.burn, secp256k1 ed25519)
test-bn254: cache/bn254.burn
test-secp256k1: cache/secp256k1.burn
test-ed25519: cache/ed25519.burn
test-x25519: cache/x25519.burn

cache/%.address: $(wildcard contracts/*.sol)
	if [ ! -f "$@" ]; then \
		$(HARDHAT) key721-deploy --yes $* ; \
	fi

cache/%.transfer: cache/%.address cache/%-mint.tokenid
	$(HARDHAT) key721-transfer `cat cache/$*.address` `cat cache/$*-mint.tokenid` $(DEVACCT_PUBLIC) $(DEVACCT_PUBLIC)

cache/%.burn: cache/%-mint.tokenid
	$(HARDHAT) key721-burn --alg $* --debug `cat cache/$*.address` `cat cache/$*-mint.tokenid`
	rm -f $<

cache/%-mint.tokenid: cache/%.address
	$(HARDHAT) key721-mint --alg $* --debug `cat cache/$*.address` | tee $@ || rm $@

cache/%-mint-to.tokenid: cache/%.address
	$(HARDHAT) key721-mint --alg $* --debug `cat cache/$*.address` $(DEVACCT_PUBLIC) | tee $@
