export default {
  generateVersionCode(paymentType, subject) {
    // Clean and ensure minimum length
    const typePart = (paymentType || "").trim().slice(0, 2).toUpperCase();
    const subjectPart = (subject || "").trim().slice(-2).toLowerCase();

    // Get current date parts
    const now = new Date();
    const year = now.getFullYear(); // e.g., 2025
    const month = (now.getMonth() + 1).toString().padStart(2, "0"); // e.g., 10
    const day = now.getDate().toString().padStart(2, "0"); // e.g., 27

    // Create date code (YYYYMMDD)
    const datePart = `${year}${month}${day}`;

    // Add a random 2-digit suffix to ensure uniqueness
    const randomPart = Math.floor(Math.random() * 90 + 10); // 10–99

    // Final version code (example: "LOnt20251027-42")
    const versionCode = `${typePart}${subjectPart}${datePart}-${randomPart}`;
    return versionCode;
  },

 async saveTemplate() {
  try {
    // Auto-fill default message ONLY if user left it blank
    if (!Input3.text || Input3.text.trim() === "") {
      Input3.setValue(
        "Hello {{full_name}}, your payment of {{amount}} for {{payment_type}} has been received."
      );
    }

     // STRICT VALIDATION — nothing moves forward if ANY field is empty
    const paymentType = Input1.text?.trim();
    const subject = Input2.text?.trim();
    const body = Input3.text?.trim();

    let missing = [];

    if (!paymentType) missing.push("Payment Type");
    if (!subject) missing.push("Subject");
    if (!body) missing.push("Body");

    if (missing.length > 0) {
      showAlert(
        `🟥 🟥 🟥Please fill in the following field(s): ${missing.join("  And  ")}.`,
        "warning"
      );
      return; //  STOP — do not continue
    }


    //  Check duplicates
    await checkExistingTemplate.run();
    if (checkExistingTemplate.data.length > 0) {
      showAlert(
        `A template for "${Input1.text}" with the subject "${Input2.text}" already exists.`,
        "warning"
      );
      return;
    }

    //  Generate version code
    const versionCode = this.generateVersionCode(Input1.text, Input2.text);
    storeValue("newVersion", versionCode);

    //  Save to DB
    await insertTemplate.run();
    await getLatestTemplate.run(); // refresh preview

    // Notify success
    showAlert(
      `Template saved successfully with version ${versionCode}`,
      "success"
    );

  } catch (error) {
    showAlert("Error saving template. Please check console.", "error");
    console.error(error);
  }
}
}
