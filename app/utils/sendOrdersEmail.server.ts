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
  excelBuffer: Buffer | null,
) {
  const mailOptions: nodemailer.SendMailOptions = {
    from: `"Shopify Orders" <${process.env.EMAIL_USER}>`,
    to,
    subject: `Orders Report - ${shop}`,
    text: excelBuffer
      ? "Attached is your scheduled orders report."
      : "No orders found for this period.",
  };

  // Only add attachment if file exists
  if (excelBuffer) {
    mailOptions.attachments = [
      {
        filename: "orders.xlsx",
        content: excelBuffer,
      },
    ];
  }

  await transporter.sendMail(mailOptions);
}
