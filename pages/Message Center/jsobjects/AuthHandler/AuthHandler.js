export default {
	  async logout() {
    try {
      // 🧹 Clear all stored session data
      await removeValue("currentUser");

      // Optionally clear other stored app data (uncomment if needed)
       await removeValue("mergedData");
       await removeValue("newVersion");

      // ✅ Notify user
      showAlert("👋 You've been logged out successfully.", "success");

      // 🔁 Redirect back to login page
      navigateTo("Login");
    } catch (error) {
      showAlert("Error during logout.", "error");
      console.error("Logout Error:", error);
    }
  },

};
