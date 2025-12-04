export default {
  async login() {
    try {
      // 1️⃣ Fetch user by email
      await getUserByEmail.run();

      if (getUserByEmail.data.length === 0) {
        showAlert("❌ Invalid email or password", "error");
        return;
      }

      const user = getUserByEmail.data[0];

      // 2️⃣ Check if account is active
      if (!user.status) {
        showAlert("⚠️ Account is disabled. Contact admin.", "warning");
        return;
      }

      // 3️⃣ Compare plain passwords directly (since no hashing yet)
      const enteredPassword = inp_password.text.trim();
      const storedPassword = user.password_hash.trim();

      if (enteredPassword !== storedPassword) {
        showAlert("❌ Invalid email or password", "error");
        return;
      }

      // 4️⃣ Store user details in Appsmith store
      await storeValue("currentUser", {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      });

      showAlert(`✅ Welcome, ${user.full_name}`, "success");

      // 5️⃣ Redirect based on role (same page but different permissions)
    if (user.role === "admin") {
  navigateTo("Admin Dashboard");
} else if (user.role === "user") {
  navigateTo("User Dashboard");
} else {
  showAlert("⚠️ Unknown role. Please contact admin.", "warning");
  return;
}
    } catch (error) {
      console.error("Login Error:", error);
      showAlert("An error occurred during login.", "error");
    }
  },
	
	  async logout() {
    try {
      // 🧹 Clear all stored session data
      await removeValue("currentUser");

      // Optionally clear other stored app data (uncomment if needed)
      // await removeValue("mergedData");
      // await removeValue("newVersion");

      // ✅ Notify user
      showAlert("👋 You've been logged out successfully.", "success");

      // 🔁 Redirect back to login page
      navigateTo("LoginPage");
    } catch (error) {
      showAlert("Error during logout.", "error");
      console.error("Logout Error:", error);
    }
  },

};
