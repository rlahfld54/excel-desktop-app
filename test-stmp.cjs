const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'brianna555551@gmail.com',
    pass: 'kfzl jzca zpwm kiml',   // 공백 없이
  },
});

transporter.verify()
  .then(() => console.log('로그인 성공'))
  .catch((error) => console.log('로그인 실패:', error.message));