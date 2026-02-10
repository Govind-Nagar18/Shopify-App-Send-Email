import type { LoaderFunctionArgs } from "react-router";
import { shopifyback , authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const client = new shopifyback.clients.Rest({ session });

  const response = await client.get({
    path: "orders",
    query: { limit: 10 },
  });

  return Response.json(response.body.orders);
};
