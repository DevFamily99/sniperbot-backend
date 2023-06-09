//this is for uniswap v2
const axios = require('axios');
const scanKey = 'KQ3MEFVCCAG7RTC6JJ56ZHU6K1JTDQ41BN';

const Plan = require("../models/one_token_uniswap_plan");
const Logs = require("../models/one_token_uniswap_logs");
const Wallet = require("../models/wallet");
const UniswapNewPair = require('../models/uniswap_new_pairs');

const core_func = require('../utils/core_func');

let socketT;
let io;

const url = {
  wss: process.env.ETH_WS,
  http: process.env.ETH_HTTP,
}
const address = {
  WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  DAI: '0x6b175474e89094c44da98b954eedeac495271d0f',
  SAI: '0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359',
  USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  USDT: '0xdac17f958d2ee523a2206206994597c13d831ec7',
  factory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
  router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
};
const abi = {
  factory: require('./abi/abi_uniswap_v2').factory,
  router: require('./abi/abi_uniswap_v2_router_all.json'),
  token: require('./abi/abi_token.json'),
}

const ethers = require('ethers');
const { JsonRpcProvider } = require("@ethersproject/providers");
const wssprovider = new ethers.providers.WebSocketProvider(url.wss);
const provider = wssprovider;
const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider(url.http));
const uniswapAbi = new ethers.utils.Interface(abi.router);

let plan;
let snipperTokens = [];
let snipperSetting = {};
let control = {
  botIsBusy: false,
  limitBuyMode: true,
  limitBuyCount: 0,
  retryBuy: false,
}
let sendGas = {
  gasPrice: 84,
  gasLimit: 500000
}
const frontRunGasPlusFee = 0;//(gwei)

