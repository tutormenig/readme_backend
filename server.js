const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration for frontend integration
const allowedOrigins = process.env.ALLOWED_ORIGIN
  ? process.env.ALLOWED_ORIGIN.split(',')
  : ['*'];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

app.use(express.json());

// Transporter configuration using Google SMTP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT, 10) || 587,
  secure: false, // false for port 587, true for port 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Verify SMTP connection on startup
transporter.verify((error) => {
  if (error) {
    console.error('❌ SMTP Connection Error:', error);
  } else {
    console.log('⚡ Ready to send order confirmation emails.');
  }
});

// Health check endpoint for Render monitoring
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// Helper function to format currency
const formatPrice = (amount) => `₦${Number(amount || 0).toLocaleString()}`;

// Build HTML email template
const generateOrderHtml = (orderData, isForAdmin = false) => {
  const { orderRef, fullName, phone, email, deliveryType, address, books, total } = orderData;

  const bookRows = books
    .map(
      (b) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #222; color: #fff;">${b.title}</td>
        <td style="padding: 10px; border-bottom: 1px solid #222; color: #FFD700; text-align: center;">${b.category || 'Book'}</td>
        <td style="padding: 10px; border-bottom: 1px solid #222; color: #FFD700; text-align: right; font-weight: bold;">${formatPrice(b.price)}</td>
      </tr>
    `
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #0A0A0A; color: #FFFFFF; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #141414; border: 1px solid #B8860B; border-radius: 16px; padding: 24px; }
        .header { text-align: center; border-bottom: 1px solid #262626; padding-bottom: 16px; margin-bottom: 20px; }
        .logo-title { color: #FFD700; font-size: 24px; font-weight: bold; margin: 0; }
        .tagline { color: #888888; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; }
        .title { color: #FFFFFF; font-size: 18px; margin-top: 10px; }
        .details-box { background: #1C1C1C; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
        .details-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
        .label { color: #AAAAAA; }
        .value { color: #FFFFFF; font-weight: 600; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background: #262626; color: #FFD700; padding: 10px; text-align: left; font-size: 12px; text-transform: uppercase; }
        .total-row { background: #1C1C1C; font-size: 16px; font-weight: bold; }
        .footer { text-align: center; font-size: 12px; color: #666666; border-top: 1px solid #262626; padding-top: 16px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo-title">ReadMe International</div>
          <div class="tagline">Raising Readers</div>
          <div class="title">${isForAdmin ? '🚨 New Order Received' : '📚 Order Confirmation'}</div>
        </div>

        <p>${isForAdmin ? `An order has been placed by <strong>${fullName}</strong>.` : `Hello <strong>${fullName}</strong>, thank you for your order! Here are your order details:`}</p>

        <div class="details-box">
          <div class="details-row"><span class="label">Order Ref:</span> <span class="value" style="color:#FFD700;">${orderRef}</span></div>
          <div class="details-row"><span class="label">Customer Name:</span> <span class="value">${fullName}</span></div>
          <div class="details-row"><span class="label">Email:</span> <span class="value">${email}</span></div>
          <div class="details-row"><span class="label">Phone:</span> <span class="value">${phone}</span></div>
          <div class="details-row"><span class="label">Delivery Method:</span> <span class="value">${deliveryType}</span></div>
          <div class="details-row"><span class="label">Address:</span> <span class="value">${address}</span></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Book Title</th>
              <th style="text-align: center;">Category</th>
              <th style="text-align: right;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${bookRows}
            <tr class="total-row">
              <td colspan="2" style="padding: 12px; color: #FFFFFF;">Total Amount</td>
              <td style="padding: 12px; color: #FFD700; text-align: right;">${formatPrice(total)}</td>
            </tr>
          </tbody>
        </table>

        <div class="details-box">
          <div class="details-row"><span class="label">Payment Method:</span> <span class="value">Bank Transfer</span></div>
          <div class="details-row"><span class="label">Bank:</span> <span class="value">WEMA Bank</span></div>
          <div class="details-row"><span class="label">Account Name:</span> <span class="value">TutorMe Nigeria</span></div>
          <div class="details-row"><span class="label">Account Number:</span> <span class="value">0122722420</span></div>
        </div>

        <div class="footer">
          <p>© 2026 ReadMe — Affordable Children's Books Online Store.</p>
          <p>One Purchase = One Book Donated. Powered by TutorMe Nigeria.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// API Endpoint to Send Order Details via SMTP
app.post('/api/send-order-email', async (req, res) => {
  try {
    const { orderRef, fullName, phone, email, deliveryType, address, books, total } = req.body;

    // Validate required fields
    if (!orderRef || !fullName || !phone || !email || !deliveryType || !address || !Array.isArray(books) || books.length === 0 || total === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required order fields.'
      });
    }

    const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER;

    // Send email to Customer
    const customerMailOptions = {
      from: `"ReadMe Bookstore" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Order Confirmation - ${orderRef} | ReadMe Bookstore`,
      html: generateOrderHtml(req.body, false)
    };

    // Send email to Admin
    const adminMailOptions = {
      from: `"ReadMe Store System" <${process.env.SMTP_USER}>`,
      to: adminEmail,
      replyTo: email,
      subject: `[New Order] ${orderRef} - ${fullName} (${formatPrice(total)})`,
      html: generateOrderHtml(req.body, true)
    };

    // Execute email sends concurrently and report individual failures
    const results = await Promise.allSettled([
      transporter.sendMail(customerMailOptions),
      transporter.sendMail(adminMailOptions)
    ]);

    const failures = results.filter((result) => result.status === 'rejected');
    if (failures.length > 0) {
      console.error('⚠️ Partial or full email failure:', failures);
    }

    return res.status(200).json({
      success: true,
      message: 'Order confirmation emails dispatched successfully to customer and admin.'
    });
  } catch (error) {
    console.error('❌ Failed to send order emails:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error sending emails.',
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
