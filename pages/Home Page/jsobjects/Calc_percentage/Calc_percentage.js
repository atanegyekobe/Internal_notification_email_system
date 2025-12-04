export default {
  successRate() {
    // Prevent errors when data is still loading
    if (!all_messages.data || !successful_messages.data) {
      return 0;
    }

    const total = all_messages.data[0]?.total_messages ?? 0;
    const success = successful_messages.data[0]?.total_messages ?? 0;

    if (total === 0) return 0;

    return Math.round((success / total) * 100);
  },

  pendingRate() {
    if (!all_messages.data || !pending_messages.data) {
      return 0;
    }

    const total = all_messages.data[0]?.total_messages ?? 0;
    const pending = pending_messages.data[0]?.total_messages ?? 0;

    if (total === 0) return 0;

    return Math.round((pending / total) * 100);
  }
};
