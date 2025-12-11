export default {

	// -------------------------------------------------------
	// 1) Generate unique batch reference
	// -------------------------------------------------------
	generateBatchRef(paymentType) {
		const cleanType = (paymentType || "GEN").replace(/\s+/g, "-");
		const timestamp = moment().valueOf();
		const randomSuffix = Math.floor(1000 + Math.random() * 9000);
		return `BATCH-${cleanType}-${timestamp}-${randomSuffix}`;
	},

	// -------------------------------------------------------
	// 2) Single hash function (Normal + Duplicate)
	// -------------------------------------------------------
// -------------------------------------------------------
// 2) Single hash function (Normal + Duplicate)
// -------------------------------------------------------
async generateMessageHash(row, isDuplicate = false) {
  try {
    console.log("🔵 (Hash) Generating hash for row:", row);

    if (!row || typeof row !== "object") {
      console.error("❌ (Hash) Invalid row:", row);
      return "HASH_ERROR";
    }

    const { TextEncoder } = window;

    const staffId = row.staff_ids ?? "NO_ID";
    const email = row.email ?? "NO_EMAIL";
    const paymentType = row.payment_type ?? "NO_TYPE";
    const amount = row.amount ?? 0;

    // Base raw string
    let raw = `${staffId}_${email}_${paymentType}_${amount}`;

    // Add timestamp for duplicate hashing
    if (isDuplicate) {
      raw += `_${Date.now()}`;
    }

    // Hash execution
    const buffer = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(raw)
    );

    const hash = Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    console.log("🟢 (Hash) SUCCESS:", hash);
    return hash;

  } catch (err) {
    console.error("❌ (Hash) ERROR:", err);
    return "HASH_ERROR";
  }
},

	// -------------------------------------------------------
	// 3) PREPARE BATCH
	// -------------------------------------------------------
	async prepareBatch() {
		try {
			const data = appsmith.store.mergedData || [];
			console.log("🟦 prepareBatch() called. Data:", data);

			if (!data.length) {
				showAlert("⚠️ No records found.", "warning");
				return;
			}

			const paymentType = data[0]?.payment_type || "GEN";
			const batchRef = this.generateBatchRef(paymentType);

			console.log("🟩 Generated BatchRef:", batchRef);
			await storeValue("currentBatchRef", batchRef);

			const updated = data.map(row => ({
				...row,
				batch_ref: batchRef,
				created_at: moment().format("YYYY-MM-DD HH:mm:ss")
			}));

			await storeValue("mergedData", updated);

			showAlert(`✅ Batch prepared: ${batchRef}`, "success");

		} catch (err) {
			console.error("❌ prepareBatch ERROR:", err);
			showAlert("❌ Failed to prepare batch.", "error");
		}
	},

	// -------------------------------------------------------
	// 4) MAIN ENTRY — sendBatch()
	// -------------------------------------------------------
	async sendBatch() {
		try {
			console.log("🟦 sendBatch() started");

			const data = appsmith.store.mergedData || [];
			console.log("📌 mergedData:", data);

			if (!data.length)
				return showAlert("⚠️ No records to send.");

			const validRows = data.filter(r =>
																		r &&
																		r.email &&
																		r.payment_type &&
																		r.amount !== undefined &&
																		r.template_id
																	 );

			console.log("🧹 validRows after cleaning:", validRows);

			if (!validRows.length)
				return showAlert("❌ No valid rows found.", "error");

			const hashed = [];
			for (const row of validRows) {
				console.log("🔵 Generating hash for:", row);
				const hash = await this.generateMessageHash(row, false);

				if (hash === "HASH_ERROR") {
					showAlert("❌ Hash generation failed.", "error");
					console.error("❌ Hash FAILED for row:", row);
				}

				const finalRow = { ...row, message_hash: hash, created_by: appsmith.user.email };
				hashed.push(finalRow);

				console.log("🟢 FINAL HASHED ROW:", finalRow);
			}

			await storeValue("hashedTemp", hashed);
			console.log("📝 hashedTemp stored:", hashed);

			for (const row of hashed) {
				if (!row.message_hash || row.message_hash === "HASH_ERROR") {
					console.error("❌ Hash missing on row:", row);
					return showAlert("❌ Missing hash in row.", "error");
				}
			}

			const hashes = hashed.map(r => r.message_hash);
			console.log("🔍 Checking duplicates for hashes:", hashes);

			const duplicates = await checkDuplicateHashes.run({
				messageHashesArray: hashes
			});

			console.log("🟠 Duplicate query result:", duplicates);

			if (duplicates.length > 0) {
				console.log("🛑 DUPLICATES FOUND:", duplicates);
				showAlert("⚠️ Duplicate records detected.", "warning");

				return this.prepareDuplicateBatch(hashed, duplicates.length);
			}

			console.log("🟢 NO DUPLICATES. Proceeding to normal batch.");
			return this.sendNormalBatch(hashed);

		} catch (err) {
			console.error("❌ sendBatch ERROR:", err);
			showAlert("❌ Failed in sendBatch().", "error");
		}
	},

	// -------------------------------------------------------
	// 5) NORMAL BATCH
	// -------------------------------------------------------
	async sendNormalBatch(rows) {
		try {
			console.log("🚀 sendNormalBatch() rows:", rows);

			const batchRef = appsmith.store.currentBatchRef;
			const now = moment().format("YYYY-MM-DD HH:mm:ss");

			const finalRows = rows.map(r => ({
				...r,
				batch_ref: batchRef,
				created_at: now
			}));

			console.log("🟢 FinalRows being inserted:", finalRows);

			await storeValue("finalBatchData", finalRows);

			const jobResult = await insertEmailJob.run();
			console.log("🟦 Job created:", jobResult);

			const job_id = jobResult?.[0]?.job_id;
			if (!job_id) {
				console.error("❌ No job_id returned");
				return showAlert("❌ Failed to create job.");
			}

			await storeValue("currentJobId", job_id);
			await insertEmailLogs.run();
			
			 // 🧹 CLEANUP (IMPORTANT)
    await storeValue("finalBatchData", []);
    await storeValue("duplicateBatchData", []);
		
			showAlert(`📨 ${finalRows.length} emails queued.`, "success");

		} catch (err) {
			console.error("❌ Normal batch error:", err);
			showAlert("❌ Failed to send normal batch.", "error");
		}
	},

	// -------------------------------------------------------
	// 6) PREPARE DUPLICATE BATCH
	// -------------------------------------------------------
	async prepareDuplicateBatch(originalRows, duplicateCount) {
		try {
			const paymentType = originalRows[0]?.payment_type || "GEN";
			const newBatchRef = this.generateBatchRef(paymentType);
			const now = moment().format("YYYY-MM-DD HH:mm:ss");

			console.log("🟧 prepareDuplicateBatch() called. Rows:", originalRows.length);

			const updatedRows = [];

			for (let i = 0; i < originalRows.length; i++) {
				const row = originalRows[i];

				console.log(`🔵 (Hash) Generating salted hash for row ${i + 1}/${originalRows.length}:`, row);

				// ✅ FIXED — correct function call
				const newHash = await this.generateMessageHash(row, true);

				console.log("🟢 (Hash) Salted SUCCESS:", newHash);

				updatedRows.push({
					...row,
					message_hash: newHash,
					batch_ref: newBatchRef,
					created_at: now,
					created_by: appsmith.user.email
				});
			}

			console.log("🟢 duplicateBatchData (FULL):", updatedRows);

			await storeValue("duplicateBatchData", updatedRows);

			// 🔥 IMPORTANT FIX — update mergedData so next sendBatch sees new hashes
			await storeValue("mergedData", updatedRows);

			await storeValue("duplicateSummary", {
				duplicateCount,
				totalRows: originalRows.length,
				payment_type: paymentType,
				created_by: appsmith.user.email,
				newBatchRef
			});


			showModal("DuplicateBatchModal");

		} catch (err) {
			console.error("prepareDuplicateBatch error:", err);
			showAlert("❌ Failed to prepare duplicate batch.", "error");
		}
	},

	// -------------------------------------------------------
	// 7) SEND DUPLICATE BATCH
	// -------------------------------------------------------
	async sendDuplicateBatch() {
		try {
			const finalRows = appsmith.store.duplicateBatchData || [];
			console.log("🚀 Sending duplicate batch:", finalRows);

			if (!finalRows.length)
				return showAlert("❌ No duplicate batch data found.");

			const jobResult = await insertEmailJob.run();
			console.log("🟦 Duplicate job created:", jobResult);

			const job_id = jobResult?.[0]?.job_id;

			if (!job_id)
				return showAlert("❌ Failed to create duplicate job.");

			await storeValue("currentJobId", job_id);
			await insertEmailLogs.run();

			closeModal("DuplicateBatchModal");
			
			// 🧹 CLEANUP (IMPORTANT)
  	  await storeValue("duplicateBatchData", []);
  	  await storeValue("finalBatchData", []);
			
			showAlert(`📨 Duplicate batch sent successfully. Rows: ${finalRows.length}`, "success");

		} catch (err) {
			console.error("❌ sendDuplicateBatch error:", err);
			showAlert("❌ Failed to send duplicate batch.", "error");
		}
	}

};
