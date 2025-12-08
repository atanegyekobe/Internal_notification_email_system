export default {

  // -------------------------------------------------------
  // 1) Generate a globally unique and safe batch reference
  // -------------------------------------------------------
  generateBatchRef(paymentType) {
    const cleanType = (paymentType || "GEN").replace(/\s+/g, "-");
    const timestamp = moment().format("YYYYMMDD-HHmmss-SSS");
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `BATCH-${cleanType}-${timestamp}-${randomSuffix}`;
  },

  // -------------------------------------------------------
  // 2) Prepare Batch (Assign batch_ref + created_at)
  // -------------------------------------------------------
  async prepareBatch() {
    try {
      const data = appsmith.store.mergedData || [];
      if (!data.length) {
        showAlert("⚠️ No records found in MergedTableFinal.", "warning");
        return;
      }

      const paymentType = Dropdown1.selectedOptionValue || "PAYMENT";
      const batchRef = this.generateBatchRef(paymentType);

      await storeValue("currentBatchRef", batchRef);

      const updatedData = data.map(row => ({
        ...row,
        batch_ref: batchRef,
        created_at: moment().format("YYYY-MM-DD HH:mm:ss")
      }));

      await storeValue("mergedData", updatedData);

      showAlert(`✅ Batch ${batchRef} prepared successfully for all records.`, "success");

    } catch (error) {
      console.error("Batch Preparation Error:", error);
      showAlert("❌ Error preparing batch. Check console.", "error");
    }
  },

  // -------------------------------------------------------
  // Generate SHA-256 Message Hash
  // -------------------------------------------------------
  async generateMessageHash(row) {
    try {
      if (!row) return "NO-ROW";

      const { TextEncoder } = window;

      const recipientId = row.staff_ids ?? "NO_ID";
      const recipientEmail = row.email ?? "NO_EMAIL";
      const paymentType = row.payment_type ?? "NO_TYPE";
      const paymentAmount = row.amount ?? 0;

      const rawString = `${recipientId}_${recipientEmail}_${paymentType}_${paymentAmount}`;

      const encoder = new TextEncoder();
      const data = encoder.encode(rawString);

      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

      return hashHex;

    } catch (error) {
      console.error("❌ Hash generation failed:", error);
      return "HASH-ERROR";
    }
  },

  // -------------------------------------------------------
  // 3) Main Send Batch Handler
  // -------------------------------------------------------
  async sendBatch() {
    try {
      const data = appsmith.store.mergedData || [];

      // 🛑 Prevent sending failed-email data as new batch
      if (data.length && data[0]?.original_id) {
        showAlert("❌ Failed-email data detected. Load fresh staff data before sending.", "error");
        return;
      }

      if (!data.length) {
        showAlert("⚠️ No records to send.", "warning");
        return;
      }

      if (!appsmith.store.currentBatchRef) {
        showAlert("⚠️ Please prepare batch first.", "warning");
        return;
      }

      // Generate message hashes
      const logsWithHashes = [];
      for (const row of data) {
        const hash = await this.generateMessageHash(row);
        logsWithHashes.push({ ...row, message_hash: hash });
      }

      // Check duplicates
      const existing = await checkExistingHashes.run({
        hash_list: logsWithHashes.map(r => r.message_hash),
      });

      const rows = Array.isArray(existing)
        ? existing
        : existing?.data || [];

      const existingHashes = new Set(rows.map(h => h.message_hash));

      const duplicates = logsWithHashes.filter(log =>
        existingHashes.has(log.message_hash)
      );

      const uniqueLogs = logsWithHashes.filter(
        log => !existingHashes.has(log.message_hash)
      );

      // Duplicate modal trigger
      if (duplicates.length > 0) {
        await storeValue("duplicateCount", duplicates.length);
        await storeValue("duplicates", duplicates);
        await storeValue("uniqueLogs", uniqueLogs);

        await storeValue(
          "duplicateMessage",
          `⚠️ ${duplicates.length} duplicate messages detected.\nDo you want to resend them?`
        );

        showModal("ModalConfirmDuplicate");
        return;
      }

      // No duplicates — continue
      await storeValue("mergedData", uniqueLogs);

      const jobResult = await insertEmailJob.run();
      const job_id = jobResult[0]?.job_id;

      if (!job_id) {
        showAlert("❌ Failed to create job record.", "error");
        return;
      }

      await storeValue("currentJobId", job_id);

      await insertEmailLogs.run();

      showAlert(`📨 Emails queued: ${uniqueLogs.length}. Job ID: ${job_id}`, "success");
      return true;

    } catch (error) {
      console.error("Send Batch Error:", error);
      showAlert("❌ Failed to queue emails. Check console.", "error");
      return false;
    }
  },

  // -------------------------------------------------------
  // 4) CONFIRM DUPLICATE — User clicked YES
  // -------------------------------------------------------
  async confirmSendDuplicates() {
    try {
      const duplicates = appsmith.store.duplicates || [];
      const uniqueLogs = appsmith.store.uniqueLogs || [];

      if (!duplicates.length) {
        showAlert("No duplicates found to process.", "info");
        return;
      }

      const timestamp = moment().format("YYYYMMDD-HHmmss");

      const fixedDuplicates = duplicates.map(d => ({
        ...d,
        message_hash: `${d.message_hash}-${timestamp}`
      }));

      const finalLogs = [...uniqueLogs, ...fixedDuplicates];

      await storeValue("mergedData", finalLogs);

      closeModal("ModalConfirmDuplicate");

      await this._sendApprovedBatch(finalLogs);

    } catch (error) {
      console.error("❌ confirmSendDuplicates Error:", error);
      showAlert("Error confirming duplicates.", "error");
    }
  },

  // -------------------------------------------------------
  // FINAL SEND PROCESS
  // -------------------------------------------------------
  async _sendApprovedBatch(finalLogs) {
    try {
      if (!finalLogs || finalLogs.length === 0) {
        showAlert("⚠️ No logs to send.", "warning");
        return;
      }

      const paymentType = Dropdown1.selectedOptionValue || "PAYMENT";
      const newBatchRef = this.generateBatchRef(paymentType);

      const logsWithNewBatch = finalLogs.map(log => ({
        ...log,
        batch_ref: newBatchRef,
        created_at: moment().format("YYYY-MM-DD HH:mm:ss")
      }));

      await storeValue("currentBatchRef", newBatchRef);

      const jobResult = await insertEmailJob.run();
      const job_id = jobResult?.[0]?.job_id;

      if (!job_id) {
        showAlert("❌ Failed to create job.", "error");
        return;
      }

      await storeValue("currentJobId", job_id);
      await storeValue("mergedData", logsWithNewBatch);

      await insertEmailLogs.run();

      showAlert(
        `📨 Emails queued: ${logsWithNewBatch.length}. Job ID: ${job_id}`,
        "success"
      );

    } catch (error) {
      console.error("❌ _sendApprovedBatch Error:", error);
      showAlert("Error sending approved batch.", "error");
    }
  }

};
