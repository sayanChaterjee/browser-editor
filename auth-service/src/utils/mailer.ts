import { Resend } from 'resend';
import { config } from '../config';

export const sendResetEmail = async (email: string, token: string) => {
  if (!config.RESEND_API_KEY) {
    console.warn('[WARN] RESEND_API_KEY is missing. Reset email will not be sent.');
    return;
  }

  const resend = new Resend(config.RESEND_API_KEY);
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${token}`;

  try {
    const { data, error } = await resend.emails.send({
      from: 'Ceditor Support <onboarding@resend.dev>',
      to: [email],
      subject: 'Reset Your Password | Ceditor',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; }
            .header { text-align: center; margin-bottom: 30px; }
            .header h1 { color: #007bff; margin: 0; }
            .content { margin-bottom: 30px; }
            .button-container { text-align: center; }
            .button { 
              display: inline-block; 
              padding: 12px 24px; 
              background-color: #007bff; 
              color: #ffffff !important; 
              text-decoration: none; 
              border-radius: 5px; 
              font-weight: bold;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .footer { font-size: 12px; color: #888; text-align: center; margin-top: 30px; border-top: 1px solid #e0e0e0; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Ceditor</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>We received a request to reset your password for your Ceditor account. If you didn't make this request, you can safely ignore this email.</p>
              <p>To reset your password, click the button below. This link will expire in 15 minutes.</p>
            </div>
            <div class="button-container">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </div>
            <div class="content">
              <p>If the button above doesn't work, copy and paste the following link into your browser:</p>
              <p style="word-break: break-all;"><a href="${resetUrl}">${resetUrl}</a></p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Ceditor. All rights reserved.</p>
              <p>Building the future of collaborative editing.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      throw new Error(`Email sending failed: ${error.message}`);
    }

    return data;
  } catch (err) {
    throw err;
  }
};
