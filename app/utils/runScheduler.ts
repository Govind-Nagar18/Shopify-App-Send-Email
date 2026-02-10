import prisma from "../db.server";
import { sessionStorage, shopifyback } from "../shopify.server";
import { generateOrdersExcel } from "./generateOrderExcel.server";
import { sendOrdersEmail } from "./sendOrdersEmail.server";

export async function runScheduler() {
  const now = new Date();
  const currentTime =
    now.getHours().toString().padStart(2, "0") +
    ":" +
    now.getMinutes().toString().padStart(2, "0");

  const schedules = await prisma.emailSchedule.findMany({
    where: {
      scheduleTime: currentTime,
      isEnabled: true,
    },
  });

  console.log("Schedules to run:", schedules);

  for (const schedule of schedules) {
    const session = await sessionStorage.loadSession(
      `offline_${schedule.shop}`,
    );

    if (!session) {
      console.log("No session found for", schedule.shop);
      continue;
    }

    const client = new shopifyback.clients.Rest({ session });

    const ordersResponse = await client.get({
      path: "orders",
      query: { limit: 10 },
    });

    const orders = ordersResponse.body.orders;

    const excelBuffer = await generateOrdersExcel(orders);

    await sendOrdersEmail(
      schedule.email || "govindts732@gmail.com",
      schedule.shop,
      excelBuffer as Buffer,
    );

    console.log("Email sent for", schedule.shop);

    console.log("Excel generated for", schedule.shop);
    console.log("Orders fetched for", schedule.shop, orders.length);
  }

  return schedules;
}
