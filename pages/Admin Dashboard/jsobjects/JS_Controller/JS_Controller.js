export default {
  view: "jobs",   // default page

  setView(type) {
    this.view = type;
    if(type === "jobs") {
      getAllJobs.run();
    } else if(type === "logs") {
      getAllLogs.run();
    }
  },

  getTableData() {
    if(this.view === "jobs") {
      return getAllJobs.data;
    } else if(this.view === "logs") {
      return getAllLogs.data;
    }
  }
}
