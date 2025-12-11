export default {

  // Transform failed logs into UI format
  transformFailedLogs(rawLogs) {
    if (!Array.isArray(rawLogs)) return [];

    return rawLogs.map(row => ({
      original_id: row.id,
      staff_ids: row.recipient_id || "",
      full_name: row.recipient_name || "",
      email: row.recipient_email || "",
      amount: row.payment_amount || 0,
      payment_type: row.payment_type || "",
      template_id: row.template_id || 0,
      last_error: row.error_message || "",
			status: row.status || "",
			created_at: row.created_at || ""
    }));
  },

  // Load all failed emails and show modal
  async loadFailedEmails() {
    try {
      const result = await getFailedLogs.run();
      const logs = result || [];

      if (!logs.length) {
        showAlert("No failed emails found.", "info");
        return;
      }

      // Store full logs
      await storeValue("failedRaw", logs);

      // Transform for UI
      const tableData = this.transformFailedLogs(logs);
      await storeValue("failedTableData", tableData);

      // Open modal
      showModal("ModalFailedEmails");

      showAlert(`Loaded ${tableData.length} failed emails.`, "success");

    } catch (e) {
      console.error("loadFailedEmails Error:", e);
      showAlert("Failed to load failed emails.", "error");
    }
  },

  // Load only selected failed rows
  async loadSelectedForResend() {
    try {
      const selected = FailedTable.selectedRows || [];

      if (!selected.length) {
        showAlert("Please select at least one failed email.", "warning");
        return;
      }

      const raw = appsmith.store.failedRaw || [];

      // Match full records
      const selectedFull = selected
        .map(sel => raw.find(r => r.id === sel.original_id))
        .filter(Boolean);

      if (!selectedFull.length) {
        showAlert("Could not map selected rows to raw failed logs.", "error");
        return;
      }

      // Store prepared resend data
      await storeValue("failedPrepare", selectedFull);

      showAlert(`Prepared ${selectedFull.length} failed emails for resend.`, "success");

    } catch (e) {
      console.error("loadSelectedForResend Error:", e);
      showAlert("Unable to prepare selected failed emails.", "error");
    }
  }

};
