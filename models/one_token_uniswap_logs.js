const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const one_token_uniswap_logs = new Schema({
  private: { type: String, required: true },
  public: { type: String, required: true },
  baseToken: { type: String, required: true },
  baseTokenAmount: { type: Number }, 
  boughtToken: { type: String, required: true },
  boughtTokenAmount : { type: Number },
  boughtPrice: {type:Number},
  currentPrice: {type:Number},
  autoSellPriceTimes: {type:Number}, 
  bGP: { type:Number}, // unit of ether
  bGL: { type:Number},
  mGP: { type:Number}, // unit of ether
  mGL: { type:Number},
  sGP: { type:Number}, // unit of ether
  sGL: { type:Number},
  
  tTx: { type: String},
  bTx: { type: String},
  bNo: { type: Number},
  mTx: { type: String},
  mNo: { type: Number},
  sTx: { type: String},
  sNo: { type: Number},
  approve: { type: Boolean},
  created: { type: Date, default: Date.now },
  updatedAt: {
    type: Number
  },
  status:{
    type:Number,
    default:0, // 0-buying,1-bought,2-buy failed,4-moving,5-moved,6-move failed,7-selling,8-sold,9-sell failed
  }
});

one_token_uniswap_logs.set('toJSON', { getters: true });
one_token_uniswap_logs.options.toJSON.transform = (doc, ret) => {
  const obj = { ...ret };
  delete obj.__v;
  return obj;
};
module.exports = mongoose.model('one_token_uniswap_logs', one_token_uniswap_logs);
