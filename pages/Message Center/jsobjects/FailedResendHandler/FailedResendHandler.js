export default {

  // -------------------------------------------------------
  // 1) Generate NEW batch_ref for any resend operation
  // -------------------------------------------------------
  generateFailedBatchRef(paymentType) {
    const cleanType = (paymentType || "GEN").replace(/\s+/g, "-");
    const timestamp = moment().format("YYYYMMDD-HHmmss-SSS");
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `BATCH-${cleanType}-${timestamp}-${randomSuffix}`;
  },

  // -------------------------------------------------------
  // 2) Generate NEW message_hash for each resend
  // -------------------------------------------------------
  async generateNewMessageHash(row) {
    try {
      const { TextEncoder } = window;

      const baseString = `
        ${row.staff_ids || "NO_ID"}_
        ${row.email || "NO_EMAIL"}_
        ${row.payment_type || "NO_TYPE"}_
        ${row.amount || 0}_
        ${moment().valueOf()}
      `;

      const encoder = new TextEncoder();
      const data = encoder.encode(baseString);

      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));

      return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    } catch (e) {
      console.error("Hash generation failed:", e);
      return "HASH_ERROR";
    }
  },

  // -------------------------------------------------------
  // 3) Load ALL failed emails
  // -------------------------------------------------------
 async loadFailedEmails() {
  try {
    const result = await getFailedLogs.run();
    const logs = result || [];

    if (!logs.length) {
      showAlert("No failed emails found.", "info");
      return;
    }

    // Save full dataset (safe)
    await storeValue("failedAllLogs", logs);

    // Transform for display table only
    const transformed = logs.map(row => ({
      original_id: row.id,
      staff_ids: row.recipient_id,
      full_name: row.recipient_name,
      email: row.recipient_email,
      amount: row.payment_amount,
      payment_type: row.payment_type,
      template_id: row.template_id
    }));

    await storeValue("failedTableData", transformed);

    showAlert(`Loaded ${transformed.length} failed emails.`, "success");

  } catch (e) {
    console.error("loadFailedEmails Error:", e);
    showAlert("Failed to load failed emails.", "error");
  }
},

  // -------------------------------------------------------
  // 4) Load ONLY selected failed rows
  // ------------------------------------------------------- 
  async loadSelectedRows() {
  try {
    const selected = FailedTable.selectedRows || [];

    if (!selected.length) {
      showAlert("Select at least one row to resend.", "warning");
      return;
    }

    const all = appsmith.store.failedAllLogs || [];

    const subset = selected
      .map(sel => all.find(r => r.id === sel.original_id))
      .filter(Boolean);

    await storeValue("failedSelectedLogs", subset);

    showAlert(`Selected ${subset.length} failed emails for resend.`, "success");

  } catch (e) {
    console.error("loadSelectedRows Error:", e);
    showAlert("Unable to load selected failed emails.", "error");
  }
},

  // -------------------------------------------------------
  // 5) RESEND FAILED EMAILS (Apply FIX HERE)
  // -------------------------------------------------------
async resendFailedEmails() {
  try {
    const selected = appsmith.store.failedSelectedLogs || [];

    if (!selected.length) {
      showAlert("No selected failed emails to resend.", "warning");
      return;
    }

    // Transform into uniform format
    const cleanData = selected.map(row => ({
      staff_ids: row.recipient_id,
      full_name: row.recipient_name,
      email: row.recipient_email,
      amount: row.payment_amount,
      payment_type: row.payment_type,
      template_id: row.template_id
    }));

    const paymentType = cleanData[0].payment_type || "GEN";

    const batchRef = this.generateFailedBatchRef(paymentType);
    await storeValue("currentFailedBatchRef", batchRef);

    const logsWithHashes = [];

    for (const r of cleanData) {
      const newHash = await this.generateNewMessageHash(r);
      logsWithHashes.push({
        ...r,
        message_hash: newHash,
        batch_ref: batchRef,
        created_at: moment().format("YYYY-MM-DD HH:mm:ss")
      });
    }

    await storeValue("failedLogsToInsert", logsWithHashes);

    const jobResult = await insertFailedResendJobs.run();
    const jobId = jobResult?.[0]?.job_id;

    if (!jobId) {
      showAlert("Failed to create job record.", "error");
      return;
    }

    await storeValue("currentFailedJobId", jobId);

    await insertFailedResendLogs.run();

    showAlert(
      `📨 Successfully resent ${logsWithHashes.length} failed emails.`,
      "success"
    );

    // Reset store to avoid accidental reuse
    await storeValue("failedSelectedLogs", []);

  } catch (e) {
    console.error("resendFailedEmails Error:", e);
    showAlert("Failed to resend emails.", "error");
  }
}
};
