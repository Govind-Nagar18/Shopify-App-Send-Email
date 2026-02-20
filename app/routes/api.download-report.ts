/**
 * IMPORTANT:
 * Manual download is READ-ONLY.
 * Never use or update lastRunAt here.
 * lastRunAt is reserved for scheduler execution only.
 */

import type { LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import { authenticate, shopifyback } from "../shopify.server";
import { generateOrdersExcel } from "../utils/generateOrderExcel.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const url = new URL(request.url);
  const scheduleId = url.searchParams.get("scheduleId");

  if (!scheduleId) {
    return new Response("Schedule ID is required", { status: 400 });
  }

  const schedule = await prisma.emailSchedule.findFirst({
    where: {
      id: scheduleId,
      shop,
    },
  });

  if (!schedule) {
    return new Response("No schedule found", { status: 404 });
  }

  const client = new shopifyback.clients.Rest({ session });

  const endDate = new Date();

  const startDate = (() => {
    const d = new Date(endDate);

    switch (schedule.frequency) {
      case "daily":
        d.setDate(d.getDate() - 1 * schedule.repeatEvery);
        break;

      case "weekly":
        d.setDate(d.getDate() - 7 * schedule.repeatEvery);
        break;

      case "monthly":
        d.setMonth(d.getMonth() - schedule.repeatEvery);
        break;

      default:
        d.setDate(d.getDate() - 7);
    }

    return d;
  })();


  const query: Record<string, string> = {
    status: "any",
    created_at_min: startDate.toISOString(),
    created_at_max: endDate.toISOString(),
  };

  if (schedule.orderFilter === "fulfilled") {
    query.fulfillment_status = "fulfilled";
  }

  if (schedule.orderFilter === "unfulfilled") {
    query.fulfillment_status = "unfulfilled";
  }

  if (schedule.paymentStatus === "paid") {
    query.financial_status = "paid";
  }

  if (schedule.paymentStatus === "pending") {
    query.financial_status = "pending";
  }

  const ordersResponse = await client.get({
    path: "orders",
    query,
  });

  let orders = ordersResponse.body.orders as any[];

  const minOrderValue = schedule.minOrderValue;

  if (minOrderValue !== null) {
    orders = orders.filter(
      (o) => Number(o.current_total_price) >= minOrderValue,
    );
  }

  const minItems = schedule.minItems;

  if (minItems !== null) {
    orders = orders.filter((o) => o.line_items.length >= minItems);
  }

  if (schedule.orderTags) {
    const tag = schedule.orderTags.toLowerCase();
    orders = orders.filter((o) =>
      o.tags
        ?.toLowerCase()
        .split(",")
        .map((t: string) => t.trim())
        .includes(tag),
    );
  }

  if (!orders.length) {
    return new Response(JSON.stringify({ message: "No orders found" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const excelBuffer = await generateOrdersExcel(orders);

  return new Response(excelBuffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="orders-report.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
};
