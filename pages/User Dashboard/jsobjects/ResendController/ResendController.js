export default {

  // ----------------------------------------------------
  // 1️⃣ Validate selected failed rows
  // ----------------------------------------------------
  validateSelection() {
    const rows = tblJobs.selectedRows;

    if (!rows || rows.length === 0) {
      showAlert("Please select at least one failed email to resend.", "warning");
      return null;
    }

    return rows;
  },

  // ----------------------------------------------------
  // 2️⃣ Prepare selected failed logs for resend
  // - Regenerate message_hash
  // - Reset status to pending
  // - Save in Appsmith store
  // ----------------------------------------------------
  async prepareResendData() {
    try {
      const selected = this.validateSelection();
      if (!selected) return;

      const timestamp = moment().format("YYYYMMDD-HHmmss");

      // Build new log dataset
      const finalData = selected.map(row => ({
        ...row,
        status: "pending",        // reset status
        message_hash: `${row.message_hash}-RESEND-${timestamp}`,
        created_at: moment().format("YYYY-MM-DD HH:mm:ss")
      }));

      // Save the final resend-ready dataset
      await storeValue("resendBatch", finalData);

      // Open confirmation modal
      showModal("ModalConfirmResend");

    } catch (error) {
      console.error("prepareResendData Error:", error);
      showAlert("Failed to prepare resend data.", "error");
    }
  },


  // ----------------------------------------------------
  // 3️⃣ Confirm resend (called from modal button)
  // - Create new job
  // - Insert new logs
  // - Mark old logs as 'resent'
  // ----------------------------------------------------
  async confirmResend() {
    try {
      const data = appsmith.store.resendBatch || [];

      if (!data.length) {
        showAlert("No resend data found.", "warning");
        return;
      }

      // 3.1 — Create new job record
      const jobResult = await insertEmailJob.run();
      const job_id = jobResult[0]?.job_id;

      if (!job_id) {
        showAlert("Failed to create resend job.", "error");
        return;
      }

      await storeValue("currentJobId", job_id);

      // 3.2 — Insert new logs
      await storeValue("mergedData", data); 
      await insertEmailLogs.run();

      // 3.3 — Update original failed logs to "resent"
      const selectedFailed = tblJobs.selectedRows || [];

      for (const row of selectedFailed) {
        await updateLogStatus.run({
          log_id: row.id, // MUST point to primary key column
          updated_by: appsmith.store.currentUser.email
        });
      }

      closeModal("ModalConfirmResend");

      showAlert(`Successfully resent ${data.length} email(s).`, "success");

    } catch (error) {
      console.error("confirmResend Error:", error);
      showAlert("Error confirming resend. Check console.", "error");
    }
  }

};
