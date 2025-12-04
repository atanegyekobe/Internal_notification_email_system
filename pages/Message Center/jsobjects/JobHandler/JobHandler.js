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
      if (!data.length) {
        showAlert("⚠️ No records to send.", "warning");
        return;
      }

      if (!appsmith.store.currentBatchRef) {
        showAlert("⚠️ Please prepare batch first.", "warning");
        return;
      }

      /* 🟩 1 — Prevent duplicate batch_ref
      await checkBatchRefExists.run();
      if (checkBatchRefExists.data.length > 0) {
        showAlert(
          `⚠️ Batch ${appsmith.store.currentBatchRef} already exists.\nPlease generate a new batch.`,
          "warning"
        );
        return;
      }
			*/

      // 🟩 2 — Generate message_hash for all rows
      const logsWithHashes = [];
      for (const row of data) {
        const hash = await this.generateMessageHash(row);
        logsWithHashes.push({ ...row, message_hash: hash });
      }

      // 🟩 3 — Check for duplicates
     const existing = await checkExistingHashes.run({
  hash_list: logsWithHashes.map(r => r.message_hash),
});

// 🟩 FIX — accept both array and object responses
const rows = Array.isArray(existing)
  ? existing
  : existing?.response || [];

			
const existingHashes = new Set(
  rows.map((h) => h.message_hash)
);


      const duplicates = logsWithHashes.filter(log =>
        existingHashes.has(log.message_hash)
      );

      const uniqueLogs = logsWithHashes.filter(
        log => !existingHashes.has(log.message_hash)
      );

      // 🟩 4 — IF DUPLICATES FOUND → open modal and STOP here
      if (duplicates.length > 0) {
        await storeValue("duplicateCount", duplicates.length);
        await storeValue("duplicateOriginalLogs", duplicates);
        await storeValue("duplicateUniqueLogs", uniqueLogs);

        showModal("ModalConfirmDuplicate");
        return; // ⛔ STOP — wait for user confirmation
      }

      // 🟩 5 — No duplicates → continue normally
      await storeValue("mergedData", uniqueLogs);

      // Insert job
      const jobResult = await insertEmailJob.run();
      const job_id = jobResult[0]?.job_id;

      if (!job_id) {
        showAlert("❌ Failed to create job record.", "error");
        return;
      }

      await storeValue("currentJobId", job_id);

      // Insert logs
      await insertEmailLogs.run();

      showAlert(
        `📨 Emails queued: ${uniqueLogs.length}. Job ID: ${job_id}`,
        "success"
      );

      return true;

    } catch (error) {
      console.error("Send Batch Error:", error);
      showAlert("❌ Failed to queue emails. Check console.", "error");
      return false;
    }
  },

  // -------------------------------------------------------
  // CONFIRM DUPLICATE — User clicked YES in modal
  // -------------------------------------------------------
  async confirmSendDuplicates() {
    try {
      const duplicates = appsmith.store.duplicateOriginalLogs || [];
      const uniqueLogs = appsmith.store.duplicateUniqueLogs || [];

      if (!duplicates.length) {
        showAlert("No duplicates found to process.", "info");
        return;
      }

      // 🟩 Convert duplicates → append timestamp to hash
      const timestamp = moment().format("YYYYMMDD-HHmmss");

      const fixedDuplicates = duplicates.map((d) => ({
        ...d,
        message_hash: `${d.message_hash}-${timestamp}`
      }));

      const finalLogs = [...uniqueLogs, ...fixedDuplicates];

      // Save
      await storeValue("mergedData", finalLogs);

      closeModal("ModalConfirmDuplicate");

      // Continue sending
      await this._sendApprovedBatch(finalLogs);

    } catch (error) {
      console.error("❌ confirmSendDuplicates Error:", error);
      showAlert("Error confirming duplicates.", "error");
    }
  },

  // -------------------------------------------------------
  // FINAL SEND PROCESS AFTER APPROVAL
  // -------------------------------------------------------
	
  async _sendApprovedBatch(finalLogs) {
    try {
      console.log("DEBUG → finalLogs received:", finalLogs);

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

      console.log("DEBUG → New batch_ref:", newBatchRef);

      const jobResult = await insertEmailJob.run();

      console.log("DEBUG → jobResult:", jobResult);

      const job_id = jobResult?.[0]?.job_id;

      console.log("DEBUG → extracted job_id:", job_id);

      if (!job_id) {
        showAlert("❌ Failed to create job.", "error");
        return;
      }

      await storeValue("currentJobId", job_id);

      await storeValue("mergedData", logsWithNewBatch);

      console.log("DEBUG → mergedData saved to store:", appsmith.store.mergedData);

      const insertResult = await insertEmailLogs.run();

      console.log("DEBUG → insertEmailLogs result:", insertResult);

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
