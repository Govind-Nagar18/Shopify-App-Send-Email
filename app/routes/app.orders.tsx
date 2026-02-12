import { useEffect, useState } from "react";
import {
  Page,
  Card,
  IndexTable,
  Text,
  Badge,
  Button,
  TextField,
  Spinner,
  Select,
  Checkbox,
  ChoiceList,
} from "@shopify/polaris";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import {
  LoaderFunctionArgs,
  useLoaderData,
  useRevalidator,
} from "react-router";

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
  const revalidator = useRevalidator();
  const { schedule } = useLoaderData() as {
    schedule: any;
  };

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

  const [enabled, setEnabled] = useState(true);
  const [frequency, setFrequency] = useState("daily");

  const [monthlyType, setMonthlyType] = useState<"date" | "weekday">("date");
  const [specificDate, setSpecificDate] = useState("1");

  const [dayPattern, setDayPattern] = useState("First");
  const [weekPattern, setWeekPattern] = useState("Sunday");

  const [repeatEvery, setRepeatEvery] = useState("1");
  const [runDay, setRunDay] = useState<string>("Mon");

  const [scheduleTime, setScheduleTime] = useState("10:00");
  const [loading, setLoading] = useState(true);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [orders, setOrders] = useState<Order[]>([]);

  const [saving, setSaving] = useState(false);
  const [orderFilter, setOrderFilter] = useState<
    "all" | "fulfilled" | "unfulfilled"
  >("all");

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
      filter: schedule?.orderFilter,
    });

    fetch(`/api/orders?${params.toString()}`)
      .then((res) => res.json())
      .then(setOrders)
      .finally(() => setLoading(false));
  }, [schedule]);

  function renderScheduleSummary(schedule: any) {
    if (!schedule) return <Text as="p">No schedule configured</Text>;

    switch (schedule.frequency) {
      case "daily":
        return (
          <Text as="p">
            Runs daily at {schedule.scheduleTime || "--"} (24hr)
          </Text>
        );

      case "weekly": {
        const day = schedule.runDays ? JSON.parse(schedule.runDays)[0] : "--";
        return <Text as="p">Runs weekly on {day}</Text>;
      }

      case "monthly":
        if (schedule.monthlyType === "date") {
          return <Text as="p">Runs monthly on: {schedule.nextRunAt}</Text>;
        }

        if (schedule.monthlyType === "weekday") {
          return (
            <Text as="p">
              Runs monthly on {schedule.dayPattern} {schedule.weekPattern}
            </Text>
          );
        }

        return <Text as="p">Runs monthly</Text>;

      default:
        return <Text as="p">Schedule not configured</Text>;
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!scheduleTime) {
      newErrors.scheduleTime = "Run time is required";
    }

    if (!repeatEvery || Number(repeatEvery) <= 0) {
      newErrors.repeatEvery = "Repeat every must be greater than 0";
    }

    if (frequency === "monthly" && Number(repeatEvery) > 12) {
      newErrors.repeatEvery = "Monthly repeat cannot exceed 12";
    }

    if (frequency === "weekly" && !runDay) {
      newErrors.runDay = "Select a weekday";
    }

    if (frequency === "monthly") {
      if (monthlyType === "date" && !specificDate) {
        newErrors.specificDate = "Select a date";
      }

      if (monthlyType === "weekday") {
        if (!dayPattern) {
          newErrors.dayPattern = "Select day pattern";
        }
        if (!weekPattern) {
          newErrors.weekPattern = "Select week pattern";
        }
      }
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  return (
    <Page title="Orders">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "320px 1fr",
          gap: 15,
        }}
      >
        {/* LEFT PANEL */}
        <div style={{ width: 320 }}>
          <Card>
            <div style={{ padding: 10 }}>
              <Text variant="headingSm" as="h3">
                Schedule summary
              </Text>

              <div
                style={{
                  background: "#F1F2F4",
                  padding: 8,
                  borderRadius: 8,
                  marginTop: 5,
                }}
              >
                {renderScheduleSummary(schedule)}
              </div>
            </div>
          </Card>
          <br />

          <Card>
            <div style={{ padding: 16 }}>
              <Text variant="headingMd" as="h2">
                Schedule Report
              </Text>

              <div style={{ marginTop: 16 }}>
                <Checkbox
                  label="Enable schedule"
                  checked={enabled}
                  onChange={setEnabled}
                />
              </div>

              <div style={{ marginTop: 16 }}>
                <Select
                  label="Repeat"
                  options={[
                    { label: "Daily", value: "daily" },
                    { label: "Weekly", value: "weekly" },
                    { label: "Monthly", value: "monthly" },
                  ]}
                  value={frequency}
                  onChange={(value) => setFrequency(value)}
                />
              </div>

              <div style={{ marginTop: 16 }}>
                <TextField
                  label="Run time"
                  type="time"
                  value={scheduleTime || "--:--"}
                  error={errors.scheduleTime}
                  onChange={setScheduleTime}
                  autoComplete="off"
                />
              </div>

              <div style={{ marginTop: 16 }}>
                <TextField
                  label="Repeat every"
                  type="number"
                  value={repeatEvery}
                  error={errors.repeatEvery}
                  onChange={setRepeatEvery}
                  autoComplete="off"
                />
              </div>

              {frequency === "weekly" && (
                <div style={{ marginTop: 16 }}>
                  <ChoiceList
                    title="Run on"
                    choices={[
                      { label: "Sunday", value: "Sun" },
                      { label: "Monday", value: "Mon" },
                      { label: "Tuesday", value: "Tue" },
                      { label: "Wednesday", value: "Wed" },
                      { label: "Thursday", value: "Thu" },
                      { label: "Friday", value: "Fri" },
                      { label: "Saturday", value: "Sat" },
                    ]}
                    selected={[runDay]}
                    onChange={(value) => setRunDay(value[0])}
                  />
                  {errors.runDay && (
                    <Text as="p" tone="critical">
                      {errors.runDay}
                    </Text>
                  )}
                </div>
              )}

              {frequency === "monthly" && (
                <div style={{ marginTop: 16 }}>
                  <ChoiceList
                    title="Monthly Type"
                    choices={[
                      { label: "On a specific date", value: "date" },
                      { label: "On a weekday pattern", value: "weekday" },
                    ]}
                    selected={[monthlyType]}
                    onChange={(value) =>
                      setMonthlyType(value[0] as "date" | "weekday")
                    }
                  />

                  {/* Specific Date */}
                  {monthlyType === "date" && (
                    <div style={{ marginTop: 12 }}>
                      <Select
                        label="Select Date"
                        options={Array.from({ length: 31 }, (_, i) => ({
                          label: `${i + 1}`,
                          value: String(i + 1),
                        }))}
                        value={specificDate}
                        error={errors.specificDate}
                        onChange={setSpecificDate}
                      />
                    </div>
                  )}

                  {/* Weekday Pattern */}
                  {monthlyType === "weekday" && (
                    <div style={{ marginTop: 12 }}>
                      <Select
                        label="Day pattern"
                        options={[
                          { label: "First", value: "First" },
                          { label: "Second", value: "Second" },
                          { label: "Third", value: "Third" },
                          { label: "Fourth", value: "Fourth" },
                          { label: "Last", value: "Last" },
                        ]}
                        value={dayPattern}
                        error={errors.dayPattern}
                        onChange={setDayPattern}
                      />

                      <div style={{ marginTop: 12 }}>
                        <Select
                          label="Week pattern"
                          options={[
                            { label: "Sunday", value: "Sunday" },
                            { label: "Monday", value: "Monday" },
                            { label: "Tuesday", value: "Tuesday" },
                            { label: "Wednesday", value: "Wednesday" },
                            { label: "Thursday", value: "Thursday" },
                            { label: "Friday", value: "Friday" },
                            { label: "Saturday", value: "Saturday" },
                          ]}
                          value={weekPattern}
                          error={errors.weekPattern}
                          onChange={setWeekPattern}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div style={{ marginTop: 16 }}>
                <ChoiceList
                  title="Order status"
                  choices={[
                    { label: "All orders", value: "all" },
                    { label: "Fulfilled only", value: "fulfilled" },
                    { label: "Unfulfilled only", value: "unfulfilled" },
                  ]}
                  selected={[orderFilter]}
                  onChange={(value) =>
                    setOrderFilter(
                      value[0] as "all" | "fulfilled" | "unfulfilled",
                    )
                  }
                />
              </div>

              <div style={{ marginTop: 20 }}>
                <Button
                  fullWidth
                  variant="primary"
                  disabled={saving}
                  onClick={async () => {
                    if (!validateForm()) return;
                    setSaving(true);
                    try {
                      await fetch("/api/schedule", {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          enabled,
                          frequency,
                          scheduleTime,
                          repeatEvery,
                          runDays: runDay ? [runDay] : [],
                          monthlyType,
                          orderFilter,
                          specificDate,
                          dayPattern,
                          weekPattern,
                        }),
                      });
                      revalidator.revalidate();
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  Save Schedule
                </Button>
              </div>
            </div>
          </Card>
        </div>

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
            {!schedule && (
              <Text as="h1" tone="subdued">
                Create a schedule to view filtered orders.
              </Text>
            )}

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

                      <IndexTable.Cell>
                        ${order.current_total_price}
                      </IndexTable.Cell>

                      <IndexTable.Cell>
                        <Badge>{order.financial_status}</Badge>
                      </IndexTable.Cell>

                      <IndexTable.Cell>
                        <Badge
                          tone={
                            order.fulfillment_status ? "success" : "attention"
                          }
                        >
                          {order.fulfillment_status ?? "Unfulfilled"}
                        </Badge>
                      </IndexTable.Cell>

                      <IndexTable.Cell>
                        {order.line_items.length} item
                      </IndexTable.Cell>
                    </IndexTable.Row>
                  ))}
                </IndexTable>
              </div>
            )}
          </Card>
        </div>
      </div>
    </Page>
  );
}