let initMempool = async () => {
  console.log('~~~~~~Uniswapv2 mempool~~~~~~~')
  await prepareBot();
  const baseToken = address.WETH;
  const re = new RegExp("^0xf305d719");
  const me = new RegExp("^0xe8e33700");
  const he = new RegExp("^0x267dd102");
  const openTrading = new RegExp("^0xc9567bf9");
  const startTrading = new RegExp("^0x293230b8");
  const swapETHForExactTokens = new RegExp("^0xfb3bdb41");
  const swapExactETHForTokens = new RegExp("^0x7ff36ab5");
  // const swapExactETHForTokensSupportingFeeOnTransferTokens = new RegExp("^");
  const swapExactTokensForETH = new RegExp("^0x18cbafe5");
  // const swapExactTokensForETHSupportingFeeOnTransferTokens = new RegExp("^");
  const swapExactTokensForTokens = new RegExp("^0x38ed1739");
  const swapExactTokensForTokensSupportingFeeOnTransferTokens = new RegExp("^0x5c11d795");
  // const swapTokensForExactETH = new RegExp("^");
  const swapTokensForExactTokens = new RegExp("^0x8803dbee");
  wssprovider.on("pending", async (tx) => {
    if (true) {
      wssprovider.getTransaction(tx).then(
          async function (transaction) {
            try {
              //check in uniswapv2 router
              if (transaction && transaction.to === address.router) {
                if (re.test(transaction.data) || me.test(transaction.data)) {// listen addliquidity event
                  try {
                    const decodedInput = uniswapAbi.parseTransaction({
                      data: transaction.data,
                      value: transaction.value,
                    });
                    const tokenName = typeof (decodedInput.args['token']) == 'string' ? String(decodedInput.args['token'].toLowerCase()) : String(decodedInput.args[0]).toLowerCase();
                    const waitTime = (snipperSetting[tokenName] && snipperSetting[tokenName].waitTime) ? snipperSetting[tokenName].waitTime : 0;
                    const snipperAmount = (snipperSetting[tokenName] && snipperSetting[tokenName].eth) ? snipperSetting[tokenName].eth : 0.001;
                    const snipperFunction = (snipperSetting[tokenName] && snipperSetting[tokenName].function) ? snipperSetting[tokenName].function : '';
                    const gasFeeEther = ethers.utils.formatEther(transaction.gasPrice) * 1000000000 + frontRunGasPlusFee;
                    const gasFeeConverted = ethers.utils.formatEther(transaction.gasPrice) * 1000000000;
                    const gasFee = ethers.utils.parseUnits(String(gasFeeEther.toFixed(9)), "gwei");
                    const gasLimit = transaction.gasLimit > 700000 ? transaction.gasLimit : 700000;

                    const name = await getName(tokenName)
                    const symbol = await getSymbol(tokenName)

                    const newPair = new UniswapNewPair({
                      tokenName,
                      txHash: transaction.hash,
                      fnName: decodedInput.name,
                      nonce: transaction.nonce,
                      name: name,
                      symbol: symbol
                    })

                    const pairResult = await UniswapNewPair.find({ tokenName, fnName: decodedInput.name })

                    if (pairResult.length === 0) {
                      console.log(`[Event]-addliquidity-[token]-${tokenName}-[hash]-${transaction.hash}`);
                      newPair.save()
                          .then((pair) => {
                            UniswapNewPair.find({}).sort({ _id: -1 })
                                .then(list => {
                                  if (io) {
                                    io.sockets.emit("uniswap:one:tokensList", list)
                                    io.sockets.emit("uniswap:one:detectAddLiquidity", {
                                      name: tokenName,
                                      hash: transaction.hash,
                                      fnName: decodedInput.name
                                    })
                                  }
                                })
                          })
                          .catch(err => console.log('[Add Liquidity] Error while saving new token -----------', err))
                    }
                    // console.log("|-------------------------------------ADDLIQUIDITYEVENT OF Uniswap-----------------------------");
                    // console.log(`|   [${decodedInput.name}],snipper[${snipperTokens}]`);
                    // console.log('|   [hash]->',transaction.hash);
                    // console.log('|   [tokenName]->',tokenName);
                    // console.log('|   [waitTime,snipperAmount,snipperFunction]->',waitTime,snipperAmount,snipperFunction);
                    // console.log('|   [gas,limit]',transaction.gasPrice,transaction.gasLimit);
                    // console.log('|   [maxPriorityFeePerGas,maxFeePerGas]',transaction.maxPriorityFeePerGas,transaction.maxFeePerGas);
                    // console.log('|   [gasNum]',gasFeeEther);
                    // console.log("|-------------------------------------------------------------------------------|");
                    if (plan && plan.status == 1) {
                      if (snipperTokens.length == 0 && (control.limitBuyMode === false || control.limitBuyCount > 0)) {//in case of all tokens
                        if (gasFeeConverted > 80 && gasFeeConverted < 200) {// we buy all tokens that gasFee is over than 100 gwei
                          await buyTokens(tokenName, baseToken, plan.public, plan.private, snipperAmount, gasFee, transaction.maxPriorityFeePerGas, transaction.maxFeePerGas, gasLimit, plan.autoSellPriceTimes, waitTime, transaction.hash);
                        }
                      } else {//in case of special token
                        if (snipperTokens.indexOf(tokenName) != -1 && snipperFunction == "addLiquidity") {// check if token name is included to tokenName arrays
                          console.log(" ADDLIQUIDITYEVENT OF Uniswap Detected ");
                          const structDatas = [
                            { name: 'tokenName', detail: snipperTokens },
                            { name: 'mempoolHash', detail: transaction.hash },
                            { name: 'waitTime', detail: waitTime },
                            { name: 'snipperAmount', detail: snipperAmount },
                            { name: 'snipperFunction', detail: snipperFunction },
                            { name: 'gasNum', detail: gasFeeEther },
                            { name: 'gasPrice', detail: transaction.gasPrice },
                            { name: 'gasLimit', detail: transaction.gasLimit },
                            { name: 'maxPriorityFeePerGas', detail: transaction.maxPriorityFeePerGas },
                            { name: 'maxFeePerGas', detail: transaction.maxFeePerGas },
                          ];
                          console.table(structDatas);
                          await buyTokens(tokenName, baseToken, plan.public, plan.private, snipperAmount, gasFee, transaction.maxPriorityFeePerGas, transaction.maxFeePerGas, gasLimit, plan.autoSellPriceTimes, waitTime, transaction.hash);
                        }
                        // else if(typeof(decodedInput.args[1])=='string'&&snipperTokens.indexOf(decodedInput.args[1].toLowerCase())!=-1){// check if token name in args[1]
                        //     await buyTokens(decodedInput.args[1].toLowerCase(),baseToken,plan.public,plan.private,snipperAmount,gasFee,transaction.maxPriorityFeePerGas,transaction.maxFeePerGas,gasLimit,plan.autoSellPriceTimes,waitTime,transaction.hash);
                        // }
                      }
                    }
                  } catch (error) {
                    // console.log('[ERROR->pending->getTransaction->if]',error)
                    console.log('[ERROR->getTransaction->if]', error)
                  }
                }
                else if (openTrading.test(transaction.data) || startTrading.test(transaction.data)) { // check for the openTrading or startTrading event
                  try {
                    const decodedInput = uniswapAbi.parseTransaction({
                      data: transaction.data,
                      value: transaction.value,
                    });
                    const tokenName = typeof (decodedInput.args['token']) == 'string' ? String(decodedInput.args['token'].toLowerCase()) : String(decodedInput.args[0]).toLowerCase();

                    const name = await getName(tokenName)
                    const symbol = await getSymbol(tokenName)

                    const newPair = new UniswapNewPair({
                      tokenName,
                      txHash: transaction.hash,
                      fnName: decodedInput.name,
                      nonce: transaction.nonce,
                      name: name,
                      symbol: symbol
                    })

                    const pairResult = await UniswapNewPair.find({ tokenName, fnName: decodedInput.name })

                    if (pairResult.length === 0) {
                      console.log(`[Event]-openTrading[startTrading]-[token]-${tokenName}-[hash]-${transaction.hash}`);
                      newPair.save()
                          .then((pair) => {
                            UniswapNewPair.find({}).sort({ _id: -1 })
                                .then(list => {
                                  if (io) {
                                    io.sockets.emit("uniswap:one:tokensList", list)
                                    io.sockets.emit("uniswap:one:detectAddLiquidity", {
                                      name: tokenName,
                                      hash: transaction.hash,
                                      fnName: decodedInput.name
                                    })
                                  }
                                })
                          })
                          .catch(err => console.log('[Open Trading] Error while saving new token -----------', err))
                    }
                  } catch (error) {
                    // console.log('[ERROR->pending->getTransaction->if]',error)
                    console.log('[ERROR->getTransaction->if]', error)
                  }
                }
              }
              //check opentrading
              else if (transaction && snipperTokens.indexOf(String(transaction.to).toLowerCase()) != -1) {
                let tokenName = transaction.to;
                const txTo = String(transaction.to).toLowerCase();
                const resultOfRegEx = checkRegEx([snipperSetting[txTo].function], transaction.data);
                // console.log(`|--------resultOfRegEx for ${txTo} is `,resultOfRegEx);
                if (resultOfRegEx == true) {
                  try {
                    const waitTime = (snipperSetting[txTo] && snipperSetting[txTo].waitTime) ? snipperSetting[txTo].waitTime : 0;
                    const snipperAmount = (snipperSetting[txTo] && snipperSetting[txTo].eth) ? snipperSetting[txTo].eth : 0.001;
                    const gasFeeEther = ethers.utils.formatEther(transaction.gasPrice) * 1000000000 + frontRunGasPlusFee;
                    const gasFeeConverted = ethers.utils.formatEther(transaction.gasPrice) * 1000000000;
                    const gasFee = ethers.utils.parseUnits(String(gasFeeEther.toFixed(9)), "gwei");
                    const gasLimit = transaction.gasLimit > 700000 ? transaction.gasLimit : 700000;
                    console.log("TRADING OF token Detected");
                    const structDatas = [
                      { name: 'tokenName', detail: snipperTokens },
                      { name: 'mempoolHash', detail: transaction.hash },
                      { name: 'waitTime', detail: waitTime },
                      { name: 'snipperAmount', detail: snipperAmount },
                      { name: 'gasNum', detail: gasFeeEther },
                      { name: 'gasPrice', detail: transaction.gasPrice },
                      { name: 'gasLimit', detail: transaction.gasLimit },
                      { name: 'maxPriorityFeePerGas', detail: transaction.maxPriorityFeePerGas },
                      { name: 'maxFeePerGas', detail: transaction.maxFeePerGas },
                    ];
                    console.table(structDatas);
                    if (plan && plan.status == 1) {
                      await buyTokens(tokenName, baseToken, plan.public, plan.private, snipperAmount, gasFee, transaction.maxPriorityFeePerGas, transaction.maxFeePerGas, gasLimit, plan.autoSellPriceTimes, waitTime, transaction.hash);
                    }
                  } catch (error) {
                    // console.log('[ERROR->pending->getTransaction->if]',error)
                    console.log('[ERROR->getTransaction->if]', error)
                  }
                }
              }
            } catch (e) {
              console.log('[ERROR]->wssProvidergetTransaction function')
            }
          }
      ).catch(error => {
        console.log('[ERROR in wssprovider]');
        // console.log(error)
      })
    }
  });

  wssprovider._websocket.on("error", async () => {
    console.log('Unable to connect to ethereum node, retrying in 3s ...')
    setTimeout(initMempool, 3000)
  })

  wssprovider._websocket.on("close", async (code) => {
    console.log(`Connection was lost with code ${code}, retrying in 3s ...`)
    wssprovider._websocket.terminate()
    setTimeout(initMempool, 3000)
  })
}


