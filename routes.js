const jwt = require('jsonwebtoken');
const multer = require('multer');

const User = require('./models/user');
const config = require('./config');
const {
  authenticate,
  validateUser,
  changePassword,
  addWallet,
  getWallet,
  removeWallet
} = require('./controllers/restController');
const botHandlers = require('./controllers/botHandler');
// const onePancakeV2 = require('./controllers/onePancake_v2');
const oneUniSwapV2 = require('./controllers/oneUniSwap_v2');
const upload = multer();
const router = require('express').Router();
const path = require('path');
const cors = require('cors');


router.post('/authenticate', validateUser, authenticate);
router.post('/change-password', changePassword);
router.post('/add-wallet', addWallet);
router.post('/remove-wallet', removeWallet);

router.get('/get-wallet', getWallet);

module.exports = (app, io) => {
  app.use(cors());
  app.options('*', cors());
  app.use('/api', router);
  app.get('*', function (req, res) {
    res.sendFile(path.resolve(__dirname, 'build', 'index.html'));
  });
  app.use((req, res, next) => {
    const error = new Error('Not found');
    error.status = 404;
    next(error);
  });

  app.use((error, req, res, next) => {
    res.status(error.status || 500).json({
      message: error.message
    });
  });

  const onConnection = (socket) => {
    botHandlers(io, socket);
    // onePancakeV2(io, socket);
    oneUniSwapV2(io, socket);
  };

  //socket middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;

    try {
      if (!socket.user) {
        const decodedToken = jwt.verify(token, config.jwt.secret, {
          algorithm: 'HS256',
          expiresIn: config.jwt.expiry
        });
        const user = await User.findById(decodedToken.id);

        socket.user = user.toJSON();

      }
    } catch (error) {
      socket.emit('error');
    }
    next();
  });

  io.on('connection', onConnection);
};
