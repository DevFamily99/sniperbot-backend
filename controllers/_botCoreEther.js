const axios = require('axios');
const scanKey = 'KQ3MEFVCCAG7RTC6JJ56ZHU6K1JTDQ41BN';
const url = {
    wss: process.env.ETH_WS, 
    // http: process.env.ETH_HTTP,
    // http: 'HTTP://127.0.0.1:7545',
    http: 'https://ropsten.infura.io/v3/d9649bed89c34d55a0b3391d9936e123',
}
const address = {
    ETH:'0x5d538965d0c5f2c21aabf16a24367fb37692cae3',
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    WETHRosten: '0xc778417E063141139Fce010982780140Aa0cD5Ab',
    DAI: '0x6b175474e89094c44da98b954eedeac495271d0f',
    SAI: '0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359',
    USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    USDT: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    // factory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f', 
    factory: '0x9c83dCE8CA20E9aAF9D3efc003b2ea62aBC08351', //for ropsten
    // router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    router: '0x9c83dCE8CA20E9aAF9D3efc003b2ea62aBC08351', // for ropsten 
};
const abi = {
    token: require('./abi/abi_token.json'),
    router: require('./abi/abi_uniswap_v2_router_all.json'),
}
const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider(url.http));
const ethers = require('ethers');
const { JsonRpcProvider } = require("@ethersproject/providers");
const provider = new JsonRpcProvider(url.http);
// const provider = new ethers.providers.WebSocketProvider(url.wss);
const txData1 = {// in ganache
    baseToken:address.WETH, 
    tokenAddress:address.USDT,
    publicKey:'0x8B7D9a9995E3BBDAEEE7B50e47b9c3732000B873',
    privateKey:'d9934722271b9e2d98a785964dc74dac20cf9c9fd18119543508a4131de9bb90',
    targetAddress: '0x8B7D9a9995E3BBDAEEE7B50e47b9c3732000B873',
    gasPrice:ethers.utils.parseUnits('54','gwei'),
    gasLimit:300000,
    value:0.01,
    maxPriorityFeePerGas:ethers.utils.parseUnits('1','gwei'),
    maxFeePerGas:ethers.utils.hexlify(Number('0x2325d806f8')),
    type: 2,
};
let getTokenInfo = async(tokenAddr)=>{
    try{
        const _contract = new web3.eth.Contract(abi.token, tokenAddr);
        const name = await _contract.methods.name().call();
        const symbol = await _contract.methods.symbol().call();
        const decimals = await _contract.methods.decimals().call();
        const totalSupplyWithDecimal = await _contract.methods.totalSupply().call();
        const totalSupply = totalSupplyWithDecimal/Math.pow(10,decimals);
        return {name,symbol,decimals,totalSupply};
    }catch(err){
        console.log(err);
        return false;
    }
}
let swapETHForExactTokens = async (txData) => {
    // Block Number	Included Gas	Fee Increase	Current Base Fee
    // 1	15M	0%	100 gwei
    // 2	30M	0%	100 gwei
    // 3	30M	12.5%	112.5 gwei
    // 4	30M	12.5%	126.6 gwei
    // 5	30M	12.5%	142.4 gwei
    // 6	30M	12.5%	160.2 gwei
    // 7	30M	12.5%	180.2 gwei
    // 8	30M	12.5%	202.7 gwei
    const {tokenAddress, baseToken, publicKey, privateKey, value , gasPrice , gasLimit} = txData;
    const amountIn = ethers.utils.parseUnits(String(value), 'ether');
    // const estGasPrice = await provider.getGasPrice();
    const signer = new ethers.Wallet(privateKey, provider);
    const router = new ethers.Contract(address.router,abi.router,signer);
    let txHash;
    try{
        const tx = await router.swapETHForExactTokens(
            0,
            [baseToken, tokenAddress],
            publicKey,
            Date.now() + 1000 * 60 * 10, //10 minutes
            { 
            gasLimit: ethers.utils.hexlify(Number(gasLimit)),
            gasPrice: ethers.utils.hexlify(Number(gasPrice)),
            value: amountIn,
            }
        );
        txHash = tx.hash;
        console.log(`Tx-hash: ${tx.hash}`);
        // return tx.hash;
        const receipt = await tx.wait();
        console.log(`Tx was mined in block: ${receipt.blockNumber}`);
        return {blockNumber:receipt.blockNumber, hash:txHash}; 
    }catch(error){
        console.log('swapETHForExactTokens failed.');
        console.log(error);
        return false;
    }

}
let swapExactETHForTokens = async (txData) => {
    const {baseToken, tokenAddress, publicKey, privateKey, value , gasPrice , gasLimit, maxPriorityFeePerGas, maxFeePerGas} = txData;
    const amountIn = ethers.utils.parseUnits(String(value), 'ether');
    const signer = new ethers.Wallet(privateKey, provider);
    const router = new ethers.Contract(address.router,abi.router,signer);
    const nonce = await web3.eth.getTransactionCount(publicKey,'pending');
    let txHash;
    let gasTx;
    if(maxPriorityFeePerGas){
        gasTx={ 
            gasLimit: ethers.utils.hexlify(Number(gasLimit)),
            maxPriorityFeePerGas: ethers.utils.hexlify(Number(maxPriorityFeePerGas)),
            maxFeePerGas: ethers.utils.hexlify(Number(maxFeePerGas)),
            value: amountIn,
            nonce:nonce,
        }
    }else{
        gasTx={ 
            gasLimit: ethers.utils.hexlify(Number(gasLimit)),
            gasPrice: ethers.utils.hexlify(Number(gasPrice)),
            value: amountIn,
            nonce:nonce,
        }
    }
    console.log(gasTx);
    try{
        const tx = await router.swapExactETHForTokens(
            '0',
            [baseToken, tokenAddress],
            publicKey,
            Date.now() + 1000 * 60 * 10, //10 minutes
            gasTx
        );
        txHash = tx.hash;
        console.log(`Tx-hash: ${tx.hash}`);
        // return tx.hash;
        const receipt = await tx.wait();
        console.log(`Tx was mined in block: ${receipt.blockNumber}`);
        return {blockNumber:receipt.blockNumber, hash:txHash}; 
    }catch(error){
        console.log('swapExactETHForTokens failed.');
        console.log(error);
        return false;
    }

}
let swapExactTokensForTokens = async (txData) => {
    // Block Number	Included Gas	Fee Increase	Current Base Fee
    // 1	15M	0%	100 gwei
    // 2	30M	0%	100 gwei
    // 3	30M	12.5%	112.5 gwei
    // 4	30M	12.5%	126.6 gwei
    // 5	30M	12.5%	142.4 gwei
    // 6	30M	12.5%	160.2 gwei
    // 7	30M	12.5%	180.2 gwei
    // 8	30M	12.5%	202.7 gwei
    const {tokenIn, tokenOut, publicKey, privateKey, value , gasPrice , gasLimit} = txData;
    const amountIn = ethers.utils.parseUnits(String(value), 'ether');
    // const estGasPrice = await provider.getGasPrice();
    const signer = new ethers.Wallet(privateKey, provider);
    const router = new ethers.Contract(address.router,abi.router,signer);
    try{   
        let contract = new ethers.Contract(tokenIn, abi.token, signer);
        let aproveResponse = await contract.approve(address.router, amountIn, {gasLimit: ethers.utils.hexlify(Number(gasLimit)), gasPrice: ethers.utils.hexlify(Number(gasPrice))});
        console.log(`<<<<<------- Approved on Uniswap -------->>>>>`);
    }catch(error){
        console.log('[ERROR->swap approve]')
        return false;
    }
    const nonce = await web3.eth.getTransactionCount(publicKey,'pending');

    let txHash;
    try{
        const amounts = await router.getAmountsOut(amountIn, [tokenIn, tokenOut]);
        //Our execution price will be a bit different, we need some flexbility
        const amountOutMin = amounts[1].sub(amounts[1].div(10));
        const tx = await router.swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            [tokenIn, tokenOut],
            publicKey,
            Date.now() + 1000 * 60 * 10, //10 minutes
            { 
            gasLimit: ethers.utils.hexlify(Number(gasLimit)), 
            gasPrice: ethers.utils.hexlify(Number(gasPrice)),
            nonce:nonce,
            }
        );
        txHash = tx.hash;
        console.log(`Swap Tx-hash: ${tx.hash}`);
        // return tx.hash;
        const receipt = await tx.wait();
        console.log(`Tx was mined in block: ${receipt.blockNumber}`);
        return {blockNumber:receipt.blockNumber, hash:txHash}; 
    }catch(error){
        console.log('swapExactTokensForTokens failed.');
        // console.log(error)
        return false;
    }

}
let swapExactETHForTokensSupportingFeeOnTransferTokens = async (txData) => {
    // Block Number	Included Gas	Fee Increase	Current Base Fee
    // 1	15M	0%	100 gwei
    // 2	30M	0%	100 gwei
    // 3	30M	12.5%	112.5 gwei
    // 4	30M	12.5%	126.6 gwei
    // 5	30M	12.5%	142.4 gwei
    // 6	30M	12.5%	160.2 gwei
    // 7	30M	12.5%	180.2 gwei
    // 8	30M	12.5%	202.7 gwei
    const {tokenAddress, baseToken, publicKey, privateKey, value , gasPrice , gasLimit} = txData;
    const amountIn = ethers.utils.parseUnits(String(value), 'ether');
    // const estGasPrice = await provider.getGasPrice();
    const signer = new ethers.Wallet(privateKey, provider);
    const router = new ethers.Contract(address.router,abi.router,signer);
    let txHash;
    try{
        const tx = await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
            0,
            [baseToken, tokenAddress],
            publicKey,
            Date.now() + 1000 * 60 * 10, //10 minutes
            { 
            // gasLimit: ethers.utils.hexlify(Number(gasLimit)), 
            gasPrice: ethers.utils.hexlify(Number(gasPrice)),
            value: amountIn,
            }
        );
        txHash = tx.hash;
        console.log(`Tx-hash: ${tx.hash}`);
        // return tx.hash;
        const receipt = await tx.wait();
        console.log(`Tx was mined in block: ${receipt.blockNumber}`);
        return {blockNumber:receipt.blockNumber, hash:txHash}; 
    }catch(error){
        console.log('swapExactETHForTokensSupportingFeeOnTransferTokens failed.');
        console.log(error);
        return false;
    }

}
let sendTokens = async (txData) => {
    // Block Number	Included Gas	Fee Increase	Current Base Fee
    // 1	15M	0%	100 gwei
    // 2	30M	0%	100 gwei
    // 3	30M	12.5%	112.5 gwei
    // 4	30M	12.5%	126.6 gwei
    // 5	30M	12.5%	142.4 gwei
    // 6	30M	12.5%	160.2 gwei
    // 7	30M	12.5%	180.2 gwei
    // 8	30M	12.5%	202.7 gwei
    const {tokenAddress,tokenAmount,targetAddress, publicKey, privateKey, gasPrice , gasLimit} = txData;
    // const estGasPrice = await provider.getGasPrice();
    const signer = new ethers.Wallet(privateKey, provider);
    const router = new ethers.Contract(tokenAddress,abi.token,signer);
    let txHash;
    try{
        const numberOfDecimals = await getDecimal(tokenAddress);
        console.log(numberOfDecimals);
        const numberOfTokens = ethers.utils.parseUnits(String(tokenAmount), numberOfDecimals);
        console.log(numberOfTokens);
        // Send tokens
        const tx = await router.transfer(targetAddress, numberOfTokens, 
            { 
            gasLimit: ethers.utils.hexlify(Number(gasLimit)), 
            gasPrice: ethers.utils.hexlify(Number(gasPrice)),
            });
        txHash = tx.hash;
        console.log(`Tx-hash: ${tx.hash}`);
        // return tx.hash;
        const receipt = await tx.wait();
        console.log(`Tx was mined in block: ${receipt.blockNumber}`);
        return {blockNumber:receipt.blockNumber, hash:txHash}; 
    }catch(error){
        console.log('sendTokens failed.');
        console.log(error);
        return false;
    }

}
//mini audit
let miniaudit = async (token,plan) => {
    try{
        const contractCodeGetRequestURL = "https://api.bscscan.com/api?module=contract&action=getsourcecode&address=" + token + "&apikey=" + scanKey;
        const contractCodeRequest = await axios.get(contractCodeGetRequestURL);
        if (plan.checkSourceCode && contractCodeRequest['data']['result'][0]['ABI'] == "Contract source code not verified") // check if source code is verified or not
            console.log("[FAIL] Contract source code isn't verified.")
        else if (plan.checkPancakeV1Router && String(contractCodeRequest['data']['result'][0]['SourceCode']).indexOf('0x05fF2B0DB69458A0750badebc4f9e13aDd608C7F') != -1) // check if pancake swap v1 router is used
            console.log("[FAIL] Contract uses PancakeSwap v1 router.")
        else if (plan.checkValidPancakeV2 && String(contractCodeRequest['data']['result'][0]['SourceCode']).indexOf(address.router) == -1) // check if pancake swap v2 router is used
            console.log("[FAIL] Contract does not use valid PancakeSwap v2 router.")
        else if (plan.checkMintFunction && String(contractCodeRequest['data']['result'][0]['SourceCode']).indexOf('mint') != -1) // check if any mint function enabled
            console.log("[FAIL] Contract has mint function enabled.")
        else if (plan.checkHoneypot && (String(contractCodeRequest['data']['result'][0]['SourceCode']).indexOf('function transferFrom(address sender, address recipient, uint256 amount) public override returns (bool)') != -1 || String(contractCodeRequest['data']['result'][0]['SourceCode']).indexOf('function _approve(address owner, address spender, uint256 amount) internal') != -1 || String(contractCodeRequest['data']['result'][0]['SourceCode']).indexOf('newun') != -1)) // check if token is honeypot
            console.log("[FAIL] Contract is a honey pot.")
        else {
            return true;
        }
        return false;
    }catch(error){
        console.log('[ERROR->miniaudit]');
        return false;
    }
}
//other functions
let getContractInfo = async (addr) => {
    try{
        const contractCodeGetRequestURL = "https://api.etherscan.com/api?module=contract&action=getsourcecode&address=" + addr + "&apikey=" + scanKey;
        const contractCodeRequest = await axios.get(contractCodeGetRequestURL);
        return contractCodeRequest['data']['result'][0]
    }catch(error){
        return false
    }
}
let checkIfTokenBought = async (txhash) => {
    try{
        const requestURL = "https://api.etherscan.com/api?module=transaction&action=gettxreceiptstatus&txhash=" + txhash + "&apikey=" + scanKey;
        const codeRequest = await axios.get(requestURL);
        if(codeRequest['data']['result']['status']=="1") return true
        else return false;
    }catch(error){
        // console.log('[checkIfTokenBoughtError]')
        // console.log(error);
        return -100;
    }
}
let getBalance = async (addr, publicKey) => {
    let balance = 0;
    let decimal = 0;
    let contractInstance = new web3.eth.Contract(abi.token, addr);
    try{
        balance = await contractInstance.methods.balanceOf(publicKey).call();
    }catch(error){
        console.log(error);
        return 0;
    }
    try{
        decimal = await contractInstance.methods.decimals().call();
    }catch(error){
        console.log(error);
        return 0;
    }
    const val = balance / Math.pow(10, decimal);
    return val;
}
let getDecimal = async (addr) => {
    let decimal = 0;
    let contractInstance = new web3.eth.Contract(abi.token, addr);
    try{
        decimal = await contractInstance.methods.decimals().call();
    }catch(error){
        console.log(error);
    }
    return decimal;
}
let getAmountOut = async (unitAddr, tokenAddr) => {
    const decimal = await getDecimal(tokenAddr);
    tokensToSell = setDecimals(1, decimal);
    const contractInstance = new web3.eth.Contract(abi.router, address.router);
    try{
        const amountOuts = await contractInstance.methods.getAmountsOut(tokensToSell, [tokenAddr, unitAddr]).call()
        console.log(web3.utils.fromWei(amountOuts[1]))
        return web3.utils.fromWei(amountOuts[1]);
    }catch(error){
        console.log('[ERROR->getAmountOut]',error) // have to think about this.
        return 0;
    }
}
function setDecimals( number, decimals ){
    number = number.toString();
    let numberAbs = number.split('.')[0]
    let numberDecimals = number.split('.')[1] ? number.split('.')[1] : '';
    while( numberDecimals.length < decimals ){
        numberDecimals += "0";
    }
    return numberAbs + numberDecimals;
}
// console.log(150.0000011111)
// console.log(ethers.utils.parseUnits(String(150.0000011111.toFixed(9)), "gwei"));
// tokenAddress, baseToken, publicKey, privateKey, value , gasPrice , gasLimit
const swapTx = {
    tokenAddress:address.WETHRosten, 
    baseToken:address.WETHRosten,
    value:0.5,
    publicKey:'0x8B7D9a9995E3BBDAEEE7B50e47b9c3732000B873',
    privateKey:'d9934722271b9e2d98a785964dc74dac20cf9c9fd18119543508a4131de9bb90',
    gasPrice:ethers.utils.parseUnits('200','gwei'),
    gasLimit:300000
};
// tokenAddress,tokenAmount,targetAddress, publicKey, privateKey, gasPrice , gasLimit
const sendTx = {
    tokenAddress:address.ETH, 
    tokenAmount:0.5,
    publicKey:'0x8B7D9a9995E3BBDAEEE7B50e47b9c3732000B873',
    privateKey:'d9934722271b9e2d98a785964dc74dac20cf9c9fd18119543508a4131de9bb90',
    targetAddress: '0x8B7D9a9995E3BBDAEEE7B50e47b9c3732000B873',
    gasPrice:ethers.utils.parseUnits('54','gwei'),
    gasLimit:300000
};
swapETHForExactTokens(swapTx);
// sendTokens(sendTx);
module.exports = {
    getContractInfo,
    getTokenInfo,
    swapETHForExactTokens,
    swapExactETHForTokens,
    swapExactTokensForTokens,
    swapExactETHForTokensSupportingFeeOnTransferTokens,
    sendTokens,
    checkIfTokenBought,
    getBalance,
    getAmountOut,
}