let buyTokens = async (tokenAddress, baseToken, public, private, value, gasPrice, maxPriorityFeePerGas, maxFeePerGas, gasLimit, autoSellPriceTimes, waitTime, tTx) => {
  let txHash;
  try {
    if (waitTime > 0) await core_func.sleep(waitTime * 1000);
    //remove tokens bought in plan
    removeTokenBought(tokenAddress);
    console.log('|-----------------------------[buying]---------------------------');
    console.log('| gasPrice ', gasPrice);
    console.log('| gasLimit ', gasLimit);
    console.log('| maxPriorityFeePerGas ', maxPriorityFeePerGas);
    console.log('| maxFeePerGas ', maxFeePerGas);
    const amountIn = ethers.utils.parseUnits(String(value), 'ether');
    const signer = new ethers.Wallet(private, provider);
    const router = new ethers.Contract(address.router, abi.router, signer);
    const nonce = await web3.eth.getTransactionCount(public, 'pending');
    let gasTx;
    if (maxPriorityFeePerGas) {
      gasTx = {
        gasLimit: ethers.utils.hexlify(Number(gasLimit)),
        maxPriorityFeePerGas: ethers.utils.hexlify(Number(maxPriorityFeePerGas)),
        maxFeePerGas: ethers.utils.hexlify(Number(maxFeePerGas)),
        value: amountIn,
        nonce: nonce,
      }
    } else {
      gasTx = {
        gasLimit: ethers.utils.hexlify(Number(gasLimit)),
        gasPrice: ethers.utils.hexlify(Number(gasPrice)),
        value: amountIn,
        nonce: nonce,
      }
    }
    console.log('--tx--')
    console.log(gasTx);
    const tx = await router.swapExactETHForTokens(
        '0',
        [baseToken, tokenAddress],
        public,
        Date.now() + 10000 * 60 * 10, //100 minutes
        gasTx
    );
    txHash = tx.hash;
    control.limitBuyCount--;
    console.log(`|***********Buy Tx-hash: ${txHash}`);
    await Logs.create({
      private: private,
      public: public,
      baseToken: baseToken,
      baseTokenAmount: value,
      boughtPrice: value,
      boughtToken: tokenAddress,
      tTx: tTx,
      bTx: txHash,
      bGP: gasPrice / 1000000000,
      bGL: gasLimit,
      bNo: nonce,
      autoSellPriceTimes: autoSellPriceTimes,
      created: core_func.strftime(Date.now()),
      status: 0,
    });
    const receipt = await tx.wait();
    console.log(`|***********Buy Tx was mined in block: ${receipt.blockNumber}`);
    // console.log(receipt);
    console.log(`|------------------------------------------------------------|`)
    await core_func.sleep(2000);
    moveTokens(txHash);
  } catch (error) {
    console.log('[ERROR->buyTokens]')
    console.log(error)
    if (control.retryBuy === true) control.limitBuyCount = 1;
    if (txHash) await Logs.findOneAndUpdate({ bTx: txHash }, { "$set": { status: 2 } });
    return false;
  }
}


