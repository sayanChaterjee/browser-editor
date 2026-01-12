import nodemailer from 'nodemailer';

export const sendResetEmail = async (email: string, token: string) => {
  // Create a test account if you don't have a real SMTP server
  // For production, use SendGrid, Mailgun, or AWS SES
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${token}`;

  await transporter.sendMail({
    from: '"Ceditor Support" <support@ceditor.com>',
    to: email,
    subject: 'Password Reset Request',
    html: `
      <h1>Reset Your Password</h1>
      <p>You requested a password reset. Click the link below to set a new password. This link expires in 15 minutes.</p>
      <a href="${resetUrl}" style="padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
      <p>If you didn't request this, please ignore this email.</p>
    `,
  });
};