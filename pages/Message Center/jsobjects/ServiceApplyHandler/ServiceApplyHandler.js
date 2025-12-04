export default {
  addServiceToMergedData: async () => {

    // 1️⃣ Selected payment type from dropdown
    const selectedPaymentType = Dropdown1.selectedOptionValue;
    const selectedPaymentLabel = Dropdown1.selectedOptionLabel;

    if (!selectedPaymentType) {
      showAlert("⚠️ Please select a valid payment type.", "warning");
      return;
    }

    // 2️⃣ Ensure getAllTemplates.data is an array
    const templateList = Array.isArray(getAllTemplates.data) ? getAllTemplates.data : [];

    // 3️⃣ Find template
    const template = templateList.find(
      t => t.payment_type?.toLowerCase().trim() === selectedPaymentType.toLowerCase().trim()
    );

    if (!template) {
      showAlert("⚠️ No matching template found for the selected payment type.", "warning");
      return;   // ❌ STOP EXECUTION (fix for your bug)
    }

    // 4️⃣ Get staff merged data
    const currentData = appsmith.store.mergedData || [];

    if (currentData.length === 0) {
      showAlert("⚠️ No data found in MergedTableFinal.", "warning");
      return;
    }

    // 5️⃣ Apply the template_id & payment type
    const updatedData = currentData.map(item => ({
      ...item,
      payment_type: selectedPaymentType,
      template_id: template.template_id
    }));

    // 6️⃣ Save updated dataset
    await storeValue("mergedData", updatedData);

    // 7️⃣ Confirmation
    showAlert(
      `✅ '${selectedPaymentLabel}' applied using Template ID ${template.template_id}.`,
      "success"
    );

    console.log("Updated merged data:", updatedData);
  }
};
