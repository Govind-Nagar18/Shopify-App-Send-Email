import { useEffect, useState } from "react";
import {
  Page,
  Card,
  IndexTable,
  Text,
  Badge,
  Button,
  Spinner,
} from "@shopify/polaris";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { LoaderFunctionArgs, useLoaderData, useNavigate } from "react-router";

interface LineItem {
  id: number;
  name: string;
  quantity: number;
  price: string;
}

interface Customer {
  first_name?: string;
  last_name?: string;
  tags?: string;
}

interface ShippingLine {
  title: string;
}

interface Order {
  id: number;
  name: string;
  created_at: string;
  current_total_price: string;
  financial_status: string;
  fulfillment_status: string | null;
  tags?: string;
  shipping_lines?: ShippingLine[];
  customer?: Customer;
  line_items: LineItem[];
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const schedule = await prisma.emailSchedule.findUnique({
    where: {
      shop: session.shop,
    },
  });

  return Response.json({ schedule });
};

export default function OrdersPage() {
  const { schedule } = useLoaderData() as {
    schedule: any;
  };

  const navigate = useNavigate();

  function getDateRangeFromSchedule(schedule: any) {
    if (!schedule) return null;

    const now = new Date();
    let startDate: Date;

    if (schedule.frequency === "daily") {
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
    } else if (schedule.frequency === "weekly") {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
    } else if (schedule.frequency === "monthly") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      return null;
    }

    return {
      start: startDate.toISOString(),
      end: now.toISOString(),
    };
  }








  const [loading, setLoading] = useState(true);

  const [rawOrders, setRawOrders] = useState<Order[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const [enableFilter, setEnableFilter] = useState(false);

  function applyClientFilters(orders: Order[], schedule: any): Order[] {
    let result = [...orders];

    if (schedule.minOrderValue) {
      result = result.filter(
        (o) => Number(o.current_total_price) >= schedule.minOrderValue,
      );
    }

    if (schedule.minItems) {
      result = result.filter((o) => o.line_items.length >= schedule.minItems);
    }

    if (schedule.orderTags?.length) {
      result = result.filter((o) =>
        o.tags
          ?.split(",")
          .some((tag: string) => schedule.orderTags.includes(tag.trim())),
      );
    }

    if (schedule.customerTags?.length) {
      result = result.filter((o) =>
        o.customer?.tags
          ?.split(",")
          .some((tag: string) => schedule.customerTags.includes(tag.trim())),
      );
    }

    return result;
  }

  useEffect(() => {
    if (!schedule) {
      setOrders([]);
      setLoading(false);
      return;
    }

    const range = getDateRangeFromSchedule(schedule);
    if (!range) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const params = new URLSearchParams({
      start: range.start,
      end: range.end,
      filter: schedule.orderFilter,
      payment: schedule.paymentStatus,
    });

    fetch(`/api/orders?${params.toString()}`)
      .then((res) => res.json())
      .then((data: Order[]) => {
        setRawOrders(data);

        const filtered = enableFilter
          ? applyClientFilters(data, schedule)
          : data;

        setOrders(filtered);
      })
      .finally(() => setLoading(false));
  }, [schedule, enableFilter]);

  return (
    <Page title="Orders">
      <div style={{ marginBottom: 16 }}>
        <Card>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 24,
              padding: "8px 4px",
            }}
          >
            {/* LEFT CONTENT */}
            <div style={{ maxWidth: 720 }}>
              <Text variant="headingMd" as="h2">
                Scheduled order reports
              </Text>

              <div style={{ marginTop: 4 }}>
                <Text as="p" tone="subdued">
                  Automatically receive order reports by email based on your
                  selected schedule and filters. Set it once and stay updated
                  without manual exports.
                </Text>
              </div>
            </div>

            {/* RIGHT CTA */}
            <Button variant="primary" onClick={() => navigate("/app/temp")}>
              Add schedule
            </Button>
          </div>
        </Card>
      </div>

      <div>
        {/* RIGHT PANEL */}
        <div style={{ flex: 1 }}>
          <Card>
            <div style={{ padding: 8 }}>
              <Text variant="headingMd" as="h3">
                Scheduled Reports
              </Text>
              {schedule ? (
                <IndexTable
                  resourceName={{ singular: "report", plural: "reports" }}
                  itemCount={1}
                  selectable={false}
                  headings={[
                    { title: "Report Type" },
                    { title: "Frequency" },
                    { title: "Last Run At" },
                    { title: "Next Run At" },
                    { title: "Status" },
                  ]}
                >
                  <IndexTable.Row id="1" position={0}>
                    <IndexTable.Cell>Orders ({orders.length})</IndexTable.Cell>

                    <IndexTable.Cell>
                      {schedule.frequency?.toUpperCase()}
                    </IndexTable.Cell>

                    <IndexTable.Cell>
                      {schedule.lastRunAt
                        ? new Date(schedule.lastRunAt).toLocaleString()
                        : "-"}
                    </IndexTable.Cell>

                    <IndexTable.Cell>
                      {schedule.nextRunAt
                        ? new Date(schedule.nextRunAt).toLocaleString()
                        : "-"}
                    </IndexTable.Cell>

                    <IndexTable.Cell>
                      <Badge tone={schedule.isEnabled ? "success" : "critical"}>
                        {schedule.isEnabled ? "Scheduled" : "Disabled"}
                      </Badge>
                    </IndexTable.Cell>
                  </IndexTable.Row>
                </IndexTable>
              ) : (
                <Text as="p" tone="subdued">
                  No schedule configured
                </Text>
              )}
            </div>
          </Card>

          <br />

          <Card>
            {!schedule ? (
              <Text as="h1" tone="subdued">
                Create a schedule to view filtered orders.
              </Text>
            ) : (
              <div>
                {loading ? (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      padding: 40,
                    }}
                  >
                    <Spinner accessibilityLabel="Loading orders" size="large" />
                  </div>
                ) : (
                  <div>
                    {rawOrders.length === 0 ? (
                      <div>No Any Orders Found For this Period or Filter</div>
                    ) : (
                      <IndexTable
                        resourceName={{ singular: "order", plural: "orders" }}
                        itemCount={orders.length}
                        selectable={false}
                        headings={[
                          { title: "Order" },
                          { title: "Date" },
                          { title: "Customer" },
                          { title: "Total" },
                          { title: "Payment status" },
                          { title: "Fulfillment" },
                          { title: "Items" },
                          { title: "Tags" },
                          { title: "Delivery Method" },
                        ]}
                      >
                        {rawOrders.map((order, index) => (
                          <IndexTable.Row
                            id={String(order.id)}
                            key={order.id}
                            position={index}
                          >
                            <IndexTable.Cell>
                              <Text as="span" fontWeight="bold">
                                {order.name}
                              </Text>
                            </IndexTable.Cell>

                            <IndexTable.Cell>
                              {new Date(order.created_at).toLocaleString()}
                            </IndexTable.Cell>

                            <IndexTable.Cell>
                              {order.customer
                                ? `${order.customer.first_name ?? ""} ${order.customer.last_name ?? ""}`
                                : "No customer"}
                            </IndexTable.Cell>

                            <IndexTable.Cell>
                              ${order.current_total_price}
                            </IndexTable.Cell>

                            <IndexTable.Cell>
                              <Badge>{order.financial_status}</Badge>
                            </IndexTable.Cell>

                            <IndexTable.Cell>
                              <Badge
                                tone={
                                  order.fulfillment_status
                                    ? "success"
                                    : "attention"
                                }
                              >
                                {order.fulfillment_status ?? "Unfulfilled"}
                              </Badge>
                            </IndexTable.Cell>

                            <IndexTable.Cell>
                              {order.line_items.length} item
                            </IndexTable.Cell>

                            <IndexTable.Cell>
                              {order.tags
                                ? order.tags.split(",").map((tag) => (
                                    <Badge key={tag} tone="info">
                                      {tag.trim()}
                                    </Badge>
                                  ))
                                : "-"}
                            </IndexTable.Cell>

                            <IndexTable.Cell>
                              {order.shipping_lines?.length
                                ? order.shipping_lines[0].title
                                : "N/A"}
                            </IndexTable.Cell>
                          </IndexTable.Row>
                        ))}
                      </IndexTable>
                    )}
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </Page>
  );
}
