export default {
  view: "logs",

  setView(type) {
    this.view = type;

    if (type === "logs") {
      getAllLogs.run();
    }
    else if (type === "failed") {
      getFailedLogs.run();
    }
    else if (type === "pending") {
      getPendingLogs.run();   // 🟩 NEW QUERY
    }
  },

  getTableData() {
    if (this.view === "logs") {
      return getAllLogs.data;
    }
    else if (this.view === "failed") {
      return getFailedLogs.data;
    }
    else if (this.view === "pending") {
      return getPendingLogs.data; // 🟩 NEW
    }

    return [];
  }
};