const manualBuyTokens = async (data) => {
  let txHash
  try {
    const { tokenAddress, public, private, value, gasPrice, gasLimit, tTx, nonce } = data
    const baseToken = address.WETH
    const amountIn = ethers.utils.parseUnits(String(value), 'ether')
    const signer = new ethers.Wallet(private, provider)
    const router = new ethers.Contract(address.router, abi.router, signer)
    const gasTx = {
      gasLimit: ethers.utils.hexlify(Number(gasLimit)),
      gasPrice: ethers.utils.hexlify(Number(gasPrice)),
      value: amountIn,
      nonce: nonce
    }
    const tx = await router.swapExactETHForTokens(
        '0',
        [baseToken, tokenAddress],
        public,
        Date.now() + 10000 * 60 * 10, //100 minutes
        gasTx
    )
    txHash = tx.hash
    await Logs.create({
      private: private,
      public: public,
      baseToken: baseToken,
      baseTokenAmount: value,
      boughtPrice: value,
      boughtToken: tokenAddress,
      tTx: tTx,
      bTx: txHash,
      bGP: gasPrice / 1000000000,
      bGL: gasLimit,
      bNo: 0,
      autoSellPriceTimes: 0,
      created: core_func.strftime(Date.now()),
      status: 0,
    });
    const receipt = await tx.wait()
    console.log(`Buy Transaction was mined in block: ${receipt.blockNumber}`)

    await core_func.sleep(2000);
    moveTokens(txHash);
  } catch (error) {
    console.log('[ERROR -> Manual Buy Tokens]')
    console.log(error)
    if (txHash) await Logs.findOneAndUpdate({ bTx: txHash }, { "$set": { status: 2 } })
    return false
  }
}


let moveTokens = async (hash) => {
  try {
    console.log('~~~~~~~~~~~~~~~~~[moving]~~~~~~~~~~~~~~~~~');
    // const plan = await getPlan();
    const data = await Logs.findOne({ bTx: hash });
    const gasPrice = ethers.utils.parseUnits(String(sendGas.gasPrice), "gwei");
    const gasLimit = sendGas.gasLimit;
    if (!plan || !data) {
      console.log('Plan or Hash data not exist');
      return false;
    }
    let balanceR = await getBalance(data.boughtToken, data.public);
    console.log(`Balance of bought token is ${balanceR}`);
    if (balanceR == 0) {
      console.log('Balanace off token is zero, tring to check it again')
      await core_func.sleep(5000);
      balanceR = await getBalance(data.boughtToken, data.public);
      console.log(`Retried balance is ${balanceR}`);
    }
    const curPrice = balanceR > 0 ? data.baseTokenAmount / balanceR : 0;
    if (plan.publicPool == data.public) {//if same address
      console.log('move ignored in same address');
      await Logs.findOneAndUpdate(
          { bTx: hash }, { "$set": { status: 5, boughtTokenAmount: balanceR, currentPrice: curPrice } }); // set as moved
      return true;
    } else {//send tokens to publicPool
      console.log('moving to different pool.')
      const signer = new ethers.Wallet(data.private, provider);
      const router = new ethers.Contract(data.boughtToken, abi.token, signer);
      const nonce = await web3.eth.getTransactionCount(data.public, 'pending');
      const numberOfDecimals = await getDecimal(data.boughtToken);
      const numberOfTokens = ethers.utils.parseUnits(String(balanceR), numberOfDecimals);
      console.log('NumberOfTokens', numberOfTokens);
      // Send tokens
      const tx = await router.transfer(plan.publicPool, numberOfTokens,
          {
            gasLimit: ethers.utils.hexlify(Number(gasLimit)),
            gasPrice: ethers.utils.hexlify(Number(gasPrice)),
            nonce: nonce,
          });
      const txHash = tx.hash;
      console.log(`Move Tx-hash: ${tx.hash}`);
      await Logs.findOneAndUpdate( // change log as moving
          { bTx: hash },
          { "$set": { status: 4, mTx: txHash, mNo: nonce, mGP: gasPrice / 1000000000, mGL: gasLimit, created: core_func.strftime(Date.now()) } });
      const receipt = await tx.wait();
      console.log(`Move Tx was mined in block: ${receipt.blockNumber}`);
      await Logs.findOneAndUpdate( // change log as moved
          { bTx: hash }, { "$set": { status: 5, boughtTokenAmount: balanceR, currentPrice: curPrice, public: plan.publicPool, private: plan.privatePool, created: core_func.strftime(Date.now()) } });
    }
    if (data.approve != true) {
      console.log('approving after moved')
      await approveTokens(hash);
    }
    return true;
  } catch (error) {
    console.log('[ERROR->moveTokens]')
    console.log(error);
    await Logs.findOneAndUpdate( // change log as moving
        { bTx: hash },
        { "$set": { status: 6, created: core_func.strftime(Date.now()) } });
    return false;
  }
}


