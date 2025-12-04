export default {

  // Convert failed logs → Message Center format
  transformFailedLogs(rawLogs) {
    if (!Array.isArray(rawLogs)) return [];

    return rawLogs.map(row => ({
      staff_ids: row.recipient_id || "",
      full_name: row.recipient_name || "",
      email: row.recipient_email || "",
      amount: row.payment_amount || 0,
      payment_type: row.payment_type || "",
      template_id: row.template_id || 0
    }));
  },

  // Load ALL failed emails (existing)
  async loadFailedEmails() {
    try {
      const result = await getFailedLogs.run();
      const logs = result || [];

      if (!logs.length) {
        showAlert("No failed emails found.", "info");
        return;
      }

      // 🟩 NEW: Save FULL original rows (so selected rows can use it)
      await storeValue("rawFailedData", logs);

      const transformed = this.transformFailedLogs(logs);

      await storeValue("mergedData", transformed);

      showAlert(`Loaded ${transformed.length} failed emails.`, "success");

    } catch (e) {
      console.error("loadFailedEmails Error:", e);
      showAlert("Failed to load failed emails.", "error");
    }
  },

  // ------------------------------------------------------------
  // 🟩 NEW FIXED: Load ONLY selected rows, but restore full data
  // ------------------------------------------------------------
  async loadSelectedRows() {
    try {
      const selected = MergedTableFinal.selectedRows || [];

      if (!selected.length) {
        showAlert("Please select at least one failed email.", "warning");
        return;
      }

      // 🟩 NEW: Get full source records
      const raw = appsmith.store.rawFailedData || [];

      // 🟩 NEW: Map selected → full original rows
      const selectedFull = selected.map(sel => {
        return raw.find(r =>
          r.recipient_email === sel.email &&
          r.recipient_name === sel.full_name &&
          r.payment_type === sel.payment_type
        );
      }).filter(Boolean);

      if (!selectedFull.length) {
        showAlert("Could not match selected rows to full log data.", "error");
        return;
      }

      const transformed = this.transformFailedLogs(selectedFull);

      // Save → populate Message Center
      await storeValue("mergedData", transformed);

      showAlert(`Loaded ${transformed.length} selected emails.`, "success");

    } catch (e) {
      console.error("loadSelectedRows Error:", e);
      showAlert("Unable to load selected emails.", "error");
    }
  }

};
