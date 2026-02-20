import ExcelJS from "exceljs";

interface Order {
  id: number;
  name: string;
  order_number?: number;
  created_at: string;
  processed_at?: string;
  currency?: string;

  financial_status: string;
  fulfillment_status: string | null;

  subtotal_price?: string;
  total_tax?: string;
  total_discounts?: string;
  current_total_price: string;

  tags?: string;
  note?: string;

  customer?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
  };

  shipping_address?: {
    address1?: string;
    city?: string;
    province?: string;
    country?: string;
    zip?: string;
  };

  billing_address?: {
    address1?: string;
    city?: string;
    province?: string;
    country?: string;
    zip?: string;
  };

  line_items: {
    name: string;
    quantity: number;
    price: string;
    sku?: string;
    vendor?: string;
  }[];
}

export async function generateOrdersExcel(orders: Order[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Orders");

  sheet.columns = [
    { header: "Order ID", key: "id", width: 18 },
    { header: "Order Name", key: "name", width: 18 },
    { header: "Order Number", key: "order_number", width: 15 },
    { header: "Order Date", key: "created_at", width: 22 },
    { header: "Processed Date", key: "processed_at", width: 22 },

    { header: "Financial Status", key: "financial_status", width: 18 },
    { header: "Fulfillment Status", key: "fulfillment_status", width: 18 },

    { header: "Subtotal", key: "subtotal_price", width: 15 },
    { header: "Tax", key: "total_tax", width: 12 },
    { header: "Discount", key: "total_discounts", width: 12 },
    { header: "Total", key: "current_total_price", width: 15 },
    { header: "Currency", key: "currency", width: 10 },

    { header: "Customer Name", key: "customer_name", width: 22 },
    { header: "Customer Email", key: "customer_email", width: 28 },
    { header: "Customer Phone", key: "customer_phone", width: 18 },

    { header: "Shipping Address", key: "shipping_address", width: 35 },
    { header: "Billing Address", key: "billing_address", width: 35 },

    { header: "Item Count", key: "item_count", width: 12 },
    { header: "Items", key: "items", width: 45 },
    { header: "SKUs", key: "skus", width: 30 },
    { header: "Vendors", key: "vendors", width: 30 },

    { header: "Tags", key: "tags", width: 25 },
  ];

  orders.forEach((o) => {
    sheet.addRow({
      id: o.id,
      name: o.name,
      order_number: o.order_number,
      created_at: o.created_at,
      processed_at: o.processed_at,

      financial_status: o.financial_status,
      fulfillment_status: o.fulfillment_status ?? "Unfulfilled",

      subtotal_price: o.subtotal_price,
      total_tax: o.total_tax,
      total_discounts: o.total_discounts,
      current_total_price: o.current_total_price,
      currency: o.currency,

      customer_name:
        `${o.customer?.first_name ?? ""} ${o.customer?.last_name ?? ""}`.trim(),
      customer_email: o.customer?.email,
      customer_phone: o.customer?.phone,

      shipping_address: o.shipping_address
        ? `${o.shipping_address.address1}, ${o.shipping_address.city}, ${o.shipping_address.country}`
        : "",

      billing_address: o.billing_address
        ? `${o.billing_address.address1}, ${o.billing_address.city}, ${o.billing_address.country}`
        : "",

      item_count: o.line_items.length,
      items: o.line_items.map((i) => `${i.name} (x${i.quantity})`).join(", "),
      skus: o.line_items
        .map((i) => i.sku)
        .filter(Boolean)
        .join(", "),
      vendors: o.line_items
        .map((i) => i.vendor)
        .filter(Boolean)
        .join(", "),

      tags: o.tags,
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