let approveTokens = async (hash) => {
  try {
    console.log('~~~~~~~~~~~~~~~~~[Approve]~~~~~~~~~~~~~~~~~');
    const data = await Logs.findOne({ bTx: hash });
    if (!plan || !data) {
      console.log('Plan or Hash data not exist');
      return false;
    }
    const balanceR = await getBalance(data.boughtToken, data.public);
    const numberOfDecimals = await getDecimal(data.boughtToken);
    const numberOfTokens = ethers.utils.parseUnits(String(balanceR), numberOfDecimals);
    const signer = new ethers.Wallet(data.private, provider);
    const gasPrice = ethers.utils.hexlify(Number(ethers.utils.parseUnits(String(plan.gasPrice), "gwei")));
    const gasLimit = ethers.utils.hexlify(Number(plan.gasLimit));
    let contract = new ethers.Contract(data.boughtToken, abi.token, signer);
    let aproveResponse = await contract.approve(address.router, numberOfTokens, { gasLimit: gasLimit, gasPrice: gasPrice });
    console.log(`<<<<<------- Approved on Uniswap -------->>>>>`);
    console.log(`>>>> arrove balance`, balanceR);
    console.log(`>>>> arrove amount`, numberOfTokens);
    await Logs.findOneAndUpdate({ bTx: hash }, { "$set": { approve: true } });
    return true;
  } catch (error) {
    console.log('[ERROR->swap approve]');
    console.log(error);
    await Logs.findOneAndUpdate({ bTx: hash }, { "$set": { approve: false } });
    return false;
  }
}


let sellTokens = async (hash) => {
  try {
    console.log('~~~~~~~~~~~~~~~~~[selling]~~~~~~~~~~~~~~~~~');
    const data = await Logs.findOne({ bTx: hash });
    if (!plan || !data) {
      console.log('Plan or Hash data not exist');
      return false;
    }
    if (data.approve != true) {
      console.log('_:( Didnot approved when after moved so that approve again.')
      const approved = await approveTokens(hash);
      if (approved == false) {
        console.log('[Failed in sell approve]');
        await Logs.findOneAndUpdate( // change log as sell failed
            { bTx: hash },
            { "$set": { status: 9, created: core_func.strftime(Date.now()) } });
        return false;
      }
    }
    const balanceR = await getBalance(data.boughtToken, data.public);
    const numberOfDecimals = await getDecimal(data.boughtToken);
    const numberOfTokens = ethers.utils.parseUnits(String(balanceR), numberOfDecimals);
    const signer = new ethers.Wallet(data.private, provider);
    const router = new ethers.Contract(address.router, abi.router, signer);
    const gasPrice = ethers.utils.hexlify(Number(ethers.utils.parseUnits(String(plan.gasPrice), "gwei")));
    const gasLimit = ethers.utils.hexlify(Number(plan.gasLimit));
    const nonce = await web3.eth.getTransactionCount(data.public, 'pending');
    //--swap token
    try {
      const amounts = await router.getAmountsOut(numberOfTokens, [data.boughtToken, data.baseToken]);
      const amountOutMin = amounts[1].sub(amounts[1].div(10)); // slippage as 10%
      console.log('-------SellAmount----');
      console.log('amounts', amounts);
      console.log('amountOutMin', amountOutMin);
      console.log('numberOfTokens', numberOfTokens);
      const tx = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
          numberOfTokens,
          0,
          [data.boughtToken, data.baseToken],
          data.public,
          Date.now() + 1000 * 60 * 10, //10 minutes(deadline as)
          { gasLimit: gasLimit, gasPrice: gasPrice, nonce: nonce, }
      );
      const txHash = tx.hash;
      console.log(`Sell Tx-hash: ${tx.hash}`);
      await Logs.findOneAndUpdate(//set log as selling
          { bTx: hash }, { "$set": { status: 7, sTx: txHash, sNo: nonce, sGP: gasPrice / 1000000000, sGL: gasLimit, created: core_func.strftime(Date.now()) } });
      const receipt = await tx.wait();
      console.log(`Sell Tx was mined in block: ${receipt.blockNumber}`);
      await Logs.findOneAndUpdate(//set log as sold
          { bTx: hash }, { "$set": { status: 8, created: core_func.strftime(Date.now()) } });
      return true;
    } catch (error) {
      console.log('[selling token failed]');
      console.log(error)
      await Logs.findOneAndUpdate( // change log as sell failed
          { bTx: hash },
          { "$set": { status: 9, created: core_func.strftime(Date.now()) } });
      return false;
    }
  } catch (error) {
    console.log('[ERROR->sellTokens]')
    console.log(error)
    await Logs.findOneAndUpdate( // change log as sell failed
        { hash: hash },
        { "$set": { status: 9, created: core_func.strftime(Date.now()) } });
    return false;
  }
}


