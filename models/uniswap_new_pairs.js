const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UniswapPairModel = new Schema({
  tokenName: { type: String, required: true },
  txHash: { type: String, required: true, unique: true },
  fnName: { type: String },
  nonce: { type: Number },
  name: { type: String },
  symbol: { type: String }
});

module.exports = mongoose.model('uniswap_new_pairs', UniswapPairModel);
