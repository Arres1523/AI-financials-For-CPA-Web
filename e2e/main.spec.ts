import { test, expect } from "@playwright/test";
import path from "path";
import ExcelJS from "exceljs";
import fs from "fs";

const FIXTURES = path.join(__dirname, "..", "tests", "fixtures");

async function verifyWorkbook(buffer: Buffer, expectTransactions: boolean, expectedIncome: number) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  const names = workbook.worksheets.map((s) => s.name);
  expect(names).toContain("P&L 2026");
  expect(names).toContain("Balance Sheet");

  // Verify P&L values
  const pnl = workbook.getWorksheet("P&L 2026");
  let foundPreliminary = false;
  pnl?.eachRow((row) => {
    if (row.getCell(1).text.includes("PRELIMINARY")) foundPreliminary = true;
  });
  expect(foundPreliminary).toBe(true);

  let foundRentalIncome = false;
  let foundTotalIncome = false;
  pnl?.eachRow((row, rowNumber) => {
    const label = row.getCell(1).text;
    const val = row.getCell(2).value;
    if (label === "Rental Income" && typeof val === "number") {
      expect(val).toBe(12000);
      foundRentalIncome = true;
    }
    if (label === "Total Income" && val && typeof val === "object" && "formula" in val) {
      foundTotalIncome = true;
    }
  });
  expect(foundRentalIncome).toBe(true);
  expect(foundTotalIncome).toBe(true);

  // Verify Balance Sheet
  const bs = workbook.getWorksheet("Balance Sheet");
  const bsTitle = bs?.getCell("A2").text ?? "";
  expect(bsTitle).toContain("Preliminary Balance Sheet from Bank Activity");

  let foundBalanceCheck = false;
  let foundPrelimBs = false;
  bs?.eachRow((row) => {
    const label = row.getCell(1).text;
    if (label.includes("Balance Check")) foundBalanceCheck = true;
    if (label.includes("PRELIMINARY")) foundPrelimBs = true;
  });
  expect(foundBalanceCheck).toBe(true);
  expect(foundPrelimBs).toBe(true);

  if (expectTransactions) {
    expect(names).toContain("Transaction History");
    const th = workbook.getWorksheet("Transaction History");
    expect(th?.getRow(1).cellCount).toBe(4);
    const headers = ["Date", "Description", "Amount", "Final Category"];
    for (let i = 0; i < 4; i++) {
      expect(th?.getRow(1).getCell(i + 1).text).toBe(headers[i]);
    }
    // Check at least one data row
    expect(th?.rowCount).toBeGreaterThan(1);
    // Date should be a date type
    const dateCell = th?.getRow(2).getCell(1);
    expect(dateCell?.type).toBe(ExcelJS.ValueType.Date);
    // Amount should be a number
    const amtCell = th?.getRow(2).getCell(3);
    expect(typeof amtCell?.value).toBe("number");
  } else {
    expect(names).not.toContain("Transaction History");
  }
}

