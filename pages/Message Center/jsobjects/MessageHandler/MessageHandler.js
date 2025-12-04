export default {
  generateMessage: async () => {
    // 1️⃣ Get selected payment type (this corresponds to email_templates.payment_type)
    const selectedPaymentType = Dropdown1.selectedOptionValue;
    const selectedPaymentLabel = Dropdown1.selectedOptionLabel;

    if (!selectedPaymentType) {
      showAlert("⚠️ Please select a payment type first.");
      return;
    }

    // 2️⃣ Get the email template data from getAllTemplates (already loaded)
  const templates = getAllTemplates.data || [];

// Try to find by payment_type or fallback to id
const template = templates.find(
  t => t.payment_type.toLowerCase().trim() === selectedPaymentType.toLowerCase().trim()
);



    if (!template) {
      showAlert("⚠️ No message template found for this payment type.");
      return;
    }

    // 3️⃣ Get staff data (mergedData from Appsmith store)
    const staffList = appsmith.store.mergedData;

    if (!staffList || staffList.length === 0) {
      showAlert("⚠️ No staff data found in MergedTableFinal.");
      return;
    }

    // 4️⃣ Pick the first staff record for preview (for demonstration)
    const firstStaff = staffList[0];
    const { full_name, amount } = firstStaff;

    // 5️⃣ Get the message body from the email template
    const messageTemplate = template.body || 
      'Hello  {{full_name}}, your payment of {{amount}} for {{payment_type}} has been received.';

    // 6️⃣ Replace placeholders with real data
    const finalMessage = messageTemplate
      .replace(/{{\s*full_name\s*}}/g, full_name)
      .replace(/{{\s*amount\s*}}/g, amount)
      .replace(/{{\s*payment_type\s*}}/g, selectedPaymentLabel);

    // 7️⃣ Display message in preview Text widget or return it
    return finalMessage;
  }
};
