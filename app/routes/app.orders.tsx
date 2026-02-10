import { useEffect, useState } from "react";
import {
  Page,
  Card,
  IndexTable,
  Text,
  Badge,
  Button,
  Modal,
  TextField,
} from "@shopify/polaris";

interface LineItem {
  id: number;
  name: string;
  quantity: number;
  price: string;
}
interface Order {
  id: number;
  name: string;
  created_at: string;
  current_total_price: string;
  financial_status: string;
  fulfillment_status: string | null;
  customer?: {
    first_name?: string;
    last_name?: string;
  };
  line_items: LineItem[];
}

export default function OrdersPage() {
  const [openScheduler, setOpenScheduler] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("");

  const [orders, setOrders] = useState<Order[]>([]);
  useEffect(() => {
    let mounted = true;

    fetch("/api/orders")
      .then((res) => res.json())
      .then((data) => {
        if (mounted) setOrders(data);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Page title="Orders">
      <div style={{ marginLeft: 800, marginBottom: 20 }}>
        <Button onClick={() => setOpenScheduler(true)}>
          Schedule Daily Email
        </Button>
      </div>
      <Card>
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
          ]}
        >
          {orders.map((order, index) => (
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

              <IndexTable.Cell>${order.current_total_price}</IndexTable.Cell>

              <IndexTable.Cell>
                <Badge>{order.financial_status}</Badge>
              </IndexTable.Cell>

              <IndexTable.Cell>
                <Badge
                  tone={order.fulfillment_status ? "success" : "attention"}
                >
                  {order.fulfillment_status ?? "Unfulfilled"}
                </Badge>
              </IndexTable.Cell>

              <IndexTable.Cell>{order.line_items.length} item</IndexTable.Cell>
            </IndexTable.Row>
          ))}
        </IndexTable>
      </Card>
      <Modal
        open={openScheduler}
        onClose={() => setOpenScheduler(false)}
        title="Schedule daily order report"
        primaryAction={{
          content: "Save schedule",
          onAction: async () => {
            await fetch("/api/schedule", {
              method: "POST",
              body: new URLSearchParams({
                scheduleTime,
              }),
            });

            setOpenScheduler(false);
          },
        }}
      >
        <Modal.Section>
          <TextField
            label="Select time (24h format)"
            type="time"
            value={scheduleTime}
            onChange={setScheduleTime}
            autoComplete="off"
          />
        </Modal.Section>
      </Modal>
    </Page>
  );
}
