export const CHART_OF_ACCOUNTS = {
  assets: {
    label: "Assets",
    subcategories: {
      "Current Assets": [
        "Cash on Hand", "Petty Cash", "Bank Accounts", "Member Loan Receivables",
        "Interest Receivable", "Penalty Receivable", "Accounts Receivable",
        "Prepaid Expenses", "Inventory", "Fixed Deposits (short-term)"
      ],
      "Non-Current Assets": [
        "Land", "Buildings", "Motor Vehicles", "Furniture & Fittings",
        "Office Equipment", "Computers", "Investments", "Intangible Assets (software)"
      ],
    },
  },
  liabilities: {
    label: "Liabilities",
    subcategories: {
      "Current Liabilities": [
        "Member Deposits", "Accounts Payable", "Salaries Payable", "PAYE Payable",
        "SHIF Payable", "Housing Levy Payable", "Withholding Tax Payable",
        "VAT Payable", "Interest Payable", "Dividend Payable",
        "Member Withdrawals Payable", "Accrued Expenses", "Insurance Payable",
        "Audit Fees Payable", "Loans Payable (Approved Not Disbursed)"
      ],
      "Long-Term Liabilities": [
        "Bank Loans", "Long-Term Borrowings", "Development Loans",
        "Mortgage Loans", "Loan from Bank", "Pension Payable"
      ],
    },
  },
  equity: {
    label: "Capital (Equity)",
    subcategories: {
      "Equity": [
        "Share Capital", "Retained Earnings", "General Reserve",
        "Statutory Reserve", "Education Fund", "Building Reserve",
        "Investment Reserve", "Revaluation Reserve", "Capital Grants"
      ],
    },
  },
  income: {
    label: "Income",
    subcategories: {
      "Income": [
        "Loan Interest Income", "Loan Processing Fees", "Loan Appraisal Fees",
        "Registration Fees", "Membership Fees", "Penalty Income",
        "Commission Income", "Investment Income", "Bank Interest Income",
        "Dividend Income", "Rental Income", "Training Income",
        "Insurance Commission", "Miscellaneous Income", "Asset Disposal Gain"
      ],
    },
  },
  expenses: {
    label: "Expenses",
    subcategories: {
      "Operating Expenses": [
        "Salaries & Wages", "Staff Benefits", "Rent Expense", "Electricity",
        "Water", "Internet", "Telephone", "Fuel", "Motor Vehicle Maintenance",
        "Repairs & Maintenance", "Office Stationery", "Printing & Photocopying",
        "Insurance Expense", "Audit Fees", "Legal Fees", "Consultancy Fees",
        "Security Expenses", "Cleaning Expenses", "Bank Charges",
        "Loan Loss Provision", "Bad Debts Written Off", "Depreciation Expense",
        "Staff Training", "Travel & Transport", "Marketing & Advertising",
        "Annual General Meeting Expenses", "Board Meeting Expenses",
        "Licensing Fees", "Software Subscription", "Office Supplies",
        "Postage & Courier", "Miscellaneous Expenses"
      ],
    },
  },
};

export const getFlatAccounts = () => {
  const accounts = [];
  Object.entries(CHART_OF_ACCOUNTS).forEach(([catKey, cat]) => {
    Object.entries(cat.subcategories).forEach(([subKey, accNames]) => {
      accNames.forEach((name) => {
        accounts.push({
          category: catKey,
          categoryLabel: cat.label,
          subcategory: subKey,
          name,
        });
      });
    });
  });
  return accounts;
};