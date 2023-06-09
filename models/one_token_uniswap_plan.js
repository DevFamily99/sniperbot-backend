const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const one_token_uniswap_plan = new Schema({
  privatePool: { type: String, required: true }, //
  publicPool: { type: String, required: true }, //
  private: { type: String, required: true }, //
  public: { type: String, required: true }, //
  eth: { type: String, default: '' }, //
  gasPrice: { type: Number, required: true }, // gwei
  gasLimit: { type: Number, required: true }, // number
  waitTime: { type: String, default: 0 },
  snipperToken: { type: String, default: '' }, //
  snipperFunction: { type: String, default: '' },
  autoSellPriceTimes: { type: Number, default: 50 },
  status: {
    type: Number,
    default: 0
  },
  enableAutoSell: { type: Boolean, default: true },
  enableMiniAudit: { type: Boolean, default: false }, // enable mini audit feature: scanning tokens to check if it has potential features that make it a scam / honeypot / rugpull etc
  checkSourceCode: { type: Boolean, default: true }, // check contract source code
  checkV1Router: { type: Boolean, default: true }, // check if pancakeswap v1 router is used or not
  checkValidV2Router: { type: Boolean, default: true }, // check if pancakeswap v2 router is used or not
  checkMintFunction: { type: Boolean, default: true }, //check if any mint function enabled
  checkHoneypot: { type: Boolean, default: true }, //check if token is honeypot
  created: { type: Date, default: Date.now },
  updatedAt: {
    type: Number
  },
});

one_token_uniswap_plan.set('toJSON', { getters: true });
one_token_uniswap_plan.options.toJSON.transform = (doc, ret) => {
  const obj = { ...ret };
  delete obj.__v;
  return obj;
};
module.exports = mongoose.model('one_token_uniswap_plan', one_token_uniswap_plan);
