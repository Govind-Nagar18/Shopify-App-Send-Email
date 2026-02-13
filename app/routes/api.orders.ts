import { LoaderFunctionArgs } from "react-router";
import { authenticate, shopifyback } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);

  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  const filter = url.searchParams.get("filter") ?? "all";
  const payment = url.searchParams.get("payment") ?? "all";

  const client = new shopifyback.clients.Rest({ session });

  const query: Record<string, string | number> = {
    status: "any",
    limit: 50,
  };

  if (start) {
    query.created_at_min = start;
  }

  if (end) {
    query.created_at_max = end;
  }

  if (filter === "fulfilled") {
    query.fulfillment_status = "fulfilled";
  }

  if (filter === "unfulfilled") {
    query.fulfillment_status = "unfulfilled";
  }

  if (payment === "paid") {
    query.financial_status = "paid";
  }

  if (payment === "pending") {
    query.financial_status = "pending";
  }

  const response = await client.get({
    path: "orders",
    query,
  });

  return Response.json(response.body.orders);
};
