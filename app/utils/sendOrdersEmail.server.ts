import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendOrdersEmail(
  to: string,
  shop: string,
  excelBuffer: Buffer
) {
  await transporter.sendMail({
    from: `"Shopify Orders" <${process.env.EMAIL_USER}>`,
    to,
    subject: `Daily Orders Report - ${shop}`,
    text: "Attached is your scheduled daily orders report.",
    attachments: [
      {
        filename: "orders.xlsx",
        content: excelBuffer,
      },
    ],
  });
}