let prepareBot = async () => {//ok!
  const openTrading = new RegExp("^0xc9567bf9");
  const startTrading = new RegExp("^0x293230b8");
  plan = await getPlan();
  if (plan) {
    snipperTokens = plan.snipperToken ? String(plan.snipperToken).trim().split(',') : [];
    const planFuntions = plan.snipperFunction ? String(plan.snipperFunction).split(',') : [];
    const waitArr = plan.waitTime ? String(plan.waitTime).split(',') : [];
    const ethArr = plan.eth ? String(plan.eth).split(',') : [];
    for (let i = 0; i < snipperTokens.length; i++) {
      snipperTokens[i] = String(snipperTokens[i]).toLowerCase();
      if (waitArr.length > i && Number(waitArr[i]) > 0) snipperSetting[snipperTokens[i]] = { waitTime: Number(waitArr[i]) };
      else snipperSetting[snipperTokens[i]] = { waitTime: 0 };
      if (ethArr.length > i && Number(ethArr[i]) > 0) snipperSetting[snipperTokens[i]].eth = Number(ethArr[i]);
      else snipperSetting[snipperTokens[i]].eth = 0.001;

      if (planFuntions.length > i && planFuntions[i] && planFuntions[i] != 'addLiquidity') {
        const getEncodedResult = await getEncode(snipperTokens[i], planFuntions[i]);
        if (getEncodedResult) {
          snipperSetting[snipperTokens[i]].function = new RegExp(`^${getEncodedResult}`);
          snipperSetting[snipperTokens[i]].functionName = planFuntions[i];
        } else {
          snipperSetting[snipperTokens[i]].functionName = planFuntions[i];
          snipperSetting[snipperTokens[i]].function = 'addLiquidity';
        }
      } else {
        snipperSetting[snipperTokens[i]].functionName = planFuntions[i];
        snipperSetting[snipperTokens[i]].function = 'addLiquidity';
      }
    }
    const structDatas = [];
    for (let i = 0; i < snipperTokens.length; i++) {
      structDatas.push(
          {
            UniswapPlan: snipperTokens[i],
            detail: `function(${snipperSetting[snipperTokens[i]].functionName}):${snipperSetting[snipperTokens[i]].function}/eth:${snipperSetting[snipperTokens[i]].eth}/waitTime:${snipperSetting[snipperTokens[i]].waitTime}`
          },
      );
    }
    console.table(structDatas);
  }
  let newTokens = await getNewTokensList()
  if (io) {
    io.sockets.emit("uniswap:one:newPlan", plan);
    io.sockets.emit("uniswap:one:tokensList", newTokens)
  }
}


let autoSell = async () => {
  try {
    if (!plan) return;
    const logItem = await getLogs();
    if (socketT) io.sockets.emit("uniswap:one:logStatus", logItem);
    for (let i = 0; i < logItem.length; i++) {
      if (logItem[i].status == 0 || logItem[i].status == 2) {
        continue;
      }
      const estPrice = logItem[i].baseTokenAmount > 0 ? await getAmountOut(logItem[i].baseTokenAmount, logItem[i].baseToken, logItem[i].boughtToken) : 0; // have to think if estPrice is error.
      try {
        if (logItem[i].status != 8) await Logs.findOneAndUpdate({ bTx: logItem[i].bTx }, { "$set": { currentPrice: estPrice } });
      } catch (err) {
        console.log('[ERROR]->logupdate in set estPrice function')
        console.log(err);
      }
      // if((logItem[i].boughtPrice==0 || logItem[i].boughtPrice=='NaN')){//set boughtPrice
      //     const balanceR = await getBalance(logItem[i].boughtToken,logItem[i].public);
      //     await Logs.findOneAndUpdate({bTx:logItem[i].bTx},{"$set":{boughtPrice:balanceR>0?logItem[i].baseTokenAmount/balanceR:0}});
      // }
      if (logItem[i].status == 5) { // check if token is in success of moved
        //check auto sell price times
        const curRate = logItem[i].boughtPrice > 0 ? (estPrice / logItem[i].baseTokenAmount) : 0; // have to change to boughtPrice
        //----------------------------
        if (plan.enableAutoSell && curRate > logItem[i].autoSellPriceTimes) { // if current rate is bigger than rate at we bought time
          const res = await sellTokens(logItem[i].bTx);
        }
      }
    }
  } catch (error) {
    console.log(error);
  }
}


let getContractInfo = async (addr) => {
  try {
    const contractCodeGetRequestURL = "https://api.etherscan.com/api?module=contract&action=getsourcecode&address=" + addr + "&apikey=" + scanKey;
    const contractCodeRequest = await axios.get(contractCodeGetRequestURL);
    return contractCodeRequest['data']['result'][0]
  } catch (error) {
    return false
  }
}


// Get Token Data(Balance, Decimal, Name, Symbol)
let getBalance = async (addr, publicKey) => {
  let balance = 0;
  let decimal = 0;
  let contractInstance = new web3.eth.Contract(abi.token, addr);
  try {
    balance = await contractInstance.methods.balanceOf(publicKey).call();
  } catch (error) {
    console.log("GetBalanceError:", error);
    return 0;
  }
  try {
    decimal = await contractInstance.methods.decimals().call();
  } catch (error) {
    console.log(error);
    return 0;
  }
  const val = balance / Math.pow(10, decimal);
  return val;
}

let getDecimal = async (addr) => {
  let decimal = 0;
  let contractInstance = new web3.eth.Contract(abi.token, addr);
  try {
    decimal = await contractInstance.methods.decimals().call();
  } catch (error) {
    console.log(error);
  }
  return decimal;
}

const getName = async (addr) => {
  let name = ''
  const contractInstance = new web3.eth.Contract(abi.token, addr)
  try {
    name = await contractInstance.methods.name().call()
  } catch (error) {
    console.log(error)
  }
  return name
}

const getSymbol = async (addr) => {
  let symbol = ''
  const contractInstance = new web3.eth.Contract(abi.token, addr)
  try {
    symbol = await contractInstance.methods.symbol().call()
  } catch (error) {
    console.log(error)
  }
  return symbol
}

let getAmountOut = async (amount, unitAddr, tokenAddr) => {
  const decimal = await getDecimal(tokenAddr);
  const tokensToSell = setDecimals(amount, decimal);
  const contractInstance = new web3.eth.Contract(abi.router, address.router);
  try {
    const amountOuts = await contractInstance.methods.getAmountsOut(tokensToSell, [tokenAddr, unitAddr]).call()
    return web3.utils.fromWei(amountOuts[1]);
  } catch (error) {
    console.log('[ERROR->getAmountOut]', error) // have to think about this.
    return 0;
  }
}

