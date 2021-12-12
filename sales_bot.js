const solanaWeb3 = require('@solana/web3.js');
const { Connection, programs } = require('@metaplex/js');
const axios = require('axios');
const logger = require('./logger');

if (!process.env.PROJECT_ADDRESS || !process.env.DISCORD_URL) {
    logger.error("Please set your environment variables!");
    return;
}

const projectPubKey = new solanaWeb3.PublicKey(process.env.PROJECT_ADDRESS);
const url = solanaWeb3.clusterApiUrl('mainnet-beta');
const solanaConnection = new solanaWeb3.Connection(url, 'confirmed');
const metaplexConnection = new Connection('mainnet-beta');
const { metadata: { Metadata } } = programs;
const pollingInterval = 2000; // ms
const marketplaceMap = {
    "MEisE1HzehtrDpAAT8PnLHjpSSkRYakotTuJRPjTpo8": "Magic Eden",
    "HZaWndaNWHFDd9Dhk5pqUUtsmoBCqzb1MLu3NAh1VX6B": "Alpha Art",
    "617jbWo616ggkDxvW1Le8pV38XLbVSyWY8ae6QUmGBAU": "Solsea",
    "CJsLwbP1iu5DuUikHEJnLfANgKy6stB2uFgvBBHoyxwz": "Solanart",
    "A7p8451ktDCHq5yYaHczeLMYsjRsAkzc3hCXcSrwYHU7": "Digital Eyes",
    "AmK5g2XcyptVLCFESBCJqoSfwV3znGoVYQnqEnaAZKWn": "Exchange Art",
};

const runSalesBot = async () => {
    logger.info("Starting sales bot...");

    let signatures;
    let lastKnownSignature;
    const options = {};
    while (true) {
        try {
            signatures = await solanaConnection.getSignaturesForAddress(projectPubKey, options);
            if (!signatures.length) {
                logger.debug("Polling for signatures...")
                await timer(pollingInterval);
                continue;
            }
        } catch (err) {
            logger.error("Could not fetch signatures: " + err);
            continue;
        }

        for (let i = signatures.length - 1; i >= 0; i--) {
            try {
                let { signature } = signatures[i];
                const txn = await solanaConnection.getTransaction(signature);
                if (txn.meta && txn.meta.err != null) { continue; }

                const dateString = new Date(txn.blockTime * 1000).toLocaleString();
                const price = Math.abs((txn.meta.preBalances[0] - txn.meta.postBalances[0])) / solanaWeb3.LAMPORTS_PER_SOL;
                const accounts = txn.transaction.message.accountKeys;
                const marketplaceAccount = accounts[accounts.length - 1].toString();

                if (marketplaceMap[marketplaceAccount]) {
                    const metadata = await getMetadata(txn.meta.postTokenBalances[0].mint);
                    if (!metadata) {
                        logger.error("Could not fetch metadata");
                        continue;
                    }

                    logger.info("New Sale Found!")
                    logger.info({
                        date: dateString,
                        price,
                        signature,
                        title: metadata.name,
                        marketplace: marketplaceMap[marketplaceAccount],
                        image: metadata.image
                    })

                    try {
                        await postSaleToDiscord(metadata.name, price, dateString, signature, metadata.image)
                    } catch (err) {
                        logger.error("Could not POST to Discord: " + err)
                    }
                } else {
                    logger.error("Marketplace not supported: " + marketplaceAccount);
                }
            } catch (err) {
                logger.error(err);
                continue;
            }
        }

        lastKnownSignature = signatures[0].signature;
        if (lastKnownSignature) {
            options.until = lastKnownSignature;
        }
    }
}
runSalesBot();

const timer = ms => new Promise(res => setTimeout(res, ms))

const getMetadata = async (tokenPubKey) => {
    try {
        const addr = await Metadata.getPDA(tokenPubKey)
        const resp = await Metadata.load(metaplexConnection, addr);
        const { data } = await axios.get(resp.data.data.uri);

        return data;
    } catch (error) {
        logger.error("Could not fetch metadata: " + error)
    }
}

const postSaleToDiscord = async (title, price, date, signature, imageURL) => {
    await axios.post(process.env.DISCORD_URL,
        {
            "embeds": [
                {
                    "title": `SALE`,
                    "description": `${title}`,
                    "fields": [
                        {
                            "name": "Price",
                            "value": `${price} SOL`,
                            "inline": true
                        },
                        {
                            "name": "Date",
                            "value": `${date}`,
                            "inline": true
                        },
                        {
                            "name": "Explorer",
                            "value": `https://explorer.solana.com/tx/${signature}`
                        }
                    ],
                    "image": {
                        "url": `${imageURL}`,
                    }
                }
            ]
        }
    )
}