import { useEffect, useState } from "react";
import {
  Page,
  Card,
  IndexTable,
  Text,
  Badge,
  Button,
  ActionList,
  Select,
  Popover,
  TextField,
  ChoiceList,
} from "@shopify/polaris";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import {
  LoaderFunctionArgs,
  useLoaderData,
  useRevalidator,
} from "react-router";
import type { EmailSchedule } from "@prisma/client";
import { MenuHorizontalIcon } from "@shopify/polaris-icons";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const schedules = await prisma.emailSchedule.findMany({
    where: {
      shop: session.shop,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return Response.json({ schedules });
};

export default function OrdersPage() {
  const { schedules } = useLoaderData() as {
    schedules: EmailSchedule[];
  };
  const [selectedSchedule, setSelectedSchedule] =
    useState<EmailSchedule | null>(null);

  const [activePopoverId, setActivePopoverId] = useState<string | null>(null);

  const revalidator = useRevalidator();

  const [enabled, setEnabled] = useState(true);
  const [openSchedule, setOpenSchedule] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(
    null,
  );
  const [frequency, setFrequency] = useState("daily");

  const [monthlyType, setMonthlyType] = useState<"date" | "weekday">("date");
  const [specificDate, setSpecificDate] = useState("1");

  const [dayPattern, setDayPattern] = useState("First");
  const [weekPattern, setWeekPattern] = useState("Sunday");

  const [repeatEvery, setRepeatEvery] = useState("1");
  const [runDay, setRunDay] = useState<string>("");

  const [scheduleTime, setScheduleTime] = useState("10:00");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [orderCounts, setOrderCounts] = useState<Record<string, number>>({});

  const [saving, setSaving] = useState(false);
  const [orderFilter, setOrderFilter] = useState<
    "all" | "fulfilled" | "unfulfilled"
  >("all");
  const [paymentStatus, setPaymentStatus] = useState<
    "all" | "paid" | "pending"
  >("all");
  const [minPrice, setMinPrice] = useState<number | null>(null);
  const [minItem, setMinItem] = useState<number | null>(null);

  const [orderTags, setOrderTags] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<
    | "orderStatus"
    | "paymentStatus"
    | "minPrice"
    | "minItem"
    | "orderTags"
    | null
  >(null);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!scheduleTime) {
      newErrors.scheduleTime = "Run time is required";
    }

    if (!repeatEvery || Number(repeatEvery) <= 0) {
      newErrors.repeatEvery = "Repeat every is required.";
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

  useEffect(() => {
    if (!selectedSchedule) return;

    setFrequency(selectedSchedule.frequency);
    setRepeatEvery(String(selectedSchedule.repeatEvery));
    setScheduleTime(selectedSchedule.scheduleTime);

    setOrderFilter(selectedSchedule.orderFilter as any);
    setPaymentStatus((selectedSchedule.paymentStatus as any) || "all");

    setMinPrice(selectedSchedule.minOrderValue ?? null);
    setMinItem(selectedSchedule.minItems ?? null);

    setOrderTags(
      selectedSchedule.orderTags ? selectedSchedule.orderTags.split(",") : [],
    );

    setEnabled(selectedSchedule.isEnabled);
  }, [selectedSchedule]);

  async function downloadReport(scheduleId: string) {
    try {
      const res = await fetch(`/api/download-report?scheduleId=${scheduleId}`);

      if (res.status === 204) {
        alert("No orders found for the selected schedule and filters.");
        return;
      }

      if (!res.ok) {
        alert("Failed to download report");
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "orders-report.xlsx";
      document.body.appendChild(a);
      a.click();

      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Something went wrong while downloading the report.");
    }
  }

  async function toggleScheduleStatus(scheduleId: string) {
    try {
      const res = await fetch("/api/toggle-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleId }),
      });

      if (!res.ok) throw new Error("Failed to toggle schedule");

      revalidator.revalidate();
    } catch (err) {
      alert("Failed to update schedule status");
    }
  }

  function openScheduleFilter() {
    if (openSchedule === true) {
      setOpenSchedule(false);
    } else {
      setOpenSchedule(true);
    }
  }

  function resetForm() {
    setEditingScheduleId(null);
    setSelectedSchedule(null);

    setEnabled(true);
    setFrequency("daily");
    setRepeatEvery("1");
    setScheduleTime("10:00");

    setOrderFilter("all");
    setPaymentStatus("all");
    setMinPrice(null);
    setMinItem(null);
    setOrderTags([]);

    setMonthlyType("date");
    setSpecificDate("1");
    setDayPattern("First");
    setWeekPattern("Sunday");
    setRunDay("");
  }

  function toggleFilter(filter: typeof activeFilter) {
    setActiveFilter((current) => (current === filter ? null : filter));
  }

  function filterLabel(label: string, value?: string | number | null) {
    if (value === null || value === undefined || value === "all") {
      return `${label}: All`;
    }
    return `${label}: ${value}`;
  }

  async function deleteSchedule(scheduleId: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this schedule? This action cannot be undone.",
    );

    if (!confirmed) return;

    try {
      const res = await fetch("/api/delete-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleId }),
      });

      if (!res.ok) {
        throw new Error("Failed to delete schedule");
      }

      if (selectedSchedule?.id === scheduleId) {
        setSelectedSchedule(null);
      }

      revalidator.revalidate();
    } catch (err) {
      alert("Failed to delete schedule. Please try again.");
    }
  }

  async function fetchOrderCount(scheduleId: string) {
    if (orderCounts[scheduleId] !== undefined) return;

    try {
      const res = await fetch(`/api/orders-count?scheduleId=${scheduleId}`);
      if (!res.ok) return;

      const data = await res.json();
      setOrderCounts((prev) => ({
        ...prev,
        [scheduleId]: data.count,
      }));
    } catch {
      // ignore silently
    }
  }

  return (
    <Page>
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
            <div style={{ maxWidth: 720 }}>
              <Text variant="headingMd" as="h2">
                Schedule & Configuration
              </Text>
              <Text as="p" tone="subdued">
                Configure when and how order reports are emailed to you using
                custom schedules and filters.
              </Text>
            </div>

            <s-button
              commandFor="modal"
              variant="primary"
              onClick={() => {
                resetForm();
                openScheduleFilter();
              }}
            >
              {openSchedule ? "Close" : "Schedule Frequency"}
            </s-button>
          </div>
          {openSchedule && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 16,
                padding: 8,
              }}
            >
              <Card>
                <div style={{ padding: 16 }}>
                  <Text variant="headingMd" as="h2">
                    Schedule Frequency
                  </Text>
                  <Text as="p" tone="subdued">
                    Configure when and how often reports are generated.
                  </Text>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 12,
                      marginTop: 12,
                    }}
                  >
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

                    <TextField
                      label="Repeat every"
                      type="number"
                      min={1}
                      value={repeatEvery}
                      error={errors.repeatEvery}
                      onChange={setRepeatEvery}
                      autoComplete="off"
                    />
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 12,
                      marginTop: 12,
                    }}
                  >
                    <TextField
                      label="Run time"
                      type="time"
                      value={scheduleTime || "--:--"}
                      error={errors.scheduleTime}
                      onChange={setScheduleTime}
                      autoComplete="off"
                    />
                  </div>

                  {frequency === "weekly" && (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 12,
                        marginTop: 12,
                        maxWidth: 420,
                      }}
                    >
                      <Select
                        label="Run on"
                        options={[
                          { label: "Select Run On", value: "" },
                          { label: "Sunday", value: "Sun" },
                          { label: "Monday", value: "Mon" },
                          { label: "Tuesday", value: "Tue" },
                          { label: "Wednesday", value: "Wed" },
                          { label: "Thursday", value: "Thu" },
                          { label: "Friday", value: "Fri" },
                          { label: "Saturday", value: "Sat" },
                        ]}
                        value={runDay}
                        error={errors.runDay}
                        onChange={(value) => setRunDay(value)}
                      />
                    </div>
                  )}

                  {frequency === "monthly" && (
                    <div style={{ marginTop: 12 }}>
                      <ChoiceList
                        title="Monthly type"
                        choices={[
                          { label: "Specific date", value: "date" },
                          { label: "Weekday pattern", value: "weekday" },
                        ]}
                        selected={[monthlyType]}
                        onChange={(value) =>
                          setMonthlyType(value[0] as "date" | "weekday")
                        }
                      />

                      {monthlyType === "date" && (
                        <div style={{ marginTop: 8, maxWidth: 200 }}>
                          <Select
                            label="Date"
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

                      {monthlyType === "weekday" && (
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 12,
                            marginTop: 8,
                          }}
                        >
                          <Select
                            label="Pattern"
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

                          <Select
                            label="Weekday"
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
                      )}
                    </div>
                  )}
                </div>
                <hr />
                <div style={{ padding: 16 }}>
                  <Text variant="headingMd" as="h2">
                    Report Configuration
                  </Text>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 12,
                      marginTop: 12,
                    }}
                  >
                    {/* ORDER STATUS */}
                    <Popover
                      active={activeFilter === "orderStatus"}
                      activator={
                        <Button
                          size="slim"
                          disclosure
                          onClick={() => toggleFilter("orderStatus")}
                        >
                          {filterLabel("Order status", orderFilter)}
                        </Button>
                      }
                      onClose={() => setActiveFilter(null)}
                    >
                      <div style={{ padding: 12, minWidth: 160 }}>
                        <ChoiceList
                          title="Order status"
                          choices={[
                            { label: "All", value: "all" },
                            { label: "Fulfilled", value: "fulfilled" },
                            { label: "Unfulfilled", value: "unfulfilled" },
                          ]}
                          selected={[orderFilter]}
                          onChange={(value) => {
                            setOrderFilter(value[0] as any);
                            setActiveFilter(null);
                          }}
                        />
                      </div>
                    </Popover>

                    {/* PAYMENT STATUS */}
                    <Popover
                      active={activeFilter === "paymentStatus"}
                      activator={
                        <Button
                          size="slim"
                          disclosure
                          onClick={() => toggleFilter("paymentStatus")}
                        >
                          {filterLabel("Payment status", paymentStatus)}
                        </Button>
                      }
                      onClose={() => setActiveFilter(null)}
                    >
                      <div style={{ padding: 12, minWidth: 160 }}>
                        <ChoiceList
                          title="Payment status"
                          choices={[
                            { label: "All", value: "all" },
                            { label: "Paid", value: "paid" },
                            { label: "Pending", value: "pending" },
                          ]}
                          selected={[paymentStatus]}
                          onChange={(value) => {
                            setPaymentStatus(value[0] as any);
                            setActiveFilter(null);
                          }}
                        />
                      </div>
                    </Popover>

                    {/* MIN PRICE */}
                    <Popover
                      active={activeFilter === "minPrice"}
                      activator={
                        <Button
                          size="slim"
                          disclosure
                          onClick={() => toggleFilter("minPrice")}
                        >
                          {minPrice ? `Min price: ${minPrice}` : "Min price"}
                        </Button>
                      }
                      onClose={() => setActiveFilter(null)}
                    >
                      <div style={{ padding: 12, minWidth: 160 }}>
                        <ChoiceList
                          title="Min order value"
                          choices={[
                            { label: "$10,000+", value: "10000" },
                            { label: "$5,000+", value: "5000" },
                            { label: "$3,000+", value: "3000" },
                            { label: "$2,000+", value: "2000" },
                          ]}
                          selected={minPrice ? [String(minPrice)] : []}
                          onChange={(value) => {
                            setMinPrice(Number(value[0]));
                            setActiveFilter(null);
                          }}
                        />
                      </div>
                    </Popover>

                    {/* MIN ITEMS */}
                    <Popover
                      active={activeFilter === "minItem"}
                      activator={
                        <Button
                          size="slim"
                          disclosure
                          onClick={() => toggleFilter("minItem")}
                        >
                          {minItem ? `Min items: ${minItem}+` : "Min items"}
                        </Button>
                      }
                      onClose={() => setActiveFilter(null)}
                    >
                      <div style={{ padding: 12, minWidth: 120 }}>
                        <ChoiceList
                          title="Min items"
                          choices={[
                            { label: "10+", value: "10" },
                            { label: "7+", value: "7" },
                            { label: "5+", value: "5" },
                            { label: "3+", value: "3" },
                            { label: "1+", value: "1" },
                          ]}
                          selected={minItem ? [String(minItem)] : []}
                          onChange={(value) => {
                            setMinItem(Number(value[0]));
                            setActiveFilter(null);
                          }}
                        />
                      </div>
                    </Popover>

                    {/* ORDER TAGS */}
                    <Popover
                      active={activeFilter === "orderTags"}
                      activator={
                        <Button
                          size="slim"
                          disclosure
                          onClick={() => toggleFilter("orderTags")}
                        >
                          {orderTags.length
                            ? `Order tags: ${orderTags[0]}`
                            : "Order tags"}
                        </Button>
                      }
                      onClose={() => setActiveFilter(null)}
                    >
                      <div style={{ padding: 12, minWidth: 130 }}>
                        <ChoiceList
                          title="Order tags"
                          choices={[
                            { label: "Wear", value: "wear" },
                            { label: "Fashion", value: "fashion" },
                            { label: "Style", value: "style" },
                            { label: "Regular", value: "regular" },
                          ]}
                          selected={orderTags}
                          onChange={(value) => {
                            setOrderTags(value);
                            setActiveFilter(null);
                          }}
                        />
                      </div>
                    </Popover>
                  </div>
                </div>
                <button
                  disabled={saving}
                  style={{
                    marginLeft: 730,
                    background: saving ? "#6b7280" : "#000",
                    color: "white",
                    padding: "6px 14px",
                    border: 0,
                    borderRadius: 5,
                    cursor: saving ? "not-allowed" : "pointer",
                    opacity: saving ? 0.6 : 1,
                    transition: "opacity 0.2s ease, background 0.2s ease",
                  }}
                  onClick={async () => {
                    if (!validateForm()) return;
                    setSaving(true);
                    try {
                      const scheduleIdParam = editingScheduleId
                        ? `?scheduleId=${editingScheduleId}`
                        : "";
                      await fetch(`/api/schedule${scheduleIdParam}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          enabled,
                          frequency,
                          scheduleTime,
                          repeatEvery,
                          runDays:
                            frequency === "weekly" && runDay ? [runDay] : [],
                          monthlyType:
                            frequency === "monthly" ? monthlyType : null,
                          specificDate:
                            frequency === "monthly" && monthlyType === "date"
                              ? specificDate
                              : null,
                          dayPattern:
                            frequency === "monthly" && monthlyType === "weekday"
                              ? dayPattern
                              : null,
                          weekPattern:
                            frequency === "monthly" && monthlyType === "weekday"
                              ? weekPattern
                              : null,
                          orderFilter,
                          paymentStatus,
                          minOrderValue: minPrice,
                          minItems: minItem,
                          orderTags,
                        }),
                      });
                      revalidator.revalidate();
                      setSelectedSchedule(null);
                      setOpenSchedule(false);
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  {editingScheduleId ? "Update Schedule" : "Set Schedule"}
                </button>
              </Card>
            </div>
          )}
        </Card>
      </div>
      <div style={{ marginBottom: 16 }}>
        <Card>
          <div style={{ padding: 8 }}>
            <Text variant="headingMd" as="h3">
              Scheduled Reports
            </Text>
            <br />

            {schedules.length > 0 ? (
              <IndexTable
                resourceName={{ singular: "report", plural: "reports" }}
                itemCount={schedules.length}
                selectable={false}
                headings={[
                  { title: "Report Type" },
                  { title: "Frequency" },
                  { title: "Last Run At" },
                  { title: "Next Run At" },
                  { title: "Status" },
                  { title: "Action" },
                ]}
              >
                {schedules.map((schedule, index) => {
                  fetchOrderCount(schedule.id);

                  return (
                    <IndexTable.Row
                      id={schedule.id}
                      key={schedule.id}
                      position={index}
                    >
                      <IndexTable.Cell>
                        Orders{" "}
                        {orderCounts[schedule.id] !== undefined
                          ? `(${orderCounts[schedule.id]})`
                          : "(…)"}
                      </IndexTable.Cell>

                      <IndexTable.Cell>
                        {schedule.frequency.toUpperCase()}
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
                        <Badge
                          tone={schedule.isEnabled ? "success" : "critical"}
                        >
                          {schedule.isEnabled ? "Scheduled" : "Paused"}
                        </Badge>
                      </IndexTable.Cell>

                      <IndexTable.Cell>
                        <Popover
                          active={activePopoverId === schedule.id}
                          activator={
                            <Button
                              icon={MenuHorizontalIcon}
                              variant="tertiary"
                              onClick={() =>
                                setActivePopoverId(
                                  activePopoverId === schedule.id
                                    ? null
                                    : schedule.id,
                                )
                              }
                            />
                          }
                          onClose={() => setActivePopoverId(null)}
                        >
                          <ActionList
                            items={[
                              {
                                content: "Edit schedule",
                                onAction: () => {
                                  setActivePopoverId(null);
                                  setEditingScheduleId(schedule.id);
                                  setSelectedSchedule(schedule);
                                  setOpenSchedule(true);
                                },
                              },
                              {
                                content: "Download report",
                                onAction: () => {
                                  downloadReport(schedule.id);
                                },
                              },
                              {
                                content: schedule.isEnabled
                                  ? "Pause schedule"
                                  : "Resume schedule",
                                onAction: async () => {
                                  setActivePopoverId(null);
                                  await toggleScheduleStatus(schedule.id);
                                },
                              },
                              {
                                content: "Delete schedule",
                                destructive: true,
                                onAction: async () => {
                                  setActivePopoverId(null);
                                  await deleteSchedule(schedule.id);
                                },
                              },
                            ]}
                          />
                        </Popover>
                      </IndexTable.Cell>
                    </IndexTable.Row>
                  );
                })}
              </IndexTable>
            ) : (
              <Text as="p" tone="subdued">
                No schedule configured
              </Text>
            )}
          </div>
        </Card>
      </div>
    </Page>
  );
}