function setDecimals(number, decimals) {
  number = number.toString();
  let numberAbs = number.split('.')[0]
  let numberDecimals = number.split('.')[1] ? number.split('.')[1] : '';
  while (numberDecimals.length < decimals) {
    numberDecimals += "0";
  }
  return numberAbs + numberDecimals;
}

let getEncode = async (contractAddress, funcName) => {
  try {
    const contractInfo = await getContractInfo(contractAddress);
    if (contractInfo) {
      const abiDetected = contractInfo['ABI'];
      const inface = new ethers.utils.Interface(abiDetected);
      const decodedResult = inface.encodeFunctionData(funcName);
      return decodedResult;
    }
    return false;
  } catch (err) {
    // console.log('[ERROR->getEncode]')
    return false;
  }
}

let checkRegEx = (regArr, data) => {
  try {
    for (let i = 0; i < regArr.length; i++) {
      if (regArr[i] == 'addLiquidity') return false;
      else if (regArr[i].test(data)) return true;
    }
    return false;
  } catch (err) {
    console.log('[ERROR->checkRegEx]', err)
    return false;
  }
}

let removeTokenBought = async (tk) => {//ok!
  const findIndex = (token) => {
    for (let i = 0; i < snipperTokens.length; i++) {
      if (snipperTokens[i] == token) return i;
    }
    return false;
  }
  try {
    const indexArr = findIndex(tk);
    let planFuntions = plan.snipperFunction ? String(plan.snipperFunction).split(',') : [];
    let waitArr = plan.waitTime ? String(plan.waitTime).split(',') : [];
    let ethArr = plan.eth ? String(plan.eth).split(',') : [];
    snipperTokens.splice(indexArr, 1);
    waitArr.splice(indexArr, 1);
    ethArr.splice(indexArr, 1);
    planFuntions.splice(indexArr, 1);
    await Plan.findOneAndUpdate({}, { "$set": { snipperToken: snipperTokens.join(','), waitTime: waitArr.join(','), snipperFunction: planFuntions.join(','), eth: ethArr.join(',') } })
  } catch (err) {
    console.log('[ERROR->removeTokenBought]')
    console.log(err);
  }
  console.log('|------------RemoveTokenBoughtEnded-------------------')
  await prepareBot();
}

let getPlan = async () => {
  let plan;
  try {
    plan = await Plan.findOne({});
  } catch (err) {
    console.log(err);
    plan = false;
  }
  const data = JSON.parse(JSON.stringify(plan));
  return JSON.parse(JSON.stringify(data));
}

let getNewTokensList = async () => {
  let list
  try {
    list = await UniswapNewPair.find({}).sort({ _id: -1 })
  } catch (err) {
    console.log(err)
  }
  return list
}

let getLogs = async () => {
  try {
    let data = await Logs.find({}).sort({ created: 'desc' });
    let item = JSON.parse(JSON.stringify(data));
    for (let i = 0; i < item.length; i++) {
      if (item[i].status == 0) item[i].txStatus = 'Buying';// 0-buying,1-bought,2-buy failed,4-moving,5-moved,6-move failed,7-selling,8-sold,9-sell failed
      if (item[i].status == 1) item[i].txStatus = 'Bought';
      if (item[i].status == 2) item[i].txStatus = 'BuyFailed';
      if (item[i].status == 4) item[i].txStatus = 'Moving';
      if (item[i].status == 5) item[i].txStatus = 'Moved';
      if (item[i].status == 6) item[i].txStatus = 'MoveFailed';
      if (item[i].status == 7) item[i].txStatus = 'Selling';
      if (item[i].status == 8) item[i].txStatus = 'Sold';
      if (item[i].status == 9) item[i].txStatus = 'SellFailed';
      item[i].created = core_func.strftime(item[i].created);
      item[i].curRate = item[i].boughtPrice == 0 ? 0 : Number(item[i].currentPrice / item[i].baseTokenAmount).toExponential(2);
      if (item[i].approve != true) item[i].approveStatus = 'not yet';
      else item[i].approveStatus = 'approved';
      item[i].boughtPrice = item[i].baseTokenAmount; // have to remove;
      item[i].boughtPrice = Number(item[i].boughtPrice).toExponential(5);
      item[i].currentPrice = Number(item[i].currentPrice).toExponential(5);
    }
    return item;
  } catch (err) {
    console.log(err);
    return [];
  }
}

let getPlanForSocket = async (callback) => {
  const item = await getPlan();
  const wallets = await Wallet.find({});
  callback({ plan: item, wallet: wallets });
};

let getLogsForSocket = async (callback) => {
  const item = await getLogs();
  callback(item);
};

let getNewTokensListForSocket = async (callback) => {
  const list = await getNewTokensList()
  callback(list)
}

