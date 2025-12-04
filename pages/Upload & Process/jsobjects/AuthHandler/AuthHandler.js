export default {
  async logout() {
    try {
      // Clear the stored user session
      await removeValue("currentUser");

      showAlert("👋 You've been logged out successfully.", "success");

      // Redirect to login page
      navigateTo("Login");
    } catch (error) {
      showAlert("Error during logout.", "error");
      console.error("Logout Error:", error);
    }
  },
};
