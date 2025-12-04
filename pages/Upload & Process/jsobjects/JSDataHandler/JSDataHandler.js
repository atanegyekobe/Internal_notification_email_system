export default {
  parseAndFetch: async () => {
    const rawInput = Text4.text.trim();

    // Split by newlines (each line = one staff entry)
    const staffEntries = rawInput.split(/\n+/).map(line => line.trim()).filter(Boolean);

    // Extract staff_id and amount from each line
    const parsedData = staffEntries.map(entry => {
      // Split only on the first space
      const [staffId, ...amountParts] = entry.split(/\s+/);
      const amountStr = amountParts.join(' '); // keep spacing and punctuation intact

      return {
        staffId: staffId?.trim(),
        amount: amountStr ? amountStr.trim() : null  // store the original format
      };
    }).filter(item => item.staffId);

    console.log("Parsed staff data:", parsedData);

    // Extract only staff IDs for the FetchStaff query
    const staffIds = parsedData.map(item => item.staffId);

    // Fetch staff details based on IDs
    const staffDetails = await FetchStaff.run({ ids: staffIds });

    // Merge fetched staff details with their formatted amounts
    const mergedData = staffDetails.map(staff => {
      const match = parsedData.find(item => item.staffId === String(staff.staff_ids));
      return { ...staff, amount: match ? match.amount : null };
    });

    storeValue("mergedData", mergedData);

    console.log("Merged data stored:", mergedData);

    return mergedData;
  }
};