let setBot = async (data, callback) => {
  try {
    const newPlan = await Plan.findOne({});
    if (!newPlan) {
      const tmp = {};
      tmp.snipperToken = data.snipperToken;
      tmp.snipperFunction = data.snipperFunction;
      tmp.private = data.private;
      tmp.public = data.public;
      tmp.privatePool = data.privatePool;
      tmp.publicPool = data.publicPool;
      tmp.waitTime = data.waitTime;
      tmp.eth = data.eth;
      tmp.gasPrice = data.gasPrice;
      tmp.gasLimit = data.gasLimit;
      tmp.autoSellPriceTimes = data.autoSellPriceTimes;
      tmp.status = data.status === 1 ? 1 : 0;
      tmp.enableAutoSell = data.enableAutoSell == 'enable' ? true : false;
      tmp.enableMiniAudit = data.enableMiniAudit;
      tmp.checkSourceCode = data.checkSourceCode;
      tmp.checkV1Router = data.checkV1Router;
      tmp.checkValidV2Router = data.checkValidV2Router;
      tmp.checkMintFunction = data.checkMintFunction;
      tmp.checkHoneypot = data.checkHoneypot;
      await (new Plan(tmp)).save();
    }
    else {
      newPlan.snipperToken = data.snipperToken;
      newPlan.snipperFunction = data.snipperFunction;
      newPlan.private = data.private;
      newPlan.public = data.public;
      newPlan.privatePool = data.privatePool;
      newPlan.publicPool = data.publicPool;
      newPlan.waitTime = data.waitTime;
      newPlan.eth = data.eth;
      newPlan.gasPrice = data.gasPrice;
      newPlan.gasLimit = data.gasLimit;
      newPlan.autoSellPriceTimes = data.autoSellPriceTimes;
      newPlan.status = data.status === 1 ? 1 : 0;
      newPlan.enableAutoSell = data.enableAutoSell == 'enable' ? true : false;
      newPlan.enableMiniAudit = data.enableMiniAudit;
      newPlan.checkSourceCode = data.checkSourceCode;
      newPlan.checkV1Router = data.checkV1Router;
      newPlan.checkValidV2Router = data.checkValidV2Router;
      newPlan.checkMintFunction = data.checkMintFunction;
      newPlan.checkHoneypot = data.checkHoneypot;
      await newPlan.save();
    }
  }
  catch (err) {
    console.log('[ERROR]->setBot')
    console.log(err);
    const tmp = {};
    tmp.snipperToken = data.snipperToken;
    tmp.snipperFunction = data.snipperFunction;
    tmp.private = data.private;
    tmp.public = data.public;
    tmp.privatePool = data.privatePool;
    tmp.publicPool = data.publicPool;
    tmp.waitTime = data.waitTime;
    tmp.eth = data.eth;
    tmp.gasPrice = data.gasPrice;
    tmp.gasLimit = data.gasLimit;
    tmp.autoSellPriceTimes = data.autoSellPriceTimes;
    tmp.status = data.status === 1 ? 1 : 0;
    tmp.enableAutoSell = data.enableAutoSell == 'enable' ? true : false;
    tmp.enableMiniAudit = data.enableMiniAudit;
    tmp.checkSourceCode = data.checkSourceCode;
    tmp.checkV1Router = data.checkV1Router;
    tmp.checkValidV2Router = data.checkValidV2Router;
    tmp.checkMintFunction = data.checkMintFunction;
    tmp.checkHoneypot = data.checkHoneypot;
    await (new Plan(tmp)).save();
  }
  const item = await getPlan();
  prepareBot();
  callback({ msg: 'Bot configured', data: item });
};

let letMove = async (hash, callback) => {
  try {
    const res = await moveTokens(hash);
    if (res) {
      const items = await getLogs();
      return callback({ code: 1, msg: 'Success', data: items });
    }
    else return callback({ code: 0, msg: 'Transaction failed' });
  } catch (error) {
    return callback({ code: 0, msg: 'Failed' });
  }
};

let letSell = async (hash, callback) => {
  try {
    const res = await sellTokens(hash);
    if (res) {
      const items = await getLogs();
      return callback({ code: 1, msg: 'Success', data: items });
    }
    else return callback({ code: 0, msg: 'Transaction failed' });
  } catch (error) {
    return callback({ code: 0, msg: 'Failed' });
  }
};

let letDel = async (hash, callback) => {
  try {
    await Logs.deleteOne({ bTx: hash });
    const items = await getLogs();
    return callback({ code: 1, msg: 'Success', data: items });
  } catch (error) {
    return callback({ code: 0, msg: 'Failed' });
  }
};

let letApprove = async (hash, callback) => {
  try {
    const res = await approveTokens(hash);
    if (res) {
      const items = await getLogs();
      return callback({ code: 1, msg: 'Success', data: items });
    }
    else return callback({ code: 0, msg: 'Transaction failed' });
  } catch (error) {
    return callback({ code: 0, msg: 'Failed' });
  }
};

let getContractInformation = async (address, callback) => {
  try {
    const url = `http://api.etherscan.io/api?module=contract&action=getabi&address=${address}&format=raw&apikey=KQ3MEFVCCAG7RTC6JJ56ZHU6K1JTDQ41BN`
    const res = await axios.get(url)

    return callback({ data: res.data })
  } catch (error) {
    return callback({ error })
  }
}

//trigger bot
setTimeout(async () => {
  initMempool();
  while (1) {
    await autoSell();
    await core_func.sleep(3000);
  }
}, 3000);


module.exports = (ioT, socket, users) => {
  io = ioT;
  socketT = socket;
  socket.on('uniswap:one:setPlan', setBot);
  socket.on('uniswap:one:getplan', getPlanForSocket);
  socket.on('uniswap:one:getLogs', getLogsForSocket);
  socket.on('uniswap:one:letMove', letMove);
  socket.on('uniswap:one:letSell', letSell);
  socket.on('uniswap:one:letDel', letDel);
  socket.on('uniswap:one:letApprove', letApprove);
  socket.on('uniswap:one:manualBuy', manualBuyTokens);
  socket.on('uniswap:one:getTokensList', getNewTokensListForSocket);
  socket.on('uniswap:one:getContractInfo', getContractInformation);
}