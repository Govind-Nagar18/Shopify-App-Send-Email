import ExcelJS from "exceljs";

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
}

export async function generateOrdersExcel(orders: Order[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Orders");

  sheet.columns = [
    { header: "Order ID", key: "id", width: 20 },
    { header: "Order Name", key: "name", width: 20 },
    { header: "Date", key: "created_at", width: 25 },
    { header: "Total Price", key: "total", width: 15 },
    { header: "Financial Status", key: "financial_status", width: 20 },
  ];

  orders.forEach((o) => {
    sheet.addRow({
      id: o.id,
      name: o.name,
      created_at: o.created_at,
      total: o.current_total_price,
      financial_status: o.financial_status,
    });
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();

  return Buffer.from(arrayBuffer);   
}
