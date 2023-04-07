DOCKER_RUN=docker run -v `pwd`:/src:rw --rm -ti -u `id -u`:`id -g`
HARDHAT=pnpm hardhat --network sapphire_local
REPO=key721-sapphire
LABEL=harryr
DEVACCT_PUBLIC=0x6052795666b7B062910AaC422b558445F1E4bcC5
DEVACCT_SECRET=0xef2cebd4fe2ed0045f8b12bea2b9a7245d2db5e9d35eb7234f65c15e8facbecc
DOCKER_RUN=docker run -v `pwd`:/src:rw --rm -ti -u `id -u`:`id -g`
DOCKER_RUN_DEV=$(DOCKER_RUN) --network host -w /src -h whatwallet-dev -e HOME=/src -e HISTFILESIZE=0 -e PRIVATE_KEY=$(DEVACCT_SECRET)

all:
	@echo ...

sapphire-dev:
	docker run --rm -it -p8545:8545 -p8546:8546 ghcr.io/oasisprotocol/sapphire-dev:local -to $(DEVACCT_PUBLIC)

cache:
	mkdir cache

cache/%.docker: Dockerfile.% cache
	docker build -f $< -t "${REPO}/$*" .
	docker image inspect "${REPO}/$*" > $@

.PHONY:
%-shell: cache/%.docker
	$(DOCKER_RUN_DEV) "${REPO}/$*" /bin/bash

deploy: cache/deployed.address

cache/deployed.address: $(wildcard contracts/*.sol)
	$(HARDHAT) key721-deploy --yes

monitor: cache/deployed.address
	$(HARDHAT) key721-monitor --stats `cat cache/deployed.address` `cat cache/deployed.height` cache/monitor.sqlite3

fetch-ethplorer: cache/deployed.address
	$(HARDHAT) key721-fetch-ethplorer cache/monitor.sqlite3

test: test-transfer test-burn

.PHONY:
test-transfer: cache/deployed.address cache/mint.tokenid
	$(HARDHAT) key721-transfer `cat cache/deployed.address` `cat cache/mint.tokenid` $(DEVACCT_PUBLIC) $(DEVACCT_PUBLIC)

.PHONY:
test-mint: cache/mint.tokenid

.PHONY:
test-burn: cache/mint.tokenid
	$(HARDHAT) key721-burn --debug `cat cache/deployed.address` `cat cache/mint.tokenid`
	rm -f $<

.PHONY:
test-mint-to: cache/mint-to.tokenid

cache/mint.tokenid: cache/deployed.address
	$(HARDHAT) key721-mint `cat cache/deployed.address` | tee $@ || rm $@

cache/mint-to.tokenid: cache/deployed.address
	$(HARDHAT) key721-mint `cat cache/deployed.address` $(DEVACCT_PUBLIC) | tee $@

clean:
	rm -rf artifacts cache node_modules typechain-types .bash_history .cache .local