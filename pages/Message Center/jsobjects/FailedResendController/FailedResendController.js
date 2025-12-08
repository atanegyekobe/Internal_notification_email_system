export default {

  transformFailedLogs(rawLogs) {
    if (!Array.isArray(rawLogs)) return [];

    return rawLogs.map(row => ({
      original_id: row.id,
      staff_ids: row.recipient_id || "",
      full_name: row.recipient_name || "",
      email: row.recipient_email || "",
      amount: row.payment_amount || 0,
      payment_type: row.payment_type || "",
      template_id: row.template_id || 0
    }));
  },

  async loadFailedEmails() {
    try {
      const result = await getFailedLogs.run();
      const logs = result || [];

      if (!logs.length) {
        showAlert("No failed emails found.", "info");
        return;
      }

      await storeValue("rawFailedData", logs);

      const transformed = this.transformFailedLogs(logs);

      // 🟩 FIX: Do NOT overwrite mergedData
      await storeValue("failedMergedData", transformed);

      showAlert(`Loaded ${transformed.length} failed emails.`, "success");

    } catch (e) {
      console.error("loadFailedEmails Error:", e);
      showAlert("Failed to load failed emails.", "error");
    }
  },

  async loadSelectedRows() {
    try {
      const selected = MergedTableFinal.selectedRows || [];

      if (!selected.length) {
        showAlert("Please select at least one failed email.", "warning");
        return;
      }

      const raw = appsmith.store.rawFailedData || [];

      const selectedFull = selected.map(sel => {
        return raw.find(r => r.id === sel.original_id);
      }).filter(Boolean);

      if (!selectedFull.length) {
        showAlert("Could not match selected rows to full log data.", "error");
        return;
      }

      const transformed = this.transformFailedLogs(selectedFull);

      // 🟩 FIX: Do NOT overwrite mergedData
      await storeValue("failedMergedData", transformed);

      showAlert(`Loaded ${transformed.length} selected emails.`, "success");

    } catch (e) {
      console.error("loadSelectedRows Error:", e);
      showAlert("Unable to load selected emails.", "error");
    }
  }

};
