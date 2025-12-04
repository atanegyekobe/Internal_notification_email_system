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
  },

  getTableData() {
    if (this.view === "logs") {
      return getAllLogs.data;
    }
    else if (this.view === "failed") {
      return getFailedLogs.data;
    }

    return [];
  }
};