test.describe("Main workflow E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Annual Financial Workflow")).toBeVisible();
  });

  test("creates company, imports file, reviews, and exports", async ({ page }) => {
    // Step 1: Company & Year
    await page.getByPlaceholder("Legal name of new company").fill("E2E Valoris LLC");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText("Fiscal year")).toBeVisible();
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    // Step 2: Bank Accounts
    await expect(page.getByText("Bank Accounts")).toBeVisible();
    await page.getByRole("button", { name: "Add bank account" }).click();
    await page.getByLabel("Account name").fill("Chase Operating");
    await page.getByLabel("Bank name").fill("Chase");
    await page.getByLabel("Last 4 digits").fill("1234");
    await page.getByLabel("Account type").selectOption("Checking");
    await page.getByLabel("Opening balance ($)").fill("0");
    await page.getByLabel("Closing balance ($)").fill("53665");
    await page.getByRole("button", { name: "Add account" }).click();
    await expect(page.getByText("Chase Operating")).toBeVisible();
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    // Step 3: Upload
    await expect(page.getByText("Upload Bank Statements")).toBeVisible();
    await page.getByLabel("Target bank account").selectOption({ index: 1 });

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(FIXTURES, "chase_sample.xlsx"));
    await expect(page.getByText("8 rows")).toBeVisible();

    await page.getByRole("button", { name: "Import", exact: true }).click();
    await expect(page.getByText(/Import successful|Imported with warnings/)).toBeVisible({ timeout: 20000 });

    // Confirm statement and transaction count
    await expect(page.getByText(/Imported 8 transactions? from 1 file/)).toBeVisible();

    // Continue to Review
    await page.getByRole("button", { name: /Continue to Review/ }).click();

    // Step 4: Review — approve the Capital Improvements exception
    await expect(page.getByText("Review Exceptions")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: /Exceptions.*1/ })).toBeVisible({ timeout: 10000 });

    // Approve using the ✓ button — must exist, no conditional skip
    const approveBtn = page.locator("button:has-text('✓')").first();
    await expect(approveBtn).toBeVisible();
    await approveBtn.click();
    await page.waitForTimeout(1500);

    // Verify pending counter updated
    await expect(page.getByRole("button", { name: /Exceptions.*0|Exceptions$/ })).toBeVisible({ timeout: 10000 });

    // Continue to Reconciliation
    const continueToRecon = page.getByRole("button", { name: /Continue to Reconciliation/ });
    await expect(continueToRecon).toBeVisible();
    await continueToRecon.click();

    // Step 5: Reconciliation
    await expect(page.getByRole("heading", { name: /Reconciliation/ })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Continue to Results/)).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: /Continue to Results/ }).click();

    // Step 6: Results
    await expect(page.getByRole("heading", { name: "Results & Export" })).toBeVisible();
    await expect(page.getByText("P&L Preview")).toBeVisible();
    await expect(page.getByText(/Preliminary Balance Sheet/)).toBeVisible();

    // Download Financial Statements (basic)
    const downloadPromise1 = page.waitForEvent("download", { timeout: 20000 });
    await page.getByRole("button", { name: "Export Financial Statements", exact: true }).click();
    const download1 = await downloadPromise1;
    expect(download1.suggestedFilename()).toContain("E2E_Valoris_LLC");
    expect(download1.suggestedFilename()).toContain("Financial_Statements.xlsx");
    expect(download1.suggestedFilename()).not.toContain("with_transactions");

    // Verify workbook content
    const filePath1 = await download1.path();
    const buffer1 = fs.readFileSync(filePath1);
    await verifyWorkbook(buffer1, false, 12000);

    // Download with transactions
    const downloadPromise2 = page.waitForEvent("download", { timeout: 20000 });
    await page.getByRole("button", { name: "Export Financial Statements + Transactions", exact: true }).click();
    const download2 = await downloadPromise2;
    expect(download2.suggestedFilename()).toContain("with_transactions");

    const filePath2 = await download2.path();
    const buffer2 = fs.readFileSync(filePath2);
    await verifyWorkbook(buffer2, true, 12000);
  });

  test("shows error for empty file", async ({ page }) => {
    await page.getByPlaceholder("Legal name of new company").fill("Empty File Test LLC");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText("Fiscal year")).toBeVisible();
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    await page.getByRole("button", { name: "Add bank account" }).click();
    await page.getByLabel("Account name").fill("Test Account");
    await page.getByLabel("Bank name").fill("Test Bank");
    await page.getByLabel("Last 4 digits").fill("0001");
    await page.getByLabel("Opening balance ($)").fill("0");
    await page.getByLabel("Closing balance ($)").fill("0");
    await page.getByRole("button", { name: "Add account" }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    await page.getByLabel("Target bank account").selectOption({ index: 1 });
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(FIXTURES, "empty_sample.xlsx"));
    await expect(page.getByText("Sheet is empty")).toBeVisible();
  });

  test("handles debit/credit columns", async ({ page }) => {
    await page.getByPlaceholder("Legal name of new company").fill("Debit Credit LLC");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText("Fiscal year")).toBeVisible();
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    await page.getByRole("button", { name: "Add bank account" }).click();
    await page.getByLabel("Account name").fill("Amex Card");
    await page.getByLabel("Bank name").fill("Amex");
    await page.getByLabel("Last 4 digits").fill("9999");
    await page.getByLabel("Opening balance ($)").fill("0");
    await page.getByLabel("Closing balance ($)").fill("0");
    await page.getByRole("button", { name: "Add account" }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    await page.getByLabel("Target bank account").selectOption({ index: 1 });
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(FIXTURES, "amex_sample.xlsx"));
    await expect(page.getByText("3 rows")).toBeVisible();

    await page.getByRole("button", { name: "Import", exact: true }).click();
    await expect(page.getByText(/Import successful/)).toBeVisible({ timeout: 20000 });
  });

  test("rejects duplicate file import", async ({ page }) => {
    await page.getByPlaceholder("Legal name of new company").fill("Dedup Test LLC");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText("Fiscal year")).toBeVisible();
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    await page.getByRole("button", { name: "Add bank account" }).click();
    await page.getByLabel("Account name").fill("Dedup Account");
    await page.getByLabel("Bank name").fill("Dedup Bank");
    await page.getByLabel("Last 4 digits").fill("0001");
    await page.getByLabel("Opening balance ($)").fill("0");
    await page.getByLabel("Closing balance ($)").fill("0");
    await page.getByRole("button", { name: "Add account" }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    await page.getByLabel("Target bank account").selectOption({ index: 1 });
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(FIXTURES, "chase_sample.xlsx"));
    await expect(page.getByText("8 rows")).toBeVisible();
    await page.getByRole("button", { name: "Import", exact: true }).click();
    await expect(page.getByText(/Import successful/)).toBeVisible({ timeout: 20000 });

    // Try uploading same file again
    await fileInput.setInputFiles(path.join(FIXTURES, "chase_sample.xlsx"));
    await expect(page.getByText("8 rows")).toBeVisible();
    await page.getByRole("button", { name: "Import", exact: true }).click();
    await expect(page.getByText(/was already imported/)).toBeVisible({ timeout: 10000 });
  });

  test("recovers after reload", async ({ page }) => {
    await page.getByPlaceholder("Legal name of new company").fill("Reload Test LLC");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText("Fiscal year")).toBeVisible();
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    await page.getByRole("button", { name: "Add bank account" }).click();
    await page.getByLabel("Account name").fill("Reload Account");
    await page.getByLabel("Bank name").fill("Reload Bank");
    await page.getByLabel("Last 4 digits").fill("5555");
    await page.getByLabel("Opening balance ($)").fill("1000");
    await page.getByLabel("Closing balance ($)").fill("2000");
    await page.getByRole("button", { name: "Add account" }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    await page.getByLabel("Target bank account").selectOption({ index: 1 });
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(FIXTURES, "chase_sample.xlsx"));
    await expect(page.getByText("8 rows")).toBeVisible();
    await page.getByRole("button", { name: "Import", exact: true }).click();
    await expect(page.getByText(/Import successful/)).toBeVisible({ timeout: 20000 });

    // Reload
    await page.reload();
    await expect(page.getByText("Annual Financial Workflow")).toBeVisible();

    // Recover company
    await page.getByPlaceholder("Search existing companies").fill("Reload Test");
    await page.getByText("Reload Test LLC").click();
    await expect(page.getByText("In progress")).toBeVisible();
    await page.getByText("2026").click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    // Accounts still exist in DB
    await expect(page.getByText("Reload Account")).toBeVisible();
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    // Can re-upload to existing account
    await expect(page.getByText("Upload Bank Statements")).toBeVisible();
    await expect(page.getByText("Target bank account")).toBeVisible();
  });
});
